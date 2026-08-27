// Real-OC integration test for the /api REST layer (WEBUI_NOTES §9 slice
// 1). Mirrors http-integration.test.ts's harness shape (real express app,
// ephemeral port, real fetch calls) but exercises JSON routes instead of
// the MCP wire protocol.
//
// No story-pointer isolation needed here (unlike stories.test.ts's
// resolveStoryId cases or http-integration.test.ts): every /api route
// takes storyId from the URL, never the local current_story_id pointer --
// that's the whole point of the design (see src/stories.ts's
// toStorySummary doc comment).

import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import express from "express";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createApiRouter } from "../src/api/index.js";
import type { LlmProvider } from "../src/llm.js";
import { saveEntity } from "../src/entities.js";
import { setupTestStory, teardownStory } from "./helpers.js";

const OC_URL = process.env.OC_URL;
const suite = OC_URL ? describe : describe.skip;

suite("/api routes (real OC)", () => {
  let oc: Awaited<ReturnType<typeof setupTestStory>>["oc"];
  let storyId: string;
  let entityMemoryId: string;
  let httpServer: Server;
  let baseUrl: string;
  const stubValidator: LlmProvider = {
    name: "stub-validator",
    generate: async () => ({
      text: JSON.stringify({
        issues: [
          {
            severity: "info",
            rule: "Style probe",
            violating_text: "probe",
            explanation: "Validation stub output.",
          },
        ],
        summary: "stubbed validator summary",
      }),
    }),
  };

  beforeAll(async () => {
    const setup = await setupTestStory(OC_URL!, "api");
    oc = setup.oc;
    storyId = setup.storyId;

    const saved = await saveEntity(oc, storyId, {
      type: "character",
      name: "API Test Character",
      body: "A character created to exercise the /api routes end to end.",
    });
    entityMemoryId = saved.memory_id;

    await saveEntity(oc, storyId, {
      type: "scene",
      name: "API scene one",
      body: "The first web test scene.",
    });
    await saveEntity(oc, storyId, {
      type: "scene",
      name: "API scene two",
      body: "The second web test scene.",
    });

    const app = express();
    app.use(express.json());
    app.use(
      "/api",
      createApiRouter(oc, {
        validator: stubValidator,
      }),
    );
    httpServer = await new Promise((resolve) => {
      const s = app.listen(0, "127.0.0.1", () => resolve(s));
    });
    const { port } = httpServer.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}/api`;
  });

  afterAll(async () => {
    if (httpServer) {
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    }
    await teardownStory(oc, storyId);
  });

  it("GET /stories includes the test story, no current field", async () => {
    const res = await fetch(`${baseUrl}/stories`);
    expect(res.status).toBe(200);
    const body = await res.json();
    const found = body.stories.find((s: { id: string }) => s.id === storyId);
    expect(found).toBeDefined();
    expect(found).not.toHaveProperty("current");
  });

  it("GET /stories/:storyId returns the story", async () => {
    const res = await fetch(`${baseUrl}/stories/${storyId}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.story.id).toBe(storyId);
  });

  it("GET /stories/:storyId 404s on an unknown id", async () => {
    const res = await fetch(
      `${baseUrl}/stories/00000000-0000-0000-0000-000000000000`,
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("story_not_found");
  });

  it("GET /stories/:storyId/entities lists the saved entity", async () => {
    const res = await fetch(`${baseUrl}/stories/${storyId}/entities`);
    expect(res.status).toBe(200);
    const body = await res.json();
    const found = body.entities.find(
      (e: { memory_id: string }) => e.memory_id === entityMemoryId,
    );
    expect(found).toBeDefined();
    expect(found).not.toHaveProperty("body");
  });

  it("GET .../entities?type= filters by type", async () => {
    const res = await fetch(
      `${baseUrl}/stories/${storyId}/entities?type=character`,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(
      body.entities.every((e: { type: string }) => e.type === "character"),
    ).toBe(true);
  });

  it("GET .../entities?type=bogus 400s with a clear message", async () => {
    const res = await fetch(
      `${baseUrl}/stories/${storyId}/entities?type=bogus`,
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid_query");
  });

  it("GET .../entities?q= finds the entity by a body-text match", async () => {
    const res = await fetch(
      `${baseUrl}/stories/${storyId}/entities?q=exercise+the+%2Fapi`,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(
      body.entities.some(
        (e: { memory_id: string }) => e.memory_id === entityMemoryId,
      ),
    ).toBe(true);
  });

  it("GET .../entities/:memoryId returns the full entity with body", async () => {
    const res = await fetch(
      `${baseUrl}/stories/${storyId}/entities/${entityMemoryId}`,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.entity.name).toBe("API Test Character");
    expect(body.entity.body).toContain("exercise the /api routes");
  });

  it("GET .../entities/:memoryId 404s on a nonexistent id", async () => {
    const res = await fetch(
      `${baseUrl}/stories/${storyId}/entities/00000000-0000-0000-0000-000000000000`,
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("entity_not_found");
  });

  it("GET .../entities/:memoryId 404s when the id belongs to a different story", async () => {
    const otherStory = await setupTestStory(OC_URL!, "api-other");
    try {
      const res = await fetch(
        `${baseUrl}/stories/${otherStory.storyId}/entities/${entityMemoryId}`,
      );
      expect(res.status).toBe(404);
    } finally {
      await teardownStory(otherStory.oc, otherStory.storyId);
    }
  });

  it("POST /stories/:storyId/validate returns validator report for provided content", async () => {
    const res = await fetch(`${baseUrl}/stories/${storyId}/validate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        content: "A test beat that should validate through the web route.",
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.issues)).toBe(true);
  });

  it("POST /stories/:storyId/validate accepts scene_context_strategy override", async () => {
    const res = await fetch(`${baseUrl}/stories/${storyId}/validate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        content: "A test beat for query-ranked context pull.",
        scene_context_strategy: "query-ranked",
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.summary).toContain("stubbed validator summary");
  });

  it("POST /stories/:storyId/revalidate-scenes runs a revalidation pass and accepts strategy override", async () => {
    const res = await fetch(`${baseUrl}/stories/${storyId}/revalidate-scenes`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ scene_context_strategy: "query-ranked" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.scenes_checked).toBe(2);
    expect(body.failures).toEqual([]);
  });

  it("an unmatched /api path returns a JSON 404, not HTML", async () => {
    const res = await fetch(`${baseUrl}/nonsense`);
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toContain("application/json");
  });
});
