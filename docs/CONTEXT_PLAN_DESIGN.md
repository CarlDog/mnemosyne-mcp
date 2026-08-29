# ContextPlan & Model-Aware Admission Design

**Status:** Proposal, recorded 2026-08-28; **not ratified**. This document
does not schedule work. [STATUS.md](../STATUS.md) remains the source of
current priority. Rationale lives in
[OPENCLAW_ADOPTION_ASSESSMENT.md §1](OPENCLAW_ADOPTION_ASSESSMENT.md#1-structured-budgeted-inspectable-context-assembly)
and [OLLAMA_ADOPTION_ASSESSMENT.md §4](OLLAMA_ADOPTION_ASSESSMENT.md#4-model-aware-fail-closed-context-admission)
/ [§6](OLLAMA_ADOPTION_ASSESSMENT.md#6-stable-context-allocation-and-true-preload);
they are one design because the Ollama assessment itself assigns the
shared planner ownership of admission and Ollama introspection ownership
of the trustworthy window.

## Problem (what the code does today)

- `ContextBundle` collapses OC entries into string arrays before
  assembly, discarding memory IDs, tags, pin state, timestamps, and
  relevance ([src/prompt.ts](../src/prompt.ts)) — the unratified Web UI
  assembly panel has nothing to render, and nothing explains why an entry
  was included or dropped.
- An Ollama request plan estimated **above** the configured cap logs a
  warning and dispatches anyway ([src/llm.ts](../src/llm.ts)) — a
  knowingly-degraded generation.
- One 32,768 default window serves models whose trained contexts range
  16K–1M (`/api/show` observations in the Ollama assessment); nothing
  clamps to trained context.
- Each prompt computes a different `num_ctx`, so Ollama can reload the
  runner between warmup and the first real request (partially fixed by
  warming at the configured ceiling, but per-request sizes still churn).

## Design

### Structured entries survive to assembly

```ts
// src/prompt.ts
export interface ContextEntry {
  memory_id: string;
  entity_type: EntityType;
  name: string;
  tags: string[];
  pinned: boolean;
  created_at: string;
  relevance?: number;          // OC RRF score when the pull was ranked
  chars: number;
  est_tokens: number;          // chars / 3.5, same estimator as today
  admission: "included" | "excerpted" | "dropped";
  reason: string;              // "protected", "rank", "budget", ...
}
```

`gatherContext` keeps the string arrays (zero churn for every existing
consumer) and adds a parallel `entries: ContextEntry[]`. A pure
`planContext(entries, provider, model, budget)` produces:

```ts
export interface ContextPlan {
  provider: string;
  model?: string;
  input_budget?: number;       // absent = unknown window
  output_reserve: number;
  est_fixed_tokens: number;    // mode directive + section scaffolding
  sections: Record<EntityType, { included: number; dropped: number; est_tokens: number }>;
  verdict: "complete" | "partial" | "rejected";
}
```

**The plan describes the payload the selected provider actually sees.**
Direct providers: system + user messages. Companions:
`buildCompanionMessage` gains a return of `{ message, includedMemoryIds }`
so the keyphrase-gated selection is reported truthfully rather than the
full bundle being claimed.

Admission order (preserves current semantics, adds a deterministic drop
order): protected rules + style first, then entities, then
`validation:clean` scenes, then untagged scenes — lowest-ranked/oldest
dropped first. **Protected material alone not fitting is a pre-dispatch
error**, never a silent truncation. No model-generated summarizer in the
admission path; no universal window guess for unknown cloud models.

### Ollama model profile (the trustworthy window)

`OllamaProvider` gains a cached (`{url, exact model}`) profile from
`/api/show` — the locality preflight already fetches this endpoint, so
the probe extends `probeModel` rather than adding a second fetch path:

```ts
interface OllamaModelProfile {
  model: string;
  trainedContext?: number;     // dynamic "*.context_length" model-info key
  capabilities?: string[];     // require "completion"
  route: "local" | "remote";
  hasEmbeddedDefaults: boolean; // presence only, contents never logged
}
```

Effective window = `min(OLLAMA_NUM_CTX cap, trainedContext)` when trained
context is known; the operator cap alone otherwise, reported as
`input_budget` absent-vs-known honestly. A 16K model is never sent a 32K
window by default; overriding past trained context requires a visible,
separately designed policy (out of scope here).

### Enforcement rollout (three stages, in order)

1. **Instrument everywhere**: every continuation response carries a
   compact plan manifest (counts, est tokens, verdict, dropped-entry ids
   + reasons — never bodies). The estimator is calibrated against the
   now-available `usage.generator.input_tokens` (log estimate-vs-actual
   delta; never silently replace the deterministic estimate).
2. **Ollama fail-closed**: the existing capped-plan warning becomes a
   pre-dispatch error against the effective window (estimated input +
   output reserve + margin). Send `truncate:false` — and `shift:false` —
   **only after a live compatibility gate**: both fields were verified at
   the pinned GitHub `main` snapshot, not against the deployed daemons
   (NAS 0.32.15 / desktop 0.33.1); verify acceptance live first, exactly
   the gate discipline the validator `format` slice used.
3. **Cloud fail-closed**: only where
   [GENERATOR_CAPABILITIES_DESIGN.md](GENERATOR_CAPABILITIES_DESIGN.md)
   supplies a reliable context window; `unknown` stays instrument-only.

### Stable `num_ctx` (decision needed — do not pick silently)

Per-prompt sizing defeats runner reuse (Ollama reloads when a later
request wants a bigger window than the loaded runner). Two candidate
policies, with the tradeoff on this hardware made explicit:

- **(a) One stable effective context per model** = the effective window
  above. Maximum reuse, but the KV cache is paid at full size on every
  load — at 32K on a 7b-q8 on the 64GB CPU-only NAS that is real memory
  held for the whole keep-alive window.
- **(b) Two documented buckets** (e.g. 8K / effective-max): halves the
  common case's KV cost, at the price of one reload when a story crosses
  the bucket boundary.

Either way, **warmup must preload at the same effective value the policy
produces** — warming at the configured ceiling while real requests use a
smaller stable value re-creates the exact first-call-reload bug the
2026-08-27 warmup remediation fixed. The preflight planner decides *fit*;
`num_ctx` allocation is stable *after* that decision.

The empty-message load operation and `/api/ps` residency diagnostics
(Ollama §6's remaining pieces) ride the same slice but are mechanical
once the policy is chosen.

## Explicitly out of scope

- The Web UI assembly panel (unratified WEBUI_NOTES input) — this design
  produces the manifest it would consume; the panel is its own slice.
- MMR/temporal-decay/importance scoring — deferred pending evidence, per
  the assessment.
- Overriding past trained context; model-generated summarization.

## Acceptance tests

- A plan over the effective window performs zero provider calls.
- Given identical inputs, admission order and exclusion reasons are
  byte-deterministic.
- Rendered prompt sizes and reported section sizes agree.
- A 16K-trained model never receives a 32K window by default; unknown
  trained context falls back to the cap and is reported as unknown.
- Companion plans report the keyphrase-gated selection, not the bundle.
- Protected-content overflow errors before dispatch.
- Warmup and the first real request agree on `num_ctx` (no reload —
  assert via load-duration telemetry now carried in `ModelUsage`).
- Oversized-request compatibility test proves the deployed daemon rejects
  (with `truncate:false`) instead of truncating.

## Slices

1. **Structured entries + plan instrumentation** (all providers, manifest
   in responses, estimator calibration logging).
2. **Ollama profile + fail-closed admission** + live-gated
   `truncate/shift` + the chosen stable-`num_ctx` policy + load-op
   warmup + one-shot `/api/ps` diagnostics.
3. **Cloud enforcement** (blocked on capability descriptors).

## Decisions needed at ratification

1. Stable-`num_ctx` policy: (a) one per-model effective context or
   (b) two buckets. Recommendation: **(a)** — the NAS measurements show
   no cache contention at 48GB resident, and reload churn is the cost
   actually observed.
2. Whether the manifest rides every continuation response by default or
   behind a `context_plan: true` request flag (recommendation: always —
   it is small and the diagnostic value is highest when unasked-for).
3. Margin constant for admission (proposal: keep `NUM_CTX_MARGIN_TOKENS`
   = 256, revisited against telemetry).
