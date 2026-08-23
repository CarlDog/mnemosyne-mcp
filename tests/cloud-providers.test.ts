// Cloud LLM provider coverage (anthropic / openai-compat / gemini) plus
// the Botify reply extractor and the companion-message equivalence check.
//
// Pure tests run unconditionally: request-body builders and response
// parsers, with fixtures matching each API's documented contract (the
// OpenAI-compat fixture additionally matches atlascloud-mcp's own
// ChatCompletionResponse type, its captured contract of the same API).
// Live round-trips are env-gated per provider key and skip cleanly --
// setting a key is the deliberate opt-in, same convention as the
// OC/Ollama/Kindroid integration suites.

import { describe, it, expect } from "vitest";
import {
  buildAnthropicBody,
  extractAnthropicText,
  AnthropicProvider,
} from "../src/anthropic-provider.js";
import {
  buildChatCompletionsBody,
  extractChatCompletionText,
  OpenAICompatProvider,
} from "../src/openai-compat-provider.js";
import {
  buildGeminiBody,
  extractGeminiText,
  GeminiProvider,
} from "../src/gemini-provider.js";
import { extractBotReply } from "../src/botify-client.js";
import { buildCompanionMessage } from "../src/companion-message.js";
import { buildKindroidMessage } from "../src/kindroid-provider.js";
import type { LlmGenerateOptions } from "../src/llm.js";
import type { ContextBundle } from "../src/prompt.js";

const OPTS: LlmGenerateOptions = {
  systemPrompt: "You are the narrator.",
  userMessage: "Continue the story.",
};

describe("buildChatCompletionsBody / extractChatCompletionText (pure)", () => {
  it("omits temperature/max_tokens unless the caller set them — the newest OpenAI reasoning models 400 on their mere presence", () => {
    const body = buildChatCompletionsBody("gpt-4.1", OPTS);
    expect(body).toEqual({
      model: "gpt-4.1",
      messages: [
        { role: "system", content: "You are the narrator." },
        { role: "user", content: "Continue the story." },
      ],
    });
    expect("temperature" in body).toBe(false);
    expect("max_tokens" in body).toBe(false);
  });

  it("honors per-call model/temperature/maxTokens overrides", () => {
    const body = buildChatCompletionsBody("gpt-4.1", {
      ...OPTS,
      model: "deepseek-ai/deepseek-v3.2",
      temperature: 0.2,
      maxTokens: 512,
    });
    expect(body.model).toBe("deepseek-ai/deepseek-v3.2");
    expect(body.temperature).toBe(0.2);
    expect(body.max_tokens).toBe(512);
  });

  it("extracts choices[0].message.content (the shape atlascloud-mcp's own types confirm)", () => {
    const fixture = {
      id: "chatcmpl-1",
      object: "chat.completion",
      created: 1,
      model: "gpt-4.1",
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: "The fog rolled in." },
          finish_reason: "stop",
        },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    };
    expect(extractChatCompletionText("openai", fixture)).toBe(
      "The fog rolled in.",
    );
  });

  it("surfaces the provider's own error message, and throws on empty choices", () => {
    expect(() =>
      extractChatCompletionText("openai", {
        error: { message: "invalid api key" },
      }),
    ).toThrow(/openai error: invalid api key/);
    expect(() =>
      extractChatCompletionText("atlascloud", { choices: [] }),
    ).toThrow(/atlascloud returned no completion content/);
  });
});

describe("buildAnthropicBody / extractAnthropicText (pure)", () => {
  it("puts system at top level, always includes the REQUIRED max_tokens, and NEVER sends temperature unless set — current-gen Claude models 400 on the field's presence", () => {
    const body = buildAnthropicBody("claude-sonnet-4-5", OPTS);
    expect(body).toEqual({
      model: "claude-sonnet-4-5",
      max_tokens: 2048,
      system: "You are the narrator.",
      messages: [{ role: "user", content: "Continue the story." }],
    });
    expect("temperature" in body).toBe(false);
    expect(
      buildAnthropicBody("claude-sonnet-4-5", { ...OPTS, temperature: 0.5 })
        .temperature,
    ).toBe(0.5);
  });

  it("concatenates text blocks and ignores non-text blocks", () => {
    const fixture = {
      content: [
        { type: "thinking", thinking: "..." },
        { type: "text", text: "The fog " },
        { type: "text", text: "rolled in." },
      ],
    };
    expect(extractAnthropicText(fixture)).toBe("The fog rolled in.");
  });

  it("surfaces API errors and empty content", () => {
    expect(() =>
      extractAnthropicText({ error: { message: "overloaded" } }),
    ).toThrow(/anthropic error: overloaded/);
    expect(() => extractAnthropicText({ content: [] })).toThrow(
      /anthropic returned no text content/,
    );
  });
});

