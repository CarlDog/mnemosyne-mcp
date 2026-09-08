// Pure tests for position tracking's merge/arithmetic helpers
// (docs/POSITION_TRACKING_DESIGN.md): mergePositionUpdate, resolveElapsedHours,
// currentStoryDatetime. No OpenChronicle needed -- setPosition's OC-backed
// write path is exercised via the tool tests instead.

import { describe, it, expect } from "vitest";
import { type PositionState } from "../src/stories.js";
import {
  currentStoryDatetime,
  mergePositionUpdate,
  resolveElapsedHours,
} from "../src/position.js";

const FRESH: PositionState = {
  epochDate: "2026-10-01T00:00:00.000Z",
  epochLocationId: "loc-epoch-1",
  elapsedHours: 0,
  currentLocationId: "loc-epoch-1",
};

describe("mergePositionUpdate (pure)", () => {
  it("throws when bootstrapping without epoch_date + epoch_location together", () => {
    expect(() =>
      mergePositionUpdate(undefined, { epochDate: "2026-10-01T00:00:00Z" }),
    ).toThrow(/hasn't started/i);
    expect(() =>
      mergePositionUpdate(undefined, { epochLocationId: "loc-1" }),
    ).toThrow(/hasn't started/i);
    expect(() => mergePositionUpdate(undefined, {})).toThrow(/hasn't started/i);
  });

  it("bootstraps with elapsed_hours defaulted to 0 and current defaulted to the epoch", () => {
    const result = mergePositionUpdate(undefined, {
      epochDate: "2026-10-01T00:00:00Z",
      epochLocationId: "loc-epoch-1",
    });
    expect(result).toEqual({
      epochDate: "2026-10-01T00:00:00.000Z",
      epochLocationId: "loc-epoch-1",
      elapsedHours: 0,
      currentLocationId: "loc-epoch-1",
    });
  });

  it("bootstraps epoch_spot defaulting into current_spot when current_spot is omitted", () => {
    const result = mergePositionUpdate(undefined, {
      epochDate: "2026-10-01T00:00:00Z",
      epochLocationId: "loc-epoch-1",
      epochSpot: "the porch",
    });
    expect(result.epochSpot).toBe("the porch");
    expect(result.currentSpot).toBe("the porch");
  });

  it("bootstraps with an explicit current_location/current_spot overriding the epoch defaults", () => {
    const result = mergePositionUpdate(undefined, {
      epochDate: "2026-10-01T00:00:00Z",
      epochLocationId: "loc-epoch-1",
      epochSpot: "the porch",
      currentLocationId: "loc-current-2",
      currentSpot: "the kitchen",
    });
    expect(result.currentLocationId).toBe("loc-current-2");
    expect(result.currentSpot).toBe("the kitchen");
  });

  it("normalizes epoch_date to a canonical ISO string regardless of input format", () => {
    const result = mergePositionUpdate(undefined, {
      epochDate: "2026-10-01",
      epochLocationId: "loc-epoch-1",
    });
    expect(result.epochDate).toBe("2026-10-01T00:00:00.000Z");
  });

  it("throws on an unparseable epoch_date", () => {
    expect(() =>
      mergePositionUpdate(undefined, {
        epochDate: "not-a-date",
        epochLocationId: "loc-epoch-1",
      }),
    ).toThrow(/not a valid date/i);
  });

  it("setting only current_location leaves elapsed_hours untouched, and vice versa", () => {
    const advanced = { ...FRESH, elapsedHours: 78 };
    const locationOnly = mergePositionUpdate(advanced, {
      currentLocationId: "loc-new",
    });
    expect(locationOnly.elapsedHours).toBe(78);
    expect(locationOnly.currentLocationId).toBe("loc-new");

    const timeOnly = mergePositionUpdate(advanced, { elapsedHours: 90 });
    expect(timeOnly.currentLocationId).toBe(advanced.currentLocationId);
    expect(timeOnly.elapsedHours).toBe(90);
  });

  it("correcting epoch_date after elapsed_hours is non-zero leaves elapsed_hours unchanged", () => {
    const advanced = { ...FRESH, elapsedHours: 78 };
    const corrected = mergePositionUpdate(advanced, {
      epochDate: "2026-09-25T00:00:00Z",
    });
    expect(corrected.elapsedHours).toBe(78);
    expect(corrected.epochDate).toBe("2026-09-25T00:00:00.000Z");
  });

  it("an empty-string spot clears it; omitting the field leaves it unchanged", () => {
    const withSpots = {
      ...FRESH,
      epochSpot: "the porch",
      currentSpot: "the kitchen",
    };
    const cleared = mergePositionUpdate(withSpots, {
      epochSpot: "",
      currentSpot: "",
    });
    expect(cleared.epochSpot).toBeUndefined();
    expect(cleared.currentSpot).toBeUndefined();

    const untouched = mergePositionUpdate(withSpots, {
      currentLocationId: "loc-new",
    });
    expect(untouched.epochSpot).toBe("the porch");
    expect(untouched.currentSpot).toBe("the kitchen");
  });
});

describe("resolveElapsedHours (pure)", () => {
  const EPOCH = "2026-10-01T00:00:00.000Z";

  it("accumulates advance across successive calls rather than overwriting", () => {
    const afterDays = resolveElapsedHours(
      0,
      EPOCH,
      { days: 3 },
      undefined,
      undefined,
    );
    expect(afterDays).toBe(72);
    const afterHours = resolveElapsedHours(
      afterDays,
      EPOCH,
      { hours: 6 },
      undefined,
      undefined,
    );
    expect(afterHours).toBe(78);
  });

  it("advance combines hours/days/weeks in one call", () => {
    expect(
      resolveElapsedHours(
        0,
        EPOCH,
        { hours: 2, days: 1, weeks: 1 },
        undefined,
        undefined,
      ),
    ).toBe(2 + 24 + 168);
  });

  it("set_elapsed_hours is an absolute jump, ignoring the current value", () => {
    expect(resolveElapsedHours(500, EPOCH, undefined, 10, undefined)).toBe(10);
  });

  it("set_date computes the delta against the epoch", () => {
    // Epoch + 3 days exactly.
    expect(
      resolveElapsedHours(
        0,
        EPOCH,
        undefined,
        undefined,
        "2026-10-04T00:00:00Z",
      ),
    ).toBe(72);
  });

  it("set_date to a target before the current derived date but after the epoch decreases elapsed_hours without refusing", () => {
    // Currently 5 days in; set_date to epoch + 2 days.
    expect(
      resolveElapsedHours(
        120,
        EPOCH,
        undefined,
        undefined,
        "2026-10-03T00:00:00Z",
      ),
    ).toBe(48);
  });

  it("set_date predating the epoch itself throws and computes nothing", () => {
    expect(() =>
      resolveElapsedHours(
        0,
        EPOCH,
        undefined,
        undefined,
        "2026-09-30T00:00:00Z",
      ),
    ).toThrow(/predates the story's epoch/i);
  });

  it("returns the current value unchanged when none of advance/set_elapsed_hours/set_date is given", () => {
    expect(
      resolveElapsedHours(42, EPOCH, undefined, undefined, undefined),
    ).toBe(42);
    expect(
      resolveElapsedHours(undefined, EPOCH, undefined, undefined, undefined),
    ).toBe(0);
  });

  it("rounds a fractional advance to the nearest integer hour", () => {
    expect(
      resolveElapsedHours(0, EPOCH, { hours: 1.5 }, undefined, undefined),
    ).toBe(2);
  });

  // Regression pin (advisor-flagged 2026-09-08): set_date already refused a
  // result before the epoch; advance and set_elapsed_hours did not, letting
  // e.g. set_elapsed_hours: -10 silently corrupt current_story_datetime to
  // before the epoch -- the exact outcome the design doc frames as a
  // categorical exclusion, not a set_date-specific one.
  it("a negative advance that would land elapsed_hours below zero throws", () => {
    expect(() =>
      resolveElapsedHours(5, EPOCH, { hours: -10 }, undefined, undefined),
    ).toThrow(/before the story's epoch/i);
  });

  it("a negative set_elapsed_hours throws", () => {
    expect(() =>
      resolveElapsedHours(5, EPOCH, undefined, -10, undefined),
    ).toThrow(/before the story's epoch/i);
  });

  it("a negative advance that keeps the result >= 0 is legal -- a deliberate walk-back", () => {
    expect(
      resolveElapsedHours(10, EPOCH, { hours: -4 }, undefined, undefined),
    ).toBe(6);
  });

  it("set_elapsed_hours: 0 (exactly at the epoch) is legal", () => {
    expect(resolveElapsedHours(10, EPOCH, undefined, 0, undefined)).toBe(0);
  });

  it("set_date with no epoch to compute against throws a clear error", () => {
    expect(() =>
      resolveElapsedHours(undefined, undefined, undefined, undefined, EPOCH),
    ).toThrow(/needs an epoch/i);
  });
});

describe("currentStoryDatetime (pure)", () => {
  it("derives epoch_date + elapsed_hours", () => {
    expect(currentStoryDatetime({ ...FRESH, elapsedHours: 78 })).toBe(
      "2026-10-04T06:00:00.000Z",
    );
  });

  it("reflows automatically when the epoch is corrected, with elapsed_hours held fixed", () => {
    const advanced = { ...FRESH, elapsedHours: 78 };
    const before = currentStoryDatetime(advanced);
    const corrected = mergePositionUpdate(advanced, {
      epochDate: "2026-09-25T00:00:00Z",
    });
    const after = currentStoryDatetime(corrected);
    // Epoch moved back exactly 6 days -- current_story_datetime shifts by
    // the same 6-day delta, elapsed_hours untouched.
    expect(Date.parse(before) - Date.parse(after)).toBe(6 * 24 * 3_600_000);
  });
});
