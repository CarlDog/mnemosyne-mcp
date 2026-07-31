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
}

function memoryToRecalled(memory: OcMemory): RecalledEntity | null {
  const parsed = parseEntityContent(memory.content);
  if (!parsed) return null;
  return {
    ...parsed,
    memory_id: memory.id,
    pinned: memory.pinned,
    tags: memory.tags,
    created_at: memory.created_at,
    updated_at: memory.updated_at,
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

async function findExistingEntity(
  oc: OcClient,
  storyId: string,
  type: EntityType,
  name: string,
): Promise<OcMemory | null> {
  const headerPrefix = `${entityHeader(type, name)}\n`;
  const matches = await oc.memorySearch({
    query: name,
    projectId: storyId,
    tags: [...BASE_TAGS, type],
    topK: SAVE_DEDUPE_SEARCH_TOPK,
  });
  return matches.find((m) => m.content.startsWith(headerPrefix)) ?? null;
}

export interface SaveEntityArgs {
  type: EntityType;
  name: string;
  body: string;
  pinned?: boolean;
  extraTags?: string[];
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
  const existing = await findExistingEntity(oc, storyId, args.type, args.name);

  if (existing) {
    const updated = await oc.memoryUpdate({
      memoryId: existing.id,
      content,
      tags,
    });
    let finalPinned = existing.pinned;
    if (args.pinned !== undefined && existing.pinned !== args.pinned) {
      await oc.memoryPin(existing.id, args.pinned);
      finalPinned = args.pinned;
    }
    return {
      entity: { type: args.type, name: args.name, body: args.body },
      memory_id: updated.id,
      created: false,
      pinned: finalPinned,
      tags,
    };
  }

  const pinned = args.pinned ?? defaultPinned(args.type);
  const saved = await oc.memorySave({
    content,
    projectId: storyId,
    tags,
    pinned,
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
  const query = args.query?.trim() || args.type || "story";
  const memories = await oc.memorySearch({
    query,
    projectId: storyId,
    tags,
    topK: limit,
  });
  // OC surfaces pinned memories even past topK; slice client-side so the
  // caller's `limit` is a hard cap rather than a soft hint.
  return memories
    .map(memoryToRecalled)
    .filter((e): e is RecalledEntity => e !== null)
    .slice(0, limit);
}
