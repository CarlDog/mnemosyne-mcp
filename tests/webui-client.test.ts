import { beforeEach, describe, expect, it, vi } from "vitest";
import { continueStory } from "../webui/src/api/client.js";
import type { ApiError, ContinueResponse } from "../webui/src/api/client.js";
import { buildContinueRequest } from "../webui/src/continue-request.js";
import {
  canonStatusLabel,
  contextEntityCount,
} from "../webui/src/result-status.js";

function makeJsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const successfulContinueResponse = {
  run_id: "run-success",
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
} satisfies ContinueResponse;

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
      run_id: "run-yielded",
      yielded_to_user: true,
      beat_text: "",
      saved: false,
      message:
        "The group handed the floor straight back to you -- do not re-send your direction.",
      mode: "director" as const,
      stages_ms: { gather_ms: 12, generate_ms: 34, save_ms: 0, validate_ms: 0 },
    } satisfies ContinueResponse;
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

  it("does not describe an ambiguous canon write as unsaved", () => {
    const ambiguousWrite = {
      run_id: "run-ambiguous",
      beat_name: "Scene 2026-08-27T00:00:00.000Z",
      beat_text: "The beat survived, but the save response did not.",
      mode: "director",
      save_error: "OpenChronicle readback timed out",
      canon_write_outcome: "unknown",
      stages_ms: {
        gather_ms: 20,
        generate_ms: 80,
        save_ms: 100,
        validate_ms: 0,
      },
    } satisfies ContinueResponse;

    expect(canonStatusLabel(ambiguousWrite)).toBe("canon write unknown");
  });

  it("falls back to the admission plan when context counts are omitted", () => {
    const yieldedWithPlan = {
      run_id: "run-planned-yield",
      yielded_to_user: true,
      beat_text: "",
      saved: false,
      mode: "participant",
      context_plan: {
        provider: "kindroid",
        input_budget: 8_192,
        output_reserve: 512,
        est_fixed_tokens: 120,
        est_direction_tokens: 20,
        sections: {
          character: { included: 2, dropped: 0, est_tokens: 160 },
          scene: { included: 3, dropped: 1, est_tokens: 480 },
        },
        verdict: "partial",
        dropped_entries: [{ memory_id: "scene-old", reason: "budget" }],
      },
      stages_ms: { gather_ms: 12, generate_ms: 34, save_ms: 0, validate_ms: 0 },
    } satisfies ContinueResponse;

    expect(contextEntityCount(yieldedWithPlan)).toBe(5);
  });

  it("preserves replay-safety metadata on unsafe HTTP failures", async () => {
    const unsafeBody = {
      error: "provider_dispatch_unknown",
      retry_safe: false,
      dispatch_attempted: true,
      provider_charge_possible: true,
      external_conversation_mutation_possible: true,
      message: "The provider may have accepted the direction.",
    } as const;
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      makeJsonResponse(unsafeBody, 502),
    );

    await expect(
      continueStory("story-abc", { direction: "Open the door." }),
    ).rejects.toMatchObject({ status: 502, body: unsafeBody });
  });

  it("preserves the Kindroid group default until the user overrides it", () => {
    const baseFields = {
      direction: "Let the room answer.",
      mode: "director",
      validate: false,
      strategy: "server-default",
      fallbackStrategy: "server-default",
      maxTokens: "",
      temperature: "",
      model: "",
      kindroidGroup: true,
      allowUser: true,
      groupMaxTurns: "",
    } as const;

    expect(buildContinueRequest(baseFields)).not.toHaveProperty(
      "group_max_turns",
    );
    expect(
      buildContinueRequest({ ...baseFields, groupMaxTurns: "6" }),
    ).toMatchObject({ allow_user: true, group_max_turns: 6 });
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

// webui/src/api/types.ts hand-mirrors three server enums with no codegen, and
// its own header says so. Nothing compared them, so adding a server entity
// type would silently leave the UI's filter and the continue form's <select>
// short. This is the same drift-guard shape as env-schema.test.ts.
describe("webui mirrors the server's enums", () => {
  it("ENTITY_TYPES matches src/entities.ts", async () => {
    const server = await import("../src/entities.js");
    const webui = await import("../webui/src/api/types.js");
    expect([...webui.ENTITY_TYPES]).toEqual([...server.ENTITY_TYPES]);
  });

  it("MODES matches src/prompt.ts", async () => {
    const server = await import("../src/prompt.js");
    const webui = await import("../webui/src/api/types.js");
    expect([...webui.MODES]).toEqual([...server.MODES]);
  });

  it("SCENE_CONTEXT_STRATEGIES matches src/prompt.ts", async () => {
    const server = await import("../src/prompt.js");
    const webui = await import("../webui/src/api/types.js");
    expect([...webui.SCENE_CONTEXT_STRATEGIES]).toEqual([
      ...server.SCENE_CONTEXT_STRATEGIES,
    ]);
  });
});
