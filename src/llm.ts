// The shared LlmProvider contract every generator implements, plus the
// generic usage/completion helpers all of them use. Each provider lives in
// its own file: ollama-provider.ts, anthropic-provider.ts, gemini-provider.ts,
// openai-compat-provider.ts (openai/atlascloud), kindroid-provider.ts, and
// botify-provider.ts. Ollama moved out of this file 2026-09-08 (phase-end
// audit) to match that pattern -- it used to live here as "the Ollama
// implementation" alongside the shared contract, an asymmetry versus every
// other provider.
//
// Seven generators now implement LlmProvider behind GENERATOR_PROVIDER:
// ollama (default), the companion-chat pair kindroid/botify, and the
// direct-API cloud four anthropic/openai/gemini/atlascloud. The validator
// role always stays on Ollama regardless of the generator — a companion-chat
// model is a poor fit for structured JSON, and keeping validation local keeps
// it free — so OLLAMA_VALIDATOR_MODEL is required for every non-ollama
// generator.
//
// This file also re-exports several Ollama-policy constants
// (adapters/ollama-policy.js) for other consumers' convenience
// (src/adapters/continuation.ts, src/api/interactive.ts,
// src/tools/continue.ts use MAX_GENERATION_TOKENS/MAX_TEMPERATURE/etc. as
// generic validation bounds) -- kept here rather than moved, since this
// file, not ollama-provider.ts, is those consumers' actual dependency.

import type { ContextBundle } from "./prompt.js";
import type { KindroidTarget } from "./stories.js";
export {
  classifyOllamaHttpError,
  computeNumCtx,
  DEFAULT_KEEP_ALIVE,
  DEFAULT_MAX_TOKENS,
  DEFAULT_OLLAMA_TIMEOUT_MS,
  MAX_GENERATION_TOKENS,
  MAX_TEMPERATURE,
  MIN_GENERATION_TOKENS,
  MIN_TEMPERATURE,
  normalizeKeepAlive,
  NUM_CTX_MARGIN_TOKENS,
  type NumCtxPlan,
} from "./adapters/ollama-policy.js";

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

/** Provider-reported usage and timing for one model call
 * (docs/OPEN_WEBUI_ADOPTION_ASSESSMENT.md §3 + the Ollama assessment's
 * telemetry track, one implementation). Guardrails baked into every
 * producer: unknown values stay ABSENT, never a flattering zero;
 * `total_tokens` is set only when the provider reported it or both parts
 * are known; no dollar cost is invented from a pricing table; and none of
 * this ever lands in a saved scene body -- it rides results and logs. */
export interface ModelUsage {
  provider: string;
  model?: string;
  /** All values here come from the provider's own response ("reported");
   * locally estimated numbers must not be mixed in under this label. */
  source: "reported";
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  /** Cache reads (Anthropic cache_read, OpenAI cached_tokens, Gemini
   * cachedContentTokenCount). */
  cached_input_tokens?: number;
  cache_creation_input_tokens?: number;
  /** Ollama-only timing detail (wire nanoseconds normalized to ms). */
  load_ms?: number;
  prompt_eval_ms?: number;
  generation_ms?: number;
}

/** Drop undefined-valued keys, so "unknown stays absent" holds
 * structurally in every provider's usage envelope (a serialized undefined
 * would vanish anyway, but in-process consumers see clean objects and
 * tests can assert absence). */
export function omitUndefined<T extends Record<string, unknown>>(
  obj: T,
): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k as keyof T] = v as T[keyof T];
  }
  return out;
}

/** total_tokens policy in one place: reported wins; else computed only
 * when BOTH parts are known. */
export function computeTotalTokens(
  input: number | undefined,
  output: number | undefined,
  reported: number | undefined,
): number | undefined {
  if (reported !== undefined) return reported;
  if (input !== undefined && output !== undefined) return input + output;
  return undefined;
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
  /** Provider-reported usage/timing, absent when the provider reports
   * none (kindroid/botify). */
  usage?: ModelUsage;
  /** Companion providers only: the memory ids of the context entries the
   * keyphrase gate actually folded into the outgoing message (plus the
   * always-included scenes). Lets the context-plan manifest report the
   * TRUE companion payload without re-implementing the matching
   * (CONTEXT_PLAN_DESIGN). */
  context_selection?: string[];
  /** Kindroid group only: why the turn loop stopped. "user_turn" means the
   * floor came back to you mid-scene -- there may still be replies in
   * `text`. Only ever set when allowUser was true (kindroid-mcp's own
   * get-turn can only return empty in that case). */
  groupEnded?: "user_turn" | "max_turns";
  /** Kindroid group only: AI turns actually generated. 0 means the group
   * yielded immediately and `text` is empty. */
  groupTurns?: number;
}

/** Map a provider's raw finish-reason string onto GeneratedBeat's
 * completion fields. One helper because the classification carries the
 * correctness rule ("length means do not auto-save") across four cloud
 * providers whose vocabularies differ only in spelling -- Anthropic
 * `max_tokens`, OpenAI `length`, Gemini `MAX_TOKENS`. Absent raw -> {}:
 * the provider didn't report, callers treat the beat as complete.
 * (OllamaProvider keeps its own inline mapping: its absent-field case
 * deliberately reads as "stop" for old daemons, not as unreported.) */
export function completionFromFinishReason(
  raw: string | undefined,
  vocab: { stop: readonly string[]; length: readonly string[] },
): Pick<GeneratedBeat, "complete" | "finishReason"> {
  if (raw === undefined) return {};
  const finishReason = vocab.length.includes(raw)
    ? "length"
    : vocab.stop.includes(raw)
      ? "stop"
      : "unknown";
  return { finishReason, complete: finishReason !== "length" };
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
  /** Optional NON-MUTATING, NON-BILLABLE readiness probe: resolve when the
   * provider can plausibly serve a generation (model installed, sibling
   * MCP contract advertised), reject with an actionable reason otherwise.
   * Absent means the provider has no free probe (the cloud providers --
   * any real check is a billable call) and readiness reports `not_probed`
   * rather than guessing (docs/NEMOCLAW_ADOPTION_ASSESSMENT.md §3).
   * Implementations MUST NOT run inference or post to a conversation. */
  checkReady?: () => Promise<void>;
}
