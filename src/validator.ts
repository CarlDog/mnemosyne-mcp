// LLM-driven validation pass. Used by mnemo_continue when validate=true.
//
// Architecture decision (ARCHITECTURE.md §3): validation is an LLM second
// pass orchestrated by Mnemosyne, not a deterministic checker. v2's
// ConsistencyChecker was deterministic and brittle; LLMs handle "does
// this respect the established melancholic third-limited POV?" naturally.
//
// The validator gets a constraints block (rules, style, characters,
// locations — the things continuity is checked against) plus the new
// content, and returns a structured verdict.
//
// JSON parsing tolerates the common LLM tic of wrapping JSON in markdown
// code fences. Factored once per the v2 retro lesson (v2 had this helper
// duplicated across four validators).

import { z } from "zod";
import { supportsStructuredOutput, type LlmProvider } from "./llm.js";
import type { ContextBundle } from "./prompt.js";
import { neutralizeSectionDelimiters } from "./prompt.js";

// Runtime verdict schema (docs/OLLAMA_ADOPTION_ASSESSMENT.md §3). The shape
// used to exist only inside the prompt plus a generic cast, so a malformed
// issue survived parsing and a misspelled severity could never equal
// "error" -- classifyVerdict() then reported clean. Strict: no extra fields
// at either level, nonempty rule/quote/explanation, severity a closed enum.
// A schema violation is a FAILED validation pass, never an empty report.
const ValidationIssueSchema = z
  .object({
    severity: z.enum(["error", "warning", "info"]),
    rule: z.string().min(1),
    violating_text: z.string().min(1),
    explanation: z.string().min(1),
  })
  .strict();

export const ValidationReportSchema = z
  .object({
    issues: z.array(ValidationIssueSchema),
    summary: z.string(),
  })
  .strict();

export type ValidationIssue = z.infer<typeof ValidationIssueSchema>;
export type ValidationReport = z.infer<typeof ValidationReportSchema>;

// The same contract as literal JSON Schema, sent as Ollama's top-level
// `format` field so the daemon constrains generation to the shape (verified
// accepted and enforced against the deployed daemon, 0.32.15, 2026-08-28).
// Hand-maintained rather than derived: this repo is on zod 3, which has no
// toJSONSchema (assessment's explicit guidance -- do not upgrade zod for
// this). tests/validator-schema.test.ts pins the two copies against each
// other so they cannot drift silently.
export const VALIDATION_REPORT_JSON_SCHEMA = {
  type: "object",
  properties: {
    issues: {
      type: "array",
      items: {
        type: "object",
        properties: {
          severity: { type: "string", enum: ["error", "warning", "info"] },
          rule: { type: "string", minLength: 1 },
          violating_text: { type: "string", minLength: 1 },
          explanation: { type: "string", minLength: 1 },
        },
        required: ["severity", "rule", "violating_text", "explanation"],
        additionalProperties: false,
      },
    },
    summary: { type: "string" },
  },
  required: ["issues", "summary"],
  additionalProperties: false,
} as const;

// Single source of truth for the clean/errors split used to tag saved scenes
// (v0.1.3 validator-gated inclusion — see STATUS.md). "clean" allows warnings
// through; any error tips it to "errors".
export function classifyVerdict(report: ValidationReport): "clean" | "errors" {
  return report.issues.some((i) => i.severity === "error") ? "errors" : "clean";
}

const VALIDATOR_TEMPERATURE = 0.2;
const VALIDATOR_MAX_TOKENS = 1024;

// Two-step prompt: enumerate constraints, then check each independently.
//
// The v0.1.0 prompt let the LLM "evaluate" abstractly, which produced
// fabricated objections (reporting "she" as first-person, etc.). v0.1.1
// added quote-and-match. v0.1.2 fixes the next failure mode: a single
// rule entry often states multiple distinct constraints (e.g., "third-
// person past tense from Aria's perspective" = three constraints), and
// the validator was catching the most prominent one and stopping.
// Forcing explicit enumeration in step 1 then a per-constraint walk in
// step 2 makes the validator check each axis independently.
const SYSTEM_PROMPT = `You are a story consistency checker.

STEP 1 (enumerate constraints): Read the established context. For the rules and style sections specifically, identify each distinct CONSTRAINT. A single rule entry often states several constraints — for example, "third-person past tense from Aria's perspective" contains three distinct constraints: (a) third-person, (b) past tense, (c) Aria's perspective only. Enumerate every constraint independently. Do not collapse them.

STEP 2 (per-constraint walk): For EACH constraint enumerated in step 1, walk through the new content and find specific text fragments that violate that constraint. Quote the violating text directly — copy it character-for-character from the new content, do not paraphrase.

A constraint has been violated only if you can quote the specific words from the new content that break it. If you cannot find a direct quote, do NOT report a violation. Do not invent or generalize.

Same logic applies for established characters and locations: if the new content describes them in a way that contradicts what the established context says, quote the contradicting text.

Return ONLY valid JSON in this shape:
{
  "issues": [
    {
      "severity": "error" | "warning" | "info",
      "rule": "<the specific constraint violated, paraphrased from the rule text>",
      "violating_text": "<exact quote from the new content>",
      "explanation": "<one sentence: why this quote violates that constraint>"
    }
  ],
  "summary": "<one-sentence overall assessment>"
}

If no violations are found, return {"issues": [], "summary": "..."}. Use "error" for clear contradictions, "warning" for borderline cases, "info" for minor stylistic notes.`;