describe("buildGeminiBody / extractGeminiText (pure)", () => {
  it("maps systemPrompt to systemInstruction; generationConfig appears only when the caller set something (2.5 thinking tokens eat a hard default cap)", () => {
    const capped = buildGeminiBody({ ...OPTS, maxTokens: 1024 });
    expect(capped).toEqual({
      systemInstruction: { parts: [{ text: "You are the narrator." }] },
      contents: [{ role: "user", parts: [{ text: "Continue the story." }] }],
      generationConfig: { maxOutputTokens: 1024 },
    });

    const bare = buildGeminiBody(OPTS);
    expect("generationConfig" in bare).toBe(false);
  });

  it("joins candidate parts, and surfaces safety blocks distinctly from empty output", () => {
    expect(
      extractGeminiText({
        candidates: [
          {
            content: { parts: [{ text: "The fog " }, { text: "rolled in." }] },
          },
        ],
      }),
    ).toBe("The fog rolled in.");
    expect(() =>
      extractGeminiText({ promptFeedback: { blockReason: "SAFETY" } }),
    ).toThrow(/blocked the prompt \(SAFETY\)/);
    expect(() =>
      extractGeminiText({ candidates: [{ finishReason: "MAX_TOKENS" }] }),
    ).toThrow(/no text content \(finishReason: MAX_TOKENS\)/);
  });
});

describe("extractBotReply (pure)", () => {
  it("returns the bot reply text when present", () => {
    expect(extractBotReply({ bot_message: { text: "Hello!" } })).toBe("Hello!");
  });

  it("throws with the trigger_warning detail and a do-not-retry note", () => {
    expect(() => extractBotReply({ trigger_warning: "inference 500" })).toThrow(
      /inference 500.*do not blindly retry/s,
    );
  });

  it("points at botify-mcp's BOTIFY_APP_TOKEN only when inference was never attempted (bot_message absent)", () => {
    expect(() => extractBotReply({})).toThrow(/BOTIFY_APP_TOKEN/);
  });

  it("does NOT blame the app token when inference ran but produced no text (bot_message null)", () => {
    // Verified against botify-mcp source: bot_message === null means the
    // inference call ran (token fine) but the response carried no text.
    expect(() => extractBotReply({ bot_message: null })).toThrow(
      /produced no text.*do not blindly retry/s,
    );
    expect(() => extractBotReply({ bot_message: null })).not.toThrow(
      /BOTIFY_APP_TOKEN/,
    );
  });
});

describe("leading-whitespace trim (the Ollama lesson, applied to cloud extractors)", () => {
  it("strips a stray leading newline/space from every provider's reply", () => {
    expect(
      extractChatCompletionText("openai", {
        choices: [{ message: { content: "\n The fog rolled in." } }],
      }),
    ).toBe("The fog rolled in.");
    expect(
      extractAnthropicText({
        content: [{ type: "text", text: " The fog rolled in." }],
      }),
    ).toBe("The fog rolled in.");
    expect(
      extractGeminiText({
        candidates: [
          { content: { parts: [{ text: "\nThe fog rolled in." }] } },
        ],
      }),
    ).toBe("The fog rolled in.");
  });
});

describe("buildCompanionMessage ↔ buildKindroidMessage equivalence", () => {
  it("kindroid's non-group path IS the shared builder (extraction was behavior-preserving)", () => {
    const context: ContextBundle = {
      rules: [],
      style: [],
      characters: ["Aria Voss\nA cartographer."],
      locations: [],
      scenes: ["Opening\nThe fog rolled in."],
      lore: [],
      worldbuilding: [],
    };
    const direction = "find Aria Voss at the docks";
    expect(buildCompanionMessage(direction, context)).toBe(
      buildKindroidMessage(direction, context, false),
    );
  });
});

