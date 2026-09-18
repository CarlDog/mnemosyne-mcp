// `think` is the field a thinking-capable model turns against this server.
//
// The provider reads only `message.content`. With no `think` in the body, a
// thinking model (Qwen3.8, Gemma 4 and its fine-tunes) reasons into a
// separate `message.thinking` field, and that reasoning is charged against
// num_predict. Live-verified 2026-09-18 on Ollama 0.34.2: qwen3.8:27b given
// the exact body generate() sends returned 900-1300 chars of thinking and an
// EMPTY `message.content` once the budget was spent, which this provider
// surfaces as "Ollama returned no message content"; gemma4 routed to
// `thinking` the same way. A top-level `"think": false` gave normal content
// with done_reason "stop".
//
// Why fixed `false` and not a default or a model sniff, both verified the
// same day: `false` is HTTP 200 on non-thinking models too (mistral-nemo,
// llama3.1), whereas `true` is HTTP 400 `"<model>" does not support
// thinking` on them. Nothing in tests/ pinned the field until this file.

import { describe, it, expect, vi, afterEach } from "vitest";
import { OllamaProvider } from "../src/ollama-provider.js";

type Captured = Record<string, unknown>;

/** Stubs fetch, runs one provider call, and returns the /api/chat body
 * Ollama saw (a /api/show preflight may precede it; that body is not the
 * one under test). */
async function captureChatBody(
  run: (provider: OllamaProvider) => Promise<unknown>,
): Promise<Captured> {
  const chatBodies: Captured[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: URL | string, init?: { body?: string }) => {
      if (String(url).includes("/api/chat") && init?.body) {
        chatBodies.push(JSON.parse(init.body) as Captured);
      }
      return {
        ok: true,
        json: async () => ({ message: { content: "ok" }, done: true }),
      };
    }),
  );

  const provider = new OllamaProvider({
    url: "http://stub:11434",
    defaultModel: "test-model",
    contentCapability: "sfw",
  });
  await run(provider);
  expect(chatBodies).toHaveLength(1);
  return chatBodies[0]!;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the Ollama generation request body", () => {
  it("pins think to the boolean false at the TOP LEVEL", async () => {
    const body = await captureChatBody((p) =>
      p.generate({ systemPrompt: "sys", userMessage: "usr" }),
    );
    expect(body.think).toBe(false);
    expect(typeof body.think).toBe("boolean");
    // Placement: `think` is a sibling of keep_alive/format, not a runner
    // option. Nested in options Ollama would ignore it silently, the same
    // failure shape keep_alive had once.
    expect(body.options).toBeDefined();
    expect(body.options).not.toHaveProperty("think");
  });

  it("carries the same think:false on the structured (validator) path without touching format", async () => {
    const schema = { type: "object", properties: { ok: { type: "boolean" } } };
    const body = await captureChatBody((p) =>
      p.generateStructured({ systemPrompt: "sys", userMessage: "usr" }, schema),
    );
    expect(body.think).toBe(false);
    expect(body.format).toEqual(schema);
  });
});