function constraintsBlock(context: ContextBundle): string {
  // Entity bodies are neutralized so an embedded `=== ... ===` line can't
  // spoof a section boundary and inject instructions into the validator.
  const join = (entries: string[]) =>
    entries.map(neutralizeSectionDelimiters).join("\n\n");
  const sections: string[] = [];
  if (context.rules.length) {
    sections.push(`=== RULES ===\n${join(context.rules)}`);
  }
  if (context.style.length) {
    sections.push(`=== STYLE ===\n${join(context.style)}`);
  }
  if (context.characters.length) {
    sections.push(`=== CHARACTERS ===\n${join(context.characters)}`);
  }
  if (context.locations.length) {
    sections.push(`=== LOCATIONS ===\n${join(context.locations)}`);
  }
  return sections.join("\n\n");
}

/**
 * Parse a validator-LLM response that should be JSON. Tolerates markdown
 * code fences (```json ... ``` or ``` ... ```) which LLMs often add even
 * when instructed not to.
 */
export function parseValidatorJson<T>(raw: string): T {
  let text = raw.trim();
  // Strip leading fence (```json or just ```)
  text = text.replace(/^```(?:json)?\s*\n?/i, "");
  // Strip trailing fence
  text = text.replace(/\n?```\s*$/i, "");
  return JSON.parse(text.trim()) as T;
}

export async function validateContent(
  validator: LlmProvider,
  context: ContextBundle,
  content: string,
): Promise<ValidationReport> {
  const constraints = constraintsBlock(context);
  const userMessage = constraints
    ? `Established story context:\n\n${constraints}\n\nNew content to validate:\n\n${content}\n\nReturn your verdict as JSON.`
    : `New content to validate (no established story constraints in this story yet):\n\n${content}\n\nReturn your verdict as JSON. With no constraints, you should typically return an empty issues array.`;

  const genOpts = {
    systemPrompt: SYSTEM_PROMPT,
    userMessage,
    temperature: VALIDATOR_TEMPERATURE,
    maxTokens: VALIDATOR_MAX_TOKENS,
  };
  // Constrain the output shape at generation time where the provider can
  // (Ollama `format`); the semantic prompt above still carries the
  // quote-grounding instructions either way, and the runtime schema below
  // validates the parsed result regardless of which path produced it.
  const verdictBeat = supportsStructuredOutput(validator)
    ? await validator.generateStructured(genOpts, VALIDATION_REPORT_JSON_SCHEMA)
    : await validator.generate(genOpts);
  // A verdict cut off at the token budget is a FAILED validation pass, not
  // a shorter report -- truncated JSON that happened to parse (or an empty
  // issues array) must never read as "clean"
  // (docs/OLLAMA_ADOPTION_ASSESSMENT.md §1).
  if (verdictBeat.complete === false) {
    throw new Error(
      "validator output was cut off at its token budget (finish reason " +
        "'length') -- validation failed; the content was NOT verified clean",
    );
  }
  const raw = verdictBeat.text;

  let parsed: unknown;
  try {
    parsed = parseValidatorJson<unknown>(raw);
  } catch {
    throw new Error(
      "validator returned unparseable JSON -- validation failed; the " +
        "content was NOT verified clean",
    );
  }
  // Strict runtime validation replaces the old permissive fallback, which
  // coerced a malformed report into {issues: [], summary: ""} -- i.e. read
  // broken validator output as a clean verdict.
  const result = ValidationReportSchema.safeParse(parsed);
  if (!result.success) {
    const detail = result.error.issues
      .slice(0, 3)
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
    throw new Error(
      `validator returned a malformed verdict (${detail}) -- validation ` +
        "failed; the content was NOT verified clean",
    );
  }
  return result.data;
}
