// LLM provider abstraction. v0 ships Ollama only. Adding Botify or
// Anthropic later is a new class implementing LlmProvider — and a
// runtime selection mechanism (env var) will appear naturally then.
// Don't pre-build it.

import { log } from "./log.js";
import type { ContextBundle } from "./prompt.js";
import type { KindroidTarget } from "./stories.js";

/**
 * Describe a transport-level failure with its real cause.
 *
 * Node's global `fetch()` throws a bare `TypeError: fetch failed` on any
 * network-level error (DNS, connect, TLS) — the actual reason lives in
 * `error.cause` and is discarded if nothing reads it, making a live
 * connectivity fault (e.g. a wrong OLLAMA_URL) undiagnosable from the tool's
 * error output alone (fleet standard MCP-F08). Must be folded into the
 * thrown Error's message itself: downstream error handling here only ever
 * reads `.message`, so `.cause` would otherwise be discarded again.
 */
export function describeTransportError(err: unknown): string {
  const base = err instanceof Error ? err.message : String(err);
  const cause = err instanceof Error ? err.cause : undefined;
  const causeMsg =
    cause instanceof Error ? cause.message : cause ? String(cause) : "";
  return causeMsg ? `${base}: ${causeMsg}` : base;
}

export interface LlmGenerateOptions {
  systemPrompt: string;
  userMessage: string;
  temperature?: number;
  maxTokens?: number;
  /** Override the provider's default model for this call. Ollama-specific
   * (an Ollama model tag) -- Kindroid's per-call override is kindroidTarget
   * below, since a Kindroid target needs a type (ai vs group), not just an id. */
  model?: string;
  /** The same gatherContext() result systemPrompt was built from, in
   * structured form. OllamaProvider ignores this (systemPrompt already has
   * everything it needs) -- it exists for KindroidProvider, which has no
   * system-prompt channel and instead does its own keyphrase-based
   * selection over these entities. */
  context?: ContextBundle;
  /** Kindroid-specific per-call target override (a single AI or a group
   * chat), taking precedence over the provider's configured/story-bound
   * default. OllamaProvider ignores this. */
  kindroidTarget?: KindroidTarget;
}

export interface LlmProvider {
  readonly name: string;
  generate(opts: LlmGenerateOptions): Promise<string>;
}

export interface OllamaConfig {
  url: string;
  defaultModel: string;
}

const OLLAMA_TIMEOUT_MS = 5 * 60 * 1000;
const DEFAULT_TEMPERATURE = 0.8;
const DEFAULT_MAX_TOKENS = 2048;

interface OllamaChatResponse {
  message?: { role?: string; content?: string };
  error?: string;
  done?: boolean;
}

export class OllamaProvider implements LlmProvider {
  readonly name = "ollama";

  constructor(private readonly config: OllamaConfig) {}

  async generate(opts: LlmGenerateOptions): Promise<string> {
    const model = opts.model ?? this.config.defaultModel;
    const url = new URL("/api/chat", this.config.url);

    const body = {
      model,
      messages: [
        { role: "system", content: opts.systemPrompt },
        { role: "user", content: opts.userMessage },
      ],
      stream: false,
      options: {
        temperature: opts.temperature ?? DEFAULT_TEMPERATURE,
        num_predict: opts.maxTokens ?? DEFAULT_MAX_TOKENS,
      },
    };

    const start = Date.now();
    log.info("ollama", "generate", {
      model,
      system_chars: opts.systemPrompt.length,
      user_chars: opts.userMessage.length,
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Ollama HTTP ${res.status}: ${text || res.statusText}`);
      }

      const data = (await res.json()) as OllamaChatResponse;
      if (data.error) {
        throw new Error(`Ollama error: ${data.error}`);
      }
      const content = data.message?.content;
      if (!content) {
        throw new Error("Ollama returned no message content");
      }

      // Strip leading whitespace. Some models (notably HammerAI/mythomax-l2)
      // prefix their responses with a stray space character; passing it
      // through means scenes get saved as " Text..." which then trips
      // downstream display + parsing in subtle ways.
      const trimmed = content.replace(/^\s+/, "");
      log.info("ollama", "generate ok", {
        model,
        ms: Date.now() - start,
        chars: trimmed.length,
      });
      return trimmed;
    } catch (err) {
      const message = describeTransportError(err);
      log.error("ollama", "generate error", {
        model,
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
}
