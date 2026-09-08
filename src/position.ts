// A story's optional in-story clock/place (docs/POSITION_TRACKING_DESIGN.md,
// ratified 2026-09-07). Split out of stories.ts (phase-end audit, 2026-09-08)
// -- the marker STORAGE FORMAT (PositionState, parsePositionState) stays in
// stories.ts since it's a core part of the marker's own parsing; this file
// holds the merge/arithmetic/validate-then-apply logic layered on top, which
// only touches the marker as a storage detail via buildMarkerContent/
// findStory. No behavior change from the split -- see git history for the
// pre-split version if a diff is ever needed.

import { type OcClient } from "./oc-client.js";
import { getEntityByMemoryId } from "./entities.js";
import {
  buildMarkerContent,
  findStory,
  type MnemoStory,
  type PositionState,
} from "./stories.js";

const HOURS_PER_DAY = 24;
const HOURS_PER_WEEK = 168;

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

/** Shared verbatim between mergePositionUpdate's own bootstrap check and
 * applyPositionUpdate's early guard below, so advance/set_elapsed_hours/
 * set_date/move_to on an untracked story all fail with the identical
 * message pointing at mnemo_position_set -- not whichever of the two
 * checks happened to run first for that particular param. */
export const POSITION_NOT_STARTED_MESSAGE =
  "Position tracking hasn't started for this story yet -- the first " +
  "mnemo_position_set call must supply both epoch_date and " +
  "epoch_location together.";

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
      throw new Error(POSITION_NOT_STARTED_MESSAGE);
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
 * Any branch that would land elapsed_hours below zero throws -- refused,
 * not clamped, since it would produce negative elapsed_hours and
 * negative-elapsed/flashback framing is explicitly out of scope
 * (docs/POSITION_TRACKING_DESIGN.md's "Explicitly out of scope" section
 * frames this as a categorical decision, not a set_date-specific one). A
 * negative `advance` component or a below-current `set_elapsed_hours` is
 * still legal on its own -- e.g. `advance: { days: -1 }` to walk back an
 * over-advance -- as long as the RESULT stays >= 0, mirroring the same
 * "epoch correction can decrease elapsed" allowance set_date already had.
 */
