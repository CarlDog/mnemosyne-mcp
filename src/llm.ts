// LLM provider abstraction, plus the Ollama implementation.
//
// Seven generators now implement LlmProvider behind GENERATOR_PROVIDER:
// ollama (default), the companion-chat pair kindroid/botify, and the
// direct-API cloud four anthropic/openai/gemini/atlascloud. The validator
// role always stays on Ollama regardless of the generator — a companion-chat
// model is a poor fit for structured JSON, and keeping validation local keeps
// it free — so OLLAMA_VALIDATOR_MODEL is required for every non-ollama
// generator.

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
  /** False when the provider reports the output was cut off before its
   * natural end (Ollama `done_reason: "length"` -- the num_predict budget
   * ran out mid-scene). Absent means the provider does not report
   * completion state, which callers treat as complete -- so providers can
   * adopt the contract incrementally without changing existing behavior
   * (docs/OLLAMA_ADOPTION_ASSESSMENT.md §1). Callers must not auto-save
   * a `complete: false` beat as canon. */
  complete?: boolean;
  /** Normalized finish reason when the provider reports one: "stop"
   * (natural end), "length" (token budget exhausted), or "unknown". */
  finishReason?: "stop" | "length" | "unknown";
  /** Kindroid group only: why the turn loop stopped. "user_turn" means the
   * floor came back to you mid-scene -- there may still be replies in
   * `text`. Only ever set when allowUser was true (kindroid-mcp's own
   * get-turn can only return empty in that case). */
  groupEnded?: "user_turn" | "max_turns";
  /** Kindroid group only: AI turns actually generated. 0 means the group
   * yielded immediately and `text` is empty. */
  groupTurns?: number;
}

/** Narrow structured-output capability, deliberately NOT a field on the
 * already-overloaded LlmGenerateOptions (docs/OLLAMA_ADOPTION_ASSESSMENT.md
 * §3: prefer a provider-specific structured-generation surface over another
 * generic option most providers ignore). Ollama implements it by sending
 * the JSON Schema as the top-level `format` field; the validator uses it
 * when available and falls back to prompt-only JSON otherwise -- runtime
 * schema validation of the parsed result applies either way. */
export interface StructuredOutputCapable {
  generateStructured(
    opts: LlmGenerateOptions,
    format: Record<string, unknown>,
  ): Promise<GeneratedBeat>;
}

export function supportsStructuredOutput(
  provider: LlmProvider,
): provider is LlmProvider & StructuredOutputCapable {
  return (
    typeof (provider as Partial<StructuredOutputCapable>).generateStructured ===
    "function"
  );
}

export interface LlmProvider {
  readonly name: string;
  generate(opts: LlmGenerateOptions): Promise<GeneratedBeat>;
  /** Optional provider warmup hook. Implemented for Ollama so we can force
   * a model load at startup and reduce first-call cold-start latency.
   * Implementations should be non-fatal and low-cost; callers use it
   * fire-and-forget. */
  warmup?: () => Promise<void>;
}

export interface OllamaConfig {
  url: string;
  defaultModel: string;
  /** Cap on the per-request context window (num_ctx). Default
   * DEFAULT_MAX_NUM_CTX; operator-tunable via OLLAMA_NUM_CTX. */
  maxContextWindow?: number;
  /** keep_alive for Ollama /api/chat. */
  keepAlive?: string;
  /** Enforce that every model this provider runs executes LOCALLY
   * (docs/OLLAMA_ADOPTION_ASSESSMENT.md §2). Ollama transparently proxies
   * `:cloud` models and remote-host aliases through the same localhost
   * API, so a localhost OLLAMA_URL is not proof of local inference. With
   * requireLocal, a `:cloud` tag is refused outright, the exact model is
   * preflighted via /api/show (remote_model/remote_host must be absent,
   * cached per model), and the final chat response's route fields are
   * re-checked so an alias changed after preflight cannot slip through.
   * Set for the validator instance -- its requests carry the story's full
   * canon and the pass is documented as local and free. */
  requireLocal?: boolean;
}

const OLLAMA_TIMEOUT_MS = 5 * 60 * 1000;
// Exported so index.ts's OLLAMA_KEEP_ALIVE env fallback and this
// provider-level fallback are one value, not two independently-owned
// "30m" literals that drift.
export const DEFAULT_KEEP_ALIVE = "30m";

/**
 * Ollama's `keep_alive` accepts a duration STRING ("30m", "90s", "0") or a
 * NUMBER of seconds -- but it rejects the string "-1" outright with HTTP 400,
 * while the number -1 (pin indefinitely) is accepted. Verified live against
 * Ollama 2026-08-28: `"keep_alive":"-1"` -> 400, `"keep_alive":-1` -> 200,
 * with "0"/"30m"/"90s" all fine as strings.
 *
 * That matters because .env.example documents `OLLAMA_KEEP_ALIVE=-1` as the
 * way to pin a model indefinitely, and env vars are always strings -- so
 * following the documentation produced a server that 400s on every
 * generation.
 *
 * Any wholly numeric value is therefore sent as a number; everything else
 * passes through as the duration string Ollama expects.
 */
