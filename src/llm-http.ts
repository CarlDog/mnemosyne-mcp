// Shared HTTP scaffolding for the direct-API cloud LLM providers
// (anthropic, openai-compat, gemini): POST JSON, bounded timeout,
// HTTP-status errors with response-body detail, and transport errors
// described with their real cause (MCP-F08 -- Node's fetch() hides
// DNS/connect/TLS reasons in error.cause). Three providers share this
// exact shape, which clears the helper-extraction bar; OllamaProvider
// predates it and keeps its own working copy (don't rewrite what works).

import { describeTransportError } from "./llm.js";
import type { GeneratedBeat } from "./llm.js";
import { log } from "./log.js";

// Cloud inference is fast relative to the CPU-NAS Ollama path (which
// needs 5 minutes); 2 minutes is generous for a hosted API while still
// failing well inside an MCP host's tool timeout.
export const CLOUD_LLM_TIMEOUT_MS = 2 * 60 * 1000;

export async function llmPostJson(opts: {
  provider: string;
  url: string | URL;
  headers: Record<string, string>;
  body: unknown;
}): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CLOUD_LLM_TIMEOUT_MS);
  const start = Date.now();
  try {
    const res = await fetch(opts.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...opts.headers },
      body: JSON.stringify(opts.body),
      signal: controller.signal,
      // Credential-bearing requests never follow redirects (NemoClaw §4):
      // a redirect would replay the Authorization header at whatever
      // location the (possibly compromised) upstream names.
      redirect: "error",
    });
    if (!res.ok) {
      // Bounded read: an upstream error body is untrusted and can be
      // huge; 2KB is plenty for a diagnostic.
      const text = (await res.text().catch(() => "")).slice(0, 2048);
      throw new Error(
        `${opts.provider} HTTP ${res.status}: ${text || res.statusText}`,
      );
    }
    return (await res.json()) as unknown;
  } catch (err) {
    const message = describeTransportError(err);
    log.error(opts.provider, "request error", {
      ms: Date.now() - start,
      msg: message,
    });
    throw err instanceof Error && message !== err.message
      ? new Error(message, { cause: err })
      : err;
  } finally {
    clearTimeout(timeout);
  }
}

// The three cloud providers (anthropic, gemini, openai-compat) each wrapped
// llmPostJson in the identical log-post-extract-log shape -- log the
// request, POST, parse, log the result with the same field names/order.
// Extracted once the third provider repeated it verbatim (the
// helper-extraction-scan bar). Each provider still builds its own request
// body and parses its own response shape via `extract` -- those genuinely
// differ per API and stay separate.
export async function runCloudGenerate(opts: {
  name: string;
  url: string | URL;
  headers: Record<string, string>;
  body: Record<string, unknown>;
  model: string;
  systemPrompt: string;
  userMessage: string;
  extract: (data: unknown) => GeneratedBeat;
}): Promise<GeneratedBeat> {
  const start = Date.now();
  log.info(opts.name, "generate", {
    model: opts.model,
    system_chars: opts.systemPrompt.length,
    user_chars: opts.userMessage.length,
  });
  const data = await llmPostJson({
    provider: opts.name,
    url: opts.url,
    headers: opts.headers,
    body: opts.body,
  });
  const beat = opts.extract(data);
  log.info(opts.name, "generate ok", {
    model: opts.model,
    ms: Date.now() - start,
    chars: beat.text.length,
    finish_reason: beat.finishReason ?? "(unreported)",
  });
  return beat;
}
