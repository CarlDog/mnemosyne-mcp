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

// Quote-and-match prompt. The earlier (v0.1.0) prompt let the LLM "evaluate"
// abstractly, which produced plausible-sounding but fabricated objections
// (e.g., reporting "she" as a first-person pronoun violation). Forcing the
// model to quote the specific violating text from the new content makes
// hallucinated issues much harder — if it can't find a quote, the violation
// can't go in the array.
const SYSTEM_PROMPT = `You are a story consistency checker.

For EACH RULE in the established context, walk through the new content and find specific text fragments that violate that rule. Quote the violating text directly — copy it from the new content character-for-character, do not paraphrase.

A rule has been violated only if you can quote the specific words from the new content that break it. If you cannot find a direct quote, do NOT report a violation. Do not invent or generalize.

Same logic applies for established characters and locations: if the new content describes them in a way that contradicts what the established context says, quote the contradicting text.

Return ONLY valid JSON in this shape:
{
  "issues": [
    {
      "severity": "error" | "warning" | "info",
      "rule": "<name or first line of the violated rule (or character/location name)>",
      "violating_text": "<exact quote from the new content>",
      "explanation": "<one sentence: why this quote violates that rule>"
    }
  ],
  "summary": "<one-sentence overall assessment>"
}

If no violations are found, return {"issues": [], "summary": "..."}. Use "error" for clear contradictions, "warning" for borderline cases, "info" for minor stylistic notes.`;

function constraintsBlock(context: ContextBundle): string {
  const sections: string[] = [];
  if (context.rules.length) {
    sections.push(`=== RULES ===\n${context.rules.join("\n\n")}`);
  }
  if (context.style.length) {
    sections.push(`=== STYLE ===\n${context.style.join("\n\n")}`);
  }
  if (context.characters.length) {
    sections.push(`=== CHARACTERS ===\n${context.characters.join("\n\n")}`);
  }
  if (context.locations.length) {
    sections.push(`=== LOCATIONS ===\n${context.locations.join("\n\n")}`);
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
