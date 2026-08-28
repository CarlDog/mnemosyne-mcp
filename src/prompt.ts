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

export const SCENE_CONTEXT_STRATEGIES = ["recency-first", "query-ranked"] as const;
export type SceneContextStrategy = (typeof SCENE_CONTEXT_STRATEGIES)[number];
export const DEFAULT_SCENE_CONTEXT_STRATEGY: SceneContextStrategy = "recency-first";

// Shared schema-description strings for the per-call strategy params.
// Every surface that exposes the params (three MCP tools, three API
// routes' docs) must describe the SAME semantics, and those semantics
// live in resolveSceneContextStrategies below -- keeping the words next
// to the code stops the copies drifting into contradiction again.
export const SCENE_CONTEXT_STRATEGY_DESCRIPTION =
  "When selecting RECENT SCENES for context, choose either recency-first " +
  "(project-scoped created-at order) or query-ranked (query-ranked " +
  "memory_search). Overrides the server default " +
  "MNEMO_SCENE_CONTEXT_STRATEGY for this call only. If unset, the server " +
  "default applies.";
export const SCENE_CONTEXT_FALLBACK_DESCRIPTION =
  "Optional fallback strategy tried when the primary yields no eligible " +
  "scenes. If unset while scene_context_strategy IS set on this call, no " +
  "fallback occurs (the chosen strategy runs pure); if both are unset, " +
  "the server's MNEMO_SCENE_CONTEXT_FALLBACK_STRATEGY applies.";

// The one place per-call strategy overrides meet the server-configured
// defaults. Contract (documented in the strings above):
// - an explicit per-call fallback always wins;
// - a per-call PRIMARY with no per-call fallback means NO fallback --
//   the caller opted into that strategy's pure semantics, and silently
//   inheriting a mismatched server fallback would contaminate it;
// - neither set: the server pair applies (a server fallback equal to the
//   server primary collapses to "no fallback").
export function resolveSceneContextStrategies(
  perCall: {
    strategy?: SceneContextStrategy;
    fallback?: SceneContextStrategy;
  },
  server: {
    strategy: SceneContextStrategy;
    fallback: SceneContextStrategy;
  },
): { strategy: SceneContextStrategy; fallback?: SceneContextStrategy } {
  const strategy = perCall.strategy ?? server.strategy;
  let fallback: SceneContextStrategy | undefined;
  if (perCall.fallback !== undefined) {
    fallback = perCall.fallback;
  } else if (perCall.strategy === undefined) {
    fallback = server.fallback;
  }
  if (fallback === strategy) fallback = undefined;
  return { strategy, ...(fallback !== undefined && { fallback }) };
}

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

// Scene pulls have two strategies, each with the same validation-safe
// post-filter:
// - recency-first (default): a compact project scan (tags + created_at
//   only, no bodies) picks the winners, then only those few scenes are
//   hydrated via memory_get. The old shape fetched every entity body in
//   the project per call just to keep 5 scene strings.
// - query-ranked: project-scoped semantic recall + OC query ranking,
//   then query-order filtering to drop only hard-errored scenes.
//
// DOGFOODING NOTE: OpenChronicle currently exposes this as either generic
// recall (query ranking) or list+local filtering. If OC adds an ordered,
// tag-filtered scene-query endpoint that preserves ordering and tags in
// one call, the recency path's scan-then-hydrate two-hop collapses to a
// single call.
// In both cases, validation:errors scenes are excluded. In recency-first,
// validation:clean scenes are preferred over untagged.
//
// Generic over {tags} so it can run on compact scan rows (pre-hydration)
// and on full RecalledEntity pools alike -- one copy of the
// clean/untagged/errors rule, not two.
function applySceneValidationFilter<T extends { tags: string[] }>(
  pool: T[],
  strategy: SceneContextStrategy,
): T[] {
  if (strategy === "query-ranked") {
    return pool.filter((e) => !e.tags.includes("validation:errors"));
  }

  const clean = pool.filter((e) => e.tags.includes("validation:clean"));
  const untagged = pool.filter(
    (e) =>
      !e.tags.includes("validation:clean") &&
      !e.tags.includes("validation:errors"),
  );

  // validation:errors scenes are hard-excluded -- never selected,
  // regardless of pool size.
  //
  // If all pool entries are validation:errors, this returns [] and
  // RECENT SCENES is omitted from the prompt entirely (block() returns
  // null), rather than seeding few-shot context with violations.
  return [...clean, ...untagged];
}

