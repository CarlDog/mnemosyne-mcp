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
  description: string;
  rule?: string;
}

export interface ValidationReport {
  issues: ValidationIssue[];
  summary: string;
}

const VALIDATOR_TEMPERATURE = 0.2;
const VALIDATOR_MAX_TOKENS = 1024;

const SYSTEM_PROMPT = `You are a story consistency checker. Evaluate new content against the established rules and entities provided in the user message. Identify contradictions, tone violations, and factual conflicts. Be precise — cite the specific rule or entity each issue conflicts with.

Return ONLY valid JSON in this shape:
{
  "issues": [
    {"severity": "error" | "warning" | "info", "description": "...", "rule": "..."}
  ],
  "summary": "brief overall assessment"
}

If no issues, return {"issues": [], "summary": "..."}. Use "error" for hard contradictions, "warning" for likely-but-unconfirmed issues, "info" for stylistic notes.`;

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
