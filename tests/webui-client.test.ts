import { beforeEach, describe, expect, it, vi } from "vitest";
import { continueStory } from "../webui/src/api/client.js";
import type { ApiError } from "../webui/src/api/client.js";

function makeJsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const successfulContinueResponse = {
  beat_name: "Scene 2026-08-27T00:00:00.000Z",
  beat_text: "A lantern gutters out as the fog shifts. A second bell sounds.",
  memory_id: "scene-1",
  mode: "director" as const,
  context_summary: {
    rules: 2,
    style: 1,
    characters: 3,
    locations: 2,
    scenes: 4,
    lore: 1,
    worldbuilding: 2,
  },
  stages_ms: {
    gather_ms: 50,
    generate_ms: 120,
    save_ms: 30,
    validate_ms: 0,
  },
};

describe("web client api module", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("continueStory posts to the new continue endpoint and returns typed body", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      makeJsonResponse(successfulContinueResponse),
    );

    const result = await continueStory("story-abc", {
      direction: "The foghorn calls again.",
      mode: "director",
      scene_context_strategy: "query-ranked",
      scene_context_fallback_strategy: "recency-first",
      validate: true,
      max_tokens: 111,
      temperature: 0.7,
      model: "gpt-mini",
    });

    expect(result).toEqual(successfulContinueResponse);

    const [rawUrl, init] = vi.mocked(globalThis.fetch).mock.calls[0]!;
    const url = String(rawUrl);
    expect(url).toBe("/api/stories/story-abc/continue");
    expect(init?.method).toBe("POST");
    const headers = init?.headers as Record<string, string> | undefined;
    expect(headers?.["content-type"]).toBe("application/json");

    const payload = JSON.parse((init?.body as string | undefined) ?? "{}");
    expect(payload.direction).toBe("The foghorn calls again.");
    expect(payload.mode).toBe("director");
    expect(payload.scene_context_strategy).toBe("query-ranked");
    expect(payload.scene_context_fallback_strategy).toBe("recency-first");
    expect(payload.validate).toBe(true);
    expect(payload.max_tokens).toBe(111);
    expect(payload.temperature).toBe(0.7);
    expect(payload.model).toBe("gpt-mini");
  });

  it("continueStory returns the yielded_to_user shape, which omits beat_name and context_summary", async () => {
    // The server's group-yield response carries no beat_name or
    // context_summary -- the client type must allow that (the result
    // panel once crashed dereferencing context_summary on this shape).
    const yieldedResponse = {
      yielded_to_user: true,
      beat_text: "",
      saved: false,
      message:
        "The group handed the floor straight back to you -- do not re-send your direction.",
      mode: "director" as const,
      stages_ms: { gather_ms: 12, generate_ms: 34, save_ms: 0, validate_ms: 0 },
    };
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      makeJsonResponse(yieldedResponse),
    );

    const result = await continueStory("story-abc", {
      direction: "What happens next?",
    });
    expect(result).toEqual(yieldedResponse);
    expect(result.context_summary).toBeUndefined();
    expect(result.beat_name).toBeUndefined();
  });

  it("continueStory converts HTTP errors into ApiError", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      makeJsonResponse(
        { error: "invalid_body", message: "direction required" },
        400,
      ),
    );

    await expect(
      continueStory("story-abc", {
        direction: "",
      }),
    ).rejects.toMatchObject({
      status: 400,
      body: { error: "invalid_body", message: "direction required" },
    } satisfies Partial<ApiError>);
  });
});
