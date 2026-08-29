// Anthropic Messages API provider -- direct HTTP, no SDK (matching the
// repo's Ollama convention). Full-fidelity mapping: systemPrompt,
// temperature, maxTokens, and per-call model all map directly; `context`
// is ignored (systemPrompt already carries it) and `kindroidTarget` is
// Kindroid-specific.
//
// Wire format per the Messages API contract: POST /v1/messages with
// x-api-key + anthropic-version headers; `system` is a top-level field
// (not a message role); `max_tokens` is REQUIRED by the API, so the
// shared default applies whenever the caller doesn't set one. Response
// text lives in content[] blocks of type "text".
//
// `temperature` is sent ONLY when the caller supplies one: Anthropic
// removed sampling controls on current-generation models (Opus 4.7 and
// everything after — Sonnet 5, Fable 5, ...), where including the field
// at all is a 400. Older models accept 0–1 (narrower than some other
// providers' 0–2). Omitting by default means every model works out of
// the box; an explicit temperature on a model that rejects it fails
// loudly with the API's own message, which is the actionable outcome.
//
// Live-verification status: documented contract, exercised by an
// env-gated integration test whenever ANTHROPIC_API_KEY is set.

import { llmPostJson } from "./llm-http.js";
import { log } from "./log.js";
import {
  completionFromFinishReason,
  computeTotalTokens,
  omitUndefined,
} from "./llm.js";
import type {
  GeneratedBeat,
  LlmGenerateOptions,
  LlmProvider,
  ModelUsage,
} from "./llm.js";

const ANTHROPIC_BASE_URL = "https://api.anthropic.com";
const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_MAX_TOKENS = 2048;

export interface AnthropicConfig {
  apiKey: string;
  defaultModel: string;
}

/** Pure request-body assembly -- unit-testable without a network. */
export function buildAnthropicBody(
  defaultModel: string,
  opts: LlmGenerateOptions,
): Record<string, unknown> {
  return {
    model: opts.model ?? defaultModel,
    // Required by the API -- there is no "unlimited" spelling.
    max_tokens: opts.maxTokens ?? DEFAULT_MAX_TOKENS,
    system: opts.systemPrompt,
    messages: [{ role: "user", content: opts.userMessage }],
    // Pass-through only -- see the header comment: current-gen Claude
    // models 400 on the field's mere presence.
    ...(opts.temperature !== undefined && { temperature: opts.temperature }),
  };
}

interface AnthropicResponse {
  content?: Array<{ type?: string; text?: string }>;
  /** "end_turn" | "stop_sequence" (natural) | "max_tokens" (truncated). */
  stop_reason?: string;
  model?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
  error?: { message?: string };
}

/** Pure response parsing: concatenate the text blocks (a normal reply is
 * one, but the contract allows several) and carry the stop reason so a
 * `max_tokens`-cut beat is not auto-saved as canon (same contract as
 * OllamaProvider -- see GeneratedBeat.complete). */
export function extractAnthropicText(data: unknown): GeneratedBeat {
  const res = data as AnthropicResponse;
  if (res.error) {
    throw new Error(`anthropic error: ${res.error.message ?? "unknown"}`);
  }
  const text = (res.content ?? [])
    .filter((block) => block.type === "text" && block.text)
    .map((block) => block.text)
    .join("");
  if (!text) {
    throw new Error("anthropic returned no text content");
  }
  // Strip leading whitespace -- same lesson as OllamaProvider: a stray
  // leading space/newline gets saved into the scene and trips downstream
  // display + parsing.
  const usage: ModelUsage | undefined = res.usage
    ? {
        provider: "anthropic",
        source: "reported",
        ...omitUndefined({
          model: res.model,
          input_tokens: res.usage.input_tokens,
          output_tokens: res.usage.output_tokens,
          total_tokens: computeTotalTokens(
            res.usage.input_tokens,
            res.usage.output_tokens,
            undefined,
          ),
          cached_input_tokens: res.usage.cache_read_input_tokens,
          cache_creation_input_tokens: res.usage.cache_creation_input_tokens,
        }),
      }
    : undefined;
  return {
    text: text.replace(/^\s+/, ""),
    ...completionFromFinishReason(res.stop_reason, {
      stop: ["end_turn", "stop_sequence"],
      length: ["max_tokens"],
    }),
    ...(usage !== undefined && { usage }),
  };
}

export class AnthropicProvider implements LlmProvider {
  readonly name = "anthropic";

  constructor(private readonly config: AnthropicConfig) {}

  async generate(opts: LlmGenerateOptions): Promise<GeneratedBeat> {
    const body = buildAnthropicBody(this.config.defaultModel, opts);
    const start = Date.now();
    log.info(this.name, "generate", {
      model: body.model,
      system_chars: opts.systemPrompt.length,
      user_chars: opts.userMessage.length,
    });
    const data = await llmPostJson({
      provider: this.name,
      url: `${ANTHROPIC_BASE_URL}/v1/messages`,
      headers: {
        "x-api-key": this.config.apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body,
    });
    const beat = extractAnthropicText(data);
    log.info(this.name, "generate ok", {
      model: body.model,
      ms: Date.now() - start,
      chars: beat.text.length,
      finish_reason: beat.finishReason ?? "(unreported)",
    });
    return beat;
  }
}
