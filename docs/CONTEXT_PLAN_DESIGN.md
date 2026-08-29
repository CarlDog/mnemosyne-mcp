# ContextPlan & Model-Aware Admission Design

**Status:** Proposal, recorded 2026-08-28, revised same day after an
adversarial review (10 findings; see the revision note at the end);
**not ratified**. This document does not schedule work.
[STATUS.md](../STATUS.md) remains the source of current priority.
Rationale lives in
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
- Each prompt computes a different `num_ctx`; whether that actually
  causes runner reloads is itself unverified (see the reload question
  below).

## Design

### Structured entries survive to assembly — and assembly is plan-driven

```ts
// src/prompt.ts
export interface ContextEntry {
  memory_id: string;
  entity_type: EntityType;
  name: string;
  tags: string[];
  pinned: boolean;
  created_at: string;
  /** OC's rrf_score when the pull was ranked. NOTE: OC's wire field
   * `relevance` is an OBJECT ({channel, rrf_score, semantic_similarity,
   * keyword_rank} — captured live from the deployed server 2026-08-28);
   * this field carries the extracted rrf_score number. */
  relevance?: number;
  chars: number;
  est_tokens: number;          // chars / 3.5, same estimator as today
  admission: "included" | "dropped";  // no "excerpted" in v1 — an
                               // undefined excerpting rule is exactly the
                               // silent-mangling this design forbids
  reason: string;              // "protected", "rank", "budget", ...
}
```

`gatherContext` returns `entries: ContextEntry[]` alongside the string
arrays. **Rendering consumes the plan's admitted set** — `buildSystemPrompt`
(and the companion message builder) render only `admission: "included"`
entries, so the manifest can never describe a payload the model didn't
see. This is a deliberate consumer change, not zero-churn: the string
arrays remain during migration, but the first draft's "zero churn" claim
contradicted the manifest-accuracy acceptance test and is withdrawn.

A pure `planContext(entries, direction, provider, model, budget)`
produces:

```ts
export interface ContextPlan {
  provider: string;
  model?: string;
  input_budget?: number;       // absent = unknown window
  output_reserve: number;
  est_fixed_tokens: number;    // mode directive + section scaffolding
  est_direction_tokens: number; // the user direction COUNTS toward fit —
                               // the source guardrail is "protected
                               // rules/style AND the current direction"
  sections: Record<EntityType, { included: number; dropped: number; est_tokens: number }>;
  verdict: "complete" | "partial" | "rejected";
}
```

`partial` (low-ranked entries dropped to fit) **dispatches**; `rejected`
(protected material + direction alone over budget) never does.

**The plan describes the payload the selected provider actually sees.**
Direct providers: system + user messages. Companions: the keyphrase-gated
selection must be reported truthfully, which requires real plumbing (the
first draft hand-waved this): `LlmGenerateOptions.context` carries the
structured `entries`; `buildCompanionMessage` selects against entries
(names are already its join key) and the provider returns the selection
as `GeneratedBeat.context_selection?: string[]` (memory ids). Because the
companion selection happens at generate time, the companion plan is
finalized from the beat's reported selection — the planner never
re-implements keyphrase matching (two copies would drift).

Admission order (preserves current semantics, adds a deterministic drop
order): protected rules + style first, then entities, then
`validation:clean` scenes, then untagged scenes — lowest-ranked/oldest
dropped first, with **`memory_id` as the terminal tie-break** (relevance
is optional and bulk-imported `created_at` values collide, so without it
the claimed byte-determinism is false). Protected material + direction
not fitting is a pre-dispatch error, never a silent truncation. No
model-generated summarizer in the admission path; no universal window
guess for unknown cloud models.

### Ollama model profile (the trustworthy window)

`OllamaProvider` gains a cached (`{url, exact model}`) profile from
`/api/show`:

```ts
interface OllamaModelProfile {
  model: string;
  trainedContext?: number;     // dynamic "*.context_length" model-info key
  capabilities?: string[];     // require "completion"
  route: "local" | "remote";
  hasEmbeddedDefaults: boolean; // presence only, contents never logged
}
```

The fetch shares `probeModel`'s HTTP path but is a **new call site**: the
existing preflight runs per-generate only under `requireLocal` (the
validator), so the plain generator — including per-call `model`
overrides — needs its own cached profile fetch at generate time (review
finding; the first draft implied the locality preflight already covered
it).

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
2. **Ollama admission enforcement — with an operator mode, not a cliff**
   (review finding: the 3.5-chars/token estimator deliberately
   overshoots by up to ~15%, so bare fail-closed would hard-reject large
   stories that generate fine today, with no recourse but trimming
   canon). `MNEMO_CONTEXT_ADMISSION=warn|enforce`: `warn` keeps today's
   dispatch-with-warning while the stage-1 calibration data accumulates;
   `enforce` turns an over-budget plan into a pre-dispatch error. The
   default and the flip criterion are ratification decision #2. Send
   `truncate:false` — and `shift:false` — **only after a live
   compatibility gate** against both deployed daemons (NAS **0.32.15**,
   desktop **0.33.2** — both probed live 2026-08-28; the fields were
   verified at the pinned GitHub `main` snapshot only), exactly the gate
   discipline the validator `format` slice used.
