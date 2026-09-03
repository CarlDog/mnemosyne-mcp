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
      "Schema: 4",
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
