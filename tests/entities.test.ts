// Phase B integration test against real OpenChronicle.
// Pure unit tests run unconditionally; integration tests skip without OC_URL.

import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import type { OcClient } from "../src/oc-client.js";
import {
  deleteEntity,
  filterListedEntities,
  parseEntityContent,
  recall,
  retagValidation,
  saveEntity,
  type RecalledEntity,
} from "../src/entities.js";
import { setupTestStory, teardownStory } from "./helpers.js";

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

describe("filterListedEntities (pure)", () => {
  const character: RecalledEntity = {
    type: "character",
    name: "Aria Voss",
    body: "A weathered cartographer.",
    memory_id: "mem-char",
    pinned: false,
    tags: ["mnemosyne", "story", "character"],
    created_at: "2026-01-01T00:00:00Z",
  };
  const scene: RecalledEntity = {
    type: "scene",
    name: "Scene 2026-01-02T00:00:00.000Z",
    body: "A long generated beat that could run to thousands of words.",
    memory_id: "mem-scene",
    pinned: false,
    tags: ["mnemosyne", "story", "scene"],
    created_at: "2026-01-02T00:00:00Z",
    updated_at: "2026-01-02T00:00:00Z",
  };
  const entities = [character, scene];

  it("strips body by default", () => {
    const result = filterListedEntities(entities, {});
    expect(result).toHaveLength(2);
    for (const e of result) {
      expect(e).not.toHaveProperty("body");
    }
    // Every other field survives the strip.
    expect(result[0]).toMatchObject({
      memory_id: "mem-char",
      type: "character",
      name: "Aria Voss",
      pinned: false,
      tags: character.tags,
      created_at: character.created_at,
    });
  });

  it("keeps body when includeBody is true", () => {
    const result = filterListedEntities(entities, { includeBody: true });
    expect(result).toEqual(entities);
  });

  it("filters to one type", () => {
    const result = filterListedEntities(entities, {
      type: "scene",
      includeBody: true,
    });
    expect(result).toEqual([scene]);
  });

  it("filter and body-strip compose", () => {
    const result = filterListedEntities(entities, { type: "character" });
    expect(result).toHaveLength(1);
    expect(result[0]).not.toHaveProperty("body");
    expect(result[0]).toMatchObject({ name: "Aria Voss" });
  });

  it("returns an empty array, not undefined, when nothing matches", () => {
    expect(filterListedEntities(entities, { type: "lore" })).toEqual([]);
  });

  it("query matches on name (case-insensitive)", () => {
    const result = filterListedEntities(entities, {
      query: "aria",
      includeBody: true,
    });
    expect(result).toEqual([character]);
  });

  it("query matches on body even when the name doesn't contain it", () => {
    const result = filterListedEntities(entities, {
      query: "thousands",
      includeBody: true,
    });
    expect(result).toEqual([scene]);
  });

  it("a body-only match still has its body stripped when includeBody is false (filter runs before strip)", () => {
    const result = filterListedEntities(entities, { query: "thousands" });
    expect(result).toHaveLength(1);
    expect(result[0]).not.toHaveProperty("body");
    expect(result[0]).toMatchObject({ memory_id: "mem-scene" });
  });

  it("type and query compose", () => {
    const result = filterListedEntities(entities, {
      type: "character",
      query: "thousands", // only in scene's body -- character shouldn't match
    });
    expect(result).toEqual([]);
  });
});

describe("entities — retagValidation (pure)", () => {
  it("strips the stale validation tag, preserves base tags in order, and appends the new verdict — exact array match (full-replace tag correctness)", async () => {
    const memoryUpdate = vi.fn().mockResolvedValue({
      id: "mem-1",
      content: "",
      project_id: "story-1",
      tags: [],
      pinned: false,
      created_at: "2026-01-01T00:00:00Z",
    });
    const oc = { memoryUpdate } as unknown as OcClient;

    const result = await retagValidation(
      oc,
      "mem-1",
      ["mnemosyne", "story", "scene", "validation:clean"],
      "errors",
    );

    expect(result).toEqual([
      "mnemosyne",
      "story",
      "scene",
      "validation:errors",
    ]);
    expect(memoryUpdate).toHaveBeenCalledTimes(1);
    expect(memoryUpdate).toHaveBeenCalledWith({
      memoryId: "mem-1",
      tags: ["mnemosyne", "story", "scene", "validation:errors"],
    });
  });
});

describe("entities — saveEntity preserves validation tag on overwrite (pure)", () => {
  it("carries an existing validation:* tag forward when overwriting via saveEntity, since memory_update replaces tags wholesale", async () => {
    const existingContent = "[Scene] Scene 2026-01-01T00:00:00Z\n\nOld body.";
    const memorySearch = vi.fn().mockResolvedValue([
      {
        id: "mem-scene-1",
        content: existingContent,
        project_id: "story-1",
        tags: ["mnemosyne", "story", "scene", "validation:clean"],
        pinned: false,
        created_at: "2026-01-01T00:00:00Z",
      },
    ]);
    const memoryUpdate = vi.fn().mockResolvedValue({
      id: "mem-scene-1",
      content: "",
      project_id: "story-1",
      tags: [],
      pinned: false,
      created_at: "2026-01-01T00:00:00Z",
    });
    const oc = { memorySearch, memoryUpdate } as unknown as OcClient;

    const result = await saveEntity(oc, "story-1", {
      type: "scene",
      name: "Scene 2026-01-01T00:00:00Z",
      body: "Hand-edited body.",
    });

    expect(memoryUpdate).toHaveBeenCalledWith({
      memoryId: "mem-scene-1",
      content: "[Scene] Scene 2026-01-01T00:00:00Z\n\nHand-edited body.",
      tags: ["mnemosyne", "story", "scene", "validation:clean"],
    });
    expect(result.tags).toEqual([
      "mnemosyne",
      "story",
      "scene",
      "validation:clean",
    ]);
  });

  it("does not fabricate a validation tag when the existing memory has none", async () => {
    const existingContent = "[Character] Aria Voss\n\nOld body.";
    const memorySearch = vi.fn().mockResolvedValue([
      {
        id: "mem-char-1",
        content: existingContent,
        project_id: "story-1",
        tags: ["mnemosyne", "story", "character"],
        pinned: false,
        created_at: "2026-01-01T00:00:00Z",
      },
    ]);
    const memoryUpdate = vi.fn().mockResolvedValue({
      id: "mem-char-1",
      content: "",
      project_id: "story-1",
      tags: [],
      pinned: false,
      created_at: "2026-01-01T00:00:00Z",
    });
    const oc = { memorySearch, memoryUpdate } as unknown as OcClient;

    const result = await saveEntity(oc, "story-1", {
      type: "character",
      name: "Aria Voss",
      body: "Updated body.",
    });

    expect(memoryUpdate).toHaveBeenCalledWith({
      memoryId: "mem-char-1",
      content: "[Character] Aria Voss\n\nUpdated body.",
      tags: ["mnemosyne", "story", "character"],
    });
    expect(result.tags).toEqual(["mnemosyne", "story", "character"]);
  });
});

const OC_URL = process.env.OC_URL;

const suite = OC_URL ? describe : describe.skip;

suite("Phase B — entities (real OC)", () => {
  let oc: OcClient;
  let storyId: string;

  beforeAll(async () => {
    ({ oc, storyId } = await setupTestStory(OC_URL!, "entities"));
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
