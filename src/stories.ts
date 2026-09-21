// OC-backed story operations: discovery, lookup, creation and the marker
// setters. The marker FORMAT itself -- how a marker is built, parsed and
// rewritten -- lives in ./story-marker.js, which has no OcClient dependency
// and is exercised by tests/story-marker.test.ts. This file is everything
// that needs to talk to OpenChronicle.
//
// Discovery uses a single cross-project memory_search filtered by the marker
// tags (AND logic), so listStories is one round trip regardless of how many
// OC projects exist. This avoids both N+1 latency and OC's rate limiter.

import { type OcClient } from "./oc-client.js";
import { assertGenreDeclaration, type GenreDeclaration } from "./genre.js";
import { requireCurrentStoryId } from "./config.js";
import { assertNarratorProfile } from "./application/narrator-policy.js";
import {
  buildMarkerContent,
  markerFieldLines,
  markerToStory,
  rewriteMarkerLines,
  STORY_MARKER_TAGS,
  type ContentRating,
  type KindroidTarget,
  type MarkerField,
  type MnemoStory,
  type PositionState,
} from "./story-marker.js";

const STORY_MARKER_QUERY = "Mnemosyne Story";
const MAX_STORIES_PER_LIST = 1000;

export async function listStories(oc: OcClient): Promise<MnemoStory[]> {
  const markers = await oc.memorySearch({
    query: STORY_MARKER_QUERY,
    // The one deliberate cross-project search in the codebase: every story is
    // its own OC project, so listing stories means searching all of them. The
    // flag is what distinguishes this from a forgotten scope, which now
    // throws instead of quietly searching everything (src/story-scope.ts).
    allProjects: true,
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

/** A requested marker change. The KEY's presence means "change this field";
 * `value: undefined` means "clear it". Without the wrapper there is no way to
 * distinguish "leave alone" from "clear", which is the distinction every one
 * of these fields needs. */
export interface MarkerChange<T> {
  value: T | undefined;
}

export interface MarkerChanges {
  kindroidTarget?: MarkerChange<KindroidTarget>;
  narratorProfile?: MarkerChange<string>;
  contentRating?: MarkerChange<ContentRating>;
  genre?: MarkerChange<GenreDeclaration>;
  position?: MarkerChange<PositionState>;
}

/**
 * The one marker write path. Reads the marker fresh, applies every requested
 * field in ONE rewrite, and writes once.
 *
 * Reading fresh matters for two different reasons. The caller's snapshot can
 * be several round trips old, so writing from it would clobber whatever landed
 * in between. And the rewrite is line surgery over the fresh bytes, so any
 * value this build cannot parse is preserved rather than erased -- see
 * rewriteMarkerLines for the failure that motivated it.
 *
 * `buildChanges` receives the FRESH story, not the caller's snapshot, so a
 * change computed from existing state (the genre merge, which folds requested
 * fields onto current ones) is computed against what is actually stored.
 *
 * Applying every field in one rewrite rather than one setter per field is
 * also what pays for the extra read: mnemo_story_use setting four fields was
 * six OC round trips and four independent chances to interleave, and is now
 * two and one.
 */
export async function updateStoryMarker(
  oc: OcClient,
  story: MnemoStory,
  buildChanges: (fresh: MnemoStory) => MarkerChanges,
): Promise<MnemoStory> {
  const memory = await oc.memoryGet(story.marker_memory_id);
  if (!memory) {
    throw new Error(
      `This story's marker memory (${story.marker_memory_id}) no longer exists. ` +
        "Refusing to recreate it, since that would silently make a second story.",
    );
  }
  const fresh = markerToStory(memory);
  if (!fresh) {
    throw new Error(
      `This story's marker memory (${story.marker_memory_id}) exists but no longer ` +
        "parses as a story marker. Refusing to overwrite content that cannot be read; " +
        "repair the marker by hand first.",
    );
  }
  const changes = buildChanges(fresh);
  const fields = Object.keys(changes) as MarkerField[];
  if (fields.length === 0) return fresh;
  const replacement = fields.flatMap((field) =>
    markerFieldLines(field, changes[field]?.value),
  );
  const content = rewriteMarkerLines(memory.content, fields, replacement);
  await oc.memoryUpdate({ memoryId: story.marker_memory_id, content });
  const written = markerToStory({ ...memory, content });
  if (!written) {
    throw new Error(
      "The rewritten story marker does not parse; the write was made but the " +
        "result cannot be read back. This is a bug, not a data problem.",
    );
  }
  return written;
}

export async function createStory(
  oc: OcClient,
  name: string,
  kindroidTarget?: KindroidTarget,
  narratorProfile?: string,
  contentRating?: ContentRating,
  genre?: GenreDeclaration,
): Promise<MnemoStory> {
  if (narratorProfile !== undefined) assertNarratorProfile(narratorProfile);
  if (genre !== undefined) assertGenreDeclaration(genre);
  const project = await oc.projectCreate(name);
  const createdAt = new Date().toISOString();
  const marker = await oc.memorySave({
    content: buildMarkerContent(
      name,
      createdAt,
      kindroidTarget,
      narratorProfile,
      undefined,
      contentRating,
      genre,
    ),
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
    ...(narratorProfile && { narrator_profile: narratorProfile }),
    ...(contentRating && { content_rating: contentRating }),
    ...(genre && {
      genres: genre.genres,
      ...(genre.guidance && { genre_guidance: genre.guidance }),
    }),
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
  return updateStoryMarker(oc, story, () => ({
    kindroidTarget: { value: kindroidTarget },
  }));
}

/**
 * Names (or clears, when label is undefined) the narrator persona this story
 * is written with, rewriting the marker in place the same way
 * setKindroidTarget does; the Kindroid target is preserved verbatim.
 */
export async function setNarratorProfile(
  oc: OcClient,
  story: MnemoStory,
  label: string | undefined,
): Promise<MnemoStory> {
  if (label !== undefined) assertNarratorProfile(label);
  return updateStoryMarker(oc, story, () => ({
    narratorProfile: { value: label },
  }));
}

/**
 * Declares (or clears, when rating is undefined) this story's content-
 * generation requirement, rewriting the marker in place the same way
 * setKindroidTarget/setNarratorProfile do; every other field is preserved
 * verbatim (docs/CONTENT_ROUTING_DESIGN.md, ratified 2026-09-08).
 */
export async function setContentRating(
  oc: OcClient,
  story: MnemoStory,
  rating: ContentRating | undefined,
): Promise<MnemoStory> {
  return updateStoryMarker(oc, story, () => ({
    contentRating: { value: rating },
  }));
}

/**
 * Declares (or clears, when declaration is undefined) this story's genre,
 * rewriting the marker in place the same way setKindroidTarget /
 * setNarratorProfile / setContentRating do; every other field is preserved
 * verbatim (docs/GENRE_DECLARATION_DESIGN.md §4). The declaration is
 * validated before the write, so an invalid one never reaches the marker --
 * the read-side leniency in parseGenreDeclaration exists for hand edits,
 * not as a substitute for this.
 */
export async function setGenre(
  oc: OcClient,
  story: MnemoStory,
  declaration: GenreDeclaration | undefined,
): Promise<MnemoStory> {
  if (declaration !== undefined) assertGenreDeclaration(declaration);
  return updateStoryMarker(oc, story, () => ({
    genre: { value: declaration },
  }));
}

// Position tracking's merge/arithmetic/validate-then-apply logic
// (PositionUpdate, mergePositionUpdate, resolveElapsedHours,
// currentStoryDatetime, setPosition, applyPositionUpdate, and friends) lives
// in ./position.ts -- it only touches the marker as a storage detail via
// buildMarkerContent/findStory above. PositionState and parsePositionState
// stay here since they're core to the marker's own parsing.
