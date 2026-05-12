// Phase A integration smoke test against a real OpenChronicle instance.
// Skipped unless OC_URL is set in the environment.
//
// Each run creates a uniquely-named test story (project + marker memory).
// OC v3 has no project_delete tool, so test projects accumulate; their
// names are prefixed `mnemosyne-test-<timestamp>` so they're identifiable
// and can be manually cleaned up via the OC UI / CLI if desired.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { OcClient } from "../src/oc-client.js";
import {
  createStory,
  findStory,
  findStoryByName,
  listStories,
} from "../src/stories.js";

const OC_URL = process.env.OC_URL;
const TEST_STORY_PREFIX = "mnemosyne-test-";

const suite = OC_URL ? describe : describe.skip;

suite("Phase A — story management (real OC)", () => {
  let oc: OcClient;
  let testName: string;
  let storyId: string | undefined;

  beforeAll(async () => {
    oc = new OcClient(new URL(OC_URL!));
    await oc.connect();
    testName = `${TEST_STORY_PREFIX}${Date.now()}`;
  });

  afterAll(async () => {
    await oc.close();
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
});
