// System prompt assembly for mnemo_continue.
//
// LOAD-BEARING block ordering (do not reorder without a deliberate change):
//   1. Mode directive (participant / director / audience)
//   2. RULES — pinned rule entities
//   3. STYLE — style guide entities
//   4. CHARACTERS — character entities
//   5. LOCATIONS — location entities
//   6. RECENT SCENES — scene entities (strict recency ordering with
//      validation:clean preference and untagged fallback)
//   7. LORE — lore entities
//   8. WORLDBUILDING — worldbuilding entities
//
// Reference: docs/V2_RETROSPECTIVE.md §2.3. The v2 storytelling plugin
// arrived at this order empirically through Phase 3's conversation mode
// build-out; degrading gracefully when a story has sparse context (e.g.,
// no characters defined yet) was the design driver.
//
// Empty blocks are omitted entirely so the prompt doesn't show "=== STYLE
// ===" with nothing under it.

import type { OcClient } from "./oc-client.js";
import {
  recall,
  memoryToRecalled,
  type EntityType,
  type RecalledEntity,
} from "./entities.js";

export const MODES = ["participant", "director", "audience"] as const;
export type Mode = (typeof MODES)[number];

const MODE_DIRECTIVES: Record<Mode, string> = {
  participant:
    "You are a character in this story. The user will tell you which character they are playing. Stay in character and respond naturally as their scene partner — perform other characters in the scene as supporting cast, but your primary voice is theirs.",
  director:
    "You are a scene director. The user will describe a scene setup or give direction. You perform ALL characters in the scene — give each their own voice, mannerisms, and dialogue. Narrate actions, describe the environment, and advance the scene based on the user's direction.",
  audience:
    "You are a narrator telling a story. The user is your audience. Write vivid, immersive narrative prose. Perform all characters with distinct voices. Advance the plot naturally. The user may offer light guidance but is primarily here to enjoy the story.",
};

// Per-type pull caps. Rules and style are typically small and important —
// pull all (OC's pinned-always-surface bias gives us all pinned rules
// regardless of these limits, but the cap matters for non-pinned). Other
// types are capped to keep the system prompt from blowing up.
const TYPE_LIMITS: Record<EntityType, number> = {
  rule: 50,
  style: 50,
  character: 20,
  location: 10,
  scene: 5,
  lore: 10,
  worldbuilding: 10,
};

// Wider candidate pool for scenes than TYPE_LIMITS.scene. OC's
// memory_search tags filter is AND-only (no OR, no exclusion), so
// gatherContext cannot ask OC server-side for "validation:clean or
// untagged, but never validation:errors" -- the exclusion has to happen
// client-side in pullFilteredScenes below, over a pool wider than the
// final cap so there are still enough candidates left after
// validation:errors scenes are dropped. Same "search wider than the final
// cap" shape as entities.ts's SAVE_DEDUPE_SEARCH_TOPK -- see that
// comment for the precedent.
const SCENE_POOL_SIZE = 20;

export interface ContextBundle {
  rules: string[];
  style: string[];
  characters: string[];
  locations: string[];
  scenes: string[];
  lore: string[];
  worldbuilding: string[];
}

async function pullByType(
  oc: OcClient,
  storyId: string,
  type: EntityType,
  query: string,
): Promise<string[]> {
  const entities = await recall(oc, storyId, {
    query,
    type,
    limit: TYPE_LIMITS[type],
  });
  return entities.map((e) => `${e.name}\n${e.body}`);
}

// Recall scene candidates from a project-scoped `memory_list` pull (strict
// recency), then filter by validation verdict client-side since OC's
// memory_search has no server-side exclusion for tags. validation:clean
// scenes are preferred; untagged scenes (saved before v0.1.3's validation
// tagging existed, or saved with validate=false) fill remaining slots; validation:errors
// scenes are hard-excluded — never selected, regardless of pool size.
// Validation and type buckets preserve strict recency, so no external
// relevance scoring is involved.
export async function pullFilteredScenes(
  oc: OcClient,
  storyId: string,
  query: string,
): Promise<string[]> {
  void query;
  const pool = (await oc.memoryList({ projectId: storyId }))
    .map((memory) => memoryToRecalled(memory))
    .filter(
      (entity): entity is RecalledEntity =>
        entity !== null && entity.type === "scene",
    )
    .sort((a, b) => {
      const aMs = Date.parse(a.created_at);
      const bMs = Date.parse(b.created_at);
      const aSafe = Number.isFinite(aMs) ? aMs : 0;
      const bSafe = Number.isFinite(bMs) ? bMs : 0;
      return bSafe - aSafe;
    })
    .slice(0, SCENE_POOL_SIZE);
  const clean = pool.filter((e) => e.tags.includes("validation:clean"));
  const untagged = pool.filter(
    (e) =>
      !e.tags.includes("validation:clean") &&
      !e.tags.includes("validation:errors"),
  );
  // validation:errors scenes are hard-excluded -- never selected, regardless
  // of pool size.
  //
  // An empty result here is the intended behavior when all scenes are
  // tagged validation:errors -- RECENT SCENES is omitted from the prompt
  // entirely (block() returns null for an empty array) rather than
  // including rule-violating few-shots.
  return [...clean, ...untagged]
    .slice(0, TYPE_LIMITS.scene)
    .map((e) => `${e.name}\n${e.body}`);
}

