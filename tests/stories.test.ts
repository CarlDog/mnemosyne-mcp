// Phase A integration smoke test against a real OpenChronicle instance.
// Skipped unless OC_URL is set in the environment.
//
// Each run creates a uniquely-named test story (project + marker memory)
// and deletes it again in `afterAll` via OC's `project_delete`. The
// `mnemosyne-test-` name prefix keeps any story that survives a failed
// teardown identifiable on the OC side.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { OcClient } from "../src/oc-client.js";
import { setCurrentStoryId } from "../src/config.js";
import {
  combineKindroidTarget,
  createStory,
  findStory,
  findStoryByName,
  listStories,
  resolveStoryId,
  setKindroidTarget,
  STORY_MARKER_TAGS,
} from "../src/stories.js";
import { isolateDataDirs, teardownStory, testStoryName } from "./helpers.js";

describe("combineKindroidTarget (pure)", () => {
  it("returns undefined when neither is given", () => {
    expect(combineKindroidTarget(undefined, undefined)).toBeUndefined();
    expect(combineKindroidTarget(null, null)).toBeUndefined();
  });

  it("builds an ai target from kin alone", () => {
    expect(combineKindroidTarget("kin-1", undefined)).toEqual({
      type: "ai",
      id: "kin-1",
    });
  });

  it("builds a group target from group_id alone", () => {
    expect(combineKindroidTarget(undefined, "group-1")).toEqual({
      type: "group",
      id: "group-1",
    });
  });

  it("throws when both kin and group_id are given", () => {
    expect(() => combineKindroidTarget("kin-1", "group-1")).toThrow(
      /at most one/i,
    );
  });
});

// Poisoned OcClient: any method call throws. Used to prove the pointer
// fallback path is pure file I/O with zero OC round trips -- the strongest
// available evidence that omitting `story` is a true no-op for every
// existing stdio/Claude-Desktop caller.
const poisonedOc = new Proxy(
  {},
  {
    get(_target, prop) {
      return () => {
        throw new Error(`OcClient.${String(prop)} must not be called`);
      };
    },
  },
) as unknown as OcClient;

describe("resolveStoryId (pure)", () => {
  isolateDataDirs("mnemo-resolve");

  it("falls back to the active-story pointer with zero OC calls", async () => {
    await setCurrentStoryId("pointer-story-id");
    await expect(resolveStoryId(poisonedOc, undefined)).resolves.toBe(
      "pointer-story-id",
    );
  });

  it("throws the same 'no active story' error as before when unset", async () => {
    await expect(resolveStoryId(poisonedOc, undefined)).rejects.toThrow(
      /no active story/i,
    );
  });
});

const OC_URL = process.env.OC_URL;

const suite = OC_URL ? describe : describe.skip;

