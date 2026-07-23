// Phase B integration test against real OpenChronicle.
// Pure unit tests run unconditionally; integration tests skip without OC_URL.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { OcClient } from "../src/oc-client.js";
import { createStory } from "../src/stories.js";
import {
  deleteEntity,
  parseEntityContent,
  recall,
  saveEntity,
} from "../src/entities.js";
import { teardownStory, testStoryName } from "./helpers.js";

describe("entities — pure", () => {
  it("parseEntityContent round-trips a well-formed entity", () => {
    const content = "[Character] Aria Voss\n\nA weathered cartographer.";
    const parsed = parseEntityContent(content);
    expect(parsed?.type).toBe("character");
    expect(parsed?.name).toBe("Aria Voss");
    expect(parsed?.body).toBe("A weathered cartographer.");
  });

  it("parseEntityContent preserves multi-line bodies", () => {
    const content =
      "[Lore] The Cartography Guild\n\nFounded centuries ago.\n\nMembership is hereditary.";
    const parsed = parseEntityContent(content);
    expect(parsed?.body).toBe(
      "Founded centuries ago.\n\nMembership is hereditary.",
    );
  });

  it("parseEntityContent rejects non-entity shapes", () => {
    expect(
      parseEntityContent(
        "[Mnemosyne Story] Some Story\nCreated: 2026-05-11\nSchema: 1",
      ),
    ).toBeNull();
    expect(parseEntityContent("Random text with no header")).toBeNull();
    expect(parseEntityContent("[BadType] Name\n\nbody")).toBeNull();
  });
});

const OC_URL = process.env.OC_URL;

const suite = OC_URL ? describe : describe.skip;

suite("Phase B — entities (real OC)", () => {
  let oc: OcClient;
  let storyId: string;

  beforeAll(async () => {
    oc = new OcClient(new URL(OC_URL!));
    await oc.connect();
    const story = await createStory(oc, testStoryName("entities"));
    storyId = story.id;
  });

  afterAll(async () => {
    await teardownStory(oc, storyId);
  });

  it("creates a new character (default unpinned)", async () => {
    const res = await saveEntity(oc, storyId, {
      type: "character",
      name: "Aria Voss",
      body: "A weathered cartographer with a missing left ear.",
    });
    expect(res.created).toBe(true);
    expect(res.pinned).toBe(false);
    expect(res.entity.type).toBe("character");
    expect(res.entity.name).toBe("Aria Voss");
    expect(res.memory_id).toBeTruthy();
  });

  it("creates a rule (default pinned)", async () => {
    const res = await saveEntity(oc, storyId, {
      type: "rule",
      name: "POV constraint",
      body: "Third-limited from Aria's perspective. Never break to omniscient.",
    });
    expect(res.created).toBe(true);
    expect(res.pinned).toBe(true);
  });

  it("overwrites by (type, name); pin state preserved by default", async () => {
    const res = await saveEntity(oc, storyId, {
      type: "character",
      name: "Aria Voss",
      body: "A weathered cartographer with a missing left ear and a fox companion.",
    });
    expect(res.created).toBe(false);
    expect(res.pinned).toBe(false); // was unpinned, still unpinned
  });

  it("explicit pinned=true on update flips pin state", async () => {
    const res = await saveEntity(oc, storyId, {
      type: "character",
      name: "Aria Voss",
      body: "A weathered cartographer with a missing left ear, a fox companion, and a pinned dossier.",
      pinned: true,
    });
    expect(res.created).toBe(false);
    expect(res.pinned).toBe(true);
  });

  it("recall filters by type", async () => {
    const characters = await recall(oc, storyId, { type: "character" });
    expect(characters.length).toBeGreaterThanOrEqual(1);
    expect(characters.every((e) => e.type === "character")).toBe(true);
    expect(characters.find((e) => e.name === "Aria Voss")).toBeDefined();
  });

  it("recall without type returns all entity types", async () => {
    const all = await recall(oc, storyId, { limit: 100 });
    expect(all.find((e) => e.type === "character")).toBeDefined();
    expect(all.find((e) => e.type === "rule")).toBeDefined();
    // Story marker has different tags/format and must not surface
    expect(all.find((e) => /Mnemosyne Story/.test(e.name))).toBeUndefined();
  });

  it("recall respects limit", async () => {
    const limited = await recall(oc, storyId, { limit: 1 });
    expect(limited.length).toBe(1);
  });

  it("deletes an entity by (type, name); recall no longer returns it", async () => {
    await saveEntity(oc, storyId, {
      type: "lore",
      name: "Throwaway lore",
      body: "Will be deleted in the next test step.",
    });
    const beforeDelete = await recall(oc, storyId, { type: "lore" });
    expect(beforeDelete.find((e) => e.name === "Throwaway lore")).toBeDefined();

    const res = await deleteEntity(oc, storyId, "lore", "Throwaway lore");
    expect(res.type).toBe("lore");
    expect(res.name).toBe("Throwaway lore");
    expect(res.memory_id).toBeTruthy();

    const afterDelete = await recall(oc, storyId, { type: "lore" });
    expect(
      afterDelete.find((e) => e.name === "Throwaway lore"),
    ).toBeUndefined();
  });

  it("deleteEntity throws when no match exists", async () => {
    await expect(
      deleteEntity(oc, storyId, "character", "Definitely Not Here"),
    ).rejects.toThrow(/no character named/i);
  });
});