function byCreatedAtDesc(
  a: { created_at: string },
  b: { created_at: string },
): number {
  const aMs = Date.parse(a.created_at);
  const bMs = Date.parse(b.created_at);
  const aSafe = Number.isFinite(aMs) ? aMs : 0;
  const bSafe = Number.isFinite(bMs) ? bMs : 0;
  return bSafe - aSafe;
}

// Scene tags as written by saveEntity (BASE_TAGS + type). Matching all
// three keeps a coincidentally-"scene"-tagged non-mnemosyne memory out.
const SCENE_TAGS = ["mnemosyne", "story", "scene"] as const;

// Recency-first winners via scan-then-hydrate: the compact scan carries
// tags + created_at (verified live -- see OcClient.memoryListCompact),
// which is everything scene detection, recency sorting, AND the
// validation filter need. Only the final <= TYPE_LIMITS.scene winners
// get their bodies fetched. No limit on the scan: memory_list floats
// pinned rows above recency order, so a server-side limit window would
// fill with pinned rules before reaching recent scenes.
async function pullRecencyScenes(
  oc: OcClient,
  storyId: string,
): Promise<RecalledEntity[]> {
  const rows = (await oc.memoryListCompact({ projectId: storyId }))
    .filter((row) => SCENE_TAGS.every((tag) => row.tags.includes(tag)))
    .sort(byCreatedAtDesc)
    .slice(0, SCENE_POOL_SIZE);
  const winners = applySceneValidationFilter(rows, "recency-first").slice(
    0,
    TYPE_LIMITS.scene,
  );

  // Sequential hydration -- see gatherContext's comment on OC's rate
  // limiter under parallel bursts.
  const hydrated: RecalledEntity[] = [];
  for (const row of winners) {
    const memory = await oc.memoryGet(row.id);
    if (memory === null) continue; // deleted between scan and hydrate
    const entity = memoryToRecalled(memory);
    if (entity !== null && entity.type === "scene") hydrated.push(entity);
  }
  return hydrated;
}

async function pullScenesByStrategy(
  oc: OcClient,
  storyId: string,
  query: string,
  strategy: SceneContextStrategy,
): Promise<RecalledEntity[]> {
  if (strategy === "query-ranked") {
    const pool = await recall(oc, storyId, {
      query,
      type: "scene",
      limit: SCENE_POOL_SIZE,
    });
    return applySceneValidationFilter(pool, strategy).slice(
      0,
      TYPE_LIMITS.scene,
    );
  }
  return pullRecencyScenes(oc, storyId);
}

export async function pullFilteredScenes(
  oc: OcClient,
  storyId: string,
  query: string,
  strategy: SceneContextStrategy = DEFAULT_SCENE_CONTEXT_STRATEGY,
  fallbackStrategy?: SceneContextStrategy,
): Promise<string[]> {
  const strategies: SceneContextStrategy[] =
    fallbackStrategy && fallbackStrategy !== strategy
      ? [strategy, fallbackStrategy]
      : [strategy];

  for (const currentStrategy of strategies) {
    const scenes = await pullScenesByStrategy(
      oc,
      storyId,
      query,
      currentStrategy,
    );
    if (scenes.length > 0) {
      return scenes.map((e) => `${e.name}\n${e.body}`);
    }
  }

  // All candidate pools were exhausted with validation:errors only.
  // Omitting RECENT SCENES is preferred to seeding few-shot context with
  // known bad scenes.
  return [];
}

export interface GatherContextOptions {
  /** RECENT SCENES retrieval strategy. Default DEFAULT_SCENE_CONTEXT_STRATEGY. */
  sceneStrategy?: SceneContextStrategy;
  /** Optional second strategy tried when the primary yields no eligible
   * scenes. Unset = no fallback. */
  sceneFallbackStrategy?: SceneContextStrategy;
  /** Validation contexts consume only rules/style/characters/locations
   * (validator.ts's constraintsBlock never reads scenes/lore/
   * worldbuilding), so validation callers skip those pulls entirely --
   * under the recency-first default the scene pull is the single most
   * expensive OC fetch in the bundle, and revalidateScenes gathers once
   * per scene. The skipped fields come back as []. */
  validationOnly?: boolean;
}

export async function gatherContext(
  oc: OcClient,
  storyId: string,
  query: string,
  options: GatherContextOptions = {},
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
  if (options.validationOnly) {
    return {
      rules,
      style,
      characters,
      locations,
      scenes: [],
      lore: [],
      worldbuilding: [],
    };
  }
  const scenes = await pullFilteredScenes(
    oc,
    storyId,
    query,
    options.sceneStrategy ?? DEFAULT_SCENE_CONTEXT_STRATEGY,
    options.sceneFallbackStrategy,
  );
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