export function normalizeKeepAlive(value: string): string | number {
  const trimmed = value.trim();
  return /^-?\d+$/.test(trimmed) ? Number(trimmed) : trimmed;
}

// Sampling bounds shared by every surface that accepts them. The MCP tool and
// the REST route validated the same three numbers independently, which is the
// drift the group-turn constants in kindroid-provider.ts already exist to
// prevent. (webui keeps its own copies: it is a separate package and cannot
// import server modules.)
export const MIN_GENERATION_TOKENS = 1;
export const MAX_GENERATION_TOKENS = 8192;
export const MIN_TEMPERATURE = 0;
export const MAX_TEMPERATURE = 2;
const DEFAULT_TEMPERATURE = 0.8;
const DEFAULT_MAX_TOKENS = 2048;
const WARMUP_TOKENS = 4;

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
  /** Why generation stopped: "stop" (natural end), "length" (num_predict
   * exhausted), "load" (empty-message load request). Absent on old daemons. */
  done_reason?: string;
  /** Set when the request actually executed on a remote (Ollama Cloud or
   * remote-host alias) model rather than locally. */
  remote_model?: string;
  remote_host?: string;
}

const SHOW_TIMEOUT_MS = 15_000;

export class OllamaProvider implements LlmProvider {
  readonly name = "ollama";

  /** Per-model /api/show locality verdicts (requireLocal only). Caches the
   * promise so concurrent first calls share one probe; a rejected probe is
   * evicted so a transient failure doesn't wedge the model permanently. */
  private readonly localityChecks = new Map<string, Promise<void>>();

  constructor(private readonly config: OllamaConfig) {}

  /** requireLocal enforcement, step 1+2: cheap tag refusal, then the
   * authoritative /api/show preflight -- remote_model/remote_host must be
   * absent. Runs before any provider-visible canon is sent. */
  private ensureLocalModel(model: string): Promise<void> {
    if (/:cloud$/i.test(model)) {
      return Promise.reject(
        new Error(
          `Ollama model "${model}" is a Cloud tag -- this provider is ` +
            "configured local-only (requireLocal); use a locally installed " +
            "model tag",
        ),
      );
    }
    const cached = this.localityChecks.get(model);
    if (cached) return cached;
    const probe = this.probeLocality(model);
    this.localityChecks.set(model, probe);
    probe.catch(() => this.localityChecks.delete(model));
    return probe;
  }

