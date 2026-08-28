// Pure unit tests for the interactive /api routes. No real OC/Ollama --
// a recording mock OcClient makes retrieval behavior observable:
// query-ranked/validation pulls go through memorySearch, while the
// recency-first scene pool goes through memoryList, so asserting which
// method ran pins what the route actually fetched.
//
// History: revalidateScenesSchema once carried a zod
// .default(DEFAULT_SCENE_CONTEXT_STRATEGY) that silently discarded the
// server-configured strategy; the strategy params were then removed from
// the validate/revalidate surfaces entirely (2026-08-27) because their
// contexts became validationOnly -- no scene pull, nothing for a
// strategy to control. The memoryList assertion below now guards that
// stronger property.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Server } from "node:http";
import express from "express";
import { createApiRouter } from "../src/api/index.js";
import type { OcClient, OcMemory } from "../src/oc-client.js";
import type { LlmProvider } from "../src/llm.js";

const STORY_ID = "11111111-2222-4333-8444-555555555555";

function markerMemory(): OcMemory {
  return {
    id: "marker-1",
    content: "[Mnemosyne Story] Unit Story\nCreated: 2026-01-01T00:00:00Z",
    project_id: STORY_ID,
    tags: ["mnemosyne", "story-marker"],
    pinned: true,
    created_at: "2026-01-01T00:00:00Z",
  };
}

function sceneMemory(): OcMemory {
  return {
    id: "scene-1",
    content: "[Scene] Unit scene\n\nA quiet beat for the unit test.",
    project_id: STORY_ID,
    tags: ["mnemosyne", "story", "scene"],
    pinned: false,
    created_at: "2026-01-02T00:00:00Z",
  };
}

interface RecordingOc {
  oc: OcClient;
  memoryListCalls: number;
  sceneSearchTags: string[][];
}

function makeRecordingOc(): RecordingOc {
  const state: RecordingOc = {
    oc: undefined as unknown as OcClient,
    memoryListCalls: 0,
    sceneSearchTags: [],
  };
  state.oc = {
    memorySearch: async (opts: { tags?: string[] }) => {
      if (opts.tags?.includes("story-marker")) return [markerMemory()];
      if (opts.tags?.includes("scene")) {
        state.sceneSearchTags.push(opts.tags);
        return [sceneMemory()];
      }
      return [];
    },
    memoryList: async () => {
      state.memoryListCalls += 1;
      return [sceneMemory()];
    },
    memoryUpdate: async () => sceneMemory(),
  } as unknown as OcClient;
  return state;
}

const stubValidator: LlmProvider = {
  name: "stub-validator",
  generate: async () => ({
    text: JSON.stringify({ issues: [], summary: "clean" }),
  }),
};

const stubGenerator: LlmProvider = {
  name: "stub-generator",
  generate: async () => ({ text: "A generated beat." }),
};

describe("interactive routes — scene-context strategy plumbing (mock OC)", () => {
  let recording: RecordingOc;
  let httpServer: Server;
  let baseUrl: string;

  beforeAll(async () => {
    recording = makeRecordingOc();
    const app = express();
    app.use(express.json());
    app.use(
      "/api",
      createApiRouter(recording.oc, {
        generator: stubGenerator,
        validator: stubValidator,
        sceneContextStrategy: "query-ranked",
        sceneContextFallbackStrategy: "query-ranked",
      }),
    );
    httpServer = await new Promise((resolve) => {
      const s = app.listen(0, "127.0.0.1", () => resolve(s));
    });
    const address = httpServer.address();
    if (address === null || typeof address === "string") {
      throw new Error("expected AddressInfo");
    }
    baseUrl = `http://127.0.0.1:${address.port}/api`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      httpServer.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it("revalidate-scenes gathers validation-only context: no scene-pool fetch at all", async () => {
    const res = await fetch(
      `${baseUrl}/stories/${STORY_ID}/revalidate-scenes`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.scenes_checked).toBe(1);

    // The outer scene enumeration (which scenes to validate) is a
    // scene-tagged memorySearch; the per-scene gatherContext runs
    // validationOnly, so the recency-first scene pool's memoryList must
    // never fire -- previously this route re-fetched the entire project
    // once per scene for a context field the validator never reads.
    expect(recording.memoryListCalls).toBe(0);
    expect(recording.sceneSearchTags.length).toBeGreaterThanOrEqual(1);
  });

  it("continue with both kindroid_kin and kindroid_group_id returns 400, not 500", async () => {
    const res = await fetch(`${baseUrl}/stories/${STORY_ID}/continue`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        direction: "A beat that should never generate.",
        kindroid_kin: "kin-1",
        kindroid_group_id: "group-1",
      }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid_body");
    expect(body.message).toContain("at most one");
  });
});
