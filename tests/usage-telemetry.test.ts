// Provider usage telemetry (docs/OPEN_WEBUI_ADOPTION_ASSESSMENT.md §3 +
// the Ollama assessment's telemetry track, one implementation). Every
// provider previously discarded its response's usage block. Guardrails
// pinned here:
//   - unknown values stay ABSENT, never a flattering zero;
//   - total_tokens is reported-or-both-parts, never a half-sum;
//   - Ollama's wire nanoseconds normalize to milliseconds;
//   - generator and validator usage stay SEPARATE in the continuation
//     response, and the envelope is absent when nothing reported.

import { describe, it, expect, vi, afterEach } from "vitest";
import {
  OllamaProvider,
  computeTotalTokens,
  type LlmProvider,
} from "../src/llm.js";
import { extractAnthropicText } from "../src/anthropic-provider.js";
import { extractChatCompletionText } from "../src/openai-compat-provider.js";
import { extractGeminiText } from "../src/gemini-provider.js";
import { validateContentWithUsage } from "../src/validator.js";
import { continueScene } from "./helpers/application.js";
import type { OcClient, OcMemory } from "../src/oc-client.js";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("computeTotalTokens", () => {
  it("reported wins; else both parts; else absent", () => {
    expect(computeTotalTokens(10, 5, 99)).toBe(99);
    expect(computeTotalTokens(10, 5, undefined)).toBe(15);
    expect(computeTotalTokens(10, undefined, undefined)).toBeUndefined();
    expect(computeTotalTokens(undefined, undefined, undefined)).toBeUndefined();
  });
});

describe("ollama usage", () => {
  it("maps counts and normalizes nanosecond durations to ms", async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        message: { content: "ok" },
        done: true,
        done_reason: "stop",
        prompt_eval_count: 120,
        eval_count: 40,
        load_duration: 2_500_000_000,
        prompt_eval_duration: 800_000_000,
        eval_duration: 1_200_000_000,
      }),
    })) as unknown as typeof fetch;
    const beat = await new OllamaProvider({
      url: "http://127.0.0.1:1",
      defaultModel: "m",
    }).generate({ systemPrompt: "s", userMessage: "u" });
    expect(beat.usage).toEqual({
      provider: "ollama",
      model: "m",
      source: "reported",
      input_tokens: 120,
      output_tokens: 40,
      total_tokens: 160,
      load_ms: 2500,
      prompt_eval_ms: 800,
      generation_ms: 1200,
    });
  });

  it("absent metrics stay absent -- no zeros invented", async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        message: { content: "ok" },
        done: true,
        done_reason: "stop",
        eval_count: 40,
      }),
    })) as unknown as typeof fetch;
    const beat = await new OllamaProvider({
      url: "http://127.0.0.1:1",
      defaultModel: "m",
    }).generate({ systemPrompt: "s", userMessage: "u" });
    expect(beat.usage?.output_tokens).toBe(40);
    expect(beat.usage).not.toHaveProperty("input_tokens");
    expect(beat.usage).not.toHaveProperty("total_tokens");
    expect(beat.usage).not.toHaveProperty("load_ms");
  });
});

