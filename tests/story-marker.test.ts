// Pure tests for the story marker's content format (stories.ts): the
// narrator-profile line added by KINDROID_NARRATOR_DESIGN S2 (2026-09-03),
// its round-trip with the Kindroid target line, and the backward-compat
// promises the header comment makes. No OpenChronicle needed; the OC-backed
// createStory/setNarratorProfile paths are exercised in stories.test.ts.

import { describe, it, expect } from "vitest";
import {
  assertNarratorProfile,
  buildMarkerContent,
  narratorTag,
  NARRATOR_PROFILE_PATTERN,
  parseMarkerContent,
} from "../src/stories.js";

const CREATED = "2026-09-03T18:00:00.000Z";

describe("story marker content (pure)", () => {
  it("round-trips name, created, target, and narrator profile", () => {
    const content = buildMarkerContent(
      "Halvard",
      CREATED,
      { type: "ai", id: "kin-1" },
      "storyteller-v1",
    );
    expect(content.split("\n")).toEqual([
      "[Mnemosyne Story] Halvard",
      `Created: ${CREATED}`,
      "Schema: 6",
      "Kindroid-Target: ai:kin-1",
      "Narrator-Profile: storyteller-v1",
    ]);
    expect(parseMarkerContent(content)).toEqual({
      name: "Halvard",
      created: CREATED,
      kindroidTarget: { type: "ai", id: "kin-1" },
      narratorProfile: "storyteller-v1",
    });
  });

  it("omits the narrator line when no profile is set, and parses its absence as undefined", () => {
    const content = buildMarkerContent("Halvard", CREATED, {
      type: "group",
      id: "g-1",
    });
    expect(content).not.toContain("Narrator-Profile");
    expect(parseMarkerContent(content)).toEqual({
      name: "Halvard",
      created: CREATED,
      kindroidTarget: { type: "group", id: "g-1" },
    });
  });

  it("still reads schema-3 and legacy schema-2 markers", () => {
    const schema3 = [
      "[Mnemosyne Story] Old",
      `Created: ${CREATED}`,
      "Schema: 3",
      "Kindroid-Target: ai:kin-old",
    ].join("\n");
    expect(parseMarkerContent(schema3)).toEqual({
      name: "Old",
      created: CREATED,
      kindroidTarget: { type: "ai", id: "kin-old" },
    });
    const schema2 = [
      "[Mnemosyne Story] Older",
      `Created: ${CREATED}`,
      "Schema: 2",
      "Kindroid-Kin: kin-legacy",
    ].join("\n");
    expect(parseMarkerContent(schema2)?.kindroidTarget).toEqual({
      type: "ai",
      id: "kin-legacy",
    });
  });

  it("ignores a malformed narrator line rather than failing the story", () => {
    const content = [
      "[Mnemosyne Story] Odd",
      `Created: ${CREATED}`,
      "Schema: 4",
      "Narrator-Profile: has spaces and !",
    ].join("\n");
    const parsed = parseMarkerContent(content);
    expect(parsed?.name).toBe("Odd");
    expect(parsed?.narratorProfile).toBeUndefined();
  });

  it("rejects labels that would not survive a tag or a marker line", () => {
    expect(() => assertNarratorProfile("storyteller-v1")).not.toThrow();
    expect(() => assertNarratorProfile("Story.Teller_2")).not.toThrow();
    for (const bad of [
      "",
      " lead",
      "has space",
      "-lead",
      "a".repeat(65),
      "x:y",
    ]) {
      expect(() => assertNarratorProfile(bad)).toThrow(/narrator_profile/);
      expect(NARRATOR_PROFILE_PATTERN.test(bad)).toBe(false);
    }
  });

  it("derives the scene tag from the label", () => {
    expect(narratorTag("storyteller-v1")).toBe("narrator:storyteller-v1");
  });
});

describe("story marker content rating (pure)", () => {
  it("round-trips a content rating alongside target and narrator profile", () => {
    const content = buildMarkerContent(
      "Halvard",
      CREATED,
      { type: "ai", id: "kin-1" },
      "storyteller-v1",
      undefined,
      "nsfw",
    );
    expect(content.split("\n")).toEqual([
      "[Mnemosyne Story] Halvard",
      `Created: ${CREATED}`,
      "Schema: 6",
      "Kindroid-Target: ai:kin-1",
      "Narrator-Profile: storyteller-v1",
      "Content-Rating: nsfw",
    ]);
    expect(parseMarkerContent(content)).toEqual({
      name: "Halvard",
      created: CREATED,
      kindroidTarget: { type: "ai", id: "kin-1" },
      narratorProfile: "storyteller-v1",
      contentRating: "nsfw",
    });
  });

  it("omits the Content-Rating line when unset, and parses its absence as undefined", () => {
    const content = buildMarkerContent("Halvard", CREATED, {
      type: "group",
      id: "g-1",
    });
    expect(content).not.toContain("Content-Rating");
    expect(parseMarkerContent(content)?.contentRating).toBeUndefined();
  });

  it("ignores a malformed content rating rather than failing the story", () => {
    const content = [
      "[Mnemosyne Story] Odd",
      `Created: ${CREATED}`,
      "Schema: 6",
      "Content-Rating: extremely-mature",
    ].join("\n");
    const parsed = parseMarkerContent(content);
    expect(parsed?.name).toBe("Odd");
    expect(parsed?.contentRating).toBeUndefined();
  });

  it("a schema-6 marker with no Content-Rating line parses identically in meaning to a schema-5 marker", () => {
    const content = buildMarkerContent(
      "Halvard",
      CREATED,
      { type: "ai", id: "kin-1" },
      "storyteller-v1",
    );
    expect(content).not.toContain("Content-Rating");
    const parsed = parseMarkerContent(content);
    expect(parsed?.contentRating).toBeUndefined();
    const schema5 = [
      "[Mnemosyne Story] Halvard",
      `Created: ${CREATED}`,
      "Schema: 5",
      "Kindroid-Target: ai:kin-1",
      "Narrator-Profile: storyteller-v1",
    ].join("\n");
    expect(parseMarkerContent(schema5)).toEqual(parsed);
  });

  it("accepts both sfw and nsfw as valid values", () => {
    for (const rating of ["sfw", "nsfw"] as const) {
      const content = buildMarkerContent(
        "Halvard",
        CREATED,
        undefined,
        undefined,
        undefined,
        rating,
      );
      expect(parseMarkerContent(content)?.contentRating).toBe(rating);
    }
  });
});

