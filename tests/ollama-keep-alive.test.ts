// keep_alive is the field this server got wrong once already, silently.
//
// fa90ba2 nested it inside `options`, where Ollama ignores it without error --
// the whole keep-alive feature was inert for weeks and nothing failed. 0532814
// moved it to the top level after a live A/B against the NAS daemon. Nothing in
// tests/ pinned either the placement or the value shape until this file.
//
// Both halves are verified against real Ollama, not assumed:
//   - nested `options.keep_alive` leaves the server expiry untouched (2026-08-27)
//   - `"keep_alive":"-1"` -> HTTP 400, `"keep_alive":-1` -> HTTP 200 (2026-08-28)

import { describe, it, expect, vi, afterEach } from "vitest";
import {
  DEFAULT_KEEP_ALIVE,
  OllamaProvider,
  normalizeKeepAlive,
} from "../src/llm.js";

type Captured = Record<string, unknown>;

/** Stubs fetch, runs one generate(), and returns the request body Ollama saw. */
async function captureRequestBody(keepAlive?: string): Promise<Captured> {
  let body: Captured = {};
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: { body: string }) => {
      body = JSON.parse(init.body) as Captured;
      return {
        ok: true,
        json: async () => ({ message: { content: "ok" }, done: true }),
      };
    }),
  );

  const provider = new OllamaProvider({
    url: "http://stub:11434",
    defaultModel: "test-model",
    ...(keepAlive === undefined ? {} : { keepAlive }),
  });
  await provider.generate({ systemPrompt: "sys", userMessage: "usr" });
  return body;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("normalizeKeepAlive", () => {
  // The exact pair that motivated this: env vars are strings, and
  // .env.example documents OLLAMA_KEEP_ALIVE=-1.
  it('sends "-1" as the number -1, which is the form Ollama accepts', () => {
    expect(normalizeKeepAlive("-1")).toBe(-1);
  });

  it('sends "0" as a number too', () => {
    expect(normalizeKeepAlive("0")).toBe(0);
  });

  it("leaves duration strings alone", () => {
    expect(normalizeKeepAlive("30m")).toBe("30m");
    expect(normalizeKeepAlive("90s")).toBe("90s");
    expect(normalizeKeepAlive("1h30m")).toBe("1h30m");
  });

  it("tolerates surrounding whitespace from a sloppy env value", () => {
    expect(normalizeKeepAlive("  -1  ")).toBe(-1);
    expect(normalizeKeepAlive(" 30m ")).toBe("30m");
  });

  it("does not mangle a value that merely starts with digits", () => {
    expect(normalizeKeepAlive("5m")).toBe("5m");
  });
});

describe("the Ollama request body", () => {
  it("puts keep_alive at the TOP LEVEL, not inside options", async () => {
    const body = await captureRequestBody("30m");
    expect(body.keep_alive).toBe("30m");
    // The actual regression: nested here, Ollama ignores it silently.
    expect(body.options).toBeDefined();
    expect(body.options).not.toHaveProperty("keep_alive");
  });

  it("applies the default when none is configured", async () => {
    const body = await captureRequestBody();
    expect(body.keep_alive).toBe(DEFAULT_KEEP_ALIVE);
  });

  it("sends a numeric keep_alive as a JSON number, not a string", async () => {
    const body = await captureRequestBody("-1");
    expect(body.keep_alive).toBe(-1);
    expect(typeof body.keep_alive).toBe("number");
  });

  it("keeps the other native controls inside options where they belong", async () => {
    const body = await captureRequestBody("30m");
    const options = body.options as Record<string, unknown>;
    expect(options).toHaveProperty("num_ctx");
    expect(options).toHaveProperty("num_predict");
    expect(options).toHaveProperty("temperature");
    // Placement is the whole point of this file: these must NOT drift upward
    // any more than keep_alive may drift downward.
    expect(body).not.toHaveProperty("num_ctx");
    expect(body).not.toHaveProperty("temperature");
  });
});
