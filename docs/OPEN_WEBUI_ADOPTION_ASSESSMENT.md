# Open WebUI Adoption Assessment

**Status:** Completed comparative research, recorded 2026-08-27;
recommendations are unratified. This document does not schedule work, change
locked architecture, or reopen deferred scope. [STATUS.md](../STATUS.md)
remains the source of current priority. A proposal that changes a locked
decision in [ARCHITECTURE.md](ARCHITECTURE.md) still requires its own design
review.

**Upstream snapshot:**
[`open-webui/open-webui@d3e8bf3`](https://github.com/open-webui/open-webui/tree/d3e8bf3405e848cfba377814d0aa7ba7290e414d),
tag `v0.11.1`, commit date 2026-08-25. The audit clone is a clean, shallow
working copy at `D:\GitHub\open-webui`. All Open WebUI source links below are
pinned to that commit so the assessment remains reproducible as upstream
changes.

**Mnemosyne snapshot:** `cfd9d7f4597d862314c78466f344f8118040016e`.
The Mnemosyne worktree already contained unrelated in-progress edits when this
review began; none were modified for this assessment. Relative Mnemosyne
source links below refer to that snapshot, not HEAD — later changes (notably
the 2026-08-28 `src/index.ts` split and the §6 accessibility fixes) have
moved some cited code.

**Method:** Static source, dependency, documentation, license, and integration
review. Open WebUI was not installed or run, and no live compatibility claim is
made. No Open WebUI code has been copied into Mnemosyne.

## Decision summary

Open WebUI is useful to Mnemosyne in two distinct ways, neither of which is a
fork:

1. as a **separately deployed, optional evaluation host** for Mnemosyne's
   existing Streamable HTTP MCP or REST surface; and
2. as a **pattern library** for a few small contracts that address needs
   already present in Mnemosyne.

It is not a sensible dependency, replacement frontend, provider gateway, or
memory layer. At the pinned snapshot, Open WebUI has 5,059 tracked files,
including 259 backend Python files, 661 Svelte components, 81 frontend
TypeScript files, and 62 migration files. Its FastAPI application mounts
routers for models, chats, channels, notes, knowledge, tools, skills, memories,
files, groups, analytics, automations, calendars, and more
([router surface](https://github.com/open-webui/open-webui/blob/d3e8bf3405e848cfba377814d0aa7ba7290e414d/backend/open_webui/main.py#L820-L864)).
Mnemosyne has 135 tracked files and one deliberately narrower responsibility:
continuity-aware story operations while OpenChronicle owns canonical memory.

The useful findings are:

| Track | Recommendation | Rank if ratified | Novelty in Mnemosyne |
|---|---|---:|---|
| Optional host | Run a bounded Open WebUI compatibility spike, first with native MCP and then, only if useful, a tiny audited Pipe | High-value experiment | New integration option; no core architecture change |
| Provider telemetry | Preserve provider-reported token, cache, and timing usage through generation and validation | Medium-high | New concrete gap; stage timing already exists |
| Continuation UX | Add a small recoverable run/event contract for the native Web UI | High | Corroborates the existing OpenClaw run-integrity candidate |
| Beat alternatives | Add noncommitting, stale-aware beat proposals only for providers that can generate without external side effects | Conditional | Strengthens an already recorded Web UI need |
| Accessibility | Harden focus visibility and asynchronous announcements in the current React UI | Low-risk | New source-grounded polish on an existing surface |

Open WebUI's provider capability metadata, context/source inspection, and
background media contracts reinforce recommendations already documented in
[OPENCLAW_ADOPTION_ASSESSMENT.md](OPENCLAW_ADOPTION_ASSESSMENT.md). They are not
counted again as newly discovered work.

In this document, **adopt** means reimplement the smallest useful contract in
Mnemosyne's vocabulary. **Integrate** means run an independently versioned Open
WebUI instance outside Mnemosyne. Neither term means copying an upstream
subsystem.

## Assessment filters

Every recommendation had to pass these tests:

1. **A real consumer exists.** The feature answers a current code path,
   recorded incident, explicit design note, or credible near-term integration.
2. **Ownership stays intact.** OpenChronicle remains canonical memory;
   Mnemosyne remains the storytelling layer; companion services continue to
   own their external conversations.
3. **Canon safety wins.** A generic chat convenience cannot silently alter,
   duplicate, or misrepresent saved narrative state.
4. **The first slice is small.** A typed result, in-process registry, SSE
   endpoint, or audited adapter is preferable to importing a platform.
5. **Existing recommendations are named as corroboration.** The review does
   not inflate its value by relabeling already documented needs as new.

## 1. Repository profile and architectural fit

### What Open WebUI actually is

Open WebUI is a self-hosted, multi-user AI application rather than a reusable
chat widget. Its backend depends on FastAPI, async SQLAlchemy, Redis, MCP,
OpenAI, Anthropic, Google GenAI, LangChain, Chroma, Qdrant, Weaviate, Milvus,
and a much wider document/media stack
([Python dependencies](https://github.com/open-webui/open-webui/blob/d3e8bf3405e848cfba377814d0aa7ba7290e414d/pyproject.toml#L8-L68),
[vector-store dependencies](https://github.com/open-webui/open-webui/blob/d3e8bf3405e848cfba377814d0aa7ba7290e414d/pyproject.toml#L158-L166)).
Its frontend combines Svelte 5, Tailwind, CodeMirror, ProseMirror, charts,
Socket.IO, collaborative editing, and other application-scale dependencies
([frontend dependencies](https://github.com/open-webui/open-webui/blob/d3e8bf3405e848cfba377814d0aa7ba7290e414d/package.json#L25-L47),
[editor and realtime dependencies](https://github.com/open-webui/open-webui/blob/d3e8bf3405e848cfba377814d0aa7ba7290e414d/package.json#L89-L153)).

Some central files reflect that breadth: the pinned
`backend/open_webui/utils/middleware.py` is 6,335 lines, `main.py` is 3,039
lines, and the main chat component is 4,663 lines. Those are not defects by
themselves; they are evidence that Open WebUI solves a different-sized
problem. Transplanting its chat pipeline would add more lifecycle, persistence,
authorization, and upgrade obligations than Mnemosyne's complete current
surface.

### What Mnemosyne should preserve

Mnemosyne's current boundaries are valuable:

- OpenChronicle owns canonical memories; Mnemosyne does not need a second chat,
  vector, or memory database.
- `continueScene` owns one shared gather → generate → save → validate flow for
  MCP and REST
  ([`src/tools/continue.ts`](../src/tools/continue.ts#L114-L130)).
- The native Web UI is a thin React client over story-aware REST rather than a
  generic model console.
- Direct providers and companion providers have materially different side
  effects. Kindroid and Botify cannot safely be treated as stateless model
  aliases.
- The v0 `mnemo_continue` contract auto-saves a nonempty beat. A generic chat
  history must not become an alternative source of truth.

The fit is therefore at the edges and at the contract level, not at the
framework level.

### Audit limitations that affect adoption confidence

The pinned checkout contains two conventional `.test.ts` files and no
checked-in backend test suite found by the repository inventory. A third
test-named path is a binary image-generation fixture. This observation does
not prove that upstream lacks external or private testing, but it means the
clone is not a test architecture to emulate. Any borrowed behavior needs
Mnemosyne-native contract tests.

The clone is shallow. That is sufficient for a pinned source audit, but not
for tracing the license provenance of individual lines across the repository's
multi-license history. The licensing consequence is covered below.

## 2. Optional Open WebUI host integration

### Why this is a real opportunity

Mnemosyne already exposes a hardened Streamable HTTP MCP endpoint at `/mcp`
and an equivalent story-aware REST continuation route. Open WebUI natively
connects to Streamable HTTP MCP servers. Its client forwards headers, lists
tools, calls them, and preserves MCP error results
([MCP client](https://github.com/open-webui/open-webui/blob/d3e8bf3405e848cfba377814d0aa7ba7290e414d/backend/open_webui/utils/mcp/client.py#L59-L123)).
Its connection flow performs access checks and can restrict the exposed tool
specifications with a function-name filter
([connection and filtering](https://github.com/open-webui/open-webui/blob/d3e8bf3405e848cfba377814d0aa7ba7290e414d/backend/open_webui/utils/middleware.py#L2311-L2358));
the admin UI also exposes custom headers and that filter
([connection controls](https://github.com/open-webui/open-webui/blob/d3e8bf3405e848cfba377814d0aa7ba7290e414d/src/lib/components/AddToolServerModal.svelte#L971-L1007)).

That creates a low-cost way to evaluate Mnemosyne through a mature chat shell
without changing Mnemosyne first. It could answer concrete questions:

- Are Mnemosyne's MCP descriptions sufficient for a tool-calling host model?
- Which story operations remain understandable outside the bespoke UI?
- Does human approval around a canon-committing tool reduce accidental calls?
- Is a generic chat surface useful for diagnostic or operator workflows even
  though it is not the final storytelling interface?

### Integration choices

| Option | What it does | Decision |
|---|---|---|
| Native MCP connection | Open WebUI discovers and exposes selected `mnemo_*` tools to a host model | Run as a compatibility and read-path spike |
| Small Pipe Function | A separately maintained Open WebUI Pipe calls Mnemosyne's existing REST continuation route and returns the exact beat as its model output | Consider only if the native MCP spike is useful but response rewriting is unacceptable |
| OpenAPI tool server | Publish and maintain an OpenAPI contract for the existing REST API | Defer; one optional host is not enough reason to add another public contract |
| Fork/replace the native UI | Rebuild Mnemosyne inside Open WebUI's frontend and backend | Reject |
| Use Open WebUI as the LLM gateway | Route Mnemosyne's seven providers through Open WebUI | Reject |

### Native MCP spike

Open WebUI's documented setup is admin-added Streamable HTTP MCP. Its own UI
labels MCP support experimental
([warning](https://github.com/open-webui/open-webui/blob/d3e8bf3405e848cfba377814d0aa7ba7290e414d/src/lib/components/AddToolServerModal.svelte#L1011-L1028)),
so the integration should pin `v0.11.1` or a container digest rather than track
`main`. The [official MCP guide](https://docs.openwebui.com/features/extensibility/mcp/)
also describes the connection as admin-managed and Streamable HTTP-only.

The first experiment should:

1. run Open WebUI as a separate service with its normal branding intact;
2. connect to `http(s)://<mnemosyne-host>:<port>/mcp` with Mnemosyne's bearer
   token in an `Authorization` header;
3. include the target hostname in `MCP_ALLOWED_HOSTS` and keep Mnemosyne off a
   public interface unless its existing security requirements are met;
4. expose only `mnemo_story_list`, `mnemo_list_entities`, `mnemo_recall`,
   `mnemo_validate`, and, for the deliberate write test, `mnemo_continue`;
5. exclude `mnemo_story_use`, import, save, delete, bulk revalidation, and
   export from the first allowlist;
6. pass an explicit `story` override on every tool call rather than relying on
   the process-wide current-story pointer; and
7. start with a disposable story and a direct stateless generator, not
   Kindroid or Botify.

The explicit-story rule is important. Mnemosyne persists one
`current_story_id` in local operational config
([`src/config.ts`](../src/config.ts#L1-L17),
[`src/config.ts`](../src/config.ts#L111-L129)). Open WebUI is multi-user, but
that does not make Mnemosyne's active-story pointer user-scoped. A shared Open
WebUI deployment using `mnemo_story_use` could switch the story underneath
another user. The spike is therefore single-operator or explicit-story-only;
it is not evidence of multi-user readiness.

Human tool approval in Open WebUI is useful defense in depth for the
canon-committing `mnemo_continue`, but it does not replace the allowlist or
Mnemosyne's own typed outcome semantics. A model should never receive
`mnemo_delete_entity` merely because the host can ask before invoking it.
The capability is present in the pinned release
([changelog](https://github.com/open-webui/open-webui/blob/d3e8bf3405e848cfba377814d0aa7ba7290e414d/CHANGELOG.md#L8-L13)).

### Critical timeout and retry constraint

Open WebUI creates an `httpx.AsyncClient` with an explicit timeout only when
the caller supplies one or `AIOHTTP_CLIENT_TIMEOUT_TOOL_SERVER` resolves to a
value
([timeout construction](https://github.com/open-webui/open-webui/blob/d3e8bf3405e848cfba377814d0aa7ba7290e414d/backend/open_webui/utils/mcp/client.py#L21-L43)).
The environment setting falls back to the general client timeout, which is
`None` when unset
([general timeout](https://github.com/open-webui/open-webui/blob/d3e8bf3405e848cfba377814d0aa7ba7290e414d/backend/open_webui/env.py#L593-L597),
[tool timeout](https://github.com/open-webui/open-webui/blob/d3e8bf3405e848cfba377814d0aa7ba7290e414d/backend/open_webui/env.py#L671-L679)).
In that case `httpx` applies its own comparatively short default. Mnemosyne's
Ollama call alone permits five minutes, and a continuation can include both
generation and validation.

For the spike, set `AIOHTTP_CLIENT_TIMEOUT_TOOL_SERVER` explicitly to a value
above the tested end-to-end continuation bound, initially 900 seconds, and
measure actual behavior. This is not permission to retry after the timeout.
Kindroid already documents that a timeout can follow a successful remote
mutation
([`src/kindroid-client.ts`](../src/kindroid-client.ts#L86-L150)). A host retry
could post the direction twice, generate a second external turn, and save a
second scene. Until Mnemosyne has the typed run outcomes described in the
OpenClaw assessment, a timeout after dispatch is an inspection event, not a
retry cue.

### Native MCP output is not a canonical reading surface

With normal tool calling, the host model sees the MCP result and then writes
the assistant response. It may summarize, omit, or restyle the generated beat.
`mnemo_continue`, however, has already saved the exact `beat_text` before the
host model speaks. The prose visible in the chat can therefore differ from
canon even though the raw tool result is correct.

That makes native MCP appropriate for discovery, diagnostics, read operations,
and a bounded compatibility test. It is not suitable as Mnemosyne's authoring
surface unless the user verifies the raw tool result or the host provides an
exact-output path.

### Exact-output Pipe, if the spike earns it

Open WebUI's Pipe Functions appear as selectable models and can handle a
request without another LLM backend. A Pipe can also expose a manifold of
selectable models
([official Function overview](https://docs.openwebui.com/features/extensibility/plugin/functions/),
[Pipe guide](https://docs.openwebui.com/features/extensibility/plugin/functions/pipe/)).
A minimal Mnemosyne Pipe could therefore:

- expose one selectable entry per story;
- treat the last user message as the direction;
- call the existing `POST /api/stories/:id/continue` route asynchronously;
- return `beat_text` verbatim as the model response; and
- render save, validation, and `memory_id` metadata in a small, clearly
  separated footer.

This adapter should remain small, pinned, and separate from Mnemosyne core.
Open WebUI Functions execute arbitrary server-side Python, so only reviewed
code should be installed. The Mnemosyne URL and token belong in Pipe Valves or
deployment secrets, never hard-coded or logged. The adapter should use
`httpx.AsyncClient` with an explicit timeout and must not implement automatic
retries.

The Pipe still does not make Open WebUI the final Mnemosyne UI. It would retain
a second presentation-only chat history, would not provide the entity library,
assembly plan, modes, story frontier, or provenance controls, and would need
maintenance across Open WebUI Function API changes.

### Compatibility-spike acceptance proof

- The clone/image is pinned and the exact version is recorded.
- Unauthorized MCP discovery fails; authorized discovery exposes only the
  configured allowlist.
- Every operation uses an explicit story and leaves the global current-story
  pointer unchanged.
- One read-only tool result is complete and correctly rendered.
- One direct-provider continuation saves exactly one scene; its OpenChronicle
  body matches the raw `beat_text` returned by Mnemosyne.
- A host-model paraphrase is demonstrated and documented, or the host proves
  exact tool-result rendering before native MCP is considered for authoring.
- A deliberately interrupted request does not trigger an automatic retry.
- Kindroid and Botify are not tested until ambiguous outcomes and provider
  capabilities are visible.
- Refresh behavior is measured honestly. Open WebUI's external MCP transport
  streaming is not its native UI event stream
  ([official distinction](https://docs.openwebui.com/features/extensibility/mcp/#when-to-use-mcp-vs-openapi)),
  so a long tool call may remain a spinner.

If these checks reveal no workflow better than the native Mnemosyne UI, stop
there. The spike has still answered the question without creating a permanent
integration.

## 3. Preserve provider-reported usage and timing

### Why this is a real gap

Mnemosyne already records end-to-end stage timing. `continueScene` reports
gather, generate, save, and validate milliseconds
([`src/tools/continue.ts`](../src/tools/continue.ts#L272-L298)), and the Web UI
shows them
([`webui/src/pages/ContinueScenePage.tsx`](../webui/src/pages/ContinueScenePage.tsx#L279-L290)).
Adding another stopwatch is not an Open WebUI lesson.

The missing information is provider usage. `GeneratedBeat` currently carries
only text and Kindroid group telemetry
([`src/llm.ts`](../src/llm.ts#L73-L100)). Ollama parses its JSON into a type
that omits token and duration fields and returns only text
([`src/llm.ts`](../src/llm.ts#L160-L164),
[`src/llm.ts`](../src/llm.ts#L244-L264)). The OpenAI-compatible, Anthropic, and
Gemini providers likewise extract text and discard the rest of each response
([OpenAI-compatible](../src/openai-compat-provider.ts#L99-L120),
[Anthropic](../src/anthropic-provider.ts#L84-L108),
[Gemini](../src/gemini-provider.ts#L94-L116)).

That prevents answers to operationally useful questions:

- Did a weak beat result from an unexpectedly small or truncated input?
- What did generation cost in input/output tokens compared with validation?
- Is Ollama spending time loading, evaluating the prompt, or generating?
- Did Anthropic report cache creation or cache reads?
- Which provider/model gives the best quality per latency and token budget in
  the existing capability benchmarks?

### Useful Open WebUI pattern

Open WebUI normalizes several provider vocabularies to `input_tokens`,
`output_tokens`, and `total_tokens`, preserves provider-specific detail, and
merges usage for multi-call responses
([normalization](https://github.com/open-webui/open-webui/blob/d3e8bf3405e848cfba377814d0aa7ba7290e414d/backend/open_webui/utils/response.py#L13-L47),
[merge](https://github.com/open-webui/open-webui/blob/d3e8bf3405e848cfba377814d0aa7ba7290e414d/backend/open_webui/utils/response.py#L50-L143)).
Its Ollama adapter retains prompt/evaluation counts, durations, and throughput
([Ollama usage](https://github.com/open-webui/open-webui/blob/d3e8bf3405e848cfba377814d0aa7ba7290e414d/backend/open_webui/utils/response.py#L163-L207)).
Normalized usage is stored on each message
([message model](https://github.com/open-webui/open-webui/blob/d3e8bf3405e848cfba377814d0aa7ba7290e414d/backend/open_webui/models/chat_messages.py#L137-L168),
[usage update](https://github.com/open-webui/open-webui/blob/d3e8bf3405e848cfba377814d0aa7ba7290e414d/backend/open_webui/models/chat_messages.py#L215-L264)).

Mnemosyne needs the normalization, not Open WebUI's analytics database.

### Recommended Mnemosyne adaptation

Add an optional provider result envelope:

```ts
interface ModelUsage {
  provider: string;
  model?: string;
  source: "reported" | "estimated";
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  cached_input_tokens?: number;
  cache_creation_input_tokens?: number;
  load_ms?: number;
  prompt_eval_ms?: number;
  generation_ms?: number;
}

interface GeneratedBeat {
  text: string;
  usage?: ModelUsage;
  // existing group telemetry remains unchanged
}
```

The continuation response should keep the two model calls separate:

```ts
usage?: {
  generator?: ModelUsage;
  validator?: ModelUsage;
}
```

Do not blindly merge them. The generator and validator may use different
providers, models, prompts, and cache semantics. Separate values are more
diagnostic and can always be summed by a presentation layer when every needed
field is known.

Provider mappings should initially cover:

- Ollama: `prompt_eval_count`, `eval_count`, `total_duration`,
  `load_duration`, `prompt_eval_duration`, and `eval_duration`;
- OpenAI-compatible: `usage.prompt_tokens`, `completion_tokens`, total, and
  cache detail when returned;
- Anthropic: input/output plus cache-creation and cache-read input tokens;
- Gemini: prompt, candidate, total, and cached-content token counts from
  `usageMetadata`;
- Kindroid and Botify: omit values they do not report.

### Guardrails and acceptance proof

- Unknown values remain absent. They are never converted to a flattering
  zero.
- Provider-reported and locally estimated values are labeled distinctly.
- `total_tokens` is computed only when both input and output are known, unless
  the provider reports it directly.
- Dollar cost is not invented from a baked-in pricing table that will drift.
  Preserve provider-reported cost if one exists; any future local price model
  needs user-owned, versioned configuration.
- Telemetry appears in REST/MCP results and structured logs, not in the saved
  scene body.
- Generator and validator usage remain separate.
- Fixture tests cover missing fields, zeros, cache detail, malformed values,
  and each supported response dialect.
- Existing providers that return only text remain source-compatible through
  optional fields.

This is the clearest genuinely new capability surfaced by the comparison.

## 4. Recoverable continuation runs and incremental events

### Why the comparison strengthens an existing need

The current React page has one `submitting` boolean, calls the synchronous REST
route, and receives one terminal `ContinueResponse`
([`webui/src/pages/ContinueScenePage.tsx`](../webui/src/pages/ContinueScenePage.tsx#L37-L75),
[`webui/src/api/client.ts`](../webui/src/api/client.ts#L86-L90)). A long Ollama
generation or generation-plus-validation therefore remains a spinner. A page
refresh loses the in-browser state even if the server continues and eventually
saves the scene.

The OpenClaw assessment already recommends a per-story continuation lane, run
identity, cancellation, idempotency, and typed ambiguous outcomes
([run contract](OPENCLAW_ADOPTION_ASSESSMENT.md#2-continuation-runs-and-per-story-state-transition-safety),
[failure semantics](OPENCLAW_ADOPTION_ASSESSMENT.md#3-cancellation-idempotency-and-replay-safe-outcomes)). Open WebUI
does not create a second independent need; it provides additional evidence for
the client/recovery side of the same design.

### Useful Open WebUI pattern

Open WebUI assigns task IDs, associates tasks with chat items, retains a
current response snapshot, and can cancel work
([task registry](https://github.com/open-webui/open-webui/blob/d3e8bf3405e848cfba377814d0aa7ba7290e414d/backend/open_webui/tasks.py#L128-L168),
[response snapshots](https://github.com/open-webui/open-webui/blob/d3e8bf3405e848cfba377814d0aa7ba7290e414d/backend/open_webui/tasks.py#L169-L226),
[cancellation](https://github.com/open-webui/open-webui/blob/d3e8bf3405e848cfba377814d0aa7ba7290e414d/backend/open_webui/tasks.py#L229-L263)).
On reload it overlays the in-progress snapshot onto stored chat history
([reload overlay](https://github.com/open-webui/open-webui/blob/d3e8bf3405e848cfba377814d0aa7ba7290e414d/backend/open_webui/routers/chats.py#L62-L85)).
Its response middleware accumulates append-only content, coalesces deltas, and
saves snapshots
([delta and snapshot path](https://github.com/open-webui/open-webui/blob/d3e8bf3405e848cfba377814d0aa7ba7290e414d/backend/open_webui/utils/middleware.py#L4646-L4754)),
while the Svelte client handles status, completion, delta, replacement, error,
and cancellation events
([client events](https://github.com/open-webui/open-webui/blob/d3e8bf3405e848cfba377814d0aa7ba7290e414d/src/lib/components/chat/Chat.svelte#L1193-L1265)).

### Recommended Mnemosyne adaptation

Build this as the HTTP projection of the already proposed continuation-run
core, not as a separate chat-stream subsystem:

- `POST /api/stories/:id/continuations` validates input and returns `202` with
  a `run_id` once accepted;
- `GET /api/continuations/:run_id` returns the latest bounded snapshot;
- `GET /api/continuations/:run_id/events` emits SSE events;
- `DELETE /api/continuations/:run_id` requests cancellation using the typed
  semantics from the run design; and
- the existing synchronous REST and MCP methods await the same run for
  compatibility.

Use a small event vocabulary:

- `run.accepted` and `run.queued`;
- `phase.started` / `phase.completed` for gather, generate, save, and validate;
- optional `beat.delta` only when a provider truly streams;
- `validation.completed`;
- terminal `run.completed`, `run.failed`, `run.cancelled`, or
  `run.outcome_unknown`.

Each event needs a run ID, story ID, monotonic sequence number, timestamp, and
bounded typed payload. The snapshot should retain current phase, the latest
complete beat text available, save identity/error, validation state, and the
terminal outcome. Terminal snapshots expire after a documented TTL and the
registry has a hard capacity.

The first slice should emit phase events without token streaming. All current
Mnemosyne generator calls are nonstreaming. Rewriting every provider to stream
would turn a recoverability improvement into a provider overhaul. Token deltas
can be added per capability later.

### What not to copy

Do not import Socket.IO, Redis, Open WebUI's chat database, or its 6,335-line
response middleware. Mnemosyne currently runs as one focused process and can
start with an in-memory registry plus SSE. Describe it accurately as
single-process recovery: it survives browser refresh and connection loss, not
server restart or multi-replica failover.

If multi-replica deployment becomes real, canon-commit serialization belongs
in an OpenChronicle lease/CAS/frontier contract. Redis task presence would not
by itself prevent two workers from saving competing continuations.

### Acceptance proof

- Phase events are monotonic, bounded, and reconnectable with `Last-Event-ID`.
- Reload during generation reconstructs the current phase and eventual result.
- The final snapshot exactly matches the synchronous response.
- Same-story serialization and different-story concurrency tests from the
  OpenClaw assessment still pass.
- Cancellation before dispatch is retry-safe; cancellation after companion or
  canon dispatch uses typed ambiguous outcomes.
- A disconnected browser does not automatically cancel an already accepted
  canon-committing run.
- TTL and capacity tests prove that snapshots and event buffers cannot grow
  without bound.

## 5. Noncommitting beat proposals, not a chat-history graph

### Why this is a real but conditional need

The Web UI notes record that bad auto-saved beats had to be hand-deleted twice
and explicitly ask for beat variants
([`docs/WEBUI_NOTES.md`](WEBUI_NOTES.md#8-borrowed-patterns)). The OpenClaw assessment
already narrows that into stale-aware proposals bound to an exact context and
scene revision
([proposal note](OPENCLAW_ADOPTION_ASSESSMENT.md#stale-aware-beat-proposals)). Open WebUI adds a
concrete interaction model for preserving alternatives without destroying the
previous response.

### Useful Open WebUI pattern

Open WebUI represents response alternatives with `parentId`, `childrenIds`,
and a `currentId`; it rebuilds and merges the graph instead of overwriting the
old response
([history merge](https://github.com/open-webui/open-webui/blob/d3e8bf3405e848cfba377814d0aa7ba7290e414d/backend/open_webui/models/chats.py#L882-L914),
[upsert](https://github.com/open-webui/open-webui/blob/d3e8bf3405e848cfba377814d0aa7ba7290e414d/backend/open_webui/models/chats.py#L959-L1001)).
The client navigates sibling responses
([sibling selection](https://github.com/open-webui/open-webui/blob/d3e8bf3405e848cfba377814d0aa7ba7290e414d/src/lib/components/chat/Messages.svelte#L199-L240))
and renders an alternative index such as `2/4`
([response navigation](https://github.com/open-webui/open-webui/blob/d3e8bf3405e848cfba377814d0aa7ba7290e414d/src/lib/components/chat/Messages/ResponseMessage.svelte#L929-L1024)).

The transferable idea is “regeneration preserves alternatives.” The full chat
tree is the wrong domain model for Mnemosyne.

### Recommended Mnemosyne adaptation

Keep the locked `mnemo_continue` auto-save behavior unchanged. If variants are
ratified, add a separate proposal path:

1. `propose` gathers context and generates text without saving a scene;
2. the proposal records story ID, provider/model, context hash or admitted
   memory IDs, current frontier scene ID, direction hash, creation time, and a
   content hash;
3. `accept` verifies that the frontier and proposal hash are unchanged and
   saves that exact text once; and
4. a stale proposal remains readable/copyable but cannot silently append to a
   changed story.

A first slice can keep a small bounded set of proposals in the same in-memory
run registry. A client-held alternative is acceptable only if the server
issues an integrity-protected opaque token that binds the content hash and
frontier; a client-supplied hash alone proves nothing. It does not need a local
chat database, nested branches, graph repair, branch merging, or indefinite
history. The UI needs a simple `1 / N` switch, Accept, Discard, and Regenerate.

### Provider side effects are the gating constraint

Only providers that can generate without mutating another persistent
conversation may offer true proposals. Direct Ollama, OpenAI-compatible,
Anthropic, and Gemini calls qualify. Kindroid and Botify do not: producing a
“draft” already advances the external conversation. Showing several sibling
variants would conceal several real remote turns even if only one became
OpenChronicle canon.

The existing provider-capability recommendation should therefore add an
explicit property such as:

```ts
supports_noncommitting_variants: boolean;
external_generation_side_effect: "none" | "conversation_mutation" | "unknown";
```

Unknown is not treated as safe. Companion providers may later support variants
only if their own APIs expose a genuine noncommitting generation or rollback
contract.

### Acceptance proof

- `mnemo_continue` remains backward compatible and auto-saving.
- Proposal generation writes neither OpenChronicle nor an external companion
  conversation.
- Accept saves the selected exact text once and is idempotent.
- Changing the story frontier makes existing proposals stale.
- Kindroid and Botify cannot enter proposal mode under current capabilities.
- Discarding a proposal leaves no canon residue.
- Variants are not represented as canonical scenes until accepted.

This should remain a separate ADR after provider capabilities and structured
context identity exist. Open WebUI demonstrates the interaction; it does not
remove Mnemosyne's domain constraints.

## 6. Targeted accessibility hardening

### Why this is grounded

Open WebUI's recent work includes clear keyboard focus, keyboard-expandable
details, hover actions that also appear on focus, and pressed-state exposure.
The current Mnemosyne UI is small enough to capture those benefits without
copying components
([pinned accessibility changelog](https://github.com/open-webui/open-webui/blob/d3e8bf3405e848cfba377814d0aa7ba7290e414d/CHANGELOG.md#L96-L101)).

The source audit found four concrete gaps:

1. `.card:focus-visible` styles an `<article>` that is not itself focusable;
   the actual links receive focus
   ([card markup](../webui/src/components/EntityCard.tsx#L21-L54),
   [card CSS](../webui/src/styles/global.css#L305-L333)).
2. `.button` has hover styles but no explicit `:focus-visible` treatment
   ([button CSS](../webui/src/styles/global.css#L612-L662)).
3. Entity filter buttons communicate selection visually but omit
   `aria-pressed`
   ([filter component](../webui/src/components/EntityTypeFilter.tsx#L14-L34)).
4. Loading and error states are plain `<div>` elements without `role=status`,
   `role=alert`, or live-region semantics
   ([Loading](../webui/src/components/Loading.tsx#L1-L7),
   [ErrorBanner](../webui/src/components/ErrorBanner.tsx#L1-L13)).

The UI already includes a reduced-motion rule, labels its search input, and
provides visible focus for form fields. This is a focused hardening pass, not a
claim that the entire UI is inaccessible.

### Recommended changes

- Apply `:focus-visible` to actual links and buttons, and use
  `.card:focus-within` for the containing-card treatment.
- Never remove an outline without an equally visible replacement.
- Add `aria-pressed={active === type}` to filter buttons.
- Give loading blocks `role="status"` with polite live announcement and errors
  `role="alert"`.
- Announce continuation phase/result state from the future run contract.
- After a completed continuation, move focus to the result heading only when
  doing so will not disrupt typing or reading position.
- Ensure actions revealed on hover are equally available on keyboard focus.

### Acceptance proof

- A keyboard-only walkthrough reaches every action in logical order.
- Focus is visible on links, filters, form controls, and result actions in
  normal and high-contrast modes.
- A screen reader announces the active filter, loading state, errors, and
  continuation completion.
- Reduced-motion behavior remains intact.
- Automated accessibility checks supplement rather than replace the manual
  walkthrough.

This is independently worthwhile and low risk, but it remains an unratified
recommendation in this research document.

## 7. Findings that corroborate existing work rather than add it

### Provider capability-aware controls

Open WebUI's large model/provider surface reinforces the need to represent
what a provider and model can actually honor. Mnemosyne's current Web UI offers
model, temperature, and maximum-token controls for every provider
([controls](../webui/src/pages/ContinueScenePage.tsx#L183-L240)), while provider
semantics differ. The existing `GeneratorCapabilities` recommendation already
covers override support, sampling, context windows, usage reporting, external
side effects, cancellation, and companion turn behavior
([existing recommendation](OPENCLAW_ADOPTION_ASSESSMENT.md#4-static-generator-capability-descriptors)).

Open WebUI adds no reason to build a dynamic provider marketplace. It simply
strengthens the case for the small built-in descriptor table already proposed.
Usage normalization and `supports_noncommitting_variants` should become two
consumers of that table.

### Inspectable context assembly

Open WebUI displays sources, tool status, and model metadata because generic
RAG and tool use are otherwise opaque. Mnemosyne's corresponding need is more
specific: an inspectable, budgeted `ContextPlan` with OpenChronicle memory IDs,
admission reasons, and provider-visible payload size. That work is already
defined in the OpenClaw assessment. Do not import Open WebUI's knowledge base,
vector stores, document loaders, or citation database to obtain the UI pattern.

### Media job envelopes

Open WebUI has extensive image, audio, and file infrastructure. Mnemosyne's
illustration work remains conditional, and its asset/sidecar ownership rules
already exist. If media is reopened, use the provider-independent `MediaJob`
shape already described in the OpenClaw assessment. Open WebUI's image studio,
voice stack, file database, and background workers do not become prerequisites.

### Human approval

Open WebUI's generic tool approval is useful at the optional host boundary.
Mnemosyne core should continue to express domain actions explicitly:
noncommitting proposal, stale check, accept, delete confirmation, and typed
outcome. A general pause-and-approve engine would be broader and less precise
than the known story operations.

## 8. Explicit non-adoptions

| Open WebUI capability | Decision | Reason |
|---|---|---|
| Fork or vendor the application | Reject | The stack, upgrade surface, custom license, and multi-user platform are disproportionate to a focused story engine |
| Replace the native React UI | Reject | Open WebUI lacks Mnemosyne's entity library, canon provenance, modes, assembly plan, and story-specific controls |
| Open WebUI chat history as canon | Reject | It would create a second truth beside OpenChronicle and can store host-model paraphrases rather than the exact saved beat |
| Memories, RAG, knowledge bases, vector stores | Reject | They duplicate OpenChronicle ownership and introduce conflicting retrieval semantics |
| Open WebUI as provider gateway | Reject | Mnemosyne already has seven provider integrations and needs their exact side-effect/error semantics, not another transforming hop |
| Plugin/Function runtime in Mnemosyne core | Reject | Arbitrary Python loading and a marketplace are unnecessary; an optional audited Pipe stays outside core |
| Multi-user accounts, RBAC, SSO, SCIM, groups | Reject now | No current Mnemosyne requirement justifies identity and tenant isolation; the global active-story pointer is not multi-user safe |
| Channels, social messaging, notifications | Reject | Story generation is not a team chat product |
| Automations and wall-clock calendar | Reject | Mnemosyne's credible temporal need is a story-relative clock and living canon, not a general scheduler |
| Open WebUI context compaction | Reject | It summarizes generic transcripts; Mnemosyne assembles authoritative story context from OpenChronicle |
| Full branching chat graph | Reject | Beat proposals need a bounded alternative set tied to a story frontier, not indefinite nested conversation history |
| Multi-model arena as a production feature | Defer | Comparing direct providers becomes useful only after noncommitting proposals; it is unsafe for companion providers today |
| Web search and document ingestion in generation | Reject now | No current canon workflow requires uncontrolled external retrieval |
| Voice, video calls, PWA/offline shell | Reject now | No recorded need outweighs the surface and maintenance cost |
| Redis/Socket.IO/distributed task system | Reject now | A bounded in-process run registry and SSE meet the current single-process need |
| Open WebUI's test posture | Do not emulate | The pinned source inventory does not provide a backend test suite to reuse; Mnemosyne needs its own contract tests |

The table deliberately says “now” where a future requirement could change the
answer. It does not invent such a requirement in order to keep an upstream
feature alive.

## 9. License and upstream-risk boundary

The pinned repository is not simply MIT. Its root
[`LICENSE`](https://github.com/open-webui/open-webui/blob/d3e8bf3405e848cfba377814d0aa7ba7290e414d/LICENSE)
is the Open WebUI License, including a branding restriction with exceptions
for deployments at or below 50 users in a rolling 30-day period, written
permission, or an enterprise license. Its
[`LICENSE_NOTICE`](https://github.com/open-webui/open-webui/blob/d3e8bf3405e848cfba377814d0aa7ba7290e414d/LICENSE_NOTICE)
describes three historical license bands: MIT before one commit, BSD-3-Clause
through another, and the current license for later contributions or
modifications. `pyproject.toml` classifies the package as
`License :: Other/Proprietary License`
([classifier](https://github.com/open-webui/open-webui/blob/d3e8bf3405e848cfba377814d0aa7ba7290e414d/pyproject.toml#L130-L137)).
Open WebUI's [official license explanation](https://docs.openwebui.com/license/)
likewise dates the branding clause to v0.6.6 and identifies v0.6.5 and earlier
as BSD-3-Clause.

Practical boundary:

- Running an unmodified, separately branded Open WebUI instance for a spike is
  different from incorporating its source into Mnemosyne.
- Do not copy current Open WebUI components or backend modules into Mnemosyne
  based on an assumption that the repository is uniformly MIT/BSD.
- Reimplement the small contracts described here from requirements and tests,
  in Mnemosyne's own code and vocabulary.
- Any distributed or rebranded Open WebUI deployment must be reviewed against
  the exact license in the chosen version.
- Because this audit used a shallow clone, it did not attempt per-line
  historical provenance analysis.

This section is an engineering risk assessment, not legal advice.

Upstream evolution is a separate risk. MCP is explicitly marked experimental,
and Functions are a powerful internal extension surface. Pin an exact release
or image digest, keep an integration test for tool discovery and one read call,
and upgrade deliberately. A compatibility spike should never depend on
Open WebUI `main`.

## 10. Recommended sequence if items are ratified

This is dependency order, not a schedule.

### Slice A — compatibility experiment

1. Run pinned Open WebUI separately.
2. Connect native MCP with strict allowlist, bearer authentication, explicit
   story IDs, and a 900-second measured tool timeout.
3. Test read operations, then one disposable direct-provider continuation.
4. Record response rewriting, refresh, cancellation, and timeout behavior.
5. Stop if no workflow is better than the native UI.
6. Only if exact output would make the host genuinely useful, write and audit
   the minimal REST Pipe.

### Slice B — telemetry and accessibility

1. Add the optional `ModelUsage` envelope and provider response fixtures.
2. Preserve generator and validator usage separately through core, MCP, REST,
   logs, and UI.
3. Add the focused keyboard, focus-visible, pressed-state, and live-region
   fixes.

These are independent of Open WebUI deployment and do not require its runtime.

### Slice C — continuation run projection

1. Ratify the existing per-story run, idempotency, cancellation, and typed
   outcome design.
2. Implement the bounded in-process registry and same-story lane.
3. Add phase events, snapshots, SSE reconnect, and native Web UI recovery.
4. Add provider token deltas later, one capability at a time.

### Slice D — proposals, only after prerequisites

1. Complete generator capabilities and structured context identity.
2. Write a proposal/accept ADR preserving the auto-save continuation contract.
3. Support only side-effect-free direct providers.
4. Add bounded alternatives and stale-frontier rejection.
5. Reconsider a multi-provider comparison view only after the proposal contract
   is proven safe.

## Source map for future reviewers

| Area | Pinned upstream source | Why it matters |
|---|---|---|
| MCP transport | [`utils/mcp/client.py`](https://github.com/open-webui/open-webui/blob/d3e8bf3405e848cfba377814d0aa7ba7290e414d/backend/open_webui/utils/mcp/client.py#L21-L181) | Headers, timeout fallback, discovery, invocation, cleanup |
| MCP access/filter | [`utils/middleware.py`](https://github.com/open-webui/open-webui/blob/d3e8bf3405e848cfba377814d0aa7ba7290e414d/backend/open_webui/utils/middleware.py#L2311-L2358) | Server resolution, access, function allowlist |
| Task/snapshot lifecycle | [`tasks.py`](https://github.com/open-webui/open-webui/blob/d3e8bf3405e848cfba377814d0aa7ba7290e414d/backend/open_webui/tasks.py#L128-L263) | IDs, bounded recovery concept, cancellation |
| Reload recovery | [`routers/chats.py`](https://github.com/open-webui/open-webui/blob/d3e8bf3405e848cfba377814d0aa7ba7290e414d/backend/open_webui/routers/chats.py#L62-L85) | Overlaying in-progress state after refresh |
| Delta coalescing | [`utils/middleware.py`](https://github.com/open-webui/open-webui/blob/d3e8bf3405e848cfba377814d0aa7ba7290e414d/backend/open_webui/utils/middleware.py#L4646-L4754) | Append-only deltas and snapshots |
| Usage normalization | [`utils/response.py`](https://github.com/open-webui/open-webui/blob/d3e8bf3405e848cfba377814d0aa7ba7290e414d/backend/open_webui/utils/response.py#L13-L207) | Provider vocabulary normalization |
| Alternative responses | [`models/chats.py`](https://github.com/open-webui/open-webui/blob/d3e8bf3405e848cfba377814d0aa7ba7290e414d/backend/open_webui/models/chats.py#L882-L1001) | Parent/children/current response model |
| Alternative UI | [`ResponseMessage.svelte`](https://github.com/open-webui/open-webui/blob/d3e8bf3405e848cfba377814d0aa7ba7290e414d/src/lib/components/chat/Messages/ResponseMessage.svelte#L929-L1024) | Navigating preserved siblings |
| Breadth boundary | [`main.py`](https://github.com/open-webui/open-webui/blob/d3e8bf3405e848cfba377814d0aa7ba7290e414d/backend/open_webui/main.py#L820-L864) | Why the platform should not be transplanted |
| License | [`LICENSE`](https://github.com/open-webui/open-webui/blob/d3e8bf3405e848cfba377814d0aa7ba7290e414d/LICENSE), [`LICENSE_NOTICE`](https://github.com/open-webui/open-webui/blob/d3e8bf3405e848cfba377814d0aa7ba7290e414d/LICENSE_NOTICE) | Current restrictions and historical bands |

## Final assessment

Open WebUI does not reveal a missing generic-AI platform inside Mnemosyne.
That is the most important conclusion. Mnemosyne should remain small,
story-aware, and anchored on OpenChronicle.

It does reveal one useful optional host, one genuinely missing telemetry
contract, and strong implementation evidence for two needs Mnemosyne had
already identified: recoverable long-running continuations and preserved beat
alternatives. Its accessibility work also exposes a few inexpensive defects in
the current UI. Those are credible improvements because each has a current
consumer and a bounded first slice.

The right relationship is therefore:

- **run Open WebUI separately** when evaluating host interoperability;
- **reimplement small contracts** where Mnemosyne has a demonstrated need;
- **keep OpenChronicle and Mnemosyne ownership unchanged**; and
- **reject the rest without apology** until a real requirement appears.
