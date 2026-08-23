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
  /** Override the provider's default model for this call. Honored by every
   * direct-LLM provider (ollama, anthropic, openai, gemini, atlascloud --
   * each interprets it as its own model id/tag); ignored by the
   * companion-chat providers (kindroid, botify), which have no per-call
   * model concept -- Kindroid's per-call override is kindroidTarget below,
   * since a Kindroid target needs a type (ai vs group), not just an id. */
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
  /** How many AI turns a Kindroid GROUP target generates for this beat
   * (1-8, mirroring kindroid_advance_group's own bound). Meaningless for a
   * single-AI target, which always produces exactly one reply, and ignored
   * by every non-Kindroid provider. Overrides KINDROID_GROUP_MAX_TURNS for
   * this call only. */
  groupMaxTurns?: number;
  /** Let a Kindroid GROUP turn loop hand the floor back to the user
   * (default false -- AI-only turns). When true the loop stops as soon as
   * it is the user's turn, which is reported as `groupEnded: "user_turn"`
   * on the result.
   *
   * Deliberately per-call ONLY, with no KINDROID_* env counterpart, unlike
   * groupMaxTurns above: this is a property of the *caller*, not of the
   * deployment. A conversational host can take the turn; a scheduled or
   * webhook-driven caller cannot, and both may hit the same server. A
   * server-wide default of true would hand the floor to a caller that
   * isn't there. Don't "fix" the inconsistency. */
  allowUser?: boolean;
}

/** What a provider returns for one beat.
 *
 * `text` is the beat. The `group*` fields are Kindroid-group-only telemetry
 * about the turn loop that produced it -- every other provider omits them,
 * so there is no per-provider semantics to invent. This widened the return
 * type from a bare string (2026-08-23) so a caller can tell a finished beat
 * from one the group handed back mid-scene; it deliberately does NOT touch
 * LlmGenerateOptions, whose separate "providers ignore most fields" problem
 * is still queued as its own redesign (see STATUS.md). */
export interface GeneratedBeat {
  text: string;
  /** Kindroid group only: why the turn loop stopped. "user_turn" means the
   * floor came back to you mid-scene -- there may still be replies in
   * `text`. Only ever set when allowUser was true (kindroid-mcp's own
   * get-turn can only return empty in that case). */
  groupEnded?: "user_turn" | "max_turns";
  /** Kindroid group only: AI turns actually generated. 0 means the group
   * yielded immediately and `text` is empty. */
  groupTurns?: number;
}

export interface LlmProvider {
  readonly name: string;
  generate(opts: LlmGenerateOptions): Promise<GeneratedBeat>;
}

export interface OllamaConfig {
  url: string;
  defaultModel: string;
  /** Cap on the per-request context window (num_ctx). Default
   * DEFAULT_MAX_NUM_CTX; operator-tunable via OLLAMA_NUM_CTX. */
  maxContextWindow?: number;
}

const OLLAMA_TIMEOUT_MS = 5 * 60 * 1000;
const DEFAULT_TEMPERATURE = 0.8;
const DEFAULT_MAX_TOKENS = 2048;

// Ollama's own default num_ctx is ~4096 — far below what a fully-imported
// story assembles (Chaos Saga's system prompt alone is ~60KB ≈ 16k
// tokens). A prompt past the window doesn't error: llama.cpp truncates /
// slides, and the model generates confident word salad off a mangled
// view of the prompt — live-observed on the first mnemo_continue against
// a large imported story (2026-08-22). So every request sizes num_ctx to
// its actual prompt (plus the generation budget), capped by
// maxContextWindow. The cap matters in the other direction too: pushing
// num_ctx far past a model's TRAINED context (e.g. a llama2-era 4k
// model) degrades output via RoPE stretching — operators running
// small-context models should set OLLAMA_NUM_CTX accordingly.
const DEFAULT_MAX_NUM_CTX = 32_768;
const MIN_NUM_CTX = 4_096;
// Conservative prose estimate — better to over-provision KV cache than
// to truncate: English prose runs ~3.5-4 chars/token.
const EST_CHARS_PER_TOKEN = 3.5;
const NUM_CTX_MARGIN_TOKENS = 256;

export interface NumCtxPlan {
  numCtx: number;
  estPromptTokens: number;
  /** True when the cap forced numCtx below what the prompt likely
   * needs — the generation may degrade; the log says how to fix it. */
  capped: boolean;
}

/** Pure sizing so it's unit-testable: fit the window to the actual
 * request, never below Ollama's own default, never above the cap. */
export function computeNumCtx(
  promptChars: number,
  numPredict: number,
  maxContextWindow = DEFAULT_MAX_NUM_CTX,
): NumCtxPlan {
  const estPromptTokens = Math.ceil(promptChars / EST_CHARS_PER_TOKEN);
  const wanted = estPromptTokens + numPredict + NUM_CTX_MARGIN_TOKENS;
  const numCtx = Math.min(Math.max(MIN_NUM_CTX, wanted), maxContextWindow);
  return { numCtx, estPromptTokens, capped: numCtx < wanted };
}

interface OllamaChatResponse {
  message?: { role?: string; content?: string };
  error?: string;
  done?: boolean;
}

export class OllamaProvider implements LlmProvider {
  readonly name = "ollama";

  constructor(private readonly config: OllamaConfig) {}

  async generate(opts: LlmGenerateOptions): Promise<GeneratedBeat> {
    const model = opts.model ?? this.config.defaultModel;
    const url = new URL("/api/chat", this.config.url);

    const numPredict = opts.maxTokens ?? DEFAULT_MAX_TOKENS;
    const ctxPlan = computeNumCtx(
      opts.systemPrompt.length + opts.userMessage.length,
      numPredict,
      this.config.maxContextWindow,
    );
    if (ctxPlan.capped) {
      log.warn("ollama", "prompt likely exceeds context window cap", {
        model,
        est_prompt_tokens: ctxPlan.estPromptTokens,
        num_ctx: ctxPlan.numCtx,
        hint: "raise OLLAMA_NUM_CTX (and check the model's trained context) or trim story context — a truncated prompt degenerates into word salad",
      });
    }

    const body = {
      model,
      messages: [
        { role: "system", content: opts.systemPrompt },
        { role: "user", content: opts.userMessage },
      ],
      stream: false,
      options: {
        temperature: opts.temperature ?? DEFAULT_TEMPERATURE,
        num_predict: numPredict,
        num_ctx: ctxPlan.numCtx,
      },
    };

    const start = Date.now();
    log.info("ollama", "generate", {
      model,
      system_chars: opts.systemPrompt.length,
      user_chars: opts.userMessage.length,
      num_ctx: ctxPlan.numCtx,
      est_prompt_tokens: ctxPlan.estPromptTokens,
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
      return { text: trimmed };
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
