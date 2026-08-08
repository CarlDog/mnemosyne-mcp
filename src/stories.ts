// Story marker logic. A Mnemosyne "story" is an OC project containing a
// pinned marker memory of the form:
//   [Mnemosyne Story] <name>
//   Created: <iso-datetime>
//   Schema: 2
//   Kindroid-Kin: <ai_id-or-registered-name>   (optional)
// with tags ["mnemosyne", "story-marker"]. The Kindroid-Kin line is new in
// schema 2 and always optional -- schema-1 markers (no such line) still
// parse fine, just with kindroid_kin left unset.
//
// Discovery uses a single cross-project memory_search filtered by the marker
// tags (AND logic), so listStories is one round trip regardless of how many
// OC projects exist. This avoids both N+1 latency and OC's rate limiter.

import { type OcClient, type OcMemory } from "./oc-client.js";

export const STORY_MARKER_TAGS = ["mnemosyne", "story-marker"];
export const STORY_MARKER_QUERY = "Mnemosyne Story";
export const STORY_MARKER_SCHEMA = 2;
const MAX_STORIES_PER_LIST = 1000;
const KINDROID_KIN_PREFIX = "Kindroid-Kin: ";

export interface MnemoStory {
  id: string; // OC project id
  name: string;
  created_at: string;
  marker_memory_id: string; // OC memory id, needed to update the marker in place
  /** This story's dedicated Kindroid kin (ai_id or kindroid-mcp registered
   * name), if bound. See setStoryKin(). */
  kindroid_kin?: string;
}

function buildMarkerContent(
  name: string,
  createdAt: string,
  kindroidKin?: string,
): string {
  const lines = [
    `[Mnemosyne Story] ${name}`,
    `Created: ${createdAt}`,
    `Schema: ${STORY_MARKER_SCHEMA}`,
  ];
  if (kindroidKin) lines.push(`${KINDROID_KIN_PREFIX}${kindroidKin}`);
  return lines.join("\n");
}

function parseMarker(
  memory: OcMemory,
): { name: string; created: string; kindroidKin?: string } | null {
  const lines = memory.content.split("\n");
  const nameMatch = lines[0]?.match(/^\[Mnemosyne Story\] (.+)$/);
  const createdMatch = lines[1]?.match(/^Created: (\S+)$/);
  if (!nameMatch?.[1] || !createdMatch?.[1]) return null;
  const kinLine = lines.find((line) => line.startsWith(KINDROID_KIN_PREFIX));
  const kindroidKin = kinLine?.slice(KINDROID_KIN_PREFIX.length).trim();
  return {
    name: nameMatch[1],
    created: createdMatch[1],
    ...(kindroidKin && { kindroidKin }),
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
    ...(parsed.kindroidKin && { kindroid_kin: parsed.kindroidKin }),
  };
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

export async function createStory(
  oc: OcClient,
  name: string,
  kindroidKin?: string,
): Promise<MnemoStory> {
  const project = await oc.projectCreate(name);
  const createdAt = new Date().toISOString();
  const marker = await oc.memorySave({
    content: buildMarkerContent(name, createdAt, kindroidKin),
    projectId: project.id,
    tags: STORY_MARKER_TAGS,
    pinned: true,
  });
  return {
    id: project.id,
    name,
    created_at: createdAt,
    marker_memory_id: marker.id,
    ...(kindroidKin && { kindroid_kin: kindroidKin }),
  };
}

/**
 * Binds this story to a dedicated Kindroid kin (or clears the binding, when
 * kindroidKin is undefined) by rewriting the marker memory's content in
 * place -- name and created_at are preserved verbatim, only the
 * Kindroid-Kin line changes. Used by mnemo_continue (via
 * resolveKindroidKin()) so a story can default to a specific kin without an
 * explicit per-call override every time.
 */
export async function setStoryKin(
  oc: OcClient,
  story: MnemoStory,
  kindroidKin: string | undefined,
): Promise<MnemoStory> {
  const content = buildMarkerContent(story.name, story.created_at, kindroidKin);
  await oc.memoryUpdate({ memoryId: story.marker_memory_id, content });
  return { ...story, kindroid_kin: kindroidKin };
}
