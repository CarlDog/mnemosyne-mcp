// Completion integrity (docs/OLLAMA_ADOPTION_ASSESSMENT.md §1, P0): a beat
// cut off at the token budget (Ollama done_reason "length") must not be
// auto-saved as canon, and a truncated validator verdict must never read as
// clean. Three layers, each pinned here:
//   1. OllamaProvider normalizes done/done_reason into GeneratedBeat's
//      complete/finishReason (mocked fetch -- exact response contract).
//   2. continueScene performs ZERO save calls for a complete:false beat and
//      still returns the costly text.
//   3. validateContent throws (validation failed) on a complete:false
//      verdict instead of parsing possibly-truncated JSON into a report.

import { describe, it, expect, vi, afterEach } from "vitest";
import { OllamaProvider, type LlmProvider } from "../src/llm.js";
import { continueScene } from "../src/tools/continue.js";
import { validateContent } from "../src/validator.js";
import type { OcClient, OcMemory } from "../src/oc-client.js";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

function stubOllamaResponse(body: unknown): void {
  globalThis.fetch = vi.fn(async () => ({
    ok: true,
    json: async () => body,
  })) as unknown as typeof fetch;
}

function provider(): OllamaProvider {
  return new OllamaProvider({
    url: "http://127.0.0.1:1",
    defaultModel: "test-model",
  });
}

describe("OllamaProvider finish-reason normalization", () => {
  it("done_reason 'stop' is a complete beat", async () => {
    stubOllamaResponse({
      message: { content: "A finished beat." },
      done: true,
      done_reason: "stop",
    });
    const beat = await provider().generate({
      systemPrompt: "s",
      userMessage: "u",
    });
    expect(beat.complete).toBe(true);
    expect(beat.finishReason).toBe("stop");
  });

  it("done_reason 'length' returns the text but marks the beat incomplete", async () => {
    stubOllamaResponse({
      message: { content: "Cut off mid-sen" },
      done: true,
      done_reason: "length",
    });
    const beat = await provider().generate({
      systemPrompt: "s",
      userMessage: "u",
    });
    expect(beat.text).toBe("Cut off mid-sen");
    expect(beat.complete).toBe(false);
    expect(beat.finishReason).toBe("length");
  });

  it("absent done_reason (old daemon) is treated as complete", async () => {
    stubOllamaResponse({ message: { content: "ok" }, done: true });
    const beat = await provider().generate({
      systemPrompt: "s",
      userMessage: "u",
    });
    expect(beat.complete).toBe(true);
  });

  it("an unrecognized done_reason is complete but flagged unknown", async () => {
    stubOllamaResponse({
      message: { content: "ok" },
      done: true,
      done_reason: "cancelled",
    });
    const beat = await provider().generate({
      systemPrompt: "s",
      userMessage: "u",
    });
    expect(beat.complete).toBe(true);
    expect(beat.finishReason).toBe("unknown");
  });

  it("a non-terminal response (done !== true) throws instead of returning a beat", async () => {
    stubOllamaResponse({ message: { content: "partial" }, done: false });
    await expect(
      provider().generate({ systemPrompt: "s", userMessage: "u" }),
    ).rejects.toThrow(/non-terminal/);
  });
});

// --- continueScene: zero saves on an incomplete beat -----------------------

const STORY_ID = "11111111-2222-4333-8444-555555555555";

function makeRecordingOc(): { oc: OcClient; saveCalls: number } {
  const state = { oc: undefined as unknown as OcClient, saveCalls: 0 };
  state.oc = {
    memorySearch: async () => [],
    memoryList: async () => [],
    memorySave: async () => {
      state.saveCalls += 1;
      return {
        id: "saved-1",
        content: "",
        project_id: STORY_ID,
        tags: [],
        pinned: false,
        created_at: "2026-01-01T00:00:00Z",
      } satisfies OcMemory;
    },
  } as unknown as OcClient;
  return state;
}

const throwingValidator: LlmProvider = {
  name: "throwing-validator",
  generate: async () => {
    throw new Error("validator must not run for an incomplete beat");
  },
};

describe("continueScene with an incomplete beat", () => {
  it("performs zero save calls, skips validation, and still returns the text", async () => {
    const recording = makeRecordingOc();
    const incompleteGenerator: LlmProvider = {
      name: "stub-generator",
      generate: async () => ({
        text: "An expensive but truncated bea",
        complete: false,
        finishReason: "length",
      }),
    };
    const result = await continueScene(
      recording.oc,
      incompleteGenerator,
      throwingValidator,
      STORY_ID,
      {
        direction: "go on",
        sceneStrategy: "query-ranked",
        validate: true,
        reinvokeHint: "call again",
      },
    );
    expect(recording.saveCalls).toBe(0);
    expect(result.incomplete).toBe(true);
    expect(result.saved).toBe(false);
    expect(result.finish_reason).toBe("length");
    expect(result.beat_text).toBe("An expensive but truncated bea");
    expect(result.memory_id).toBeUndefined();
    expect(result.message).toMatch(/NOT saved/);
    expect(result.message).toMatch(/mnemo_save_entity/);
  });

  it("a complete beat still saves (the guard is not over-broad)", async () => {
    const recording = makeRecordingOc();
    const completeGenerator: LlmProvider = {
      name: "stub-generator",
      generate: async () => ({ text: "A finished beat.", complete: true }),
    };
    const result = await continueScene(
      recording.oc,
      completeGenerator,
      throwingValidator,
      STORY_ID,
      {
        direction: "go on",
        sceneStrategy: "query-ranked",
        reinvokeHint: "call again",
      },
    );
    expect(recording.saveCalls).toBe(1);
    expect(result.incomplete).toBeUndefined();
  });
});

// --- validateContent: a truncated verdict is a failed pass -----------------

describe("validateContent with an incomplete validator response", () => {
  it("throws instead of classifying possibly-truncated JSON", async () => {
    const truncatedValidator: LlmProvider = {
      name: "stub-validator",
      generate: async () => ({
        // Even VALID JSON is rejected when the provider says it was cut
        // off -- an empty issues array from a truncated pass must never
        // read as clean.
        text: JSON.stringify({ issues: [], summary: "looks clean" }),
        complete: false,
        finishReason: "length",
      }),
    };
    await expect(
      validateContent(
        truncatedValidator,
        {
          rules: [],
          style: [],
          characters: [],
          locations: [],
          scenes: [],
          lore: [],
          worldbuilding: [],
        },
        "content",
      ),
    ).rejects.toThrow(/NOT verified clean/);
  });
});
