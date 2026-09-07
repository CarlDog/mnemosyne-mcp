// Story marker logic. A Mnemosyne "story" is an OC project containing a
// pinned marker memory of the form:
//   [Mnemosyne Story] <name>
//   Created: <iso-datetime>
//   Schema: 5
//   Kindroid-Target: ai:<id>        (optional; or "group:<id>")
//   Narrator-Profile: <label>       (optional; schema 4, 2026-09-03)
//   Epoch-Date: <iso-datetime>      (optional; schema 5, 2026-09-07 --
//                                    position tracking's on/off switch)
//   Epoch-Location: <memory_id>
//   Epoch-Spot: <free text>         (optional)
//   Elapsed-Hours: <integer>
//   Current-Location: <memory_id>
//   Current-Spot: <free text>       (optional)
// with tags ["mnemosyne", "story-marker"]. Schema-1 markers (no kin line at
// all), schema-2 markers (legacy "Kindroid-Kin: <id>" line, always an AI
// target), schema-3 markers (no narrator line), and schema-4 markers (no
// position block) all still parse fine -- unknown lines are ignored and
// known ones are found by prefix. Every write path bumps the Schema line to
// the current constant regardless of whether position tracking is used, so
// a schema-5 marker with no Epoch-* lines must parse identically in meaning
// to a schema-4 marker -- see docs/POSITION_TRACKING_DESIGN.md's
// "Refinements added at implementation time" §1.
//
// The narrator profile is a LABEL naming which narrator kin persona a story
// is written with (docs/KINDROID_NARRATOR_DESIGN.md S2): it rides the
// marker so provenance survives, is echoed by mnemo_continue, and tags each
// saved scene as `narrator:<label>`. It is not a copy of the persona.
//
// Position tracking (docs/POSITION_TRACKING_DESIGN.md, ratified 2026-09-07)
// is opt-in per story, exactly like the Kindroid target and narrator
// profile: no Epoch-* lines means tracking hasn't started. The block is
// atomic -- Epoch-Date and Epoch-Location are required together, enforced
// in the *parser* (parsePositionState), not only at write time, since a
// hand-edited marker could otherwise violate it. Location memory_ids are
// stored, never names -- a location's display name is always resolved
// fresh via getEntityByMemoryId, so a later rename can't leave a stale
// cached copy in the marker. Elapsed-Hours is the one field that changes
// as the story advances; current_story_datetime (epoch_date + elapsed
// hours) is always DERIVED at read time, never stored -- see
// currentStoryDatetime().
//
// Discovery uses a single cross-project memory_search filtered by the marker
// tags (AND logic), so listStories is one round trip regardless of how many
// OC projects exist. This avoids both N+1 latency and OC's rate limiter.

import { type OcClient, type OcMemory } from "./oc-client.js";
import { requireCurrentStoryId } from "./config.js";
import {
  assertNarratorProfile,
  NARRATOR_PROFILE_PATTERN,
  narratorTag,
} from "./application/narrator-policy.js";

// Re-exported so the tools and tests that reach the marker through this
// module get the label policy from the same place.
export { assertNarratorProfile, NARRATOR_PROFILE_PATTERN, narratorTag };

export const STORY_MARKER_TAGS = ["mnemosyne", "story-marker"];
const STORY_MARKER_QUERY = "Mnemosyne Story";
const STORY_MARKER_SCHEMA = 5;
const MAX_STORIES_PER_LIST = 1000;
const KINDROID_TARGET_PREFIX = "Kindroid-Target: ";
// Schema 2, read-only compat: a bare kin line always meant an AI target.
const LEGACY_KINDROID_KIN_PREFIX = "Kindroid-Kin: ";
const NARRATOR_PROFILE_PREFIX = "Narrator-Profile: ";
const EPOCH_DATE_PREFIX = "Epoch-Date: ";
const EPOCH_LOCATION_PREFIX = "Epoch-Location: ";
const EPOCH_SPOT_PREFIX = "Epoch-Spot: ";
const ELAPSED_HOURS_PREFIX = "Elapsed-Hours: ";
const CURRENT_LOCATION_PREFIX = "Current-Location: ";
const CURRENT_SPOT_PREFIX = "Current-Spot: ";
const HOURS_PER_DAY = 24;
const HOURS_PER_WEEK = 168;

export type KindroidTargetType = "ai" | "group";

export interface KindroidTarget {
  type: KindroidTargetType;
  /** ai_id/group_id, or a kindroid-mcp registered name (resolved server-side). */
  id: string;
}

