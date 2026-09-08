// continueScene's position integration (docs/POSITION_TRACKING_DESIGN.md
// slice 4): advance/set_date/move_to applied before context gathering,
// the not-yet-initialized refusal (via mergePositionUpdate's atomic
// invariant) firing before generation or save, and the accepted
// advance-survives-a-subsequent-generation-failure semantics. Real OC
// (authentic marker read/write), stub generator (no real LLM call, so this
// stays fast). Skipped unless OC_URL is set.

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { OcClient } from "../src/oc-client.js";
import { createStory, findStory, setPosition } from "../src/stories.js";
import { saveEntity } from "../src/entities.js";
import { continueScene } from "./helpers/application.js";
import { makeRunContext } from "../src/run-context.js";
import type { LlmProvider } from "../src/llm.js";
import { teardownStory, testStoryName } from "./helpers.js";

const OC_URL = process.env.OC_URL;
const suite = OC_URL ? describe : describe.skip;

const stubGenerator = (generate: LlmProvider["generate"]): LlmProvider => ({
  name: "stub-generator",
  generate,
});

const neverValidator: LlmProvider = {
  name: "stub-validator",
  generate: async () => {
    throw new Error("validator must not run in these tests");
  },
};

const okBeat = { text: "A beat." };

suite("continueScene position integration (real OC)", () => {
  let oc: OcClient;
  let storyId: string;
  let porchId: string;
  let gardenId: string;

  beforeAll(async () => {
    oc = new OcClient(new URL(OC_URL!));
    await oc.connect();
    const story = await createStory(oc, testStoryName("continue-position"));
    storyId = story.id;
    const porch = await saveEntity(oc, storyId, {
      type: "location",
      name: "The Porch",
      body: "A weathered porch.",
    });
    porchId = porch.memory_id;
    const garden = await saveEntity(oc, storyId, {
      type: "location",
      name: "The Garden",
      body: "An overgrown garden.",
    });
    gardenId = garden.memory_id;
  });

  afterAll(async () => {
    await teardownStory(oc, storyId);
  });

  it("refuses advance on an untracked story before generation or save fire", async () => {
    const generate = vi.fn();
    const saveSpy = vi.spyOn(oc, "memorySave");
    await expect(
      continueScene(oc, stubGenerator(generate), neverValidator, storyId, {
        direction: "go on",
        sceneStrategy: "recency-first",
        reinvokeHint: "call again",
        advance: { days: 1 },
      }),
    ).rejects.toMatchObject({ outcome: "rejected_before_dispatch" });
    expect(generate).not.toHaveBeenCalled();
    expect(saveSpy).not.toHaveBeenCalled();
    saveSpy.mockRestore();
  });

  it("refuses set_date and move_to the same way, and the message names mnemo_position_set", async () => {
    const moveGenerate = vi.fn();
    await expect(
      continueScene(oc, stubGenerator(moveGenerate), neverValidator, storyId, {
        direction: "go on",
        sceneStrategy: "recency-first",
        reinvokeHint: "call again",
        moveTo: { location: porchId },
      }),
    ).rejects.toThrow(/mnemo_position_set/);
    expect(moveGenerate).not.toHaveBeenCalled();

    const dateGenerate = vi.fn();
    await expect(
      continueScene(oc, stubGenerator(dateGenerate), neverValidator, storyId, {
        direction: "go on",
        sceneStrategy: "recency-first",
        reinvokeHint: "call again",
        setDate: "2026-10-01T00:00:00Z",
      }),
    ).rejects.toThrow(/mnemo_position_set/);
    expect(dateGenerate).not.toHaveBeenCalled();
  });

  it("applies advance before generation and echoes the new position in the response", async () => {
    const story = await findStory(oc, storyId);
    await setPosition(oc, story!, {
      epochDate: "2026-10-01T00:00:00Z",
      epochLocationId: porchId,
    });

    let sawPositionAtGenerateTime: string | undefined;
    const generate = vi.fn(async () => {
      // Read the marker mid-call to prove the advance already landed
      // BEFORE generation, not after.
      const midCallStory = await findStory(oc, storyId);
      sawPositionAtGenerateTime = midCallStory?.position?.elapsedHours
        ? String(midCallStory.position.elapsedHours)
        : undefined;
      return okBeat;
    });

    const result = await continueScene(
      oc,
      stubGenerator(generate),
      neverValidator,
      storyId,
      {
        direction: "go on",
        sceneStrategy: "recency-first",
        reinvokeHint: "call again",
        advance: { days: 3, hours: 6 },
      },
    );

    expect(sawPositionAtGenerateTime).toBe("78");
    expect(result.position).toEqual({
      current_story_datetime: "2026-10-04T06:00:00.000Z",
      current_location: { name: "The Porch" },
    });

    const after = await findStory(oc, storyId);
    expect(after?.position?.elapsedHours).toBe(78);
  });

  it("applies move_to and echoes the new location without touching elapsed_hours", async () => {
    const before = await findStory(oc, storyId);
    const beforeElapsed = before?.position?.elapsedHours;

    const generate = vi.fn(async () => okBeat);
    const result = await continueScene(
      oc,
      stubGenerator(generate),
      neverValidator,
      storyId,
      {
        direction: "go on",
        sceneStrategy: "recency-first",
        reinvokeHint: "call again",
        moveTo: { location: gardenId, spot: "by the stove" },
      },
    );

    expect(result.position?.current_location).toEqual({
      name: "The Garden",
      spot: "by the stove",
    });

    const after = await findStory(oc, storyId);
    // move_to alone must not touch elapsed_hours -- a transposition to
    // epoch_spot/epoch_location instead of current_* would still pass a
    // test that only checked current_location, so pin the untouched field
    // too.
    expect(after?.position?.elapsedHours).toBe(beforeElapsed);
    expect(after?.position?.currentLocationId).toBe(gardenId);
  });

  it("a successful advance is not rolled back when generation subsequently fails", async () => {
    const before = await findStory(oc, storyId);
    const beforeElapsed = before?.position?.elapsedHours ?? 0;

    const generate = vi.fn(async () => {
      throw new Error("provider exploded");
    });

    await expect(
      continueScene(oc, stubGenerator(generate), neverValidator, storyId, {
        direction: "go on",
        sceneStrategy: "recency-first",
        reinvokeHint: "call again",
        advance: { hours: 5 },
      }),
    ).rejects.toThrow(/provider exploded/);

    const after = await findStory(oc, storyId);
    // The advance landed anyway -- 5 hours later than before this test's
    // own generation "failed", not rolled back to beforeElapsed.
    expect(after?.position?.elapsedHours).toBe(beforeElapsed + 5);
  });

  // Regression pin (advisor-flagged 2026-09-08): assertNotAborted for
  // "the position update" must run BEFORE port.applyPosition, not just
  // before context gathering -- otherwise a run that's already aborted
  // when continueScene is entered would still apply advance/set_date/
  // move_to (this story is already tracked at this point in the suite, so
  // the write WOULD succeed if attempted).
  it("a pre-aborted run refuses before attempting the position write on an already-tracked story", async () => {
    const generate = vi.fn();
    const updateSpy = vi.spyOn(oc, "memoryUpdate");
    const before = await findStory(oc, storyId);
    const beforeElapsed = before?.position?.elapsedHours;

    const abort = new AbortController();
    abort.abort();

    await expect(
      continueScene(
        oc,
        stubGenerator(generate),
        neverValidator,
        storyId,
        {
          direction: "go on",
          sceneStrategy: "recency-first",
          reinvokeHint: "call again",
          advance: { days: 1 },
        },
        makeRunContext("rest", { storyId, signal: abort.signal }),
      ),
    ).rejects.toMatchObject({ outcome: "rejected_before_dispatch" });
    expect(generate).not.toHaveBeenCalled();
    expect(updateSpy).not.toHaveBeenCalled();

    const after = await findStory(oc, storyId);
    expect(after?.position?.elapsedHours).toBe(beforeElapsed);
    updateSpy.mockRestore();
  });
});