export async function gatherContext(
  oc: OcClient,
  storyId: string,
  query: string,
): Promise<ContextBundle> {
  // Sequential per-type pulls. Parallel (Promise.all over 7 calls) trips
  // OC v3's rate limiter under burst load — same gap that bit Phase A's
  // listStories. The latency cost (~7 round trips × OC RTT) is dwarfed
  // by LLM generation in the next step, so the simpler sequential form
  // is the right v0 trade. Revisit if/when OC raises the rate-limit
  // ceiling or exposes a bulk-search endpoint.
  const rules = await pullByType(oc, storyId, "rule", query);
  const style = await pullByType(oc, storyId, "style", query);
  const characters = await pullByType(oc, storyId, "character", query);
  const locations = await pullByType(oc, storyId, "location", query);
  const scenes = await pullFilteredScenes(oc, storyId, query);
  const lore = await pullByType(oc, storyId, "lore", query);
  const worldbuilding = await pullByType(oc, storyId, "worldbuilding", query);
  return { rules, style, characters, locations, scenes, lore, worldbuilding };
}

/**
 * Neutralize lines inside entity content that would collide with the
 * `=== HEADER ===` section delimiters used by buildSystemPrompt and the
 * validator's constraints block. Without this, an entity body containing
 * its own `=== RULES ===` line can spoof a section boundary and inject
 * instructions (e.g., steer the validator). Any line that looks like a
 * delimiter has its `=` runs replaced with `-`, which preserves the text's
 * visual shape while breaking the collision.
 */
export function neutralizeSectionDelimiters(text: string): string {
  return text
    .split("\n")
    .map((line) =>
      /^\s*={3,}.*={3,}\s*$/.test(line) ? line.replace(/=/g, "-") : line,
    )
    .join("\n");
}

function block(header: string, entries: string[]): string | null {
  if (entries.length === 0) return null;
  const safe = entries.map(neutralizeSectionDelimiters);
  return `=== ${header} ===\n${safe.join("\n\n")}`;
}

// Appended to every mode directive so mnemosyne's own generated output
// (the five direct-LLM providers -- Kindroid/Botify ignore systemPrompt
// entirely and format replies per their own persona config) stays
// visually consistent with the wider companion-chat convention: Kindroid's
// own docs document exactly this split for a Kin's Example Message
// ("actions in asterisks, speech in quotes"), and cross-platform research
// (2026-08-23) found no surveyed convention ever collides action-asterisks
// with bracket/OOC markup. Consistency is the point, not just style --
// making generated output uniform across every generator this project
// supports makes a bad reaction easier to attribute to a specific
// generator rather than to inconsistent formatting. Phrased descriptively
// ("X are written in Y"), not as an imperative directive -- Kindroid's own
// docs warn imperative phrasing (e.g. "narrate in 3rd person") over-triggers
// into unwanted narration walls; RULES/STYLE below can still override it
// per RULE_PRECEDENCE_STATEMENT, same as any other narration convention.
const ACTION_FORMATTING_STATEMENT =
  "Physical actions are written in *asterisks*; spoken dialogue stays plain text.";

// Inserted between the mode directive and the constraint blocks when the
// story has rules or style entries. The mode directives use action verbs
// ("Narrate actions, describe the environment...") that the LLM tends to
// read as priming for present-tense narrative prose. Without this
// statement, even instruction-tuned models like nous-hermes2-mixtral
// follow both the mode and the rules awkwardly — picking up the mode's
// implicit conventions as a default and the rules as overlay. Stating
// the precedence explicitly fixes that.
const RULE_PRECEDENCE_STATEMENT =
  "The RULES and STYLE blocks below are absolute. Follow them exactly. They override any narration conventions implied by the mode directive above (tense, voice, point of view, register).";

export function buildSystemPrompt(mode: Mode, context: ContextBundle): string {
  const hasConstraints = context.rules.length > 0 || context.style.length > 0;
  const parts: (string | null)[] = [
    `${MODE_DIRECTIVES[mode]} ${ACTION_FORMATTING_STATEMENT}`,
    hasConstraints ? RULE_PRECEDENCE_STATEMENT : null,
    block("RULES", context.rules),
    block("STYLE", context.style),
    block("CHARACTERS", context.characters),
    block("LOCATIONS", context.locations),
    block("RECENT SCENES", context.scenes),
    block("LORE", context.lore),
    block("WORLDBUILDING", context.worldbuilding),
  ];
  return parts.filter((p): p is string => p !== null).join("\n\n");
}
