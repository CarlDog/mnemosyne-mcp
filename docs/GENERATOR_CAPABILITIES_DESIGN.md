# Generator Capability Descriptors Design

**Status:** Proposal, recorded 2026-08-28; **not ratified**. This document
does not schedule work. [STATUS.md](../STATUS.md) remains the source of
current priority. Rationale lives in
[OPENCLAW_ADOPTION_ASSESSMENT.md §4](OPENCLAW_ADOPTION_ASSESSMENT.md#4-static-generator-capability-descriptors),
corroborated by
[OPEN_WEBUI_ADOPTION_ASSESSMENT.md §7](OPEN_WEBUI_ADOPTION_ASSESSMENT.md#7-findings-that-corroborate-existing-work-rather-than-add-it)
and [NEMOCLAW_ADOPTION_ASSESSMENT.md](NEMOCLAW_ADOPTION_ASSESSMENT.md)
(corroboration table). This document records the concrete descriptor
shape, its consumers, and what it deliberately does not decide.

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
// src/capabilities.ts — a typed static table plus a model-aware resolver.
// Deliberately NOT a plugin loader, manifest format, registry, or
// third-party code boundary; seven built-in providers, one file.

export interface GeneratorCapabilities {
  provider: string;
  per_call_model_override: boolean;         // direct five: true; companions: false
  temperature:
    | { supported: true; min: number; max: number; passthrough_only: boolean }
    | { supported: false }
    | "unknown";                            // model-dependent (current-gen Claude rejects it)
  max_tokens: /* same three-way shape */;
  context_window: number | "unknown";       // resolved per model; Ollama from the
                                            // /api/show profile, cloud from a
                                            // small static per-model table or unknown
  system_prompt_channel: "native" | "none"; // companions: none (keyphrase message)
  usage_reporting: "reported" | "none";
  structured_output: boolean;               // Ollama format: true today
  cancellation: "cooperative" | "pre_dispatch_only";
  external_generation_side_effect: "none" | "conversation_mutation" | "unknown";
  supports_noncommitting_variants: boolean; // side_effect === "none" today, but
                                            // an explicit field: unknown is NOT safe
  kindroid_targeting?: { targets: ["ai", "group"]; group_turns: boolean };
}

export function resolveCapabilities(
  provider: LlmProvider,
  model?: string,
): GeneratorCapabilities;
```

Values come from the code as it exists, not aspiration — e.g. Anthropic
temperature is `"unknown"` at the provider level because support is
model-dependent (0–1 on older models, rejected on current-gen); the
resolver returns the concrete answer only when the model is on a small
known list, else `"unknown"`. **`unknown` is never treated as either
`supported` or `unsupported`** by any consumer.

### Consumers (each one is an acceptance surface)

1. **REST projection** `GET /api/capabilities` (protected like the rest
   of `/api/*`): the active generator's resolved descriptor + the
   validator's. The Web UI hides or constrains controls the provider
   cannot honor, **renders `unknown` as unknown** (enabled with a hint),
   and stops offering temperature/max-tokens for companions.
2. **Ignored-option warnings**: when a caller sends an option the
   descriptor says is unsupported, the response carries a warning field —
   not an error; legacy MCP callers keep working until a migration path
   exists (the assessment's compatibility rule).
3. **ContextPlan**: `context_window` is the cloud-side window source for
   enforcement stage 3
   ([CONTEXT_PLAN_DESIGN.md](CONTEXT_PLAN_DESIGN.md)).
4. **Beat-proposals gate (parked)**: `supports_noncommitting_variants` +
   `external_generation_side_effect` are the fields the parked proposals
   feature reads. Companions can never enter proposal mode under current
   values; `unknown` is not safe.
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
- The UI never offers a control the selected provider cannot honor, and
  renders `unknown` distinctly from `unsupported` (component test).
- `resolveCapabilities` returns `"unknown"` (not a guess) for a
  model-dependent field with an unlisted model.
- The projection route is absent when generator/validator are absent
  (test-router parity with `/api/status`).
- Companion descriptors report `conversation_mutation` and
  `supports_noncommitting_variants: false`.

## Slices

1. **Table + resolver + request-behavior tests** (no behavior change).
2. **REST projection + capability-aware Web UI controls.**
3. **Ignored-option warnings** on MCP/REST responses.

## Decisions needed at ratification

1. Confirm warn-don't-break for ignored options (vs rejecting outright).
2. Whether the cloud per-model context-window table is worth maintaining
   now (it drifts) or `context_window: "unknown"` for all cloud models
   until a real need — **recommendation: start all-unknown**; the
   ContextPlan design treats unknown honestly, and a drifting local
   table is the exact failure mode the usage-telemetry design refused
   for pricing.
