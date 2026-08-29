# Generator Capability Descriptors Design

**Status:** Proposal, recorded 2026-08-28, revised same day after an
adversarial review (9 findings; see the revision note at the end);
since **RATIFIED** — see the ratification block below. This document does not schedule work by itself; the ratified slices are in build.
[STATUS.md](../STATUS.md) remains the source of current priority.
Rationale lives in
[OPENCLAW_ADOPTION_ASSESSMENT.md §4](OPENCLAW_ADOPTION_ASSESSMENT.md#4-static-generator-capability-descriptors),
corroborated by
[OPEN_WEBUI_ADOPTION_ASSESSMENT.md §7](OPEN_WEBUI_ADOPTION_ASSESSMENT.md#7-findings-that-corroborate-existing-work-rather-than-add-it)
and [NEMOCLAW_ADOPTION_ASSESSMENT.md](NEMOCLAW_ADOPTION_ASSESSMENT.md)
(corroboration table).

**Ratified 2026-08-28** (operator "go ahead" on the reviewed revision) with
decisions: ① warn-don't-break + surface-bounds precedence; ② cloud
context windows all-`unknown`, no local per-model table; ③ the honest
resolution matrix accepted as the slice-2 payoff.

## Problem (what the code does today)

- `LlmGenerateOptions` documents several fields providers ignore
  (temperature/maxTokens on companions; model on companions; context on
  direct providers), and the Web UI renders model/temperature/max-token
  controls for **every** provider
  ([webui/src/pages/ContinueScenePage.tsx](../webui/src/pages/ContinueScenePage.tsx))
  even where they are ignored or rejected outright.
- Nothing machine-readable states which providers mutate an external
  conversation — the property that gates the parked beat-proposals
  feature and drives the retry-safety rules.
- The ContextPlan design needs a per-provider/model context window that
  distinguishes *known* from *unknown*.

## Design

### The descriptor

```ts
// src/capabilities.ts — invariants in a typed static table, resolved per
// provider INSTANCE + config (not per provider name: with
// GENERATOR_PROVIDER=ollama there are TWO OllamaProvider instances —
// generator and validator — with different models, window caps, and
// requireLocal; a name-keyed table cannot tell them apart).
// Deliberately NOT a plugin loader, manifest format, registry, or
// third-party code boundary; seven built-in providers, one file.

export interface GeneratorCapabilities {
  provider: string;
  per_call_model_override: boolean;         // direct five: true; companions: false
  temperature:
    | { supported: true; min: number; max: number; passthrough_only: boolean }
    | { supported: false }
    | "unknown";                            // model-dependent
  max_tokens: /* same three-way shape */;
  /** The EFFECTIVE enforceable input window — for Ollama,
   * min(trained context, OLLAMA_NUM_CTX cap) from the model profile;
   * not the trained window alone (they diverge exactly where
   * ContextPlan needs the number). */
  context_window: number | "unknown";
  system_prompt_channel: "native" | "none"; // companions: none (keyphrase message)
  usage_reporting: "reported" | "none";
  /** Derived inside the resolver from supportsStructuredOutput(provider)
   * — never tabled, so the type guard stays the single source of truth. */
  structured_output: boolean;
  external_generation_side_effect: "none" | "conversation_mutation" | "unknown";
  supports_noncommitting_variants: boolean; // side_effect === "none" today, but
                                            // an explicit field: unknown is NOT safe
  kindroid_targeting?: { targets: ["ai", "group"]; group_turns: boolean };
}

/** ASYNC: Ollama's context_window comes from the cached /api/show model
 * profile (a network fetch on first resolution per model). A synchronous
 * signature — the first draft's — could only ever return "unknown" for
 * exactly the field ContextPlan depends on. */
export function resolveCapabilities(
  provider: LlmProvider,
  model?: string,
): Promise<GeneratorCapabilities>;
```

Values come from the code as it exists, not aspiration. **No
`cancellation` field**: today no provider accepts caller cancellation at
all, and the vocabulary belongs to the (also unratified)
[RUN_OUTCOMES_DESIGN.md](RUN_OUTCOMES_DESIGN.md) — that design adds the
field with its own terms when cancellation exists, rather than two
unratified docs pinning contradictory words. Likewise omitted, as a
recorded decision rather than an oversight: the assessment's
"warm-up/connection/disposal lifecycle" axis — warmup and readiness
(`warmup?`, `checkReady?`) already shipped as optional `LlmProvider`
hooks with the semantic-readiness slice, so re-describing them in a
table would be a second source of truth.

### The honest resolution matrix (so ratification weighs the real payoff)

With a from-the-code-only table, temperature/max_tokens resolve
non-`unknown` for: **ollama** (supported, 0–2 / token cap), **gemini**
(supported, passthrough-only), **kindroid**, **botify** (supported:
false). They stay `"unknown"` for **anthropic, openai, atlascloud** —
all three gate on model generations the code deliberately doesn't
enumerate (the pass-through posture exists because current-gen models
400 on the fields' presence). So slice 2's provable UI win is the
**companion control removal plus honest unknown-hints on the cloud
three**, not capability-aware sliders everywhere. Ratify with that
expectation, or fund a per-model known list (which drifts) explicitly.

### Precedence with the shared surface bounds (decision recorded)

The shared MCP/REST validation bounds (`MIN/MAX_TEMPERATURE` 0–2,
`MIN/MAX_GENERATION_TOKENS`) **stay as-is** — they are input sanity, not
capability. A value inside the surface bounds but outside a descriptor's
known range goes through the warn path (consumer 2 below), never a new
rejection: warn-don't-break is the assessment's compatibility rule and
this line keeps one validation authority per concern.

### Consumers (each one is an acceptance surface)

1. **REST projection** `GET /api/capabilities` (protected like the rest
   of `/api/*`, behind the same generator+validator presence gate as
   `/api/status`): **two** resolved descriptors — the generator
   instance's and the validator instance's (distinct even when both are
   Ollama). The Web UI removes controls marked `supported: false`,
   keeps `unknown` controls enabled with a hint, and stops offering
   temperature/max-tokens for companions.
2. **Ignored/out-of-range warnings**: when a caller sends an option the
   descriptor marks unsupported (or outside a known range), the response
   carries a warning field — not an error; legacy MCP callers keep
   working until a migration path exists.
3. **ContextPlan**: `context_window` is the cloud-side window source for
   enforcement stage 3
   ([CONTEXT_PLAN_DESIGN.md](CONTEXT_PLAN_DESIGN.md)).
4. **Beat-proposals gate (parked)**: `supports_noncommitting_variants` +
   `external_generation_side_effect` are the fields the parked proposals
   feature reads (the queue records that feature as blocked on this
   design — the dependency runs toward us, not circularly). Companions
   can never enter proposal mode under current values; `unknown` is not
   safe.
5. **Usage labeling**: `usage_reporting` explains an absent `ModelUsage`
   as by-design vs anomalous.

### What this deliberately does not decide

- **Content routing is NOT ratified here.** The descriptor leaves an
  attachment point (a future `content_capability` field) for
  [CONTENT_ROUTING_DESIGN.md](CONTENT_ROUTING_DESIGN.md)'s
  provider-level declaration, whose ratification is its own decision.
- No dynamic provider registry, runtime router, marketplace, or
  third-party loading — rejected across all four assessments.
- No automatic behavior change on `unknown` — instrument-and-surface
  only.

## Acceptance tests

- Provider request tests prove supported values are forwarded and
  unsupported values are omitted-or-warned (per provider fixture).
- **Warn path**: an unsupported option produces the warning field, a
  2xx/normal result, and an unchanged legacy-caller contract; `unknown`
  options produce NO warning (unknown is not unsupported).
- The UI removes only `supported: false` controls and renders `unknown`
  enabled-with-hint (component test) — an upstream 400 on an unknown
  field surfaces verbatim, which is the designed outcome.
- `resolveCapabilities` returns `"unknown"` (not a guess) for a
  model-dependent field with an unlisted model, and **distinct
  descriptors for the generator and validator instances** under
  `GENERATOR_PROVIDER=ollama` (different models/window caps).
- `structured_output` tracks `supportsStructuredOutput` by construction
  (drift test: a provider gaining `generateStructured` flips the field
  with no table edit).
- Ollama's `context_window` equals the effective window
  (min(trained, cap)) once the profile is cached, `"unknown"` before.
- The projection route is absent when generator/validator are absent.
- Companion descriptors report `conversation_mutation` and
  `supports_noncommitting_variants: false`.

## Slices

1. **Table + async resolver + request-behavior tests** (no behavior
   change).
2. **REST projection + capability-aware Web UI controls.**
3. **Ignored-option warnings** on MCP/REST responses.

## Decisions needed at ratification

1. Confirm warn-don't-break for ignored options and the
   surface-bounds precedence above.
2. Cloud context windows start all-`unknown`; no locally maintained
   per-model table (it drifts — the same failure mode the usage design
   refused for pricing). Revisit only if ContextPlan stage 3 develops a
   real consumer that unknown blocks.
3. Accept the honest resolution matrix above as the slice-2 payoff, or
   explicitly fund a known-model list for the cloud three.

## Revision note (2026-08-28)

An adversarial review confirmed 9 findings against the first draft; all
are folded in above. The load-bearing corrections: the resolver is now
async (a sync signature could never source Ollama's `/api/show`-backed
window — the one field ContextPlan needs) and `context_window` is
defined as the *effective* window; resolution is keyed off the provider
instance + config, so the generator and validator Ollama instances get
distinct descriptors; the `cancellation` field is dropped (aspiration
with an undefined vocabulary owned by an unratified sibling);
`structured_output` derives from the existing type guard instead of a
second source of truth; the UI acceptance criterion is reworded so
`unknown` handling is testable; the expected resolution matrix is stated
so ratification weighs the true payoff; surface-bounds precedence is
recorded; the lifecycle-axis omission is now a recorded decision; and
warn-path acceptance tests exist for the only behavior-changing slice.