describe("story marker position block (pure)", () => {
  const POSITION = {
    epochDate: "2026-10-01T00:00:00.000Z",
    epochLocationId: "loc-epoch-1",
    epochSpot: "the porch",
    elapsedHours: 78,
    currentLocationId: "loc-current-2",
    currentSpot: "the kitchen",
  };

  it("round-trips a full position block alongside target and narrator profile", () => {
    const content = buildMarkerContent(
      "Halvard",
      CREATED,
      { type: "ai", id: "kin-1" },
      "storyteller-v1",
      POSITION,
    );
    expect(content.split("\n")).toEqual([
      "[Mnemosyne Story] Halvard",
      `Created: ${CREATED}`,
      "Schema: 6",
      "Kindroid-Target: ai:kin-1",
      "Narrator-Profile: storyteller-v1",
      "Epoch-Date: 2026-10-01T00:00:00.000Z",
      "Epoch-Location: loc-epoch-1",
      "Epoch-Spot: the porch",
      "Elapsed-Hours: 78",
      "Current-Location: loc-current-2",
      "Current-Spot: the kitchen",
    ]);
    expect(parseMarkerContent(content)).toEqual({
      name: "Halvard",
      created: CREATED,
      kindroidTarget: { type: "ai", id: "kin-1" },
      narratorProfile: "storyteller-v1",
      position: POSITION,
    });
  });

  it("omits epoch_spot/current_spot lines when unset, and parses their absence as undefined", () => {
    const { epochSpot: _es, currentSpot: _cs, ...rest } = POSITION;
    void _es;
    void _cs;
    const content = buildMarkerContent(
      "Halvard",
      CREATED,
      undefined,
      undefined,
      rest,
    );
    expect(content).not.toContain("Epoch-Spot");
    expect(content).not.toContain("Current-Spot");
    expect(parseMarkerContent(content)?.position).toEqual(rest);
  });

  it("a schema-5 marker with no position lines parses identically in meaning to a schema-4 marker -- position is entirely absent", () => {
    const content = buildMarkerContent(
      "Halvard",
      CREATED,
      { type: "ai", id: "kin-1" },
      "storyteller-v1",
    );
    expect(content).not.toContain("Epoch-");
    expect(content).not.toContain("Elapsed-Hours");
    expect(content).not.toContain("Current-");
    const parsed = parseMarkerContent(content);
    expect(parsed?.position).toBeUndefined();
    // Same shape a schema-4 marker (no position lines at all) parses to.
    const schema4 = [
      "[Mnemosyne Story] Halvard",
      `Created: ${CREATED}`,
      "Schema: 4",
      "Kindroid-Target: ai:kin-1",
      "Narrator-Profile: storyteller-v1",
    ].join("\n");
    expect(parseMarkerContent(schema4)).toEqual(parsed);
  });

  it("the atomic invariant is enforced in the parser: Elapsed-Hours with no Epoch-Date parses as not-started, not a crash or a half-populated object", () => {
    const handEdited = [
      "[Mnemosyne Story] Odd",
      `Created: ${CREATED}`,
      "Schema: 5",
      "Elapsed-Hours: 40",
      "Current-Location: loc-current-2",
    ].join("\n");
    const parsed = parseMarkerContent(handEdited);
    expect(parsed?.name).toBe("Odd");
    expect(parsed?.position).toBeUndefined();
  });

  it("the atomic invariant also catches Epoch-Date with no Epoch-Location", () => {
    const handEdited = [
      "[Mnemosyne Story] Odd",
      `Created: ${CREATED}`,
      "Schema: 5",
      "Epoch-Date: 2026-10-01T00:00:00.000Z",
    ].join("\n");
    expect(parseMarkerContent(handEdited)?.position).toBeUndefined();
  });

  it("an unparseable Epoch-Date parses as not-started rather than corrupting derived arithmetic", () => {
    const handEdited = [
      "[Mnemosyne Story] Odd",
      `Created: ${CREATED}`,
      "Schema: 5",
      "Epoch-Date: not-a-date",
      "Epoch-Location: loc-epoch-1",
    ].join("\n");
    expect(parseMarkerContent(handEdited)?.position).toBeUndefined();
  });

  it("Current-Location defaults to Epoch-Location and Elapsed-Hours defaults to 0 when hand-edited without them", () => {
    const handEdited = [
      "[Mnemosyne Story] Fresh",
      `Created: ${CREATED}`,
      "Schema: 5",
      "Epoch-Date: 2026-10-01T00:00:00.000Z",
      "Epoch-Location: loc-epoch-1",
    ].join("\n");
    expect(parseMarkerContent(handEdited)?.position).toEqual({
      epochDate: "2026-10-01T00:00:00.000Z",
      epochLocationId: "loc-epoch-1",
      elapsedHours: 0,
      currentLocationId: "loc-epoch-1",
    });
  });
});
