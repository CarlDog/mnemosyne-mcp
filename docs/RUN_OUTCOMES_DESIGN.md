# Run Outcomes & Cancellation Design

**Status:** Proposal, recorded 2026-08-28; **not ratified**. This document
does not schedule work. [STATUS.md](../STATUS.md) remains the source of
current priority. Rationale lives in
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

### RunContext

```ts
// src/run-context.ts
export interface RunContext {
  runId: string;          // crypto.randomUUID(); correlation only — no registry
  storyId: string;
  surface: "mcp" | "rest";
  signal: AbortSignal;
}
```

Constructed at each surface:

- **REST** (`src/api/interactive.ts`): an `AbortController` aborted by the
  request's `close` event when the response has not finished.
- **MCP** (`src/tools/helpers.ts`): `withLogging` widens its handler type
  to `(args, extra)` and passes `extra.signal` through. This touches every
  tool registration's callback type but not their bodies; tools that never
  dispatch long work ignore it.

`continueScene()` gains `run: RunContext` as a parameter (not folded into
`ContinueSceneOptions` — the options object describes the request, the run
describes the execution). `gatherContext`, the OC client's backoff sleep,
and every provider `generate()` accept the signal; providers compose it
with their own deadlines via `AbortSignal.any([run.signal, timeoutSignal])`.

### Chosen disconnect semantics (decision)

**A surface disconnect aborts pre-dispatch work only.** Gather, OC backoff
sleeps, and any not-yet-dispatched provider call stop; once generation has
been dispatched on ANY provider, the run completes and saves. Rationale:
the OpenClaw assessment's complaint is that a disconnect fails to stop
*safe* remaining work, while the Open WebUI assessment separately warns
that a disconnected browser must not cancel an accepted canon-committing
run — both are satisfied by this line. The tokens are already spent; the
saved scene is recoverable by the caller afterwards.

### Typed outcomes

`src/run-outcome.ts` defines the assessment's table verbatim as a typed
error carried through MCP, REST, and logs:

| Outcome | Retry safe | Charge possible | Companion mutation possible | Canon write |
|---|---:|---:|---:|---|
| `rejected_before_dispatch` | yes | no | no | not attempted |
| `timeout_before_dispatch` | yes | no | no | not attempted |
| `provider_dispatch_unknown` | no | yes | provider-dependent | not attempted |
| `completed_but_readback_failed` | no | yes | yes | not attempted |
| `canon_write_unknown` | no | already possible | provider-dependent | unknown |

```ts
export class RunOutcomeError extends Error {
  readonly outcome: RunOutcome;           // the enum above
  readonly retry_safe: boolean;
  readonly dispatch_attempted: boolean;
  readonly provider_charge_possible: boolean;
  readonly external_conversation_mutation_possible: boolean;
  readonly canon_write_outcome: "not_attempted" | "unknown";
}
```

Producers: providers classify their own failures (Kindroid's existing
timeout rethrow becomes `provider_dispatch_unknown`
with its current message; a pre-dispatch abort becomes
`rejected_before_dispatch`). `continueScene` wraps a failure of a
**dispatched** `memory_save` as `canon_write_unknown` instead of the
current save_error-implies-nothing-committed reading.

Consumers: the REST error handler maps a `RunOutcomeError` to a structured
JSON body (outcome + the boolean projection + the message) instead of
`internal_error`; non-typed errors keep today's behavior. MCP callers get
the same fields in the error text. Messages carry no secrets or story
prose (the logging slice's rule applies).

### Botify parity (small, rides slice 2)

`BotifyClient.sendMessage` adopts `KindroidClient.callMutatingTool`'s
shape: per-request timeout (`BOTIFY_MCP_TIMEOUT_MS`, default matching
Kindroid's 180s reasoning) and the timeout-specific
may-have-already-posted rethrow. This is a parity fix, not a response to
an observed Botify incident (the assessment says so explicitly).

### Supporting operational safety (§7 remainder, folded in)

1. **Admission/shutdown owner** in `src/index.ts`: on SIGINT/SIGTERM —
   gate new admission and start listener close; drain active work for a
   bounded grace period; abort phases where cancellation is safe (the
   same pre-dispatch line as above); close MCP sessions, provider
   clients, then OC (the bind-failure fix already proved OC must close
   before exit); await listener closure.
2. **Single-flight companion connect**: `KindroidClient`/`BotifyClient`
   share one `connectPromise` so concurrent first connects don't race.
3. **OC retry classification**: the rate-limit retry currently matches
   `/rate limit/i` on any error. Keep the retry, but retry a **mutating**
   call only when the message proves pre-handler rejection (OC's
   middleware rejects before dispatch — make that dependency explicit in
   a comment + a test against the live message shape), and make the
   backoff sleep accept `run.signal`.
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

- A cancelled queued/gathering run performs zero provider calls and zero
  saves; the outcome is `rejected_before_dispatch`.
- Cancellation before save prevents a direct-provider result from
  becoming a scene; after companion dispatch it yields
  `provider_dispatch_unknown` and never invites a retry.
- A failure during a dispatched OC save yields `canon_write_unknown`.
- REST surfaces the typed projection; Kindroid's do-not-retry text
  survives to the REST client.
- Botify timeout behaves like Kindroid's (mocked transport).
- OC backoff aborts promptly on signal; a mutating retry only fires on
  the proven pre-handler rejection message.
- Shutdown with queued + active work drains, aborts only safe phases,
  and exits cleanly (no libuv abort — regression on the bind-failure
  lesson).
- Existing non-cancelled MCP callers still get a terminal response.

## Slices (dependency order, each independently shippable)

1. **Signal plumbing + typed outcomes for direct providers** — RunContext,
   withLogging widening, REST close-abort, provider signal composition,
   `RunOutcomeError`, REST error mapping.
2. **Companion ambiguity + canon-write-unknown** — Kindroid reclassify,
   Botify parity, dispatched-save wrapping.
3. **Lifecycle** — shutdown owner, single-flight connect, OC retry
   classification + cancellable backoff, atomic config write.

## Decisions needed at ratification

1. Confirm the disconnect semantics (pre-dispatch-only abort).
2. Confirm `canon_write_unknown` replaces the current
   `save_error`-with-beat-text response for the **dispatched**-save case
   only (a save that fails before dispatch keeps today's retryable
   `save_error` shape).
3. Grace period for shutdown drain (proposal: 30s, env-overridable).