describe("cloud usage mapping", () => {
  it("anthropic: input/output plus cache creation and reads", () => {
    const beat = extractAnthropicText({
      content: [{ type: "text", text: "ok" }],
      stop_reason: "end_turn",
      model: "claude-sonnet-4-5",
      usage: {
        input_tokens: 100,
        output_tokens: 20,
        cache_creation_input_tokens: 60,
        cache_read_input_tokens: 30,
      },
    });
    expect(beat.usage).toEqual({
      provider: "anthropic",
      source: "reported",
      model: "claude-sonnet-4-5",
      input_tokens: 100,
      output_tokens: 20,
      total_tokens: 120,
      cached_input_tokens: 30,
      cache_creation_input_tokens: 60,
    });
  });

  it("openai-compat: reported total wins; cached detail mapped", () => {
    const beat = extractChatCompletionText("atlascloud", {
      choices: [{ message: { content: "ok" }, finish_reason: "stop" }],
      model: "deepseek-v4",
      usage: {
        prompt_tokens: 50,
        completion_tokens: 10,
        total_tokens: 61,
        prompt_tokens_details: { cached_tokens: 40 },
      },
    });
    expect(beat.usage).toMatchObject({
      provider: "atlascloud",
      total_tokens: 61,
      cached_input_tokens: 40,
    });
  });

  it("gemini: usageMetadata mapped; missing block leaves usage absent", () => {
    const withMeta = extractGeminiText({
      candidates: [
        { content: { parts: [{ text: "ok" }] }, finishReason: "STOP" },
      ],
      modelVersion: "gemini-3.6-flash",
      usageMetadata: {
        promptTokenCount: 30,
        candidatesTokenCount: 5,
        totalTokenCount: 35,
        cachedContentTokenCount: 12,
      },
    });
    expect(withMeta.usage).toMatchObject({
      provider: "gemini",
      input_tokens: 30,
      output_tokens: 5,
      total_tokens: 35,
      cached_input_tokens: 12,
    });

    const without = extractAnthropicText({
      content: [{ type: "text", text: "ok" }],
      stop_reason: "end_turn",
    });
    expect(without.usage).toBeUndefined();
  });
});

// --- separation through the continuation response --------------------------

const STORY_ID = "11111111-2222-4333-8444-555555555555";

function stubOc(): OcClient {
  return {
    memorySearch: async () => [],
    memoryList: async () => [],
    memorySave: async () =>
      ({
        id: "saved-1",
        content: "",
        project_id: STORY_ID,
        tags: [],
        pinned: false,
        created_at: "2026-01-01T00:00:00Z",
      }) satisfies OcMemory,
    memoryUpdate: async () => ({}) as OcMemory,
  } as unknown as OcClient;
}

const usageGenerator: LlmProvider = {
  name: "stub-generator",
  generate: async () => ({
    text: "A beat.",
    usage: { provider: "stub-generator", source: "reported", input_tokens: 9 },
  }),
};

const usageValidator: LlmProvider = {
  name: "stub-validator",
  generate: async () => ({
    text: JSON.stringify({ issues: [], summary: "clean" }),
    usage: { provider: "stub-validator", source: "reported", output_tokens: 3 },
  }),
};

describe("continuation response usage envelope", () => {
  it("keeps generator and validator usage separate", async () => {
    const result = await continueScene(
      stubOc(),
      usageGenerator,
      usageValidator,
      STORY_ID,
      {
        direction: "go on",
        sceneStrategy: "query-ranked",
        validate: true,
        reinvokeHint: "call again",
      },
    );
    expect(result.usage?.generator).toMatchObject({
      provider: "stub-generator",
      input_tokens: 9,
    });
    expect(result.usage?.validator).toMatchObject({
      provider: "stub-validator",
      output_tokens: 3,
    });
  });

  it("an incomplete (length-cut) beat still reports its generator usage", async () => {
    const truncated: LlmProvider = {
      name: "stub-generator",
      generate: async () => ({
        text: "cut mid-sen",
        complete: false,
        finishReason: "length",
        usage: {
          provider: "stub-generator",
          source: "reported",
          input_tokens: 500,
          output_tokens: 2048,
        },
      }),
    };
    const result = await continueScene(
      stubOc(),
      truncated,
      usageValidator,
      STORY_ID,
      {
        direction: "go on",
        sceneStrategy: "query-ranked",
        reinvokeHint: "call again",
      },
    );
    expect(result.incomplete).toBe(true);
    expect(result.usage?.generator).toMatchObject({ output_tokens: 2048 });
  });

  it("omits the envelope entirely when nothing reported usage", async () => {
    const bare: LlmProvider = {
      name: "bare",
      generate: async () => ({ text: "A beat." }),
    };
    const result = await continueScene(stubOc(), bare, bare, STORY_ID, {
      direction: "go on",
      sceneStrategy: "query-ranked",
      reinvokeHint: "call again",
    });
    expect(result.usage).toBeUndefined();
  });
});

describe("validateContentWithUsage", () => {
  it("passes the validator call's usage through beside the report", async () => {
    const outcome = await validateContentWithUsage(
      usageValidator,
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
    );
    expect(outcome.report.summary).toBe("clean");
    expect(outcome.usage).toMatchObject({ provider: "stub-validator" });
  });
});