suite("Phase A — story management (real OC)", () => {
  let oc: OcClient;
  let testName: string;
  let storyId: string | undefined;

  beforeAll(async () => {
    oc = new OcClient(new URL(OC_URL!));
    await oc.connect();
    testName = testStoryName();
  });

  afterAll(async () => {
    await teardownStory(oc, storyId);
  });

  it("creates a story (project + marker memory)", async () => {
    const story = await createStory(oc, testName);
    expect(story.id).toBeTruthy();
    expect(story.name).toBe(testName);
    storyId = story.id;
  });

  it("lists the new story via listStories", async () => {
    const stories = await listStories(oc);
    const found = stories.find((s) => s.name === testName);
    expect(found).toBeDefined();
    expect(found?.id).toBe(storyId);
  });

  it("finds the story by name", async () => {
    const story = await findStoryByName(oc, testName);
    expect(story?.id).toBe(storyId);
  });

  it("finds the story by UUID", async () => {
    expect(storyId).toBeTruthy();
    const story = await findStory(oc, storyId!);
    expect(story?.name).toBe(testName);
  });

  it("returns null for a missing story", async () => {
    const story = await findStoryByName(oc, "no-such-story-zzz");
    expect(story).toBeNull();
  });

  it("resolveStoryId: explicit override bypasses the active-story pointer", async () => {
    expect(storyId).toBeTruthy();
    const otherName = testStoryName("resolve-other");
    const other = await createStory(oc, otherName);
    // setCurrentStoryId writes the real local config.json -- isolate it (and
    // the legacy OS-config-dir path, to skip its auto-migration entirely) to
    // temp dirs so this test never touches the developer's actual
    // active-story pointer.
    const savedMnemoDataDir = process.env.MNEMO_DATA_DIR;
    const savedLegacyDir = process.env.MNEMOSYNE_CONFIG_DIR;
    const tempDataDir = await fs.mkdtemp(join(tmpdir(), "mnemo-resolve-oc-"));
    const tempLegacyDir = await fs.mkdtemp(
      join(tmpdir(), "mnemo-resolve-oc-legacy-"),
    );
    process.env.MNEMO_DATA_DIR = tempDataDir;
    process.env.MNEMOSYNE_CONFIG_DIR = tempLegacyDir;
    try {
      // Pointer points at the primary test story; explicit override to
      // the other story's name (and separately, its id) must win.
      await setCurrentStoryId(storyId!);
      await expect(resolveStoryId(oc, otherName)).resolves.toBe(other.id);
      await expect(resolveStoryId(oc, other.id)).resolves.toBe(other.id);
      await expect(resolveStoryId(oc, undefined)).resolves.toBe(storyId);
    } finally {
      if (savedMnemoDataDir === undefined) delete process.env.MNEMO_DATA_DIR;
      else process.env.MNEMO_DATA_DIR = savedMnemoDataDir;
      if (savedLegacyDir === undefined) delete process.env.MNEMOSYNE_CONFIG_DIR;
      else process.env.MNEMOSYNE_CONFIG_DIR = savedLegacyDir;
      await fs.rm(tempDataDir, { recursive: true, force: true });
      await fs.rm(tempLegacyDir, { recursive: true, force: true });
      await oc.projectDelete(other.id);
    }
  });

  it("creates a story with an ai target bound at creation time", async () => {
    const kinStoryName = testStoryName("kin-create");
    const story = await createStory(oc, kinStoryName, {
      type: "ai",
      id: "test-ai-id-123",
    });
    expect(story.kindroid_target).toEqual({
      type: "ai",
      id: "test-ai-id-123",
    });
    expect(story.marker_memory_id).toBeTruthy();
    // Direct cleanup -- teardownStory() also closes the shared OC
    // connection, which the remaining tests in this suite still need.
    await oc.projectDelete(story.id);
  });

  it("creates a story with a group target bound at creation time", async () => {
    const groupStoryName = testStoryName("group-create");
    const story = await createStory(oc, groupStoryName, {
      type: "group",
      id: "test-group-id-456",
    });
    expect(story.kindroid_target).toEqual({
      type: "group",
      id: "test-group-id-456",
    });
    await oc.projectDelete(story.id);
  });

  it("binds, rebinds (ai to group), and clears a target via setKindroidTarget", async () => {
    expect(storyId).toBeTruthy();
    const before = await findStory(oc, storyId!);
    expect(before?.kindroid_target).toBeUndefined();

    const bound = await setKindroidTarget(oc, before!, {
      type: "ai",
      id: "bound-kin-456",
    });
    expect(bound.kindroid_target).toEqual({ type: "ai", id: "bound-kin-456" });
    // The marker rewrite must preserve name and created_at verbatim.
    expect(bound.name).toBe(before!.name);
    expect(bound.created_at).toBe(before!.created_at);
    expect((await findStory(oc, storyId!))?.kindroid_target).toEqual({
      type: "ai",
      id: "bound-kin-456",
    });

    const rebound = await setKindroidTarget(oc, bound, {
      type: "group",
      id: "different-group-789",
    });
    expect(rebound.kindroid_target).toEqual({
      type: "group",
      id: "different-group-789",
    });
    expect((await findStory(oc, storyId!))?.kindroid_target).toEqual({
      type: "group",
      id: "different-group-789",
    });

    const cleared = await setKindroidTarget(oc, rebound, undefined);
    expect(cleared.kindroid_target).toBeUndefined();
    expect((await findStory(oc, storyId!))?.kindroid_target).toBeUndefined();
  });

  it("reads a legacy schema-2 'Kindroid-Kin:' line as an ai target (backward compat)", async () => {
    const legacyStoryName = testStoryName("legacy-schema2");
    const project = await oc.projectCreate(legacyStoryName);
    await oc.memorySave({
      content: [
        `[Mnemosyne Story] ${legacyStoryName}`,
        `Created: ${new Date().toISOString()}`,
        `Schema: 2`,
        `Kindroid-Kin: legacy-ai-id`,
      ].join("\n"),
      projectId: project.id,
      tags: STORY_MARKER_TAGS,
      pinned: true,
    });

    const story = await findStory(oc, project.id);
    expect(story?.kindroid_target).toEqual({ type: "ai", id: "legacy-ai-id" });

    await oc.projectDelete(project.id);
  });
});
