// Entity logic for Mnemosyne stories.
//
// An entity is a structured story-domain object — character, location,
// rule, style guide, scene, lore, or worldbuilding fact. Entities live as
// OC memories scoped to one story (project), with a normalized content
// format and a base set of tags that the recall path filters on.
//
// Content format (load-bearing — recall parses it back out):
//   [TitleCaseType] Name
//
//   <body>
//
// Tags: ["mnemosyne", "story", <type>] are always present. Additional
// user-supplied tags are appended (deduped against the base set).
//
// save_entity uses overwrite-by-(type,name) semantics: if a memory in the
// current story already starts with the same `[Type] Name` header, it's
// updated in place via memory_update. Pin state is preserved across
// updates unless the caller explicitly passes `pinned`, in which case
// memory_pin is called to align.
//
// recall does a project-scoped memory_search filtered by the entity tags
// and parses every result back into entity shape. Memories that don't
// parse (e.g., the story marker, or non-Mnemosyne memories that somehow
// bear the tag) are skipped.

import { type OcClient, type OcMemory } from "./oc-client.js";

export const ENTITY_TYPES = [
  "character",
  "location",
  "rule",
  "style",
  "scene",
  "lore",
  "worldbuilding",
] as const;

export type EntityType = (typeof ENTITY_TYPES)[number];

const BASE_TAGS = ["mnemosyne", "story"] as const;
const DEFAULT_RECALL_LIMIT = 10;
// Exported so mnemo_revalidate_scenes (v0.1.3 step 3) can request "every
// scene in the story" without duplicating this ceiling as a second magic
// number -- recall() itself clamps any caller-supplied limit to this value
// regardless, so this is also the single source of truth for that clamp.
export const MAX_RECALL_LIMIT = 100;
// Overwrite-by-(type,name) dedup is bounded by this search window: OC has
// no exact-header lookup, so findExistingEntity does a memory_search on
// the name (topK below, AND-filtered on the type tag) and scans results
// for the `[Type] Name` header prefix. If a story accumulates more than
// this many same-type entities AND the search ranks the exact-name match
// below the cutoff, saveEntity will miss the existing memory and create a
// duplicate instead of updating. In practice the name-as-query ranking
// surfaces exact matches near the top, so this window is generous for the
// per-type volumes v0 targets (see TYPE_LIMITS in prompt.ts). Revisit if
// OC grows an exact-match/content-prefix lookup or stories exceed ~50
// entities of one type.
const SAVE_DEDUPE_SEARCH_TOPK = 50;

function titleCase(type: EntityType): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function entityHeader(type: EntityType, name: string): string {
  return `[${titleCase(type)}] ${name}`;
}

function formatEntityContent(
  type: EntityType,
  name: string,
  body: string,
): string {
  return `${entityHeader(type, name)}\n\n${body}`;
}

export interface ParsedEntity {
  type: EntityType;
  name: string;
  body: string;
}

export function parseEntityContent(content: string): ParsedEntity | null {
  const match = content.match(/^\[([A-Za-z]+)\] (.+?)\n\n([\s\S]*)$/);
  if (!match || !match[1] || !match[2]) return null;
  const typeNorm = match[1].toLowerCase();
  if (!(ENTITY_TYPES as readonly string[]).includes(typeNorm)) return null;
  return {
    type: typeNorm as EntityType,
    name: match[2],
    body: match[3] ?? "",
  };
}

export interface RecalledEntity extends ParsedEntity {
  memory_id: string;
  pinned: boolean;
  tags: string[];
  created_at: string;
  updated_at?: string;
  /** Extracted rrf_score when the source row came from a hybrid-ranked
   * memory_search (absent for keyword/semantic modes, pinned floats, and
   * non-search reads -- see OcMemorySearchResult). */
  relevance?: number;
}

export function memoryToRecalled(
  memory: OcMemory & {
    relevance?: { rrf_score?: number | null } | null;
  },
): RecalledEntity | null {
  const parsed = parseEntityContent(memory.content);
  if (!parsed) return null;
  const rrf = memory.relevance?.rrf_score;
  return {
    ...parsed,
    memory_id: memory.id,
    pinned: memory.pinned,
    tags: memory.tags,
    created_at: memory.created_at,
    ...(typeof rrf === "number" && { relevance: rrf }),
    // OC's Python None arrives as null; RecalledEntity keeps the narrower
    // string|undefined shape its consumers already expect.
    updated_at: memory.updated_at ?? undefined,
  };
}

