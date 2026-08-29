# OpenClaw Adoption Assessment

**Status:** Completed comparative research, recorded 2026-08-27;
recommendations are unratified. This document does not schedule work, change
locked architecture, or reopen deferred scope. [STATUS.md](../STATUS.md)
remains the source of current priority. Any item that changes a locked decision
in [ARCHITECTURE.md](ARCHITECTURE.md) still requires its own design review.

**Upstream snapshot:**
[`openclaw/openclaw@f1e9960`](https://github.com/openclaw/openclaw/tree/f1e996068d8dd03c2c577a9fb37a19995ffdc1f7),
package version `2026.8.1`, MIT license. All OpenClaw source links below are
pinned to that commit so this assessment remains reproducible as upstream
changes.

**Mnemosyne snapshot:** `cfd9d7f4597d862314c78466f344f8118040016e`.
A local audit clone was created from the canonical OpenClaw repository; this
record does not imply that a GitHub-hosted fork was created. Relative
Mnemosyne source links below refer to that snapshot, not HEAD — later
refactors (notably the 2026-08-28 `src/index.ts` split) have moved some
cited code.

## Decision summary

Treat OpenClaw as a **pattern library**, not as a dependency, fork base, or
architecture to transplant into Mnemosyne.

OpenClaw is a broad personal-agent platform: one Gateway coordinates models,
tools, messaging channels, devices, sessions, companion apps, automation,
skills, plugins, media, and multiple user interfaces. At the audited snapshot
it contained 34,426 tracked files, 153 extension directories, and 22 package
directories. Mnemosyne contained 135 tracked files and has a much narrower
job: perform continuity-aware story operations while OpenChronicle owns
canonical memory.

That mismatch rules out most of OpenClaw's platform. It does not rule out its
small contracts. Seven patterns are grounded in Mnemosyne's code, incidents,
standards, or recorded proposals:

| Track | Recommendation | Assessment rank if ratified | Mnemosyne grounding |
|---|---|---:|---|
| Context assembly | Adopt a structured, budgeted, inspectable `ContextPlan` | High | An estimated request plan above Ollama's cap still dispatches, and unratified UI notes propose an assembly panel |
| Run integrity | Serialize canon-committing continuations per story | High | Concurrent requests can gather the same story frontier |
| Failure semantics | Preserve cancellation, idempotency, and replay safety | High | Companion calls can mutate remotely before a timeout |
| Provider surface | Add static generator capability descriptors | Medium | Public controls are ignored or vary by provider |
| Retrieval | Expose existing OpenChronicle controls and enrich only vague queries | Medium | Raw `continue`-style directions are weak entity queries |
| Living state | Prototype provenance-bound, review-only state proposals | Later | The Living Canon Standard already requires current-state extraction |
| Operational safety | Remove prose from default logs and tighten lifecycle ownership | High | Narrative content is currently logged by default |

Media jobs, beat proposals, and remote-HTTP hardening have legitimate triggers,
but remain conditional. The Gateway, plugin system, memory database, autonomous
consolidation, channel platform, scheduler, and multi-agent runtime do not fit
Mnemosyne's current ownership or use cases.

In this document, **adopt** means reimplement the smallest useful contract in
Mnemosyne's vocabulary. It does not mean copying an OpenClaw subsystem. No
OpenClaw code has been incorporated.

## Assessment constraints

The comparison used four filters:

1. **A real consumer must exist.** A recommendation needs a current code path,
   observed incident, ratified requirement, or explicit roadmap item.
2. **Ownership must remain intact.** OpenChronicle remains canonical for
   memories; Mnemosyne remains the narrative layer; provider services retain
   ownership of their external conversations.
3. **The first slice must be bounded.** Prefer pure planners, small registries,
   in-process queues, and typed outcomes over databases or frameworks.
4. **Canon safety outranks automation.** No inferred fact becomes durable canon
   solely because it is recent, repeated, or model-generated.

These filters are why this assessment recommends several contracts from
OpenClaw while rejecting most of its feature surface.

## 1. Structured, budgeted, inspectable context assembly

### Why this is a real need

Mnemosyne currently caps the number of recalled entries by entity type in
[`src/prompt.ts`](../src/prompt.ts#L96-L108), but it does not cap each entry or
the complete provider-visible payload. `ContextBundle` becomes arrays of
strings, discarding memory IDs, tags, timestamps, pin state, and retrieval
relevance before final assembly
([`src/prompt.ts`](../src/prompt.ts#L121-L142)). Direct LLM providers receive
the concatenated system and user prompts
([`src/prompt.ts`](../src/prompt.ts#L334-L400)). Kindroid and Botify ignore the
system prompt and instead build a separately keyphrase-gated companion message
([`src/kindroid-provider.ts`](../src/kindroid-provider.ts#L17-L23),
[`src/botify-provider.ts`](../src/botify-provider.ts#L41-L43),
[`src/companion-message.ts`](../src/companion-message.ts#L94-L126)). Neither
path emits a structured admission plan for the payload that its provider
actually sees.

Mnemosyne computes an estimated Ollama request plan, but a plan above the
configured cap currently produces a warning and is still submitted
([`src/llm.ts`](../src/llm.ts#L121-L197)). The estimate is character-based,
not tokenizer-exact. A separate 59 KB Anthropic generation succeeded, while
the long-context word salad observed on the local Ollama installation was
ultimately bisected to an installation-level defect rather than malformed
Mnemosyne context ([`STATUS.md`](../STATUS.md)). That incident supports
deterministic sizing and visibility; it is not evidence that Mnemosyne caused
an Ollama overflow. The explicitly unratified Web UI notes propose a
retrieval-assembly panel and accurately note that the backend drops the
metadata needed to build it
([`docs/WEBUI_NOTES.md`](WEBUI_NOTES.md#4-show-the-assembly)).

### Useful OpenClaw pattern

OpenClaw separates context ingestion, assembly, compaction, and post-turn
processing. Assembly receives a token budget and returns messages plus an
estimate
([context-engine lifecycle](https://github.com/openclaw/openclaw/blob/f1e996068d8dd03c2c577a9fb37a19995ffdc1f7/docs/concepts/context-engine.md#L68-L84),
[assembly contract](https://github.com/openclaw/openclaw/blob/f1e996068d8dd03c2c577a9fb37a19995ffdc1f7/docs/concepts/context-engine.md#L144-L161)).
Its context inspector reports raw and injected sizes, truncation, and major
contributors
([context inspection](https://github.com/openclaw/openclaw/blob/f1e996068d8dd03c2c577a9fb37a19995ffdc1f7/docs/concepts/context.md#L20-L55)).
Bootstrap material has deterministic per-item and aggregate limits with
visible warnings when content is partial
([bootstrap budget](https://github.com/openclaw/openclaw/blob/f1e996068d8dd03c2c577a9fb37a19995ffdc1f7/src/agents/embedded-agent-helpers/bootstrap.ts#L381-L443)).

The transferable idea is the planner and its diagnostics, not OpenClaw's
transcript-oriented context-engine plugin.

### Recommended Mnemosyne adaptation

Preserve structured entries until final prompt rendering. A proposed entry
needs, at minimum:

- `memory_id`, story ID, entity type, and display name;
- tags, pin state, creation/update time, and retrieval relevance where
  supplied by OpenChronicle;
- original and included character counts plus an estimated token count;
- authority/admission class;
- inclusion, excerpting, or exclusion reason.

A pure `ContextPlan` should then report:

- provider and model when known;
- known input budget, output reserve, and fixed-instruction cost;
- included, excerpted, and dropped entry IDs;
- section-level character/token estimates;
- whether the result is complete, partial, or rejected before dispatch.

`ContextPlan` must represent the payload the selected provider actually sees:
system/user messages for direct providers and the keyphrase-gated companion
message for Kindroid/Botify.

Admission order should protect absolute rules and style constraints first,
then accepted current-state records if that workflow is ratified, relevant
entities, `validation:clean` recent scenes, and untagged fallback scenes. This
preserves the current clean-before-untagged ordering and hard exclusion of
`validation:errors`. Lower-ranked or older candidates should be dropped before
protected material. If protected material alone cannot fit, generation should
fail visibly rather than silently summarize or truncate canon.

Roll out enforcement only where the model window is trustworthy:

1. Instrument every provider immediately.
2. Reject Ollama requests whose estimated input, output reserve, and margin
   exceed the configured cap before dispatch.
3. Extend hard enforcement to cloud models only as provider capability
   descriptors gain reliable context-window metadata.

Return a compact manifest in the MCP/REST result. If the proposed Web UI
assembly-panel slice is separately ratified, it is the appropriate home for
expanded identities and reasons. Entity bodies do not belong in progress
events or normal logs.

### Guardrails and acceptance proof

- No model-generated summarizer in the admission path.
- No universal context-window guess for unknown cloud models.
- An Ollama request plan estimated above the configured cap performs no
  provider request.
- Given identical inputs, admission order and exclusion reasons are
  deterministic.
- Protected-content overflow is an actionable error, not a warning followed
  by a knowingly bad generation.
- Tests show that the rendered prompt and reported section sizes agree.

## 2. Continuation runs and per-story state-transition safety

### Why this is a real need

The interactive route waits for the complete gather, generate, save, and
validate pipeline
([`src/api/interactive.ts`](../src/api/interactive.ts#L82-L138)). The Web UI
tracks a boolean loading state and receives no recoverable run identity. More
importantly, two calls for the same story can both gather before either saves
([`src/tools/continue.ts`](../src/tools/continue.ts#L133-L172),
[`src/tools/continue.ts`](../src/tools/continue.ts#L206-L228)). That permits
two continuations to branch from the same prior frontier and then save in
nondeterministic order.

This source-level race is demonstrated by the control flow; this audit did not
find a production incident proving that users have triggered it.

### Useful OpenClaw pattern

OpenClaw uses small keyed lanes: work in one lane is serialized while
different lanes remain parallel
([command queue](https://github.com/openclaw/openclaw/blob/f1e996068d8dd03c2c577a9fb37a19995ffdc1f7/src/process/command-queue.ts#L101-L104)).
Admission is committed before callbacks run and completion drains the next
entry
([queue transition](https://github.com/openclaw/openclaw/blob/f1e996068d8dd03c2c577a9fb37a19995ffdc1f7/src/process/command-queue.ts#L386-L448)).
It also gives runs stable identities, typed terminal states, and monotonic
progress snapshots with explicit count/byte limits and eviction
([terminal outcome](https://github.com/openclaw/openclaw/blob/f1e996068d8dd03c2c577a9fb37a19995ffdc1f7/src/agents/agent-run-terminal-outcome.types.ts#L3-L28),
[snapshot limits](https://github.com/openclaw/openclaw/blob/f1e996068d8dd03c2c577a9fb37a19995ffdc1f7/src/gateway/server-chat-progress-snapshot.ts#L5-L14),
[monotonic sequencing](https://github.com/openclaw/openclaw/blob/f1e996068d8dd03c2c577a9fb37a19995ffdc1f7/src/gateway/server-chat-progress-snapshot.ts#L79-L85),
[snapshot eviction](https://github.com/openclaw/openclaw/blob/f1e996068d8dd03c2c577a9fb37a19995ffdc1f7/src/gateway/server-chat-progress-snapshot.ts#L184-L230)).

### Recommended Mnemosyne adaptation

Add a process-local lane keyed by `storyId` around the entire canon-committing
transition:

```text
queued -> gather -> generate -> save -> validate -> terminal
```

Independent stories remain parallel. Report `queue_wait_ms` alongside the
existing stage timings.

For the browser surface, add a small in-memory continuation-run registry:

- the client supplies a `client_request_id` bound to the story, caller/surface
  scope, and a canonical hash of direction and options;
- the same ID and request hash return the existing `run_id`, while reuse with a
  different request returns a conflict;
- add a new async endpoint or an explicit `Prefer: respond-async` mode that
  returns `202` and exposes a snapshot through polling or server-sent events;
- retain the current synchronous REST route until server and Web UI migrate
  together; its current client immediately expects a terminal
  `ContinueResponse`;
- phases are `accepted`, `queued`, `gathering`, `generating`, `saving`, and
  `validating`;
- terminal states are `completed`, `failed`, `cancelled`, or
  `outcome_unknown`;
- terminal runs expire after a documented TTL, completed entries are evicted,
  and the registry has a hard maximum size.

Keep the synchronous MCP contract as a compatibility wrapper that awaits the
same run. A first slice needs no database and no restart recovery, preserving
the no-local-database decision in
[ARCHITECTURE.md](ARCHITECTURE.md#2-state-model-hybrid-oc-canonical).

### Guardrails and acceptance proof

- A forced-overlap test proves that the second same-story gather begins only
  after the first save.
- A second test proves different stories still progress concurrently.
- Queue cancellation removes work before gathering begins.
- Progress events are monotonic and bounded by count and byte size.
- Reusing an idempotency key with a changed payload returns conflict.
- TTL and capacity tests prove the registry itself remains bounded.
- Only canon-committing continuations are serialized; a future draft/variant
  feature must not be smuggled into this change.
- A process-local lane is not described as multi-process protection. If
  multi-replica deployment becomes real, the correct next design is an
  OpenChronicle lease/CAS/frontier contract, not a wider in-memory mutex.

## 3. Cancellation, idempotency, and replay-safe outcomes

### Why this is a real need

The MCP SDK supplies cancellation context, but Mnemosyne's tool-registration
helper narrows callbacks to arguments and drops the extra handler context
([`src/tools/helpers.ts`](../src/tools/helpers.ts#L10-L15),
[`src/tools/helpers.ts`](../src/tools/helpers.ts#L45-L64)). Provider requests
therefore use internal timeouts without caller cancellation, OpenChronicle
backoff sleeps are not cancellable, and an HTTP disconnect does not stop safe
remaining work.

Cancellation is not equivalent across providers. Kindroid already documents
that a timeout may occur after the direction and generated replies have been
persisted remotely; blindly retrying can duplicate the external mutation
([`src/kindroid-client.ts`](../src/kindroid-client.ts#L86-L150)). Botify's
mutating path does not yet provide equivalent timeout and ambiguity
classification
([`src/botify-client.ts`](../src/botify-client.ts#L95-L123)). REST currently
collapses detailed provider errors into `internal_error`, losing Kindroid's
do-not-retry instruction
([`src/api/helpers.ts`](../src/api/helpers.ts#L87-L92)).

### Useful OpenClaw pattern

OpenClaw composes a caller signal with an internal deadline and clears its
owned timeout timer
([fetch timeout](https://github.com/openclaw/openclaw/blob/f1e996068d8dd03c2c577a9fb37a19995ffdc1f7/src/utils/fetch-timeout.ts#L108-L163)).
Its retry utility marks post-dispatch/provider-output ambiguity as replay
unsafe and refuses to retry it
([retry safety](https://github.com/openclaw/openclaw/blob/f1e996068d8dd03c2c577a9fb37a19995ffdc1f7/src/llm/utils/retry.ts#L8-L32)).
Its general terminal outcome records provider-start and timeout-phase fields
([terminal fields](https://github.com/openclaw/openclaw/blob/f1e996068d8dd03c2c577a9fb37a19995ffdc1f7/src/agents/agent-run-terminal-outcome.types.ts#L18-L28)).

### Recommended Mnemosyne adaptation

Thread a single `RunContext` through MCP/REST ingress, queue admission,
retrieval, providers, save, validation, and logging:

```ts
type RunContext = {
  runId: string;
  storyId: string;
  surface: "mcp" | "rest";
  signal: AbortSignal;
};
```

Compose its signal with provider deadlines. Direct HTTP and Ollama calls can
cooperate throughout the request. Companion providers can stop safely before
dispatch; after dispatch, cancellation or timeout must report an unknown
external outcome rather than claim the mutation was undone.

The canonical save is another dispatch boundary. Check cancellation before
calling OpenChronicle, but once `memory_save` is dispatched, cancellation or a
transport failure can leave the canonical write outcome unknown. Report a
distinct `canon_write_unknown` outcome instead of treating every save error as
proof that no scene was committed
([`src/tools/continue.ts`](../src/tools/continue.ts#L206-L228)).

Preserve a typed result/error classification on MCP, REST, UI, and logs:

| Outcome | Retry safe | Provider charge possible | Companion mutation possible | Canon write |
|---|---:|---:|---:|---|
| `rejected_before_dispatch` | yes | no | no | not attempted |
| `timeout_before_dispatch` | yes | no | no | not attempted |
| `provider_dispatch_unknown` | no | yes | provider-dependent | not attempted |
| `completed_but_readback_failed` | no | yes | yes | not attempted |
| `canon_write_unknown` | no | already possible | provider-dependent | unknown |

The public projection should include `retry_safe`, `dispatch_attempted`,
`provider_charge_possible`, `external_conversation_mutation_possible`, and
`canon_write_outcome`, plus an actionable message with secrets and story prose
removed. Mnemosyne can prove that dispatch was attempted; it cannot generally
prove that a remote provider began execution.

### Guardrails and acceptance proof

- No automatic provider fallback or retry after a possibly billable or
  externally mutating request.
- Botify receives an explicit timeout and the same ambiguity classification as
  Kindroid; this is a parity fix, not a response to an observed Botify incident.
- A cancelled queued request never enters gathering.
- Cancellation before save prevents a direct-provider result from becoming a
  scene.
- Cancellation after companion dispatch becomes `outcome_unknown` and never
  invites a blind retry.
- Cancellation during a dispatched OpenChronicle save yields
  `canon_write_unknown` rather than a retry-safe failure.
- Existing non-cancelled MCP callers continue to receive a terminal response.

## 4. Static generator capability descriptors

### Why this is a real need

`LlmGenerateOptions` mixes generic sampling controls with companion-provider
context plus Kindroid-specific targeting and turn controls, and documents
several fields that providers ignore
([`src/llm.ts`](../src/llm.ts#L29-L100)). The provider-input redesign is
already recorded as queued in [`STATUS.md`](../STATUS.md), while the Web UI
currently renders model, temperature, and maximum-token controls broadly
([`webui/src/pages/ContinueScenePage.tsx`](../webui/src/pages/ContinueScenePage.tsx#L183-L240)).

### Useful OpenClaw pattern

OpenClaw models provider and model compatibility explicitly: role support,
reasoning, strict/schema behavior, input types, cost, context window, and output
limits
([LLM types](https://github.com/openclaw/openclaw/blob/f1e996068d8dd03c2c577a9fb37a19995ffdc1f7/packages/llm-core/src/types.ts#L474-L569),
[model definition](https://github.com/openclaw/openclaw/blob/f1e996068d8dd03c2c577a9fb37a19995ffdc1f7/packages/llm-core/src/types.ts#L658-L700)).

### Recommended Mnemosyne adaptation

Add a typed runtime `GeneratorCapabilities` descriptor table and a model-aware
resolver for the seven built-in providers. Provider invariants can remain
static, but model-dependent limits and sampling controls must resolve for the
selected model or remain explicitly `unknown`. The descriptor should describe:

- per-call model override support;
- temperature and maximum-token support plus known ranges;
- known context/input budget;
- prompt/system-channel behavior;
- usage reporting;
- external-conversation side effects;
- cancellation semantics;
- Kindroid target, group-turn, and user-handback behavior;
- warm-up, connection, and disposal lifecycle.

Expose a safe projection through REST and use it to hide or constrain invalid
Web UI controls. Initially warn when legacy MCP callers send ignored options;
do not break compatibility until callers have a migration path. The UI must
not interpret `unknown` as `unsupported`.

### Guardrails and acceptance proof

- This remains a typed built-in descriptor/resolver, not a plugin loader,
  manifest format, marketplace, or third-party code boundary.
- Capability existence does not ratify the proposed content-routing policy in
  [CONTENT_ROUTING_DESIGN.md](CONTENT_ROUTING_DESIGN.md).
- The UI does not offer controls a selected provider cannot honor.
- Provider request tests prove supported values are forwarded and unsupported
  values are either omitted or reported.

## 5. OpenChronicle retrieval controls and vague-direction enrichment

### Why this is a real need

OpenChronicle already provides hybrid, keyword, and semantic search modes,
phrase matching, compact results, pinned limits, and typed relevance metadata
([OpenChronicle memory tool](https://github.com/CarlDog/openchronicle-mcp/blob/68a4eebd947963d4aa87ae1470bd0ff4d06e0774/src/openchronicle/interfaces/mcp/tools/memory.py#L43-L118)).
Mnemosyne's wrapper exposes only query, project, tags, and `topK`, and its
`OcMemory` type omits relevance
([`src/oc-client.ts`](../src/oc-client.ts#L26-L35),
[`src/oc-client.ts`](../src/oc-client.ts#L72-L77)).

This has two concrete effects:

1. Entity overwrite detection can miss an exact existing name when a hybrid
   top-50 result window is occupied by other entries, a limitation already
   documented in [`src/entities.ts`](../src/entities.ts#L48-L59).
2. Context gathering uses the raw direction for rules, style, characters,
   locations, lore, worldbuilding, and query-ranked scene search
   ([`src/prompt.ts`](../src/prompt.ts#L295-L331)). The default recency-first
   scene path ignores the query. Directions such as `continue` or `go on` can
   contain little character, location, or lore signal.

### Useful OpenClaw pattern

OpenClaw's optional `active-memory` extension includes a query builder that
uses tightly bounded recent context and, in its configured short-query path,
prepends bounded prior user context
([active-memory query](https://github.com/openclaw/openclaw/blob/f1e996068d8dd03c2c577a9fb37a19995ffdc1f7/extensions/active-memory/query.ts#L19-L84),
[short-query enrichment](https://github.com/openclaw/openclaw/blob/f1e996068d8dd03c2c577a9fb37a19995ffdc1f7/extensions/active-memory/query.ts#L138-L163)).

### Recommended Mnemosyne adaptation

First expose OpenChronicle's existing `mode`, `phrase`, `compact`, and
`pinnedLimit` options and preserve its relevance metadata through
`ContextPlan`. `pinnedLimit` caps the number of pinned results floated ahead;
zero disables that float but does not hide pinned memories, which can still
rank normally. Do not interpret an RRF score as probability or confidence.

Use keyword phrase search before exact header comparison during interactive
entity overwrite lookup. This should reduce false creates. It is not an
absolute guarantee for arbitrarily large stories; an eventual exact
`(project, type, name)` OpenChronicle endpoint would be the deterministic
solution.

Then benchmark a bounded query enrichment for low-information directions:

1. Leave information-rich directions unchanged.
2. Select validation-safe recent scenes using the configured scene strategy.
3. Append only the newest scene name and a small tail excerpt to character,
   location, lore, and worldbuilding queries.
4. Keep scene selection itself deterministic and initially rank scenes using
   the raw direction.
5. Do not call another LLM to rewrite the query.

### Guardrails and acceptance proof

- Benchmark vague and explicit directions separately.
- Measure unwanted persistence of characters or locations that have exited
  the scene.
- Cap both entry count and excerpt characters.
- Validation-error scenes never enrich a query.
- Phrase lookup receives regression coverage for an exact-name entry outside
  the original hybrid result window.

## 6. Provenance-bound current-state proposals

### Why this is a real need

The ratified Living Canon Standard already calls for extracting injuries,
relationship and knowledge changes, promises, custody, location damage,
aftermath, and hook transitions after consequential scenes
([LIVING_CANON_STANDARD.md](LIVING_CANON_STANDARD.md#8-scene-consequence-and-current-state)). It also
states that recency is not authority and requires provenance for durable
claims
([LIVING_CANON_STANDARD.md](LIVING_CANON_STANDARD.md#1-canon-authority)).

That standard ratifies an editorial requirement for curated references and
polish passes; it does not ratify a new MCP tool. It motivates a prototype
workflow, not a committed runtime feature.

The risk is equally concrete: `mnemo_continue` saves a generated beat before
its advisory validation, and keeps the scene if validation fails
([`src/tools/continue.ts`](../src/tools/continue.ts#L206-L270)). An automatic
post-turn promotion could therefore elevate an invalid or hallucinated scene
before a human has reviewed it.

### Useful OpenClaw pattern

OpenClaw's memory-consolidation design separates machine state, source
preimages, and human-visible output. Consolidated rewrites require structural
validation; eligible candidates that cannot be consolidated can still fall
back to append-only promotion
([dreaming stages](https://github.com/openclaw/openclaw/blob/f1e996068d8dd03c2c577a9fb37a19995ffdc1f7/docs/concepts/dreaming.md#L31-L66)).
Candidates retain source lineage, rehydrate source material, and reject
rewrites that lose provenance or violate thresholds
([dreaming safeguards](https://github.com/openclaw/openclaw/blob/f1e996068d8dd03c2c577a9fb37a19995ffdc1f7/docs/concepts/dreaming.md#L57-L95),
[memory provenance](https://github.com/openclaw/openclaw/blob/f1e996068d8dd03c2c577a9fb37a19995ffdc1f7/docs/concepts/memory-provenance.md#L68-L99),
[append-only fallback](https://github.com/openclaw/openclaw/blob/f1e996068d8dd03c2c577a9fb37a19995ffdc1f7/extensions/memory-core/src/short-term-promotion-apply.ts#L566-L574)).

The useful transfer is provenance-bound candidate staging. OpenClaw's
automatic consolidation and promotion policy is not suitable for authored
canon.

### Recommended Mnemosyne adaptation

Make state extraction explicit and review-only. A user selects one or more
scene memory IDs and receives proposals, not writes. Each proposal should
contain:

- stable candidate ID;
- source scene `memory_id` and optional `updated_at`;
- a visible literal evidence excerpt plus a freshness fingerprint derived from
  available timestamp and content data;
- target type/name and existing target ID/version when found;
- consequence dimension;
- truth tier: established/revised canon, open possibility, or attributed
  in-world belief;
- proposed `add`, `merge`, or `supersede` operation.

Validate story ownership, source freshness, literal evidence, exact target
resolution, and candidate uniqueness. The user accepts candidates
individually. A later apply operation requires a new OpenChronicle
compare-and-set/precondition contract, or an equivalent checked write, because
the current entity-save path cannot guarantee optimistic concurrency
([OpenChronicle update contract](https://github.com/CarlDog/openchronicle-mcp/blob/68a4eebd947963d4aa87ae1470bd0ff4d06e0774/src/openchronicle/interfaces/mcp/tools/memory.py#L263-L280)).

The current-state record is a derivative index that points to authoritative
entities and cites its source scenes. It never replaces or deletes source
history.

### Guardrails and acceptance proof

- No silent extraction after every continuation.
- `validation:errors` scenes are ineligible; untagged scenes are visibly
  unvalidated and require affirmative review.
- Repetition, relevance, and recency do not promote a claim's truth tier.
- A stale source or changed target rejects apply and requires regeneration or
  review.
- Extraction and apply are separate operations; extraction performs no write.

## 7. Supporting operational safety

These changes are not product features, but they are prerequisites for safely
adding the run and context contracts above.

### Privacy-safe logging

Tool invocation currently logs every argument at info: each long top-level
string is truncated to 200 characters, while short strings and non-string
values remain complete. Debug logs the complete argument object
([`src/tools/helpers.ts`](../src/tools/helpers.ts#L17-L64)). For a private
storytelling server, particularly one designed for mature material, narrative
prose should not be normal telemetry.

Log tool/run/story IDs, field lengths, counts, provider/model, phases, and
terminal outcome. Remove prose from default info and debug logs, or require an
explicit short-lived content-debug opt-in. Add final-sink exact-secret and
sensitive-key redaction, following the defense-in-depth placement used by
OpenClaw
([logging sink](https://github.com/openclaw/openclaw/blob/f1e996068d8dd03c2c577a9fb37a19995ffdc1f7/src/logging/subsystem.ts#L275-L301)).

Narrative exposure is present today. Secret exposure is a defense-in-depth
risk; current provider code generally avoids deliberately logging
authorization headers.

### Runtime ownership

Add one owner for admission and shutdown:

1. gate new admission and initiate listener close immediately;
2. drain active work for a bounded grace period;
3. abort phases where cancellation is safe;
4. close MCP sessions, provider clients, and OpenChronicle;
5. await listener closure before shutdown completes.

Make companion connection initialization single-flight with a shared
`connectPromise`. Source permits concurrent first-connect attempts today, but
SDK failure behavior should be pinned with a test before calling it a
production incident.

### OpenChronicle retry safety

The client currently retries every error whose message matches `rate limit`,
including mutating operations
([`src/oc-client.ts`](../src/oc-client.ts#L131-L169)). In the pinned
OpenChronicle implementation, HTTP rate limiting rejects a request before
handler dispatch
([rate-limit middleware](https://github.com/CarlDog/openchronicle-mcp/blob/68a4eebd947963d4aa87ae1470bd0ff4d06e0774/src/openchronicle/interfaces/api/middleware/rate_limit.py#L38-L61)),
which makes that specific retry safe. Mnemosyne should make this dependency
explicit: prefer structured rate-limit detection, classify operations, and
retry a mutating call only when the error proves pre-handler rejection.
Backoff must accept the run cancellation signal.

### Atomic local configuration

The current-story pointer uses direct read-modify-write JSON operations
([`src/config.ts`](../src/config.ts#L95-L115)). Serialize mutations in-process,
write a validated temporary sibling, and atomically rename it. This addresses
a crash/concurrent-read risk; no corrupted configuration incident was found.
Do not introduce a configuration database or journal.

### Test boundaries

Split pure/unit and live-provider suites. Unit tests can use shorter timeouts
and parallel execution; real OpenChronicle/Ollama/provider tests should remain
environment-gated and one-worker. The boundary tests below should land with
their corresponding change rather than collect in a later test-only project:

- overlapping same-story continuations;
- reuse of an idempotency key with a different request payload;
- run-registry TTL and capacity eviction;
- cancellation while queued, gathering, generating, and before saving;
- post-dispatch companion timeout/cancellation;
- cancellation during a dispatched OpenChronicle save producing an unknown
  canonical-write outcome;
- shutdown with queued and active work;
- prompt admission at and beyond a known window;
- narrative and secret redaction;
- OpenChronicle retry backoff cancellation and a mutating retry proven to be a
  pre-handler rejection;
- an allowed `Host` combined with a disallowed `Origin`;
- initializing HTTP sessions counting toward the capacity limit.

Do not claim a test-suite speedup until it is measured.

## Conditional findings

### Illustration and media jobs

The ratified asset and sidecar conventions in
[DATA_LAYOUT.md](DATA_LAYOUT.md) provide a home for durable visual references.
Asynchronous generation remains an unratified, unstarted, and unscheduled
proposal in
[ILLUSTRATION_INTEGRATION.md](ILLUSTRATION_INTEGRATION.md), and the Atlas MCP
deployment contemplated there has been decommissioned
([`STATUS.md`](../STATUS.md)). If that work is reopened after an actual media
provider/deployment is selected and verified, borrow OpenClaw's
provider-independent media request/result shape and immediate job identity
([image-generation types](https://github.com/openclaw/openclaw/blob/f1e996068d8dd03c2c577a9fb37a19995ffdc1f7/src/image-generation/types.ts#L52-L143),
[background result](https://github.com/openclaw/openclaw/blob/f1e996068d8dd03c2c577a9fb37a19995ffdc1f7/src/agents/tools/media-generate-background-shared.ts#L419-L455)).

A minimal `MediaJob` would bind story, scene, request hash, provider/model,
provider job ID, status, progress, error, and eventual artifact reference. It
should map into the existing sidecar schema in
[DATA_LAYOUT.md](DATA_LAYOUT.md), not create a competing artifact model.

Before implementation, resolve the existing ownership conflict: unratified Web
UI notes describe the server writing art, while the ratified data-layout
standard says the server does not write `canon/`, `references/`, or `art/`.
That requires an ADR. No generic worker or approval platform is justified for
a one-image first slice.

### Stale-aware beat proposals

The Web UI notes record real pain from bad auto-saved beats and discuss beat
variants. If variants become scheduled, bind a draft to the exact context and
scene revision that produced it. Applying it after the story frontier changes
should report a stale proposal rather than silently append it. This deserves a
separate ADR and depends on structured context IDs; it is not part of the run
registry.

### Remote HTTP deployment hardening

The current default is loopback and bearer authentication is available. The
current `hostAllowed` flow can accept an allowed `Host` before independently
checking a present `Origin`
([`src/api-security.ts`](../src/api-security.ts#L28-L42),
[`src/shared/http-transport.ts`](../src/shared/http-transport.ts#L62-L77)).
Before Docker or another non-loopback deployment, require an explicit
authentication decision, validate `Host` independently, and match a present
browser `Origin` against a full-origin allowlist including scheme, host, and
port. Cap active and initializing HTTP sessions. Reverse-proxy trust is a
future ingress design choice, not an existing trusted-proxy identity
mechanism. These are deployment gates, not blockers for current
stdio/default-loopback use.

## Explicit non-adoptions

| OpenClaw capability | Decision | Reason |
|---|---|---|
| Gateway/control plane and durable task ledger | Reject | Mnemosyne has one focused server and thin REST adapters; it does not coordinate devices, channels, or general tools. |
| Plugin/extension SDK, manifests, installs, and hot reload | Reject | Seven built-in providers do not justify third-party code loading or a marketplace. |
| Skills runtime | Reject | Typed story entities are the instruction plane; skills would create a second source of truth and cross-story bleed risk. |
| SQLite/vector/BM25 memory stack | Reject | OpenChronicle already owns canonical storage and hybrid retrieval. |
| Transcript compaction/context-engine plugin | Reject for current architecture | A continuation is a self-contained story operation whose beat is saved. Revisit only if Mnemosyne gains an owned durable multi-turn transcript or tool-calling agent loop. |
| Autonomous dreaming or memory promotion | Reject | Authored canon cannot be promoted by recurrence, relevance, or recency. |
| MMR, temporal decay, and generic importance scoring | Defer pending evidence | Relationship overlap can be useful and stable canon must not decay. Add only if assembly telemetry demonstrates harmful duplication. |
| Messaging-channel abstraction | Reject | Kindroid and Botify are generator backends with external side effects, not interchangeable delivery channels. |
| General multi-agent or one-agent-per-character runtime | Reject | One shared provider invocation and advisory validation avoid separate per-character agent state. A Kindroid group invocation may already contain multiple upstream turns. |
| Wall-clock cron/heartbeat story progression | Reject | Mnemosyne's recorded need is story-relative position and elapsed time, not wall-clock task scheduling. |
| Voice/TTS | Reject for current scope | The missing story-specific problem is speaker segmentation and voice casting; no current use case justifies it. |
| Automatic provider failover/retry | Reject | It can double-bill direct providers or duplicate companion-chat mutations. |
| Distributed locks | Reject for current deployment | There is no multi-replica contract. An in-process story lane is sufficient and honest. |
| Generic approval platform | Reject for now | Domain-specific immutable proposals are enough if a second concrete approval use case appears. |
| Full metrics/tracing/security-audit platform | Defer pending consumer | A run ID and structured outcomes solve current correlation needs without an unused operations stack. |
| Content keyword classifier | Reject | The existing content-routing proposal deliberately uses explicit story/provider declarations and remains unratified. |

## Candidate sequence if separately ratified

This is an implementation-dependency ordering for evaluating future decisions,
not a parallel roadmap. No slice below is scheduled by this assessment.

### Candidate slice A — correctness spine

1. Add typed replay-safety outcomes and preserve them through MCP, REST, UI,
   and logs.
2. Add the per-story continuation lane and run ID.
3. Propagate cancellation and make companion post-dispatch ambiguity explicit.
4. Add admission/shutdown ownership and single-flight companion connection.
5. Remove narrative content from default logs.
6. Turn an Ollama request plan estimated above the configured context cap into
   a pre-dispatch error.

This slice should land as small independent changes, not one cross-cutting
rewrite.

### Candidate slice B — context capability

1. Add the minimum model-aware capability resolver needed to distinguish a
   known context limit from `unknown`.
2. Preserve structured retrieval entries and OpenChronicle relevance.
3. Build the pure `ContextPlan` and deterministic admission policy.
4. Return a compact assembly manifest.
5. If separately ratified, implement the proposed Web UI assembly panel.
6. Add provider budget enforcement only when capability metadata is reliable.

### Candidate slice C — provider and retrieval maturity

1. Complete generator capabilities and capability-aware Web UI controls.
2. Expose OpenChronicle search mode/phrase/compact/pinned options.
3. Improve exact-name overwrite lookup.
4. Benchmark bounded vague-direction enrichment.
5. Complete OpenChronicle retry and unit/live-suite refinements.

### Candidate slice D — reviewed living state

Prototype provenance-bound state-delta extraction and individual review. Do
not add an apply path until proposal validation and staleness behavior are
proven against real story material.

### Conditional candidate — media

Resolve artifact ownership and select and verify an actual media
provider/deployment first. Only then design a provider-neutral async job
envelope and immutable cost/consent proposal.

## Audit method and limitations

The audit compared OpenClaw's memory/context, runtime, provider, reliability,
security, testing, UI, extension, automation, media, and multi-agent code with
Mnemosyne's actual implementation, locked architecture, current status, Web UI
notes, Living Canon Standard, and OpenChronicle API.

The OpenClaw clone was clean at the pinned commit. Its dependencies were not
installed and its test suite was not executed; this was a static source and
architecture assessment. Mnemosyne was not modified during the audit. Upstream
behavior described here is therefore grounded in source contracts and tests,
not an independent live deployment verification.

The recommendations deliberately distinguish source-demonstrated risks from
observed incidents. Where no production incident was found—same-story
concurrency, Botify timeout ambiguity, concurrent first connection, local
config corruption, or remote session exhaustion—the text says so.

## Re-evaluation triggers

Revisit rejected or deferred patterns only when one of these becomes true:

- Mnemosyne supports multiple server processes or replicas.
- A third party needs to install providers without changing this repository.
- Mnemosyne becomes a messaging delivery hub rather than a story operation
  server.
- Retrieval telemetry proves harmful redundancy that existing type, pin, and
  relevance controls cannot solve.
- Illustration or beat-variant work is formally scheduled.
- A non-loopback deployment has an identified operator and threat model.
- Spoken-story playback has a concrete speaker-casting design and user.

Until then, the narrow contracts above provide the useful part of OpenClaw
without importing its product surface.
