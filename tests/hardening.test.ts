// Mechanical hardening items (ratified directly from the assessments):
//   1. parseServiceUrl (NemoClaw §4): http(s)-only, no embedded
//      credentials, no fragment, no query unless opted in; loopback and
//      RFC1918 deliberately allowed.
//   2. classifyOllamaHttpError (Ollama §7): 404 -> exact-tag guidance,
//      exceed_context_size_error -> the reject-don't-truncate message with
//      the daemon's exact counts (nested-JSON-escaped form included),
//      429/503 -> overload with the no-auto-retry rationale.
//   3. Final-sink log redaction (OpenClaw §7): sensitive-named keys are
//      redacted recursively; URL userinfo is scrubbed from string values.

import { describe, it, expect, vi } from "vitest";
import { parseServiceUrl, describeServiceUrl } from "../src/service-url.js";
import { classifyOllamaHttpError, OllamaProvider } from "../src/llm.js";
import { log } from "../src/log.js";

describe("parseServiceUrl", () => {
  it("accepts loopback/RFC1918 http(s) and returns the URL", () => {
    expect(parseServiceUrl("X", "http://127.0.0.1:11434").port).toBe("11434");
    expect(parseServiceUrl("X", "http://some-nas:18000/mcp").pathname).toBe(
      "/mcp",
    );
  });

  it("rejects non-http protocols, credentials, fragments, and query strings", () => {
    expect(() => parseServiceUrl("X", "file:///etc/passwd")).toThrow(
      /http\(s\)/,
    );
    expect(() => parseServiceUrl("X", "http://user:pw@host/")).toThrow(
      /must not embed credentials/,
    );
    expect(() => parseServiceUrl("X", "http://host/#frag")).toThrow(
      /#fragment/,
    );
    expect(() => parseServiceUrl("X", "http://host/?key=abc")).toThrow(
      /credential in disguise/,
    );
    expect(
      parseServiceUrl("X", "http://host/?a=1", { allowQuery: true }).search,
    ).toBe("?a=1");
  });

  it("describeServiceUrl renders origin+path only", () => {
    expect(
      describeServiceUrl(parseServiceUrl("X", "http://some-nas:18000/mcp")),
    ).toBe("http://some-nas:18000/mcp");
    expect(describeServiceUrl(parseServiceUrl("X", "http://host:1/"))).toBe(
      "http://host:1",
    );
  });
});

describe("classifyOllamaHttpError", () => {
  it("404 -> exact-tag guidance", () => {
    expect(classifyOllamaHttpError(404, "", "typo-model").message).toMatch(
      /not installed.*EXACT/s,
    );
  });

  it("exceed_context_size_error -> reject-don't-truncate with the daemon's counts (nested-escaped wire form)", () => {
    // Captured live wire shape: JSON nested inside a JSON string.
    const body =
      '{"error":"{\\"error\\":{\\"code\\":400,\\"message\\":\\"request (6016 tokens) exceeds the available context size (4096 tokens)\\",\\"type\\":\\"exceed_context_size_error\\",\\"n_prompt_tokens\\":6016,\\"n_ctx\\":4096}}"}';
    const err = classifyOllamaHttpError(400, body, "m");
    expect(err.message).toMatch(/reject-don't-truncate/);
    expect(err.message).toContain("6016 tokens vs num_ctx 4096");
  });

  it("429/503 -> overload with the no-auto-retry rationale", () => {
    for (const status of [429, 503]) {
      expect(classifyOllamaHttpError(status, "", "m").message).toMatch(
        /overloaded.*NOT retried automatically/s,
      );
    }
  });

  it("anything else keeps the plain status + bounded body", () => {
    expect(classifyOllamaHttpError(500, "boom", "m").message).toBe(
      "Ollama HTTP 500: boom",
    );
  });
});

describe("final-sink log redaction", () => {
  function capture(meta: Record<string, unknown>): string {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    log.info("test", "line", meta);
    const line = String(spy.mock.calls[0]?.[0] ?? "");
    spy.mockRestore();
    return line;
  }

  it("redacts sensitive-named keys, recursively", () => {
    const line = capture({
      api_key: "sk-SECRET",
      nested: { auth_token: "abc123", ok: "visible" },
      count: 3,
    });
    expect(line).not.toContain("sk-SECRET");
    expect(line).not.toContain("abc123");
    expect(line).toContain("<redacted>");
    expect(line).toContain("visible");
    expect(line).toContain("count=3");
  });

  it("scrubs URL userinfo out of string values", () => {
    const line = capture({ url: "http://user:hunter2@host:1/mcp" });
    expect(line).not.toContain("hunter2");
    expect(line).toContain("http://<redacted>@host:1/mcp");
  });
});

describe("Ollama timeout classification", () => {
  it("a hung request classifies as timeout via the owned controller, not error-name sniffing", async () => {
    const realFetch = globalThis.fetch;
    // Hang until aborted, then reject the way undici does: a wrapper
    // whose NAME is not AbortError (the real cause is nested).
    globalThis.fetch = vi.fn(
      (_input: URL | RequestInfo, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            const wrapper = new TypeError("fetch failed");
            (wrapper as { cause?: unknown }).cause = new Error("aborted");
            reject(wrapper);
          });
        }),
    ) as unknown as typeof fetch;
    try {
      const p = new OllamaProvider({
        url: "http://127.0.0.1:1",
        defaultModel: "m",
        timeoutMs: 50,
      });
      // Pre-seed the show cache so no /api/show fetch races the hang.
      (
        p as unknown as { showCache: Map<string, Promise<unknown>> }
      ).showCache.set("m", Promise.resolve({}));
      await expect(
        p.generate({ systemPrompt: "s", userMessage: "u" }),
      ).rejects.toThrow(/timed out after 50ms.*OLLAMA_TIMEOUT_MS/s);
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});
