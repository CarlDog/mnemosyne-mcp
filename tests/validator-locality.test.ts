// Validator locality (docs/OLLAMA_ADOPTION_ASSESSMENT.md §2, P0): the
// architecture calls the validator "local and free", but Ollama can
// transparently execute a `:cloud` model or a remote-host alias through the
// same localhost API -- a localhost OLLAMA_URL is not proof of local
// inference, and the validator's request carries the story's full canon.
// With OllamaConfig.requireLocal (set on the validator instance):
//   1. A `:cloud` tag is refused before ANY fetch happens.
//   2. /api/show preflights the exact model: remote_model/remote_host must
//      be absent, a 404 is an actionable not-installed error, and the
//      refusal happens BEFORE the canon-bearing /api/chat request.
//   3. The final chat response's route fields are re-checked, so an alias
//      re-pointed after the cached preflight still fails loudly.
//   4. Without requireLocal (the generator instance) nothing changes -- no
//      /api/show call at all.

import { describe, it, expect, vi, afterEach } from "vitest";
import { OllamaProvider } from "../src/llm.js";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

interface StubRoute {
  show?: { status?: number; body?: unknown };
  chat?: { body?: unknown };
}

/** Route-aware fetch stub recording every URL path hit, in order. */
function stubFetch(routes: StubRoute): { calls: string[] } {
  const state = { calls: [] as string[] };
  globalThis.fetch = vi.fn(async (input: URL | RequestInfo) => {
    const path = new URL(String(input)).pathname;
    state.calls.push(path);
    if (path === "/api/show") {
      const status = routes.show?.status ?? 200;
      return {
        ok: status >= 200 && status < 300,
        status,
        statusText: String(status),
        text: async () => "",
        json: async () => routes.show?.body ?? {},
      };
    }
    return {
      ok: true,
      status: 200,
      json: async () =>
        routes.chat?.body ?? {
          message: { content: "ok" },
          done: true,
          done_reason: "stop",
        },
    };
  }) as unknown as typeof fetch;
  return state;
}

function localOnlyProvider(model = "local-model"): OllamaProvider {
  return new OllamaProvider({
    url: "http://127.0.0.1:1",
    defaultModel: model,
    requireLocal: true,
  });
}

const genOpts = { systemPrompt: "canon", userMessage: "direction" };

describe("requireLocal enforcement", () => {
  it("refuses a :cloud tag before any fetch", async () => {
    const state = stubFetch({});
    await expect(
      localOnlyProvider("qwen3:480b:cloud").generate(genOpts),
    ).rejects.toThrow(/Cloud tag/);
    expect(state.calls).toEqual([]);
  });

  it("refuses a per-call :cloud model override the same way", async () => {
    const state = stubFetch({});
    await expect(
      localOnlyProvider().generate({ ...genOpts, model: "x:cloud" }),
    ).rejects.toThrow(/Cloud tag/);
    expect(state.calls).toEqual([]);
  });

  it("a remote alias fails the /api/show preflight BEFORE any canon is sent", async () => {
    const state = stubFetch({
      show: { body: { remote_host: "https://ollama.com" } },
    });
    await expect(localOnlyProvider().generate(genOpts)).rejects.toThrow(
      /REMOTELY per \/api\/show/,
    );
    // The canon-bearing /api/chat request never happened.
    expect(state.calls).toEqual(["/api/show"]);
  });

  it("a missing model is an actionable not-installed error, not a bare 404", async () => {
    stubFetch({ show: { status: 404 } });
    await expect(localOnlyProvider().generate(genOpts)).rejects.toThrow(
      /not installed.*exact.*tags/i,
    );
  });

  it("a clean preflight lets generation proceed, and the verdict is cached per model", async () => {
    const state = stubFetch({ show: { body: {} } });
    const provider = localOnlyProvider();
    const first = await provider.generate(genOpts);
    const second = await provider.generate(genOpts);
    expect(first.text).toBe("ok");
    expect(second.text).toBe("ok");
    expect(state.calls.filter((p) => p === "/api/show")).toHaveLength(1);
    expect(state.calls.filter((p) => p === "/api/chat")).toHaveLength(2);
  });

  it("a failed preflight is NOT cached -- the next call re-probes", async () => {
    const provider = localOnlyProvider();
    stubFetch({ show: { status: 500 } });
    await expect(provider.generate(genOpts)).rejects.toThrow(/HTTP 500/);
    const recovered = stubFetch({ show: { body: {} } });
    await expect(provider.generate(genOpts)).resolves.toMatchObject({
      text: "ok",
    });
    expect(recovered.calls).toContain("/api/show");
  });

  it("a final response reporting remote execution is refused even after a clean preflight", async () => {
    stubFetch({
      show: { body: {} },
      chat: {
        body: {
          message: { content: "a beat" },
          done: true,
          done_reason: "stop",
          remote_model: "qwen3:480b",
          remote_host: "https://ollama.com",
        },
      },
    });
    await expect(localOnlyProvider().generate(genOpts)).rejects.toThrow(
      /REMOTE execution/,
    );
  });

  it("without requireLocal (the generator), a :cloud model is NOT refused", async () => {
    // The generator instance performs no LOCALITY enforcement. (It may
    // still fetch /api/show for the stable-context window -- that probe
    // never refuses anything without requireLocal.)
    const state = stubFetch({ show: { body: {} } });
    const provider = new OllamaProvider({
      url: "http://127.0.0.1:1",
      defaultModel: "any-model:cloud",
    });
    const beat = await provider.generate(genOpts);
    expect(beat.text).toBe("ok");
    expect(state.calls).toContain("/api/chat");
  });
});
