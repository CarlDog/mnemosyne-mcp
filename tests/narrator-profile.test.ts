// KINDROID_NARRATOR_DESIGN S2: the story marker's narrator label reaches
// mnemo_continue's response and the saved scene's tags whenever the story's
// Kindroid binding is consulted (or prefetched), and stays out of the way for
// every other generator. Runs against an OC stub; no network.

import { describe, it, expect } from "vitest";
import { continueScene } from "./helpers/application.js";
import { buildMarkerContent, STORY_MARKER_TAGS } from "../src/stories.js";
import type { LlmProvider } from "../src/llm.js";
import type { OcClient, OcMemory } from "../src/oc-client.js";

const STORY_ID = "11111111-2222-4333-8444-555555555555";
const LABEL = "storyteller-v1";

function stubOc(): { oc: OcClient; savedTags: string[][] } {
  const savedTags: string[][] = [];
  const marker: OcMemory = {
    id: "marker-1",
    content: buildMarkerContent(
      "Halvard",
      "2026-09-03T00:00:00.000Z",
      { type: "ai", id: "kin-1" },
      LABEL,
    ),
    project_id: STORY_ID,
    tags: STORY_MARKER_TAGS,
    pinned: true,
    created_at: "2026-09-03T00:00:00.000Z",
  };
  const oc = {
    memorySearch: async (opts: { tags?: string[] }) =>
      opts.tags?.includes("story-marker") ? [marker] : [],
    memoryList: async () => [],
    memoryListCompact: async () => [],
    memorySave: async (args: { tags?: string[] }) => {
      savedTags.push(args.tags ?? []);
      return {
        id: `saved-${savedTags.length}`,
        content: "",
        project_id: STORY_ID,
        tags: args.tags ?? [],
        pinned: false,
        created_at: "2026-09-03T00:00:00.000Z",
      } satisfies OcMemory;
    },
  } as unknown as OcClient;
  return { oc, savedTags };
}

const generator = (name: string): LlmProvider => ({
  name,
  generate: async () => ({ text: "A beat." }),
});

const neverValidator: LlmProvider = {
  name: "stub-validator",
  generate: async () => {
    throw new Error("validator must not run");
  },
};

const OPTS = {
  direction: "go on",
  sceneStrategy: "recency-first" as const,
  reinvokeHint: "call again",
};

describe("narrator profile on continue (S2)", () => {
  it("echoes the story's label and tags the saved scene when the Kindroid binding is consulted", async () => {
    const { oc, savedTags } = stubOc();
    const result = await continueScene(
      oc,
      generator("kindroid"),
      neverValidator,
      STORY_ID,
      OPTS,
    );
    expect(result.narrator_profile).toBe(LABEL);
    expect(result.memory_id).toBeTruthy();
    const sceneTags = savedTags.find((t) => t.includes("scene"));
    expect(sceneTags).toContain(`narrator:${LABEL}`);
  });

  it("does not consult the marker or tag anything for a non-Kindroid generator", async () => {
    const { oc, savedTags } = stubOc();
    const result = await continueScene(
      oc,
      generator("ollama-ish"),
      neverValidator,
      STORY_ID,
      OPTS,
    );
    expect(result.narrator_profile).toBeUndefined();
    const sceneTags = savedTags.find((t) => t.includes("scene"));
    expect(sceneTags?.some((t) => t.startsWith("narrator:"))).toBe(false);
  });

  // gatherContext's own position resolution (docs/POSITION_TRACKING_DESIGN.md)
  // makes an unrelated story-marker read on every continueScene call now,
  // regardless of Kindroid-target prefetching -- so "0 reads" is no longer
  // the right assertion. What prefetching still saves is the SEPARATE
  // story-binding read continueScene itself would otherwise make: this test
  // pins that saving directly, by comparing prefetched vs. not.
  function countingOc(oc: OcClient): {
    counting: OcClient;
    reads: () => number;
  } {
    let markerReads = 0;
    const counting = {
      ...(oc as unknown as Record<string, unknown>),
      memorySearch: async (opts: { tags?: string[] }) => {
        if (opts.tags?.includes("story-marker")) markerReads += 1;
        return [];
      },
    } as unknown as OcClient;
    return { counting, reads: () => markerReads };
  }

  it("uses a prefetched label with exactly one marker read (position's, not a redundant story-binding one)", async () => {
    const { oc, savedTags } = stubOc();
    const { counting, reads } = countingOc(oc);
    const result = await continueScene(
      counting,
      generator("kindroid"),
      neverValidator,
      STORY_ID,
      {
        ...OPTS,
        storyKindroidTarget: { type: "ai", id: "kin-1" },
        storyNarratorProfile: "prefetched-label",
        storyKindroidTargetPrefetched: true,
      },
    );
    expect(reads()).toBe(1);
    expect(result.narrator_profile).toBe("prefetched-label");
    expect(savedTags.find((t) => t.includes("scene"))).toContain(
      "narrator:prefetched-label",
    );
  });

  it("without prefetching, makes a second marker read for the story binding -- proving prefetching saves exactly one", async () => {
    const { oc } = stubOc();
    const { counting, reads } = countingOc(oc);
    await continueScene(
      counting,
      generator("kindroid"),
      neverValidator,
      STORY_ID,
      {
        ...OPTS,
        // No storyKindroidTarget/storyKindroidTargetPrefetched -- continueScene
        // must fetch the binding itself.
      },
    );
    expect(reads()).toBe(2);
  });
});