/**
 * A story's in-story clock/place, if position tracking has been started
 * (docs/POSITION_TRACKING_DESIGN.md). Location fields are memory_ids, never
 * names -- resolve a display name via getEntityByMemoryId at read time.
 * elapsedHours is the one field that advances; the current datetime is
 * always derived (see currentStoryDatetime()), never stored.
 */
export interface PositionState {
  epochDate: string; // iso-datetime, normalized to Date#toISOString() form
  epochLocationId: string;
  epochSpot?: string;
  elapsedHours: number; // integer
  currentLocationId: string;
  currentSpot?: string;
}

export interface MnemoStory {
  id: string; // OC project id
  name: string;
  created_at: string;
  marker_memory_id: string; // OC memory id, needed to update the marker in place
  /** This story's dedicated Kindroid target (a single AI or a group chat),
   * if bound. See setKindroidTarget(). */
  kindroid_target?: KindroidTarget;
  /** The narrator persona label this story is written with, if set. See
   * setNarratorProfile(). */
  narrator_profile?: string;
  /** This story's in-story clock/place, if position tracking has been
   * started. See setPosition(). */
  position?: PositionState;
}

/** Exported for the pure marker tests; production callers go through
 * createStory / setKindroidTarget / setNarratorProfile. */
export function buildMarkerContent(
  name: string,
  createdAt: string,
  kindroidTarget?: KindroidTarget,
  narratorProfile?: string,
  position?: PositionState,
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
  if (narratorProfile) {
    lines.push(`${NARRATOR_PROFILE_PREFIX}${narratorProfile}`);
  }
  if (position) {
    lines.push(`${EPOCH_DATE_PREFIX}${position.epochDate}`);
    lines.push(`${EPOCH_LOCATION_PREFIX}${position.epochLocationId}`);
    if (position.epochSpot) {
      lines.push(`${EPOCH_SPOT_PREFIX}${position.epochSpot}`);
    }
    lines.push(`${ELAPSED_HOURS_PREFIX}${position.elapsedHours}`);
    lines.push(`${CURRENT_LOCATION_PREFIX}${position.currentLocationId}`);
    if (position.currentSpot) {
      lines.push(`${CURRENT_SPOT_PREFIX}${position.currentSpot}`);
    }
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

export interface ParsedMarker {
  name: string;
  created: string;
  kindroidTarget?: KindroidTarget;
  narratorProfile?: string;
  position?: PositionState;
}

function parseMarker(memory: OcMemory): ParsedMarker | null {
  return parseMarkerContent(memory.content);
}

function lineValue(lines: string[], prefix: string): string | undefined {
  const line = lines.find((l) => l.startsWith(prefix));
  const value = line?.slice(prefix.length).trim();
  return value || undefined;
}

/**
 * Parses the optional position block (Epoch-Date, Epoch-Location,
 * Epoch-Spot, Elapsed-Hours, Current-Location, Current-Spot). The atomic
 * invariant lives HERE, not only at write time (setPosition): Epoch-Date
 * and Epoch-Location are required together, so a marker missing either one
 * -- a hand-edit is the only way that can happen, since every write path
 * goes through setPosition -- parses as "position tracking not started"
 * (undefined), never a half-initialized object or a thrown error. An
 * unparseable Epoch-Date is treated the same way: not started, rather than
 * trusting a malformed date into current_story_datetime's arithmetic.
 */
function parsePositionState(lines: string[]): PositionState | undefined {
  const epochDate = lineValue(lines, EPOCH_DATE_PREFIX);
  const epochLocationId = lineValue(lines, EPOCH_LOCATION_PREFIX);
  if (!epochDate || !epochLocationId) return undefined;
  if (Number.isNaN(Date.parse(epochDate))) return undefined;

  const epochSpot = lineValue(lines, EPOCH_SPOT_PREFIX);
  const elapsedRaw = lineValue(lines, ELAPSED_HOURS_PREFIX);
  const elapsedHours =
    elapsedRaw !== undefined && /^-?\d+$/.test(elapsedRaw)
      ? parseInt(elapsedRaw, 10)
      : 0;
  // Current-Location defaults to the epoch location -- the state a fresh
  // setPosition() bootstrap always writes explicitly, so a missing value
  // here can only be a hand-edit; "hasn't moved yet" is the safe reading.
  const currentLocationId =
    lineValue(lines, CURRENT_LOCATION_PREFIX) ?? epochLocationId;
  const currentSpot = lineValue(lines, CURRENT_SPOT_PREFIX);

  return {
    epochDate,
    epochLocationId,
    ...(epochSpot && { epochSpot }),
    elapsedHours,
    currentLocationId,
    ...(currentSpot && { currentSpot }),
  };
}

/** Exported for the pure marker tests. */
export function parseMarkerContent(content: string): ParsedMarker | null {
  const lines = content.split("\n");
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

  const narratorLine = lines.find((line) =>
    line.startsWith(NARRATOR_PROFILE_PREFIX),
  );
  const narratorRaw = narratorLine
    ?.slice(NARRATOR_PROFILE_PREFIX.length)
    .trim();
  // A malformed label in a hand-edited marker is ignored rather than fatal:
  // the story must still resolve.
  const narratorProfile =
    narratorRaw && NARRATOR_PROFILE_PATTERN.test(narratorRaw)
      ? narratorRaw
      : undefined;

  const position = parsePositionState(lines);

  return {
    name: nameMatch[1],
    created: createdMatch[1],
    ...(kindroidTarget && { kindroidTarget }),
    ...(narratorProfile && { narratorProfile }),
    ...(position && { position }),
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
    ...(parsed.narratorProfile && {
      narrator_profile: parsed.narratorProfile,
    }),
    ...(parsed.position && { position: parsed.position }),
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
  narratorProfile?: string,
): Promise<MnemoStory> {
  if (narratorProfile !== undefined) assertNarratorProfile(narratorProfile);
  const project = await oc.projectCreate(name);
  const createdAt = new Date().toISOString();
  const marker = await oc.memorySave({
    content: buildMarkerContent(
      name,
      createdAt,
      kindroidTarget,
      narratorProfile,
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
    story.narrator_profile,
    story.position,
  );
  await oc.memoryUpdate({ memoryId: story.marker_memory_id, content });
  return { ...story, kindroid_target: kindroidTarget };
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
  const content = buildMarkerContent(
    story.name,
    story.created_at,
    story.kindroid_target,
    label,
    story.position,
  );
  await oc.memoryUpdate({ memoryId: story.marker_memory_id, content });
  const { narrator_profile: _dropped, ...rest } = story;
  void _dropped;
  return label === undefined ? rest : { ...rest, narrator_profile: label };
}

/**
 * Merges a partial mnemo_position_set-style update onto a story's current
 * position (or starts fresh, when current is undefined). The first call on
 * a story MUST supply epochDate + epochLocationId together -- that's what
 * "starts" tracking (throws otherwise); every later call may touch any
 * subset, and untouched fields keep their stored value. All elapsed-hours
 * arithmetic (advance/set_date/set_elapsed_hours) is resolved by the caller
 * via resolveElapsedHours() BEFORE calling this -- update.elapsedHours is
 * already the final number to store, or omitted to leave it unchanged. Pure:
 * no I/O, so it's the same function both mnemo_position_set's handler and
 * its unit tests exercise directly.
 */
export interface PositionUpdate {
  epochDate?: string;
  epochLocationId?: string;
  epochSpot?: string; // "" clears; omitted leaves unchanged
  elapsedHours?: number;
  currentLocationId?: string;
  currentSpot?: string; // "" clears; omitted leaves unchanged
}

function assertValidDatetime(value: string, field: string): void {
  if (Number.isNaN(Date.parse(value))) {
    throw new Error(`${field} "${value}" is not a valid date/time.`);
  }
}

function resolveSpot(
  update: string | undefined,
  fallback: string | undefined,
): string | undefined {
  if (update === undefined) return fallback;
  return update === "" ? undefined : update;
}

export function mergePositionUpdate(
  current: PositionState | undefined,
  update: PositionUpdate,
): PositionState {
  if (update.epochDate !== undefined) {
    assertValidDatetime(update.epochDate, "epoch_date");
  }
  const epochDate = update.epochDate
    ? new Date(Date.parse(update.epochDate)).toISOString()
    : undefined;

  if (!current) {
    if (epochDate === undefined || update.epochLocationId === undefined) {
      throw new Error(
        "Position tracking hasn't started for this story yet -- the first " +
          "mnemo_position_set call must supply both epoch_date and " +
          "epoch_location together.",
      );
    }
    const epochSpot = resolveSpot(update.epochSpot, undefined);
    const currentSpot =
      update.currentSpot !== undefined
        ? resolveSpot(update.currentSpot, undefined)
        : epochSpot;
    return {
      epochDate,
      epochLocationId: update.epochLocationId,
      ...(epochSpot !== undefined && { epochSpot }),
      elapsedHours: Math.round(update.elapsedHours ?? 0),
      currentLocationId: update.currentLocationId ?? update.epochLocationId,
      ...(currentSpot !== undefined && { currentSpot }),
    };
  }

  const epochSpot = resolveSpot(update.epochSpot, current.epochSpot);
  const currentSpot = resolveSpot(update.currentSpot, current.currentSpot);
  return {
    epochDate: epochDate ?? current.epochDate,
    epochLocationId: update.epochLocationId ?? current.epochLocationId,
    ...(epochSpot !== undefined && { epochSpot }),
    elapsedHours: Math.round(update.elapsedHours ?? current.elapsedHours),
    currentLocationId: update.currentLocationId ?? current.currentLocationId,
    ...(currentSpot !== undefined && { currentSpot }),
  };
}

export interface AdvanceAmount {
  hours?: number;
  days?: number;
  weeks?: number;
}

/**
 * Resolves the new elapsed_hours value for a mnemo_position_set/
 * mnemo_continue-style call, against `epochDate` -- pass the EFFECTIVE
 * epoch (update.epoch_date ?? current epoch), so a call that corrects the
 * epoch and sets a target date in the same call resolves against the new
 * epoch, not the stale one. At most one of advance / setElapsedHours /
 * setDate should be given (mutual exclusivity is validated in the tool
 * handler, per the codebase's existing kindroid_kin/kindroid_group_id
 * convention -- zod input schemas can't express cross-field invariants);
 * if more than one is given here anyway, advance wins, then setElapsedHours,
 * then setDate. Returns the current elapsed_hours unchanged when none is
 * given (a pure location-only update).
 *
 * set_date predating the epoch throws -- refused, not clamped, since it
 * would produce negative elapsed_hours and negative-elapsed/flashback
 * framing is explicitly out of scope (docs/POSITION_TRACKING_DESIGN.md).
 */
export function resolveElapsedHours(
  currentElapsedHours: number | undefined,
  epochDate: string | undefined,
  advance: AdvanceAmount | undefined,
  setElapsedHours: number | undefined,
  setDate: string | undefined,
): number {
  const base = currentElapsedHours ?? 0;
  if (advance) {
    const delta =
      (advance.hours ?? 0) +
      (advance.days ?? 0) * HOURS_PER_DAY +
      (advance.weeks ?? 0) * HOURS_PER_WEEK;
    return Math.round(base + delta);
  }
  if (setElapsedHours !== undefined) return Math.round(setElapsedHours);
  if (setDate !== undefined) {
    if (epochDate === undefined) {
      throw new Error(
        "set_date needs an epoch to compute against -- pass epoch_date in " +
          "this same call, or start position tracking first.",
      );
    }
    assertValidDatetime(setDate, "set_date");
    assertValidDatetime(epochDate, "epoch_date");
    const deltaMs = Date.parse(setDate) - Date.parse(epochDate);
    if (deltaMs < 0) {
      throw new Error(
        `set_date (${setDate}) predates the story's epoch (${epochDate}) -- ` +
          "refused, since it would produce negative elapsed time. Position " +
          "tracking doesn't support flashback framing; correct epoch_date " +
          "first if it's the one that's wrong.",
      );
    }
    return Math.round(deltaMs / 3_600_000);
  }
  return base;
}

/** epoch_date + elapsed_hours -- always derived, never stored, so
 * correcting the epoch later automatically reflows this for free. */
export function currentStoryDatetime(position: PositionState): string {
  return new Date(
    Date.parse(position.epochDate) + position.elapsedHours * 3_600_000,
  ).toISOString();
}

/**
 * Applies a merged position update to a story's marker, rewriting it in
 * place the same way setKindroidTarget/setNarratorProfile do -- name,
 * created_at, the Kindroid target, and the narrator profile all preserved
 * verbatim. See mergePositionUpdate() for the merge/bootstrap semantics.
 */
export async function setPosition(
  oc: OcClient,
  story: MnemoStory,
  update: PositionUpdate,
): Promise<MnemoStory> {
  const position = mergePositionUpdate(story.position, update);
  const content = buildMarkerContent(
    story.name,
    story.created_at,
    story.kindroid_target,
    story.narrator_profile,
    position,
  );
  await oc.memoryUpdate({ memoryId: story.marker_memory_id, content });
  return { ...story, position };
}
