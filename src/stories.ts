// Story marker logic. A Mnemosyne "story" is an OC project containing a
// pinned marker memory of the form:
//   [Mnemosyne Story] <name>
//   Created: <iso-datetime>
//   Schema: 3
//   Kindroid-Target: ai:<id>        (optional; or "group:<id>")
// with tags ["mnemosyne", "story-marker"]. Schema-1 markers (no kin line at
// all) and schema-2 markers (legacy "Kindroid-Kin: <id>" line, always an AI
// target) both still parse fine -- see parseMarker's legacy fallback.
//
// Discovery uses a single cross-project memory_search filtered by the marker
// tags (AND logic), so listStories is one round trip regardless of how many
// OC projects exist. This avoids both N+1 latency and OC's rate limiter.

import { type OcClient, type OcMemory } from "./oc-client.js";
import { requireCurrentStoryId } from "./config.js";

export const STORY_MARKER_TAGS = ["mnemosyne", "story-marker"];
const STORY_MARKER_QUERY = "Mnemosyne Story";
const STORY_MARKER_SCHEMA = 3;
const MAX_STORIES_PER_LIST = 1000;
const KINDROID_TARGET_PREFIX = "Kindroid-Target: ";
// Schema 2, read-only compat: a bare kin line always meant an AI target.
const LEGACY_KINDROID_KIN_PREFIX = "Kindroid-Kin: ";

export type KindroidTargetType = "ai" | "group";

export interface KindroidTarget {
  type: KindroidTargetType;
  /** ai_id/group_id, or a kindroid-mcp registered name (resolved server-side). */
  id: string;
}

export interface MnemoStory {
  id: string; // OC project id
  name: string;
  created_at: string;
  marker_memory_id: string; // OC memory id, needed to update the marker in place
  /** This story's dedicated Kindroid target (a single AI or a group chat),
   * if bound. See setKindroidTarget(). */
  kindroid_target?: KindroidTarget;
}

// Explicit field whitelist rather than spreading MnemoStory -- keeps
// internal plumbing (marker_memory_id) out of any caller's response.
// kindroid_kin / kindroid_group_id mirror mnemo_story_use's own input
// param shape rather than exposing the internal kindroid_target: {type,
// id} representation. Deliberately omits "current" (which story the
// local active-story pointer points at) -- that's meaningful only to a
// caller reading the pointer itself (the MCP tools); a caller resolving
// stories through an explicit id/name (the web API) should never need or
// imply reliance on it. See resolveStoryId's doc comment above for why.
export interface StorySummary {
  id: string;
  name: string;
  created_at: string;
  kindroid_kin?: string;
  kindroid_group_id?: string;
}

export function toStorySummary(story: MnemoStory): StorySummary {
  return {
    id: story.id,
    name: story.name,
    created_at: story.created_at,
    ...(story.kindroid_target?.type === "ai" && {
      kindroid_kin: story.kindroid_target.id,
    }),
    ...(story.kindroid_target?.type === "group" && {
      kindroid_group_id: story.kindroid_target.id,
    }),
  };
}

function buildMarkerContent(
  name: string,
  createdAt: string,
  kindroidTarget?: KindroidTarget,
): string {
  const lines = [
    `[Mnemosyne Story] ${name}`,
    `Created: ${createdAt}`,
    `Schema: ${STORY_MARKER_SCHEMA}`,
  ];
  if (kindroidTarget) {
    lines.push(
      `${KINDROID_TARGET_PREFIX}${kindroidTarget.type}:${kindroidTarget.id}`,
    );
  }
  return lines.join("\n");
}

function parseKindroidTargetValue(value: string): KindroidTarget | undefined {
  const sep = value.indexOf(":");
  if (sep === -1) return undefined;
  const type = value.slice(0, sep);
  const id = value.slice(sep + 1).trim();
  if (id && (type === "ai" || type === "group")) return { type, id };
  return undefined;
}

function parseMarker(
  memory: OcMemory,
): { name: string; created: string; kindroidTarget?: KindroidTarget } | null {
  const lines = memory.content.split("\n");
  const nameMatch = lines[0]?.match(/^\[Mnemosyne Story\] (.+)$/);
  const createdMatch = lines[1]?.match(/^Created: (\S+)$/);
  if (!nameMatch?.[1] || !createdMatch?.[1]) return null;

  const targetLine = lines.find((line) =>
    line.startsWith(KINDROID_TARGET_PREFIX),
  );
  let kindroidTarget = targetLine
    ? parseKindroidTargetValue(targetLine.slice(KINDROID_TARGET_PREFIX.length))
    : undefined;

  if (!kindroidTarget) {
    const legacyLine = lines.find((line) =>
      line.startsWith(LEGACY_KINDROID_KIN_PREFIX),
    );
    const legacyId = legacyLine
      ?.slice(LEGACY_KINDROID_KIN_PREFIX.length)
      .trim();
    if (legacyId) kindroidTarget = { type: "ai", id: legacyId };
  }

  return {
    name: nameMatch[1],
    created: createdMatch[1],
    ...(kindroidTarget && { kindroidTarget }),
  };
}

