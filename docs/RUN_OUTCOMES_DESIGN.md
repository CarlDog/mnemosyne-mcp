# Run Outcomes & Cancellation Design

**Status:** Proposal, recorded 2026-08-28, revised same day after an
adversarial review (9 findings; see the revision note at the end);
**not ratified**. This document does not schedule work.
[STATUS.md](../STATUS.md) remains the source of current priority.
Rationale lives in
[OPENCLAW_ADOPTION_ASSESSMENT.md §3](OPENCLAW_ADOPTION_ASSESSMENT.md#3-cancellation-idempotency-and-replay-safe-outcomes)
and [§7](OPENCLAW_ADOPTION_ASSESSMENT.md#7-supporting-operational-safety);
this document records the Mnemosyne-specific decisions: types, placement,
chosen semantics, slice order, and acceptance tests.

## Problem (what the code does today)

- `withLogging` ([src/tools/helpers.ts](../src/tools/helpers.ts)) narrows
  tool callbacks to `(args)` and drops the MCP SDK's extra handler context
  — including its `AbortSignal` — so no MCP cancellation ever reaches a
  provider call.
- Provider requests use internal timeouts only; OC's rate-limit backoff
  sleeps are uncancellable; a REST client disconnect stops nothing.
- Kindroid documents that a timeout can follow a successful remote
  mutation; Botify's mutating path has **no timeout and no ambiguity
  classification** at all ([src/botify-client.ts](../src/botify-client.ts)).
- The REST error handler collapses every thrown error into
  `internal_error` ([src/api/helpers.ts](../src/api/helpers.ts)),
  destroying Kindroid's do-not-retry instruction.
- A failure during a dispatched OC `memory_save` is reported as if no
  scene was committed, which is not provable.

## Design

### RunContext and the abort signal

```ts
// src/run-context.ts
export interface RunContext {
  runId: string;          // crypto.randomUUID(); correlation only — no registry
  storyId?: string;       // assembled AFTER resolveStoryId; story-less tools omit it
  surface: "mcp" | "rest";
  signal: AbortSignal;
}
```

Each surface supplies **only the signal**; `RunContext` itself is
assembled inside the handler once `resolveStoryId` has run (the surface
cannot know the story id — review finding).

- **REST** (`src/api/interactive.ts`): an `AbortController` aborted from
  **`res.on("close")` guarded by `!res.writableEnded`**. NOT
  `req.on("close")`: on this repo's Node/Express stack the request's
  `close` fires when the request *message* completes — empirically ~0 ms
  into a long route — so it would abort every run at start. The response's
  `close` fires on both disconnect and normal completion; `writableEnded`
  is the discriminator.
- **MCP** (`src/tools/helpers.ts`): `withLogging` widens its handler type
  to `(args, extra)` and passes `extra.signal` through
  (`RequestHandlerExtra.signal` is a required field in the SDK; verified
  against the installed types). Tools that never dispatch long work
  ignore it.

`continueScene()` gains `run: RunContext` as a parameter (not folded into
`ContinueSceneOptions` — the options object describes the request, the
run describes the execution). `runId` is also surfaced as `run_id` on the
**success** response, so a caller can correlate a completed run with
server logs — correlation is the field's stated purpose.

### Chosen disconnect semantics (decision)

**A surface disconnect aborts pre-dispatch work only**, and the signal is
therefore consulted **only at phase boundaries** — before gather, between
retrieval calls (including inside OC backoff sleeps), and immediately
before a provider dispatch or an OC `memory_save` dispatch. The signal is
**never composed into an in-flight provider request**: aborting a
dispatched generation would discard spent tokens and, for a companion,
manufacture an ambiguous outcome for a call that would have completed —
exactly what this design exists to prevent. (The original draft's
`AbortSignal.any` composition contradicted this; removed by review.)
Provider requests keep only their own internal timeouts.

Rationale: the OpenClaw assessment's complaint is that a disconnect fails
to stop *safe* remaining work, while the Open WebUI assessment separately
warns that a disconnected browser must not cancel an accepted
canon-committing run — both are satisfied by this line. A dispatched
generation completes and saves; the scene is recoverable afterwards.

### Typed outcomes

`src/run-outcome.ts` defines the assessment's table verbatim:

| Outcome | Retry safe | Charge possible | Companion mutation possible | Canon write |
|---|---:|---:|---:|---|
| `rejected_before_dispatch` | yes | no | no | not attempted |
| `timeout_before_dispatch` | yes | no | no | not attempted |
| `provider_dispatch_unknown` | no | yes | provider-dependent | not attempted |
| `completed_but_readback_failed` | no | yes | yes | not attempted |
| `canon_write_unknown` | no | already possible | provider-dependent | unknown |

```ts
export class RunOutcomeError extends Error {
  readonly outcome: Exclude<RunOutcome, "canon_write_unknown">;
  readonly retry_safe: boolean;
  readonly dispatch_attempted: boolean;
  readonly provider_charge_possible: boolean;
  readonly external_conversation_mutation_possible: boolean;
}
```

**`canon_write_unknown` is NOT a thrown error** (review finding): the
beat text already exists when a dispatched save fails, and the code's own
guard says an expensive generation must never be discarded — while the
no-prose logging rule forbids carrying it in an error message. It is
instead a field on the **success-shaped** `ContinueSceneResult`,
alongside the beat text, replacing today's `save_error` reading **only
for the dispatched-save case**:

```ts
// ContinueSceneResult additions
canon_write_outcome?: "unknown";   // dispatched save, outcome unprovable
save_error?: string;               // unchanged: pre-dispatch failures stay
                                   // retryable via mnemo_save_entity
run_id: string;
```

**Producers, enumerated per outcome** (review finding — the readback row
had none):

- `rejected_before_dispatch` — a phase-boundary abort (disconnect,
  shutdown) before any dispatch.
- `timeout_before_dispatch` — an internal deadline elapsing before
  dispatch (e.g. OC retrieval exhausting backoff).
- `provider_dispatch_unknown` — Kindroid's existing
  `callMutatingTool` timeout rethrow (its current message is kept);
  Botify's new timeout (below); any transport failure after a companion
  dispatch.
- `completed_but_readback_failed` — Kindroid's `read_back_error` data
  path (turns > 0, no replies) and Botify's `trigger_warning` /
  null-text throws in `extractBotReply` — today all plain `Error`s that
  REST collapses into `internal_error`, defeating their own
  do-not-retry instructions.
- `canon_write_unknown` — the success-shaped field above; never thrown.

Consumers: the REST error handler maps a `RunOutcomeError` to a
structured JSON body (outcome + the boolean projection + the message)
instead of `internal_error`; non-typed errors keep today's behavior. MCP
callers get the same fields in the error text. Messages carry no secrets
or story prose.

### Botify parity (small, rides slice 2)

`BotifyClient.sendMessage` adopts `KindroidClient.callMutatingTool`'s
shape: per-request timeout (`BOTIFY_MCP_TIMEOUT_MS`, default matching
Kindroid's 180s reasoning) and the timeout-specific
may-have-already-posted rethrow. This is a parity fix, not a response to
an observed Botify incident (the assessment says so explicitly).

### Supporting operational safety (§7 remainder, folded in)

1. **Admission/shutdown owner** in `src/index.ts`: on SIGINT/SIGTERM —
   gate new admission and start listener close; drain **in-flight** work
   for a bounded grace period; abort phases where cancellation is safe
   (the same pre-dispatch line as above); close MCP sessions, provider
   clients, then OC (the bind-failure fix already proved OC must close
   before exit); await listener closure. (Nothing in this design queues
   work — "queued" vocabulary belongs to the rejected registry and is
   deliberately absent here.)
2. **Single-flight companion connect**: `KindroidClient`/`BotifyClient`
   share one `connectPromise` so concurrent first connects don't race.
3. **OC retry classification**: the rate-limit retry currently matches
   `/rate limit/i` on any error. Keep the retry, but retry a **mutating**
   call only when the message proves pre-handler rejection (OC's
   middleware rejects before dispatch — make that dependency explicit in
   a comment + a test against the live message shape), and make the
   backoff sleep abort promptly on `run.signal`.
4. **Atomic config write** (`src/config.ts`): temp-sibling + rename.
   Mechanical; listed here only so the slice is complete.

## Explicitly out of scope (decisions, not omissions)

- **Run registry, per-story lane, SSE events, snapshots** — rejected at
  triage (no incident demonstrates the race); revisit per the
  assessment's own triggers.
- **Idempotency keys** (`client_request_id`) — they live in the registry
  design and have nowhere to exist without it. The queue row's word
  "idempotency" does not pull them into this design.
- **Multi-replica coordination** — a process-local design; the honest
  next step there is an OC lease/CAS contract, not a wider mutex.

## Acceptance tests

- A run cancelled before or during gathering performs zero provider
  calls and zero saves; the outcome is `rejected_before_dispatch`.
- A direct-provider generation **dispatched, then disconnected** still
  completes and saves (the chosen semantics — this replaces the
  assessment's pre-save-cancel bullet, which assumed a cancel point this
  design deliberately removed).
- After companion dispatch, a timeout yields `provider_dispatch_unknown`
  and never invites a retry; Kindroid's `read_back_error` and Botify's
  `trigger_warning`/null-text cases yield `completed_but_readback_failed`
  with their do-not-retry text intact through REST.
- A failure of a **dispatched** OC save yields a success-shaped response
  with `canon_write_outcome: "unknown"` and the beat text present; a
  pre-dispatch save failure keeps today's retryable `save_error` shape.
- A REST response for every outcome uses the ratified status-code map
  (decision #4) and the typed projection.
- Botify timeout behaves like Kindroid's (mocked transport).
- OC backoff aborts promptly on signal; a mutating retry only fires on
  the proven pre-handler rejection message.
- A normally-completed REST request does NOT abort (the
  `res.close`/`writableEnded` guard — regression against the
  request-close 0 ms trap).
- Shutdown with in-flight work drains, aborts only safe phases, and
  exits cleanly (no libuv abort — regression on the bind-failure lesson).
- Success responses carry `run_id`; existing non-cancelled MCP callers
  still get a terminal response.

## Slices (dependency order, each independently shippable)

1. **Signal plumbing + typed outcomes for direct providers** — RunContext,
   withLogging widening, REST close-abort (guarded), phase-boundary
   checks, `RunOutcomeError`, REST error mapping, `run_id` on success.
2. **Companion ambiguity + canon-write-unknown** — Kindroid/Botify
   producer mapping (timeout + readback), Botify parity, the
   success-shaped `canon_write_outcome` field.
3. **Lifecycle** — shutdown owner, single-flight connect, OC retry
   classification + cancellable backoff, atomic config write.

## Decisions needed at ratification

1. Confirm the disconnect semantics: pre-dispatch-only abort, signal
   consulted at phase boundaries only, never composed into an in-flight
   provider request.
2. Confirm `canon_write_unknown` as a success-shaped field (beat text
   preserved) for the dispatched-save case only.
3. Grace period for shutdown drain (proposal: 30s, env-overridable).
4. REST status-code map for typed outcomes (proposal: 499-style 400 for
   `rejected/timeout_before_dispatch`, 502 for
   `provider_dispatch_unknown` and `completed_but_readback_failed` —
   chosen so no `retry_safe: false` outcome returns a status generic
   clients auto-retry).

## Revision note (2026-08-28)

An adversarial review confirmed 9 findings against the first draft; all
are folded in above. The load-bearing corrections: `req.on("close")`
fires at ~0 ms on this stack (empirically verified) and would have
aborted every REST run at start — replaced with guarded `res.on("close")`;
the `AbortSignal.any` provider-request composition contradicted the
design's own pre-dispatch-only semantics — removed; a thrown
`canon_write_unknown` would have discarded the beat text the code's own
guard exists to preserve — now a success-shaped field; the
pre-save-cancel acceptance test contradicted the chosen semantics —
inverted; `completed_but_readback_failed` had no producers — enumerated;
`RunContext.storyId` was unconstructible at the surface — now assembled
post-`resolveStoryId`; "queued" vocabulary — removed; status codes and a
`run_id` consumer — added.