function buildTags(type: EntityType, extraTags?: string[]): string[] {
  const base = [...BASE_TAGS, type];
  if (!extraTags || extraTags.length === 0) return base;
  const baseSet = new Set<string>(base);
  const extras = extraTags.filter((t) => !baseSet.has(t));
  return [...base, ...extras];
}

function defaultPinned(type: EntityType): boolean {
  return type === "rule";
}

function toKnownExisting(memory: OcMemory | null): KnownExistingEntity | null {
  return memory
    ? { memoryId: memory.id, tags: memory.tags, pinned: memory.pinned }
    : null;
}

async function findExistingEntity(
  oc: OcClient,
  storyId: string,
  type: EntityType,
  name: string,
): Promise<OcMemory | null> {
  const headerPrefix = `${entityHeader(type, name)}\n`;
  const isHeaderMatch = (m: OcMemory) => m.content.startsWith(headerPrefix);

  // Phrase-first (RETRIEVAL_CONTROLS_DESIGN slice 2, ratified): an exact
  // keyword+phrase search for the name surfaces the `[Type] Name` header
  // memory even when the hybrid window is crowded, reducing false
  // creates. The residual miss mode remains in kind: within-type BODY
  // mentions of the name can still outrank the header past the window --
  // narrowed, not eliminated; the deterministic fix is an eventual OC
  // exact (project, type, name) endpoint.
  const phraseMatches = await oc.memorySearch({
    query: name,
    projectId: storyId,
    tags: [...BASE_TAGS, type],
    topK: SAVE_DEDUPE_SEARCH_TOPK,
    mode: "keyword",
    phrase: true,
  });
  const phraseHit = phraseMatches.find(isHeaderMatch);
  if (phraseHit) return phraseHit;

  const matches = await oc.memorySearch({
    query: name,
    projectId: storyId,
    tags: [...BASE_TAGS, type],
    topK: SAVE_DEDUPE_SEARCH_TOPK,
  });
  return matches.find(isHeaderMatch) ?? null;
}

/** A caller-resolved answer to "does this (type, name) already exist" —
 * see SaveEntityArgs.existing. */
export interface KnownExistingEntity {
  memoryId: string;
  tags: string[];
  pinned: boolean;
}

export interface SaveEntityArgs {
  type: EntityType;
  name: string;
  body: string;
  pinned?: boolean;
  extraTags?: string[];
  /** Backdate the memory on CREATE (mnemo_import_story's round-trip
   * timestamp restoration). Ignored on update — an existing memory keeps
   * its original creation time, which is the honest one. */
  createdAt?: string;
  /** Skip the bounded dedupe search when the caller has already resolved
   * existence from a COMPLETE enumeration (mnemo_import_story's
   * preflight). Pass the existing entity to update it by id, or null to
   * assert "definitely absent — create". The search's
   * SAVE_DEDUPE_SEARCH_TOPK window can miss in bulk regimes (a
   * 100-scene story whose auto-named scenes share most search tokens),
   * and a miss on the overwrite path would mint a silent duplicate —
   * the exact failure a complete preflight exists to prevent. Undefined
   * = search as before (the interactive mnemo_save_entity path). */
  existing?: KnownExistingEntity | null;
}

export interface SaveEntityResult {
  entity: ParsedEntity;
  memory_id: string;
  created: boolean;
  pinned: boolean;
  tags: string[];
}