3. **Cloud fail-closed**: only where
   [GENERATOR_CAPABILITIES_DESIGN.md](GENERATOR_CAPABILITIES_DESIGN.md)
   supplies a reliable context window; `unknown` stays instrument-only.

### Stable `num_ctx` (decision needed — and a factual gate first)

**Gate: verify the reload behavior live before choosing.** The two source
texts disagree — src/llm.ts's own comment describes bigger-only reload
semantics (under which a ceiling warmup means capped requests never
reload and per-request sizing is harmless), while Ollama assessment §6
describes any-mismatch semantics ("a 32K warmup followed by a 19K request
can reload"). The now-shipped `ModelUsage.load_ms` telemetry answers this
in minutes on the live daemon; decision #1 must not be made before that
measurement.

If reloads are real, the candidate policies:

- **(a) One stable effective context per model** = the effective window
  above. Maximum reuse; the KV cache is paid at full size for the whole
  keep-alive window. Note the honest evidence bound: the NAS
  "no cache contention at 48GB resident" measurement was three-hot-models
  *throughput*, not KV-pinning cost — it does not by itself justify (a).
- **(b) Two documented buckets** (e.g. 8K / effective-max): lower common
  KV cost, one reload at the bucket boundary.
- **(c) Status quo — per-request sizing, accept reloads**: the right
  answer if the live measurement shows reloads are rare or cheap.

The choice may be **per-deployment**: the 64GB CPU NAS and the desktop
GPU install trade off differently — and the desktop's documented
long-context corruption past ~7–8K prompt tokens (install-level, not a
Mnemosyne bug) means a policy that pins large windows there maximizes
exposure to the broken regime until that install is fixed.

Whichever policy wins, **warmup must preload at the same effective value
the policy produces** — warming at the ceiling while real requests use a
smaller stable value re-creates the first-call-reload bug the 2026-08-27
warmup remediation fixed. The preflight planner decides *fit*; `num_ctx`
allocation is stable *after* that decision. The empty-message load
operation and `/api/ps` residency diagnostics (Ollama §6's remaining
pieces) ride the same slice.

## Explicitly out of scope

- The Web UI assembly panel (unratified WEBUI_NOTES input) — this design
  produces the manifest it would consume; the panel is its own slice.
- Excerpting (`"excerpted"` admission state) — v1 includes or drops
  whole entries; a deterministic excerpting rule is future design.
- MMR/temporal-decay/importance scoring — deferred pending evidence.
- Overriding past trained context; model-generated summarization.

## Acceptance tests

- With `enforce`, a plan whose verdict is `rejected` performs zero
  provider calls; with `warn`, it dispatches and the manifest says so.
- Given identical inputs, admission order and exclusion reasons are
  byte-deterministic (including the `memory_id` tie-break under equal
  timestamps/relevance).
- Rendered prompt content is exactly the admitted set; reported section
  sizes agree with it.
- The direction's tokens count toward the fit check (a huge direction
  with fitting protected material still rejects).
- A 16K-trained model never receives a 32K window by default; unknown
  trained context falls back to the cap and is reported as unknown.
- Companion plans report the beat's actual `context_selection`, not the
  full bundle, and the planner contains no second keyphrase matcher.
- Warmup and the first real request agree on `num_ctx` (asserted via
  `load_ms` telemetry).
- Oversized-request compatibility test proves both deployed daemons
  reject (with `truncate:false`) instead of truncating.

## Slices

1. **Structured entries + plan instrumentation** (all providers,
   plan-driven rendering, manifest in responses, estimator calibration
   logging, companion `context_selection` plumbing).
2. **Ollama profile + admission mode** + live-gated `truncate/shift` +
   the reload measurement, then the chosen stable-`num_ctx` policy +
   load-op warmup + one-shot `/api/ps` diagnostics.
3. **Cloud enforcement** (blocked on capability descriptors).

## Decisions needed at ratification

1. Stable-`num_ctx` policy — **gated on the live reload measurement
   first**; then (a)/(b)/(c), possibly per-deployment (NAS vs desktop,
   including the desktop corruption caveat).
2. `MNEMO_CONTEXT_ADMISSION` default (`warn` until calibration shows the
   estimator's overshoot band, then flip to `enforce`?) and the flip
   criterion.
3. Whether the manifest rides every continuation response or a
   `context_plan: true` flag (recommendation: always).
4. Margin constant (proposal: keep 256, revisited against telemetry).

## Revision note (2026-08-28)

An adversarial review confirmed 10 findings against the first draft; all
are folded in above. The load-bearing corrections: bare fail-closed +
a deliberately conservative estimator would have bricked large working
stories with no recourse — replaced with the `warn|enforce` admission
mode gated on calibration; "zero churn" contradicted the
manifest-accuracy test — rendering is now explicitly plan-driven; the
companion `{message, includedMemoryIds}` return had no ids on its path
and no return channel — the entries-through-options /
`context_selection`-through-beat plumbing is now specified; the reload
premise underlying the whole stable-`num_ctx` section is contested
between the code's own comment and the assessment — now a live
measurement gate before decision #1, with status-quo (c) added and the
NAS evidence bound honestly; the direction's tokens were missing from
the fit check; `"excerpted"` was undefined and is dropped from v1; the
daemon versions were wrong (desktop is 0.33.2, probed live); OC's
`relevance` is an object, not a number — the extraction is now
specified; and `memory_id` is the terminal ordering tie-break.
