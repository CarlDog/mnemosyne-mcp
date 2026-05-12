// Story marker logic. A Mnemosyne "story" is an OC project containing a
// pinned marker memory of the form:
//   [Mnemosyne Story] <name>
//   Created: <iso-datetime>
//   Schema: 1
// with tags ["mnemosyne", "story-marker"].
//
// Discovery uses a single cross-project memory_search filtered by the marker
// tags (AND logic), so listStories is one round trip regardless of how many
// OC projects exist. This avoids both N+1 latency and OC's rate limiter.

import { type OcClient, type OcMemory } from "./oc-client.js";

export const STORY_MARKER_TAGS = ["mnemosyne", "story-marker"];
export const STORY_MARKER_QUERY = "Mnemosyne Story";
export const STORY_MARKER_SCHEMA = 1;
const MAX_STORIES_PER_LIST = 1000;

export interface MnemoStory {
  id: string; // OC project id
  name: string;
  created_at: string;
}

function buildMarkerContent(name: string): string {
  return [
    `[Mnemosyne Story] ${name}`,
    `Created: ${new Date().toISOString()}`,
    `Schema: ${STORY_MARKER_SCHEMA}`,
  ].join("\n");
}

function parseMarker(
  memory: OcMemory,
): { name: string; created: string } | null {
  const match = memory.content.match(
    /^\[Mnemosyne Story\] (.+?)\nCreated: (\S+)/,
  );
  if (!match || !match[1] || !match[2]) return null;
  return { name: match[1], created: match[2] };
}

function markerToStory(marker: OcMemory): MnemoStory | null {
  const parsed = parseMarker(marker);
  if (!parsed) return null;
  return {
    id: marker.project_id,
    name: parsed.name,
    created_at: parsed.created,
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
): Promise<MnemoStory> {
  const project = await oc.projectCreate(name);
  await oc.memorySave({
    content: buildMarkerContent(name),
    projectId: project.id,
    tags: STORY_MARKER_TAGS,
    pinned: true,
  });
  return {
    id: project.id,
    name,
    created_at: new Date().toISOString(),
  };
}
