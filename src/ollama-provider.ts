// Ollama provider -- the default GENERATOR_PROVIDER and the one every
// non-Ollama generator's validator role still uses. Split out of llm.ts
// (phase-end audit, 2026-09-08) so Ollama has its own file matching every
// other provider's pattern (anthropic-provider.ts, gemini-provider.ts,
// openai-compat-provider.ts, kindroid-provider.ts) -- llm.ts keeps only the
// shared LlmProvider contract every provider implements. No behavior change
// from the split; see git history for the pre-split version if a diff is
// ever needed.

import { log } from "./log.js";
import {
  classifyOllamaHttpError,
  computeNumCtx,
  DEFAULT_KEEP_ALIVE,
  DEFAULT_MAX_NUM_CTX,
  DEFAULT_MAX_TOKENS,
  DEFAULT_OLLAMA_TIMEOUT_MS,
  DEFAULT_TEMPERATURE,
  normalizeKeepAlive,
} from "./adapters/ollama-policy.js";
import {
  computeTotalTokens,
  describeTransportError,
  omitUndefined,
  type GeneratedBeat,
  type LlmGenerateOptions,
  type LlmProvider,
  type ModelUsage,
} from "./llm.js";
import type { ContentRating } from "./stories.js";

export interface OllamaConfig {
  url: string;
  defaultModel: string;
  /** Cap on the per-request context window (num_ctx). Default
   * DEFAULT_MAX_NUM_CTX; operator-tunable via OLLAMA_NUM_CTX. */
  maxContextWindow?: number;
  /** keep_alive for Ollama /api/chat. */
  keepAlive?: string;
  /** Per-request /api/chat timeout in ms (OLLAMA_TIMEOUT_MS). Default 5
   * minutes; raise for CPU/NAS deployments where a big-story generation
   * legitimately runs long. */
  timeoutMs?: number;
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
  /** This provider's declared content-generation capability
   * (OLLAMA_CONTENT_CAPABILITY, default sfw;
   * docs/CONTENT_ROUTING_DESIGN.md, ratified 2026-09-08). Meaningless on
   * the validator instance (the gate only checks the GENERATOR's
   * capability) but required to satisfy LlmProvider either way -- both
   * OllamaProvider instances in index.ts pass the same resolved value. */
  contentCapability: ContentRating;
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
  /** Exact usage/timing metrics; durations are NANOSECONDS on the wire. */
  prompt_eval_count?: number;
  eval_count?: number;
  load_duration?: number;
  prompt_eval_duration?: number;
  eval_duration?: number;
}

/** Wire nanoseconds -> whole milliseconds; absent stays absent. */
function nsToMs(ns: number | undefined): number | undefined {
  return ns === undefined ? undefined : Math.round(ns / 1_000_000);
}

const SHOW_TIMEOUT_MS = 15_000;

interface OllamaShowInfo {
  remoteModel?: string;
  remoteHost?: string;
  trainedContext?: number;
}

export class OllamaProvider implements LlmProvider {
  readonly name = "ollama";