  private async probeLocality(model: string): Promise<void> {
    const url = new URL("/api/show", this.config.url);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SHOW_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model }),
        signal: controller.signal,
      });
      if (res.status === 404) {
        throw new Error(
          `Ollama model "${model}" is not installed on this daemon -- ` +
            "model names must be EXACT installed tags (list them with " +
            "`ollama list` or GET /api/tags)",
        );
      }
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(
          `Ollama /api/show HTTP ${res.status}: ${text || res.statusText}`,
        );
      }
      const info = (await res.json()) as {
        remote_model?: string;
        remote_host?: string;
      };
      if (info.remote_model || info.remote_host) {
        throw new Error(
          `Ollama model "${model}" executes REMOTELY per /api/show -- this ` +
            "provider is configured local-only (requireLocal), and its " +
            "requests carry story canon. Use a locally installed model.",
        );
      }
      log.info("ollama", "locality preflight ok", { model, route: "local" });
    } catch (err) {
      const message = describeTransportError(err);
      throw err instanceof Error && message !== err.message
        ? new Error(message, { cause: err })
        : err;
    } finally {
      clearTimeout(timeout);
    }
  }

  // numCtxOverride is warmup plumbing: it pins num_ctx instead of sizing
  // it to the (tiny) warmup prompt, so the preloaded runner matches the
  // window real large-story requests will ask for. Ollama reloads the
  // model when a later request wants a bigger num_ctx than it was loaded
  // with -- a warmup at the computeNumCtx floor (MIN_NUM_CTX) would leave
  // the first real call paying the full cold start anyway.
  /** Structured generation: identical to generate() but constrains the
   * output through Ollama's top-level `format` JSON-Schema field (verified
   * accepted and shape-enforced against the deployed daemon, 0.32.15,
   * 2026-08-28). Callers still runtime-validate the parsed result --
   * `format` constrains shape, it does not prove content. */
  async generateStructured(
    opts: LlmGenerateOptions,
    format: Record<string, unknown>,
  ): Promise<GeneratedBeat> {
    return this.generate(opts, undefined, format);
  }

  async generate(
    opts: LlmGenerateOptions,
    numCtxOverride?: number,
    format?: Record<string, unknown>,
  ): Promise<GeneratedBeat> {
    const model = opts.model ?? this.config.defaultModel;
    // Locality is proven BEFORE the request carrying canon is built or
    // sent -- a refused model must leak nothing.
    if (this.config.requireLocal) {
      await this.ensureLocalModel(model);
    }
    const url = new URL("/api/chat", this.config.url);

    const numPredict = opts.maxTokens ?? DEFAULT_MAX_TOKENS;
    const ctxPlan = computeNumCtx(
      opts.systemPrompt.length + opts.userMessage.length,
      numPredict,
      this.config.maxContextWindow,
    );
    const numCtx = numCtxOverride ?? ctxPlan.numCtx;
    if (numCtxOverride === undefined && ctxPlan.capped) {
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
      // keep_alive is a TOP-LEVEL /api/chat field, sibling of options --
      // nested inside options Ollama silently ignores it (verified live
      // 2026-08-27: options.keep_alive left the server default expiry
      // untouched; top-level keep_alive moved it).
      keep_alive: normalizeKeepAlive(
        this.config.keepAlive ?? DEFAULT_KEEP_ALIVE,
      ),
      // format is a TOP-LEVEL field like keep_alive, not a runner option.
      ...(format !== undefined && { format }),
      options: {
        temperature: opts.temperature ?? DEFAULT_TEMPERATURE,
        num_predict: numPredict,
        num_ctx: numCtx,
      },
    };

    const start = Date.now();
    log.info("ollama", "generate", {
      model,
      system_chars: opts.systemPrompt.length,
      user_chars: opts.userMessage.length,
      num_ctx: numCtx,
      est_prompt_tokens: ctxPlan.estPromptTokens,
      keep_alive: normalizeKeepAlive(
        this.config.keepAlive ?? DEFAULT_KEEP_ALIVE,
      ),
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
      // requireLocal step 3: re-check the route on the FINAL response. An
      // alias re-pointed at a remote host after the cached preflight would
      // pass step 2; the response's own route fields cannot lie about
      // where it actually ran. Too late for privacy on this request, but
      // it surfaces immediately instead of silently continuing -- and the
      // result is refused rather than treated as a valid local pass.
      if (this.config.requireLocal && (data.remote_model || data.remote_host)) {
        throw new Error(
          `Ollama response for "${model}" reports REMOTE execution -- this ` +
            "provider is configured local-only (requireLocal). The result " +
            "was discarded; use a locally installed model.",
        );
      }

      // Nonstreaming mode must end in a terminal response. A response with
      // done !== true is malformed, not a shorter answer -- trusting it
      // would treat an interrupted generation as a finished beat.
      if (data.done !== true) {
        throw new Error(
          "Ollama returned a non-terminal response (done !== true) in nonstreaming mode",
        );
      }
      const content = data.message?.content;
      if (!content) {
        throw new Error("Ollama returned no message content");
      }

      // Normalize the finish reason so callers can keep a truncated beat
      // out of automatic canon admission (docs/OLLAMA_ADOPTION_ASSESSMENT.md
      // §1). "stop" is a natural end; "length" means num_predict ran out
      // mid-scene. Absent done_reason (old daemons) is treated as complete
      // -- the field predates every supported deployment, so absence means
      // an old server, not a truncation.
      const finishReason: GeneratedBeat["finishReason"] =
        data.done_reason === "length"
          ? "length"
          : data.done_reason === "stop" || data.done_reason === undefined
            ? "stop"
            : "unknown";
      const complete = finishReason !== "length";

      // Strip leading whitespace. Some models (notably HammerAI/mythomax-l2)
      // prefix their responses with a stray space character; passing it
      // through means scenes get saved as " Text..." which then trips
      // downstream display + parsing in subtle ways.
      const trimmed = content.replace(/^\s+/, "");
      log.info("ollama", "generate ok", {
        model,
        ms: Date.now() - start,
        chars: trimmed.length,
        finish_reason: data.done_reason ?? "(absent)",
      });
      return { text: trimmed, complete, finishReason };
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

  async warmup(): Promise<void> {
    // Pin num_ctx to the configured window (not the tiny warmup prompt's
    // computed floor) so the runner Ollama loads here is the same one
    // real requests will hit -- see the numCtxOverride note on generate.
    await this.generate(
      {
        systemPrompt: "",
        userMessage: "ready",
        maxTokens: WARMUP_TOKENS,
      },
      this.config.maxContextWindow ?? DEFAULT_MAX_NUM_CTX,
    );
  }
}