export function resolveElapsedHours(
  currentElapsedHours: number | undefined,
  epochDate: string | undefined,
  advance: AdvanceAmount | undefined,
  setElapsedHours: number | undefined,
  setDate: string | undefined,
): number {
  const base = currentElapsedHours ?? 0;
  let result: number;
  if (advance) {
    const delta =
      (advance.hours ?? 0) +
      (advance.days ?? 0) * HOURS_PER_DAY +
      (advance.weeks ?? 0) * HOURS_PER_WEEK;
    result = Math.round(base + delta);
  } else if (setElapsedHours !== undefined) {
    result = Math.round(setElapsedHours);
  } else if (setDate !== undefined) {
    if (epochDate === undefined) {
      throw new Error(
        "set_date needs an epoch to compute against -- pass epoch_date in " +
          "this same call, or start position tracking first.",
      );
    }
    assertValidDatetime(setDate, "set_date");
    assertValidDatetime(epochDate, "epoch_date");
    const deltaMs = Date.parse(setDate) - Date.parse(epochDate);
    result = Math.round(deltaMs / 3_600_000);
  } else {
    return base;
  }

  if (result < 0) {
    throw new Error(
      setDate !== undefined
        ? `set_date (${setDate}) predates the story's epoch (${epochDate}) -- ` +
            "refused, since it would produce negative elapsed time. Position " +
            "tracking doesn't support flashback framing; correct epoch_date " +
            "first if it's the one that's wrong."
        : `This would move elapsed_hours to ${result} (before the story's ` +
            "epoch) -- refused, since position tracking doesn't support " +
            "flashback framing. Pass a smaller magnitude, or correct " +
            "epoch_date first if it's the one that's wrong.",
    );
  }
  return result;
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

/** Validates a caller-supplied memory_id actually resolves to a
 * type:location entity in this story -- cheap, since resolving it for a
 * display name is required either way (mnemo_position_get/getContext), and
 * it turns a silent mismatch (pointing position at a character by mistake)
 * into a clear error. Shared by mnemo_position_set and mnemo_continue's
 * move_to (via applyPositionUpdate below). */
async function resolveLocationId(
  oc: OcClient,
  storyId: string,
  memoryId: string | undefined,
  field: string,
): Promise<string | undefined> {
  if (memoryId === undefined) return undefined;
  const entity = await getEntityByMemoryId(oc, storyId, memoryId);
  if (!entity) {
    throw new Error(
      `${field} "${memoryId}" doesn't resolve to an entity in this story.`,
    );
  }
  if (entity.type !== "location") {
    throw new Error(
      `${field} "${memoryId}" resolves to a ${entity.type} entity, not a location.`,
    );
  }
  return memoryId;
}

export interface ApplyPositionUpdateArgs {
  epochDate?: string;
  epochLocation?: string; // memory_id
  epochSpot?: string;
  advance?: AdvanceAmount;
  setElapsedHours?: number;
  setDate?: string;
  currentLocation?: string; // memory_id
  currentSpot?: string;
}

/**
 * The full validate-then-apply sequence mnemo_position_set and
 * mnemo_continue's advance/set_date/move_to convenience params share:
 * resolve the story, mutual-exclusivity check (advance/setElapsedHours/
 * setDate), location-type validation, elapsed-hours resolution against the
 * EFFECTIVE epoch (a same-call epochDate correction, if given, wins over
 * the story's existing one -- see resolveElapsedHours's doc comment), and
 * the merge-then-write via setPosition. Single OC-mutation chokepoint for
 * position, so mnemo_continue's convenience params can't drift from
 * mnemo_position_set's own semantics.
 *
 * The atomic invariant enforced inside mergePositionUpdate (called via
 * setPosition) doubles as the "position tracking isn't started" refusal
 * mnemo_continue's convenience params need for free: none of
 * advance/setDate/moveTo can supply epochDate/epochLocation, so calling any
 * of them against an untracked story reaches mergePositionUpdate's bootstrap
 * branch and throws before any OC write.
 */
export async function applyPositionUpdate(
  oc: OcClient,
  storyId: string,
  args: ApplyPositionUpdateArgs,
): Promise<MnemoStory> {
  const story = await findStory(oc, storyId);
  if (!story) {
    throw new Error(
      `Story ${storyId} could not be found -- it may have been deleted.`,
    );
  }

  // advance/set_elapsed_hours/set_date/move_to all eventually reach
  // mergePositionUpdate's own bootstrap check via setPosition -- except
  // set_date, which needs an epoch to compute a delta against and so
  // throws its own, different-worded error from resolveElapsedHours
  // BEFORE getting there. Guard here so every convenience param fails
  // identically on an untracked story, regardless of which one was called.
  if (!story.position && args.epochDate === undefined) {
    throw new Error(POSITION_NOT_STARTED_MESSAGE);
  }

  const exclusive = [args.advance, args.setElapsedHours, args.setDate].filter(
    (v) => v !== undefined,
  ).length;
  if (exclusive > 1) {
    throw new Error(
      "Pass at most one of advance / set_elapsed_hours / set_date -- they all resolve the same elapsed_hours value.",
    );
  }

  const epochLocationId = await resolveLocationId(
    oc,
    storyId,
    args.epochLocation,
    "epoch_location",
  );
  const currentLocationId = await resolveLocationId(
    oc,
    storyId,
    args.currentLocation,
    "current_location",
  );

  const effectiveEpochDate = args.epochDate ?? story.position?.epochDate;
  const elapsedHours =
    args.advance !== undefined ||
    args.setElapsedHours !== undefined ||
    args.setDate !== undefined
      ? resolveElapsedHours(
          story.position?.elapsedHours,
          effectiveEpochDate,
          args.advance,
          args.setElapsedHours,
          args.setDate,
        )
      : undefined;

  return setPosition(oc, story, {
    epochDate: args.epochDate,
    epochLocationId,
    epochSpot: args.epochSpot,
    elapsedHours,
    currentLocationId,
    currentSpot: args.currentSpot,
  });
}
