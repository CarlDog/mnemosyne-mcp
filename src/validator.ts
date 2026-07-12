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

import type { LlmProvider } from "./llm.js";
import type { ContextBundle } from "./prompt.js";
import { neutralizeSectionDelimiters } from "./prompt.js";

export interface ValidationIssue {
  severity: "error" | "warning" | "info";
  /** The name or first line of the rule that is being violated. */
  rule: string;
  /** Exact quote of the violating text, copied from the new content. */
  violating_text: string;
  /** One-sentence explanation of why this text violates the rule. */
  explanation: string;
}

export interface ValidationReport {
  issues: ValidationIssue[];
  summary: string;
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

  const raw = await validator.generate({
    systemPrompt: SYSTEM_PROMPT,
    userMessage,
    temperature: VALIDATOR_TEMPERATURE,
    maxTokens: VALIDATOR_MAX_TOKENS,
  });

  const parsed = parseValidatorJson<ValidationReport>(raw);
  // Defensive: ensure shape is sane even if LLM returned partial structure.
  return {
    issues: Array.isArray(parsed.issues) ? parsed.issues : [],
    summary: typeof parsed.summary === "string" ? parsed.summary : "",
  };
}