  get contentCapability(): ContentRating {
    return this.config.contentCapability;
  }

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
    const probe = this.probeModel(model, true);
    this.localityChecks.set(model, probe);
    probe.catch(() => this.localityChecks.delete(model));
    return probe;
  }

  /** ONE cached /api/show fetch per exact model tag, shared by the
   * locality preflight, the capabilities resolver, and the effective-
   * window lookup -- one wire call serves all three. A rejected fetch is
   * evicted so a transient failure doesn't wedge the model. */
  private readonly showCache = new Map<string, Promise<OllamaShowInfo>>();

  private fetchShowCached(model: string): Promise<OllamaShowInfo> {
    let probe = this.showCache.get(model);
    if (!probe) {
      probe = this.fetchShow(model);
      this.showCache.set(model, probe);
      probe.catch(() => this.showCache.delete(model));
    }
    return probe;
  }

  private async fetchShow(model: string): Promise<OllamaShowInfo> {
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
        model_info?: Record<string, unknown>;
      };
      // The context length lives under a DYNAMIC architecture-prefixed
      // key (e.g. "llama.context_length") -- match the suffix.
      let trainedContext: number | undefined;
      for (const [key, value] of Object.entries(info.model_info ?? {})) {
        if (key.endsWith(".context_length") && typeof value === "number") {
          trainedContext = value;
          break;
        }
      }
      return {
        remoteModel: info.remote_model,
        remoteHost: info.remote_host,
        trainedContext,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  /** The EFFECTIVE enforceable input window for a model:
   * min(trained context from /api/show, the operator's maxContextWindow
   * cap). "unknown" when the daemon is unreachable or reports no
   * context_length -- callers must treat unknown as unknown, never as a
   * default (GENERATOR_CAPABILITIES_DESIGN / CONTEXT_PLAN_DESIGN). */
  async getEffectiveContextWindow(model?: string): Promise<number | "unknown"> {
    const tag = model ?? this.config.defaultModel;
    const cap = this.config.maxContextWindow ?? DEFAULT_MAX_NUM_CTX;
    try {
      const info = await this.fetchShowCached(tag);
      return info.trainedContext === undefined
        ? cap
        : Math.min(cap, info.trainedContext);
    } catch {
      return "unknown";
    }
  }

  /** Non-mutating readiness probe (LlmProvider.checkReady): the configured
   * model must exist on the daemon as an exact tag -- and, under
   * requireLocal, execute locally. /api/show only; no inference. */
  async checkReady(): Promise<void> {
    if (this.config.requireLocal) {
      await this.ensureLocalModel(this.config.defaultModel);
      return;
    }
    await this.probeModel(this.config.defaultModel, false);
  }

  private async probeModel(
    model: string,
    enforceLocal: boolean,
  ): Promise<void> {
    try {
      const info = await this.fetchShowCached(model);
      if (enforceLocal && (info.remoteModel || info.remoteHost)) {
        throw new Error(
          `Ollama model "${model}" executes REMOTELY per /api/show -- this ` +
            "provider is configured local-only (requireLocal), and its " +
            "requests carry story canon. Use a locally installed model.",
        );
      }
      log.info("ollama", "model preflight ok", {
        model,
        route: enforceLocal
          ? "local"
          : info.remoteModel || info.remoteHost
            ? "remote"
            : "local",
      });
    } catch (err) {
      const message = describeTransportError(err);
      throw err instanceof Error && message !== err.message
        ? new Error(message, { cause: err })
        : err;
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
    // Stable per-model num_ctx (CONTEXT_PLAN_DESIGN decision #1, backed by
    // the 2026-08-28 live measurement: the deployed daemon reloads the
    // runner ~6s on EVERY num_ctx change, not just growth -- per-request
    // sizing was reload churn). The effective window is min(trained
    // context, operator cap) from the cached /api/show profile; when the
    // daemon can't say (unknown), fall back to the old per-request sizing,
    // which is conservative rather than degraded.
    const effectiveWindow = await this.getEffectiveContextWindow(model);
    let numCtx: number;
    if (numCtxOverride !== undefined) {
      numCtx = numCtxOverride;
    } else if (typeof effectiveWindow === "number") {
      numCtx = effectiveWindow;
    } else {
      const ctxPlan = computeNumCtx(
        opts.systemPrompt.length + opts.userMessage.length,
        numPredict,
        this.config.maxContextWindow,
      );
      numCtx = ctxPlan.numCtx;
      if (ctxPlan.capped) {
        log.warn("ollama", "prompt likely exceeds context window cap", {
          model,
          est_prompt_tokens: ctxPlan.estPromptTokens,
          num_ctx: ctxPlan.numCtx,
          hint: "raise OLLAMA_NUM_CTX (and check the model's trained context) or trim story context — a truncated prompt degenerates into word salad",
        });
      }
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
      // Reject-don't-mangle (CONTEXT_PLAN_DESIGN stage 2): an over-window
      // request must error (exceed_context_size_error, with exact
      // n_prompt_tokens) instead of silently truncating or shifting into
      // word salad. Both fields live-verified accepted on the deployed
      // daemons (NAS 0.32.15, desktop 0.33.2) 2026-08-28.
      truncate: false,
      shift: false,
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
      keep_alive: normalizeKeepAlive(
        this.config.keepAlive ?? DEFAULT_KEEP_ALIVE,
      ),
    });

    const timeoutMs = this.config.timeoutMs ?? DEFAULT_OLLAMA_TIMEOUT_MS;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        // Bounded read: an upstream error body is untrusted input.
        const text = (await res.text().catch(() => "")).slice(0, 2048);
        throw classifyOllamaHttpError(res.status, text, model);
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
      const usage: ModelUsage = {
        provider: this.name,
        model,
        source: "reported",
        ...omitUndefined({
          input_tokens: data.prompt_eval_count,
          output_tokens: data.eval_count,
          total_tokens: computeTotalTokens(
            data.prompt_eval_count,
            data.eval_count,
            undefined,
          ),
          load_ms: nsToMs(data.load_duration),
          prompt_eval_ms: nsToMs(data.prompt_eval_duration),
          generation_ms: nsToMs(data.eval_duration),
        }),
      };
      log.info("ollama", "generate ok", {
        model,
        ms: Date.now() - start,
        chars: trimmed.length,
        finish_reason: data.done_reason ?? "(absent)",
        ...omitUndefined({
          input_tokens: usage.input_tokens,
          output_tokens: usage.output_tokens,
          load_ms: usage.load_ms,
          generation_ms: usage.generation_ms,
        }),
      });
      return { text: trimmed, complete, finishReason, usage };
    } catch (err) {
      // Own-controller check, not err.name: undici wraps aborts in
      // "TypeError: fetch failed" with the real cause nested (the exact
      // wrapping describeTransportError exists for), so name-sniffing can
      // misclassify a timeout as a plain transport error. The controller
      // is ours -- if it aborted, this WAS the timeout.
      const timedOut = controller.signal.aborted;
      const message = timedOut
        ? `Ollama request timed out after ${timeoutMs}ms ` +
          `(OLLAMA_TIMEOUT_MS). A big story on a CPU/slow daemon can ` +
          `legitimately need longer -- raise OLLAMA_TIMEOUT_MS rather ` +
          `than retrying (the daemon may still be working on this ` +
          `request; a blind retry doubles the queue).`
        : describeTransportError(err);
      log.error("ollama", "generate error", {
        model,
        ms: Date.now() - start,
        timed_out: timedOut,
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
    // True preload (CONTEXT_PLAN_DESIGN slice 2 / Ollama assessment §6):
    // an EMPTY-messages request with a nonzero keep_alive loads the
    // runner without generating a single token (done_reason "load"),
    // replacing the old 4-token "ready" generation. num_ctx is the SAME
    // effective per-model window generate() uses -- warming at a
    // different size than real requests re-creates the first-call-reload
    // bug the 2026-08-27 remediation fixed.
    const keepAlive = normalizeKeepAlive(
      this.config.keepAlive ?? DEFAULT_KEEP_ALIVE,
    );
    if (keepAlive === 0) {
      log.info("ollama", "warmup skipped (keep_alive is zero)", {});
      return;
    }
    const model = this.config.defaultModel;
    const effectiveWindow = await this.getEffectiveContextWindow(model);
    const numCtx =
      typeof effectiveWindow === "number"
        ? effectiveWindow
        : (this.config.maxContextWindow ?? DEFAULT_MAX_NUM_CTX);
    const res = await fetch(new URL("/api/chat", this.config.url), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [],
        stream: false,
        keep_alive: keepAlive,
        options: { num_ctx: numCtx },
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      done_reason?: string;
      error?: string;
    };
    if (!res.ok || data.error) {
      throw new Error(
        `Ollama warmup load failed: ${data.error ?? `HTTP ${res.status}`}`,
      );
    }
    log.info("ollama", "warmup load", {
      model,
      num_ctx: numCtx,
      done_reason: data.done_reason ?? "(absent)",
    });
    await this.logResidency();
  }

  /** One-shot /api/ps residency diagnostics after warmup -- compact
   * metadata only, never polled, never used to second-guess Ollama's own
   * scheduler. */
  private async logResidency(): Promise<void> {
    try {
      const res = await fetch(new URL("/api/ps", this.config.url));
      if (!res.ok) return;
      const data = (await res.json()) as {
        models?: Array<{
          name?: string;
          context_length?: number;
          size_vram?: number;
          expires_at?: string;
        }>;
      };
      for (const m of data.models ?? []) {
        log.info("ollama", "resident model", {
          model: m.name ?? "(unnamed)",
          context_length: m.context_length ?? "(unreported)",
          vram_bytes: m.size_vram ?? 0,
          expires_at: m.expires_at ?? "(unreported)",
        });
      }
    } catch {
      // Diagnostics only -- a failed /api/ps must never fail warmup.
    }
  }
}
