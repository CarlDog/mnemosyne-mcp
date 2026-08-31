// Generator capability descriptors
// (docs/GENERATOR_CAPABILITIES_DESIGN.md, ratified 2026-08-28). Pinned:
//   1. Instance-keyed resolution: two Ollama instances (generator vs
//      validator config) resolve DISTINCT effective context windows.
//   2. unknown is unknown: cloud sampling fields and windows resolve
//      "unknown", never a guess -- and produce NO warnings.
//   3. structured_output tracks supportsStructuredOutput by construction.
//   4. Warn-don't-break: unsupported options warn in the continuation
//      response; the call still succeeds; legacy callers unaffected.
//   5. GET /api/capabilities returns both descriptors.

import { describe, it, expect, vi, afterEach } from "vitest";
import express from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import {
  resolveCapabilities,
  capabilityWarnings,
} from "../src/capabilities.js";
import { OllamaProvider, type LlmProvider } from "../src/llm.js";
import { continueScene } from "../src/tools/continue.js";
import { createApiRouter } from "../src/api/index.js";
import type { OcClient, OcMemory } from "../src/oc-client.js";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

function stubShowFetch(contextLength: number): void {
  globalThis.fetch = vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      model_info: { "llama.context_length": contextLength },
    }),
  })) as unknown as typeof fetch;
}

describe("instance-keyed resolution", () => {
  it("two Ollama instances with different caps resolve distinct windows", async () => {
    stubShowFetch(131_072);
    const generator = new OllamaProvider({
      url: "http://127.0.0.1:1",
      defaultModel: "gen-model",
      maxContextWindow: 32_768,
    });
    const validator = new OllamaProvider({
      url: "http://127.0.0.1:1",
      defaultModel: "val-model",
      maxContextWindow: 8_192,
    });
    const [g, v] = await Promise.all([
      resolveCapabilities(generator),
      resolveCapabilities(validator),
    ]);
    expect(g.context_window).toBe(32_768);
    expect(v.context_window).toBe(8_192);
  });

  it("trained context below the cap clamps the window; unreachable daemon is unknown", async () => {
    stubShowFetch(16_384);
    const p = new OllamaProvider({
      url: "http://127.0.0.1:1",
      defaultModel: "m",
      maxContextWindow: 32_768,
    });
    expect((await resolveCapabilities(p)).context_window).toBe(16_384);

    globalThis.fetch = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;
    const q = new OllamaProvider({
      url: "http://127.0.0.1:1",
      defaultModel: "other",
      maxContextWindow: 32_768,
    });
    expect((await resolveCapabilities(q)).context_window).toBe("unknown");
  });
});

const stubProvider = (name: string): LlmProvider => ({
  name,
  generate: async () => ({ text: "x" }),
});

describe("unknown is unknown", () => {
  it("cloud sampling fields and windows resolve unknown, not guesses", async () => {
    for (const name of ["anthropic", "openai", "atlascloud"]) {
      const caps = await resolveCapabilities(stubProvider(name));
      expect(caps.temperature).toBe("unknown");
      expect(caps.max_tokens).toBe("unknown");
      expect(caps.context_window).toBe("unknown");
      expect(caps.supports_noncommitting_variants).toBe(true);
    }
  });

  it("companions report conversation_mutation and no variants", async () => {
    for (const name of ["kindroid", "botify"]) {
      const caps = await resolveCapabilities(stubProvider(name));
      expect(caps.external_generation_side_effect).toBe(
        "conversation_mutation",
      );
      expect(caps.supports_noncommitting_variants).toBe(false);
      expect(caps.per_call_model_override).toBe(false);
    }
  });

  it("structured_output tracks the type guard by construction", async () => {
    stubShowFetch(4096);
    const ollama = new OllamaProvider({
      url: "http://127.0.0.1:1",
      defaultModel: "m2",
    });
    expect((await resolveCapabilities(ollama)).structured_output).toBe(true);
    expect(
      (await resolveCapabilities(stubProvider("anthropic"))).structured_output,
    ).toBe(false);
  });
});

describe("capabilityWarnings (warn-don't-break)", () => {
  it("warns for options a companion ignores; unknown fields never warn", () => {
    expect(
      capabilityWarnings("kindroid", { temperature: 0.7, model: "x" }),
    ).toHaveLength(2);
    expect(capabilityWarnings("anthropic", { temperature: 1.5 })).toEqual([]);
    expect(capabilityWarnings("ollama", { temperature: 0.7 })).toEqual([]);
  });

  it("continuation responses carry the warning and still succeed", async () => {
    const oc = {
      memorySearch: async () => [],
      memoryList: async () => [],
      memorySave: async () =>
        ({
          id: "saved-1",
          content: "",
          project_id: "11111111-2222-4333-8444-555555555555",
          tags: [],
          pinned: false,
          created_at: "2026-01-01T00:00:00Z",
        }) satisfies OcMemory,
    } as unknown as OcClient;
    const result = await continueScene(
      oc,
      stubProvider("botify"),
      stubProvider("stub-validator"),
      "11111111-2222-4333-8444-555555555555",
      {
        direction: "go on",
        sceneStrategy: "query-ranked",
        temperature: 0.9,
        reinvokeHint: "call again",
      },
    );
    expect(result.capability_warnings).toHaveLength(1);
    expect(result.capability_warnings?.[0]).toMatch(/ignored by the botify/);
    expect(result.memory_id).toBe("saved-1");
  });
});

describe("GET /api/capabilities", () => {
  it("returns both descriptors through the router", async () => {
    const app = express();
    app.use(
      "/api",
      createApiRouter({ memorySearch: async () => [] } as unknown as OcClient, {
        generator: stubProvider("anthropic"),
        validator: stubProvider("stub-validator"),
        validateStory: async () => {
          throw new Error("validation is not exercised by this test");
        },
      }),
    );
    const server: Server = await new Promise((resolve) => {
      const s = app.listen(0, "127.0.0.1", () => resolve(s));
    });
    try {
      const { port } = server.address() as AddressInfo;
      const res = await fetch(`http://127.0.0.1:${port}/api/capabilities`);
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        generator: { provider: string; temperature: unknown };
        validator: { provider: string };
      };
      expect(body.generator.provider).toBe("anthropic");
      expect(body.generator.temperature).toBe("unknown");
      expect(body.validator.provider).toBe("stub-validator");
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