function markerToStory(marker: OcMemory): MnemoStory | null {
  const parsed = parseMarker(marker);
  if (!parsed) return null;
  return {
    id: marker.project_id,
    name: parsed.name,
    created_at: parsed.created,
    marker_memory_id: marker.id,
    ...(parsed.kindroidTarget && { kindroid_target: parsed.kindroidTarget }),
  };
}

/**
 * Validates and combines mutually-exclusive kin/group_id call params into a
 * single KindroidTarget. Throws when both are truthy -- a target is either
 * one AI or one group chat, never both. Shared by mnemo_story_use (a
 * persistent binding, where the caller separately tracks the null-vs-
 * undefined "clear vs leave unchanged" distinction) and mnemo_continue (a
 * one-shot per-call override, where there's no such distinction).
 */
export function combineKindroidTarget(
  kin: string | null | undefined,
  groupId: string | null | undefined,
): KindroidTarget | undefined {
  if (kin && groupId) {
    throw new Error(
      "Pass at most one of kindroid_kin / kindroid_group_id -- a target is either a single AI or a group, not both.",
    );
  }
  if (kin) return { type: "ai", id: kin };
  if (groupId) return { type: "group", id: groupId };
  return undefined;
}

export async function listStories(oc: OcClient): Promise<MnemoStory[]> {
  const markers = await oc.memorySearch({
    query: STORY_MARKER_QUERY,
    tags: STORY_MARKER_TAGS,
    topK: MAX_STORIES_PER_LIST,
  });
  return markers.map(markerToStory).filter((s): s is MnemoStory => s !== null);
}

export async function findStoryByName(
  oc: OcClient,
  name: string,
): Promise<MnemoStory | null> {
  const stories = await listStories(oc);
  return stories.find((s) => s.name === name) ?? null;
}

function looksLikeUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    s,
  );
}

export async function findStory(
  oc: OcClient,
  nameOrId: string,
): Promise<MnemoStory | null> {
  if (looksLikeUuid(nameOrId)) {
    const markers = await oc.memorySearch({
      query: STORY_MARKER_QUERY,
      projectId: nameOrId,
      tags: STORY_MARKER_TAGS,
      topK: 1,
    });
    const marker = markers[0];
    if (!marker) return null;
    return markerToStory(marker);
  }
  return findStoryByName(oc, nameOrId);
}

/**
 * Resolve the story id a call should operate on: an explicit per-call
 * override (name or OC project UUID, same rule as mnemo_story_use) when
 * given, otherwise the active-story pointer. The fallback path makes NO
 * OcClient call -- reading the local pointer is pure file I/O -- so every
 * existing caller relying on it (every stdio/Claude-Desktop session today)
 * pays zero new OC round trips and is behaviorally unchanged. An explicit
 * override deliberately has no lifetime of its own (unlike a session-scoped
 * "active story" would): the caller supplies it fresh on every call, so a
 * future web UI just tracks which story is open in its own client state and
 * passes it through -- nothing here can go stale or get silently evicted.
 */
export async function resolveStoryId(
  oc: OcClient,
  explicit: string | undefined,
): Promise<string> {
  if (explicit === undefined) return requireCurrentStoryId();
  const story = await findStory(oc, explicit);
  if (!story) {
    throw new Error(
      `No story matches "${explicit}". Use mnemo_story_list to see what exists.`,
    );
  }
  return story.id;
}

export async function createStory(
  oc: OcClient,
  name: string,
  kindroidTarget?: KindroidTarget,
): Promise<MnemoStory> {
  const project = await oc.projectCreate(name);
  const createdAt = new Date().toISOString();
  const marker = await oc.memorySave({
    content: buildMarkerContent(name, createdAt, kindroidTarget),
    projectId: project.id,
    tags: STORY_MARKER_TAGS,
    pinned: true,
  });
  return {
    id: project.id,
    name,
    created_at: createdAt,
    marker_memory_id: marker.id,
    ...(kindroidTarget && { kindroid_target: kindroidTarget }),
  };
}

/**
 * Binds this story to a dedicated Kindroid target -- a single AI or a group
 * chat -- (or clears the binding, when kindroidTarget is undefined) by
 * rewriting the marker memory's content in place: name and created_at are
 * preserved verbatim, only the Kindroid-Target line changes. Used by
 * mnemo_continue (via resolveKindroidTarget()) so a story can default to a
 * specific target without an explicit per-call override every time.
 */
export async function setKindroidTarget(
  oc: OcClient,
  story: MnemoStory,
  kindroidTarget: KindroidTarget | undefined,
): Promise<MnemoStory> {
  const content = buildMarkerContent(
    story.name,
    story.created_at,
    kindroidTarget,
  );
  await oc.memoryUpdate({ memoryId: story.marker_memory_id, content });
  return { ...story, kindroid_target: kindroidTarget };
}
