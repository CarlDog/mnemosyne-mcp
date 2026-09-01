// Structured, budgeted, inspectable context admission
// (docs/CONTEXT_PLAN_DESIGN.md, ratified 2026-08-28). Pure: given the
// gathered entries, the direction, and a budget, decide what is admitted
// and why -- deterministically, with memory_id as the terminal tie-break.
// No model-generated summarizer, no universal window guess: an unknown
// budget means instrument-only (everything admitted, verdict "complete").
//
// Admission preference (drop order is the reverse): protected rules +
// style first -- these NEVER drop; if they plus the direction cannot fit,
// the verdict is "rejected" and enforcement mode decides whether that is
// an error or a warning -- then reference entities, then validation:clean
// scenes, then untagged scenes. Within a droppable tier, lowest relevance
// drops first, then oldest, then memory_id.

import type { EntityType } from "./entities.js";

// Same deliberate prose estimate the Ollama sizing has always used
// (~3.5-4 chars/token; over-provisioning beats truncation). Calibrated
// against provider-reported input_tokens by the outbound continuation adapter
// -- logged, never silently replaced.
export const EST_CHARS_PER_TOKEN = 3.5;

export function estimateTokens(chars: number): number {
  return Math.ceil(chars / EST_CHARS_PER_TOKEN);
}

export interface ContextEntry {
  memory_id: string;
  entity_type: EntityType;
  name: string;
  tags: string[];
  pinned: boolean;
  created_at: string;
  /** Extracted rrf_score when the pull was hybrid-ranked (OC's wire
   * `relevance` is an object; rrf_score exists only in hybrid mode). */
  relevance?: number;
  chars: number;
  est_tokens: number;
  admission: "included" | "dropped";
  reason: string;
}

export type AdmissionMode = "warn" | "enforce";

export interface ContextPlan {
  provider: string;
  model?: string;
  /** Absent = unknown window (instrument-only; nothing drops on it). */
  input_budget?: number;
  output_reserve: number;
  est_fixed_tokens: number;
  est_direction_tokens: number;
  sections: Partial<
    Record<
      EntityType,
      { included: number; dropped: number; est_tokens: number }
    >
  >;
  verdict: "complete" | "partial" | "rejected";
}

const PROTECTED_TYPES: ReadonlySet<EntityType> = new Set(["rule", "style"]);

/** Drop tier: higher drops first. Protected types never drop (tier 0). */
function dropTier(entry: ContextEntry): number {
  if (PROTECTED_TYPES.has(entry.entity_type)) return 0;
  if (entry.entity_type !== "scene") return 1;
  return entry.tags.includes("validation:clean") ? 2 : 3;
}

/** Deterministic drop ordering within the droppable set: highest tier
 * first, then lowest relevance, then oldest, then memory_id -- the
 * terminal tie-break that makes the order byte-stable when relevance is
 * absent and bulk-imported timestamps collide. */
function byDropPriority(a: ContextEntry, b: ContextEntry): number {
  const tier = dropTier(b) - dropTier(a);
  if (tier !== 0) return tier;
  const rel = (a.relevance ?? -1) - (b.relevance ?? -1);
  if (rel !== 0) return rel;
  const created = a.created_at.localeCompare(b.created_at);
  if (created !== 0) return created;
  return a.memory_id.localeCompare(b.memory_id);
}

export interface PlanInputs {
  provider: string;
  model?: string;
  /** Known effective input window; undefined = unknown (instrument-only). */
  inputBudget?: number;
  outputReserve: number;
  /** Tokens for the fixed scaffold (mode directive + section headers). */
  estFixedTokens: number;
  directionChars: number;
  marginTokens: number;
}

export interface PlanResult {
  plan: ContextPlan;
  /** The admitted entries, in the ORIGINAL gather order (rendering
   * consumes exactly this set -- the manifest can never describe a
   * payload the model didn't see). */
  admitted: ContextEntry[];
  /** ALL entries with their final admission marks (feeds toManifest). */
  entries: ContextEntry[];
}

export function planContext(
  entries: ContextEntry[],
  inputs: PlanInputs,
): PlanResult {
  const estDirectionTokens = estimateTokens(inputs.directionChars);
  const working = entries.map((e) => ({ ...e }));

  let verdict: ContextPlan["verdict"] = "complete";
  if (inputs.inputBudget !== undefined) {
    const budgetForEntries =
      inputs.inputBudget -
      inputs.outputReserve -
      inputs.estFixedTokens -
      estDirectionTokens -
      inputs.marginTokens;

    const protectedTokens = working
      .filter((e) => PROTECTED_TYPES.has(e.entity_type))
      .reduce((sum, e) => sum + e.est_tokens, 0);

    if (protectedTokens > budgetForEntries) {
      // Protected material + direction alone don't fit: nothing to drop
      // that would help -- rejected, never silently truncated.
      verdict = "rejected";
    } else {
      let total = working.reduce((sum, e) => sum + e.est_tokens, 0);
      if (total > budgetForEntries) {
        const droppable = working
          .filter((e) => !PROTECTED_TYPES.has(e.entity_type))
          .sort(byDropPriority);
        for (const entry of droppable) {
          if (total <= budgetForEntries) break;
          entry.admission = "dropped";
          entry.reason = "budget";
          total -= entry.est_tokens;
        }
        verdict = "partial";
      }
    }
  }

  const sections: ContextPlan["sections"] = {};
  for (const entry of working) {
    const section = (sections[entry.entity_type] ??= {
      included: 0,
      dropped: 0,
      est_tokens: 0,
    });
    if (entry.admission === "included") {
      section.included += 1;
      section.est_tokens += entry.est_tokens;
    } else {
      section.dropped += 1;
    }
  }

  return {
    plan: {
      provider: inputs.provider,
      ...(inputs.model !== undefined && { model: inputs.model }),
      ...(inputs.inputBudget !== undefined && {
        input_budget: inputs.inputBudget,
      }),
      output_reserve: inputs.outputReserve,
      est_fixed_tokens: inputs.estFixedTokens,
      est_direction_tokens: estDirectionTokens,
      sections,
      verdict,
    },
    admitted: working.filter((e) => e.admission === "included"),
    entries: working,
  };
}

/** Compact response manifest: counts + verdict + dropped ids/reasons --
 * never entity bodies. */
export interface ContextPlanManifest extends ContextPlan {
  dropped_entries: Array<{ memory_id: string; reason: string }>;
}

export function toManifest(
  plan: ContextPlan,
  entries: ContextEntry[],
): ContextPlanManifest {
  return {
    ...plan,
    dropped_entries: entries
      .filter((e) => e.admission === "dropped")
      .map((e) => ({ memory_id: e.memory_id, reason: e.reason })),
  };
}
