// Phase A integration smoke test against a real OpenChronicle instance.
// Skipped unless OC_URL is set in the environment.
//
// Each run creates a uniquely-named test story (project + marker memory)
// and deletes it again in `afterAll` via OC's `project_delete`. The
// `mnemosyne-test-` name prefix keeps any story that survives a failed
// teardown identifiable on the OC side.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { OcClient } from "../src/oc-client.js";
import {
  createStory,
  findStory,
  findStoryByName,
  listStories,
  setStoryKin,
} from "../src/stories.js";
import { teardownStory, testStoryName } from "./helpers.js";

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

  it("creates a story with a kin bound at creation time", async () => {
    const kinStoryName = testStoryName("kin-create");
    const story = await createStory(oc, kinStoryName, "test-ai-id-123");
    expect(story.kindroid_kin).toBe("test-ai-id-123");
    expect(story.marker_memory_id).toBeTruthy();
    // Direct cleanup -- teardownStory() also closes the shared OC
    // connection, which the remaining tests in this suite still need.
    await oc.projectDelete(story.id);
  });

  it("binds, rebinds, and clears a kin on an existing story via setStoryKin", async () => {
    expect(storyId).toBeTruthy();
    const before = await findStory(oc, storyId!);
    expect(before?.kindroid_kin).toBeUndefined();

    const bound = await setStoryKin(oc, before!, "bound-kin-456");
    expect(bound.kindroid_kin).toBe("bound-kin-456");
    // The marker rewrite must preserve name and created_at verbatim.
    expect(bound.name).toBe(before!.name);
    expect(bound.created_at).toBe(before!.created_at);
    expect((await findStory(oc, storyId!))?.kindroid_kin).toBe("bound-kin-456");

    const rebound = await setStoryKin(oc, bound, "different-kin-789");
    expect(rebound.kindroid_kin).toBe("different-kin-789");
    expect((await findStory(oc, storyId!))?.kindroid_kin).toBe(
      "different-kin-789",
    );

    const cleared = await setStoryKin(oc, rebound, undefined);
    expect(cleared.kindroid_kin).toBeUndefined();
    expect((await findStory(oc, storyId!))?.kindroid_kin).toBeUndefined();
  });
});