export async function saveEntity(
  oc: OcClient,
  storyId: string,
  args: SaveEntityArgs,
): Promise<SaveEntityResult> {
  const content = formatEntityContent(args.type, args.name, args.body);
  const tags = buildTags(args.type, args.extraTags);
  const existing: KnownExistingEntity | null =
    args.existing !== undefined
      ? args.existing
      : toKnownExisting(
          await findExistingEntity(oc, storyId, args.type, args.name),
        );

  if (existing) {
    // Preserve an existing validation:* tag across an overwrite. `tags`
    // above is rebuilt from scratch (base + type + extraTags) with no
    // knowledge of out-of-band tags like validation:clean/validation:errors
    // (added by retagValidation, not by saveEntity) -- without this,
    // re-saving a scene via mnemo_save_entity would silently drop its
    // validation verdict, since OC's memory_update replaces tags wholesale.
    // Only the validation tag is carried forward; extraTags replace-on-
    // update semantics are otherwise unchanged.
    const preservedValidationTag = existing.tags.find((t) =>
      /^validation:/.test(t),
    );
    const finalTags =
      preservedValidationTag && !tags.some((t) => /^validation:/.test(t))
        ? [...tags, preservedValidationTag]
        : tags;
    const updated = await oc.memoryUpdate({
      memoryId: existing.memoryId,
      content,
      tags: finalTags,
    });
    let finalPinned = existing.pinned;
    if (args.pinned !== undefined && existing.pinned !== args.pinned) {
      await oc.memoryPin(existing.memoryId, args.pinned);
      finalPinned = args.pinned;
    }
    return {
      entity: { type: args.type, name: args.name, body: args.body },
      memory_id: updated.id,
      created: false,
      pinned: finalPinned,
      tags: finalTags,
    };
  }

  const pinned = args.pinned ?? defaultPinned(args.type);
  const saved = await oc.memorySave({
    content,
    projectId: storyId,
    tags,
    pinned,
    createdAt: args.createdAt,
  });
  return {
    entity: { type: args.type, name: args.name, body: args.body },
    memory_id: saved.id,
    created: true,
    pinned,
    tags,
  };
}

// The only place that should ever construct a validation-tag update. OC's
// memory_update replaces the "tags" array wholesale (confirmed from the
// OpenChronicle server source: "New tags (replaces existing)") — so this
// always echoes the complete current tag list plus the new validation tag,
// never just the tag being added. Omitting the base tags would silently
// break mnemo_recall's AND-tag filter for that memory forever. Exported so
// mnemo_revalidate_scenes (later step) can reuse it instead of duplicating
// the retag logic.
export async function retagValidation(
  oc: OcClient,
  memoryId: string,
  currentTags: string[],
  verdict: "clean" | "errors",
): Promise<string[]> {
  const withoutValidation = currentTags.filter((t) => !/^validation:/.test(t));
  const newTags = [...withoutValidation, `validation:${verdict}`];
  await oc.memoryUpdate({ memoryId, tags: newTags });
  return newTags;
}

export interface RecallArgs {
  query?: string;
  type?: EntityType;
  limit?: number;
  /** Run-abort signal threaded into the OC call (aborts backoff sleeps
   * promptly; never interrupts an in-flight request). */
  signal?: AbortSignal;
}

export interface DeleteEntityResult {
  type: EntityType;
  name: string;
  memory_id: string;
}

export async function deleteEntity(
  oc: OcClient,
  storyId: string,
  type: EntityType,
  name: string,
): Promise<DeleteEntityResult> {
  const existing = await findExistingEntity(oc, storyId, type, name);
  if (!existing) {
    throw new Error(
      `No ${type} named "${name}" in current story. Use mnemo_recall to see what's there.`,
    );
  }
  await oc.memoryDelete(existing.id);
  return { type, name, memory_id: existing.id };
}

export async function recall(
  oc: OcClient,
  storyId: string,
  args: RecallArgs,
): Promise<RecalledEntity[]> {
  const limit = Math.min(
    Math.max(args.limit ?? DEFAULT_RECALL_LIMIT, 1),
    MAX_RECALL_LIMIT,
  );
  const tags = args.type ? [...BASE_TAGS, args.type] : [...BASE_TAGS];
  // memory_search requires non-empty query. When the caller doesn't supply
  // one, fall back to the type name (or "story") — the AND-tag filter does
  // the actual restriction; the query just affects ranking.
  const suppliedQuery = args.query?.trim();
  const query = suppliedQuery || args.type || "story";
  const memories = await oc.memorySearch({
    query,
    projectId: storyId,
    tags,
    topK: limit,
    // A caller-supplied query is a relevance lookup, so OC v3's separate
    // pinned prepend must not consume the small result window. Query-less
    // browsing keeps OC's normal pin-first behavior. OC v4 accepts this
    // compatibility parameter but treats it as inert after removing the
    // prepend entirely.
    ...(suppliedQuery ? { pinnedLimit: 0 } : {}),
    signal: args.signal,
  });
  // OC surfaces pinned memories even past topK; slice client-side so the
  // caller's `limit` is a hard cap rather than a soft hint.
  return memories
    .map(memoryToRecalled)
    .filter((e): e is RecalledEntity => e !== null)
    .slice(0, limit);
}