// ---------------------------------------------------------------------------
// Live round-trips: one tiny generation per provider, gated on that
// provider's key + model being set. Real API calls with real cost --
// setting the env vars is the opt-in.
// ---------------------------------------------------------------------------

// Deliberately NO temperature/maxTokens: the pass-through posture means
// omitting them is the path every model accepts (reasoning-era models
// reject the fields, and a tight cap would starve a thinking model's
// budget). Cost is bounded by the prompt asking for a one-word reply.
const LIVE_OPTS: LlmGenerateOptions = {
  systemPrompt: "You are a terse assistant. Reply with a single short word.",
  userMessage: "Say hello.",
};

const anthropicSuite =
  process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_MODEL
    ? describe
    : describe.skip;
anthropicSuite("AnthropicProvider (live)", () => {
  it("round-trips a tiny generation", async () => {
    const provider = new AnthropicProvider({
      apiKey: process.env.ANTHROPIC_API_KEY!,
      defaultModel: process.env.ANTHROPIC_MODEL!,
    });
    const text = await provider.generate(LIVE_OPTS);
    expect(text.length).toBeGreaterThan(0);
  }, 60_000);
});

const openaiSuite =
  process.env.OPENAI_API_KEY && process.env.OPENAI_MODEL
    ? describe
    : describe.skip;
openaiSuite("OpenAICompatProvider (live, openai)", () => {
  it("round-trips a tiny generation", async () => {
    const provider = new OpenAICompatProvider({
      name: "openai",
      baseUrl: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
      apiKey: process.env.OPENAI_API_KEY!,
      defaultModel: process.env.OPENAI_MODEL!,
    });
    const text = await provider.generate(LIVE_OPTS);
    expect(text.length).toBeGreaterThan(0);
  }, 60_000);
});

const geminiSuite =
  process.env.GEMINI_API_KEY && process.env.GEMINI_MODEL
    ? describe
    : describe.skip;
geminiSuite("GeminiProvider (live)", () => {
  it("round-trips a tiny generation", async () => {
    const provider = new GeminiProvider({
      apiKey: process.env.GEMINI_API_KEY!,
      defaultModel: process.env.GEMINI_MODEL!,
    });
    const text = await provider.generate(LIVE_OPTS);
    expect(text.length).toBeGreaterThan(0);
  }, 60_000);
});

const botifySuite =
  process.env.BOTIFY_MCP_URL && process.env.BOTIFY_STORYTELLING_CHAT
    ? describe
    : describe.skip;
botifySuite("BotifyProvider (live)", () => {
  it("posts a message to the real chat and gets a bot reply", async () => {
    const { BotifyClient } = await import("../src/botify-client.js");
    const { BotifyProvider } = await import("../src/botify-provider.js");
    const client = new BotifyClient(
      new URL(process.env.BOTIFY_MCP_URL!),
      process.env.BOTIFY_MCP_AUTH_TOKEN,
    );
    const provider = new BotifyProvider(client, {
      defaultChatId: process.env.BOTIFY_STORYTELLING_CHAT!,
    });
    try {
      const text = await provider.generate({
        systemPrompt: "",
        userMessage:
          "(mnemosyne integration test — just say hi back in one short sentence)",
      });
      expect(text.length).toBeGreaterThan(0);
    } finally {
      await client.close();
    }
  }, 120_000);
});

const atlasSuite =
  process.env.ATLASCLOUD_API_KEY && process.env.ATLASCLOUD_MODEL
    ? describe
    : describe.skip;
atlasSuite("OpenAICompatProvider (live, atlascloud)", () => {
  it("round-trips a tiny generation", async () => {
    const provider = new OpenAICompatProvider({
      name: "atlascloud",
      baseUrl:
        process.env.ATLASCLOUD_BASE_URL || "https://api.atlascloud.ai/v1",
      apiKey: process.env.ATLASCLOUD_API_KEY!,
      defaultModel: process.env.ATLASCLOUD_MODEL!,
    });
    const text = await provider.generate(LIVE_OPTS);
    expect(text.length).toBeGreaterThan(0);
  }, 120_000);
});