export interface ListAllEntitiesResult {
  entities: RecalledEntity[];
  /** Memory ids present in the project that are neither the story marker
   * nor parseable entities. Surfaced (not silently dropped) so an export
   * caller can report exactly what a document does NOT contain. */
  skipped_memory_ids: string[];
}

// Complete enumeration for mnemo_export_story — recall()'s search window
// (MAX_RECALL_LIMIT) is a ranking cap, not a completeness contract, and an
// export that silently truncated would be quiet data loss. Uses
// memoryList (no limit, strict project scope). The story marker is
// excluded by its memory ID — not by its "story-marker" tag — because
// save_entity accepts arbitrary extra_tags, so a legitimate, parseable
// entity could carry that tag and a tag filter would silently omit it
// from the one enumeration whose contract is completeness. Excluding by
// identity keeps the skipped list an honest "unexpected non-entities"
// signal (a normal story yields []; a hand-made duplicate marker in OC
// fails the parse and lands in skipped, visibly).
export async function listAllEntities(
  oc: OcClient,
  storyId: string,
  markerMemoryId: string,
): Promise<ListAllEntitiesResult> {
  const memories = await oc.memoryList({ projectId: storyId });
  const entities: RecalledEntity[] = [];
  const skipped: string[] = [];
  for (const memory of memories) {
    if (memory.id === markerMemoryId) continue;
    const recalled = memoryToRecalled(memory);
    if (recalled) entities.push(recalled);
    else skipped.push(memory.id);
  }
  return { entities, skipped_memory_ids: skipped };
}

export type EntitySummary = Omit<RecalledEntity, "body">;

export interface ListEntitiesFilter {
  type?: EntityType;
  /** Case-insensitive substring match against name OR body. Runs BEFORE
   * the body-strip step below, so a match found only in body text (e.g. a
   * scene mentioning a location by name) still counts even though the
   * returned summary omits body when includeBody is false. Added for the
   * web UI's entity-roster search (slice 1) -- mnemo_list_entities
   * doesn't pass this, so its behavior is unchanged. */
  query?: string;
  includeBody?: boolean;
}

/**
 * Narrow a complete listAllEntities() result for mnemo_list_entities: an
 * optional type filter, and body stripped by default. Pure/testable --
 * body-stripping matters because a large story's complete prose can run to
 * hundreds of KB across its scenes, and a browse/inventory caller (the
 * entity library this exists for) usually wants the roster, not the
 * content, until it drills into one entity. Every summary still carries
 * created_at, so a caller can sort chronologically itself -- this
 * deliberately does no sorting of its own, mirroring recall()'s existing
 * "the caller composes" posture.
 */
export function filterListedEntities(
  entities: RecalledEntity[],
  filter: ListEntitiesFilter,
): RecalledEntity[] | EntitySummary[] {
  let filtered = filter.type
    ? entities.filter((e) => e.type === filter.type)
    : entities;
  if (filter.query) {
    const q = filter.query.toLowerCase();
    filtered = filtered.filter(
      (e) =>
        e.name.toLowerCase().includes(q) || e.body.toLowerCase().includes(q),
    );
  }
  if (filter.includeBody) return filtered;
  return filtered.map((e) => ({
    memory_id: e.memory_id,
    type: e.type,
    name: e.name,
    pinned: e.pinned,
    tags: e.tags,
    created_at: e.created_at,
    updated_at: e.updated_at,
  }));
}

/**
 * Fetch one entity by its OC memory id, scoped to a specific story.
 * memory_get itself is NOT project-scoped (OC will happily return a memory
 * belonging to a different project), so this enforces story ownership
 * itself -- a cross-story id and a genuinely nonexistent one both come
 * back as null, deliberately: neither should tell the caller whether the
 * id exists in *some other* story. Also returns null (not a parse error)
 * if the memory exists but isn't a well-formed entity (e.g. it's the
 * story marker itself) -- an unlikely but real case if a caller guesses a
 * marker's memory_id.
 */
export async function getEntityByMemoryId(
  oc: OcClient,
  storyId: string,
  memoryId: string,
): Promise<RecalledEntity | null> {
  const memory = await oc.memoryGet(memoryId);
  if (!memory || memory.project_id !== storyId) return null;
  return memoryToRecalled(memory);
}
