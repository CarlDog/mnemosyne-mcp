# Ollama Adoption Assessment

**Status:** Completed comparative research, recorded 2026-08-27;
recommendations are unratified. This document does not schedule work, change
locked architecture, or reopen deferred scope. [STATUS.md](../STATUS.md)
remains the source of current priority.

**Upstream snapshot:**
[`ollama/ollama@f96e7aa`](https://github.com/ollama/ollama/tree/f96e7aa0513b9973a0ccc71be414c2ecb9d65b1a),
commit date 2026-08-27, MIT license. The official repository was cloned as a
clean, shallow `main` checkout at `D:\GitHub\ollama`. It contains 1,348 tracked
files and remains unmodified. This local audit clone is not a fork and is not a
Mnemosyne dependency.

**Mnemosyne snapshot:** `cfd9d7f4597d862314c78466f344f8118040016e`.
Mnemosyne already had unrelated working-tree changes when this audit began;
none were modified by this assessment.

## Decision summary

Keep Ollama as an **external inference runtime**. Adopt a small, independently
implemented portion of its native HTTP contract; do not vendor its Go client,
runner, scheduler, model registry, agent, memory, or tool subsystems.

The highest-value findings are correctness and privacy fixes, not new product
features:

| Rank | Recommendation | Why it is real now |
|---|---|---|
| P0 | Preserve completion status and block automatic canon save on `done_reason: "length"` | Mnemosyne currently drops the finish reason and saves every nonempty beat |
| P0 | Prove that the validator route is local | Ollama can transparently proxy cloud and remote models through localhost |
| P0 | Enforce the validator's JSON structure at generation time and at runtime | Prompt-only JSON plus a TypeScript cast can misclassify malformed output as clean |
| P1 | Make context admission model-aware and fail closed | Mnemosyne warns on overflow but still dispatches; Ollama truncates and shifts by default |
| P1 | Extract and test a typed native Ollama request/response contract | The documented numeric `keep_alive=-1` case is currently serialized incorrectly |
| P1 | Stabilize `num_ctx`, preload without inference, and observe residency | Variable explicit windows can reload the runner and defeat warmup |
| P1 | Consume native usage, route, and error metadata | Exact tokens and load/eval timings directly improve existing latency and context diagnosis |
| P2 | Add bounded preflight/diagnostics and deployment guidance | Missing tags and unsafe remote deployment have already produced opaque failures or privacy risk |

These ranks describe risk and fit if separately ratified; they are not a new
roadmap. The P0 label means the existing behavior can violate a stated
integrity or privacy property, not that this document authorizes an emergency
release.

In this document, **adopt** means reimplement the smallest useful TypeScript
contract in Mnemosyne's vocabulary. No Ollama source has been incorporated.

## Assessment method and constraints

The review used four kinds of evidence:

1. Mnemosyne's current provider, continuation, validator, configuration, test,
   architecture, and status paths.
2. Static inspection of the pinned Ollama source, documentation, integration
   tests, scheduler behavior, and public API types.
3. Read-only probes of the operator's existing Ollama daemon: `/api/version`,
   `/api/tags`, `/api/show`, and `/api/ps`.
4. Three independent review tracks: native API/runtime behavior, higher-level
   Ollama capabilities, and an adversarial cross-repository fit/privacy audit.

Recommendations had to pass these filters:

- A current consumer, observed defect, documented invariant, or explicit
  proposal must exist.
- OpenChronicle remains canonical for memory and retrieval.
- Ollama remains responsible for model execution, scheduling, GPU placement,
  and model storage.
- Provider routing and locality must be explicit; a localhost URL is not proof
  of local inference.
- Canon safety outranks convenience. Partial, malformed, or ambiguously routed
  output must not quietly become accepted canon.
- The first implementation slice must be narrow and testable without adding a
  second database, agent framework, or model-management plane.

This is why the assessment recommends API contracts and rejects nearly all of
Ollama's larger product surface.

## Current integration and the useful boundary

Mnemosyne already uses Ollama in two specific roles:

- the default direct generator; and
- the validator runtime, which the project describes as local and free.

The current Ollama provider estimates a request window, builds a nonstreaming
`/api/chat` body, and returns only `message.content`
([provider request](../src/llm.ts#L177-L263)). The continuation pipeline then
auto-saves every nonempty result before optional validation
([save path](../src/tools/continue.ts#L160-L243)). The validator asks for JSON
in prose, strips optional fences, calls `JSON.parse`, and checks only that
`issues` is an array and `summary` is a string
([validator](../src/validator.ts#L55-L137)).

The appropriate future boundary is:

```text
  /api/version + /api/tags + /api/show
                    |
                    v
         cached OllamaModelProfile
     local/remote | capabilities | trained context
     embedded defaults | exact tag | daemon features
                    |
         +----------+-----------+
         |                      |
         v                      v
   ContextPlan            role policy
 input + output reserve   generator / validator
         |                      |
         +----------+-----------+
                    v
        typed request builder -> /api/chat
                    |
                    v
        parsed GenerationResult
 text | complete | finish | tokens | timings | route
                    |
                    v
       continuation integrity gate -> save or recoverable partial
```

The profile is advisory until a generation or validation operation actually
needs it. A missing validator must not prevent unrelated browse operations;
an operation that requests validation must still fail transparently rather
than silently skip or weaken it.

## Local runtime observations

The following snapshot was captured read-only on 2026-08-27. No model was
loaded and no inference was run during the audit.

| Observation | Result | Relevance |
|---|---|---|
| Daemon version | `0.33.1` | The audited GitHub `main` may contain fields newer than the deployed daemon; compatibility tests are required |
| Installed tags | 34 | Preflight can resolve configured and per-call tags before expensive context gathering |
| Completion capability | 34/34 | Every installed tag could serve text generation |
| Thinking capability | 3 | Omitting `think` can already change latency and token use on this host |
| Vision capability | 3 | A later read-only reference-inspection experiment is technically possible, but not currently required |
| Embedding / image / remote | 0 / 0 / 0 | There is no local evidence supporting new embedding, image, or cloud work |
| Running models | 0 | The probes did not mutate residency |

`/api/show` exposed materially different trained context windows: 16,384 for
`phi4:14b-q8_0`, 1,024,000 for
`mistral-nemo:12b-instruct-2407-q8_0`, and 262,144 for
`qwen3.6:35b-a3b-q8_0`. Mnemosyne's single 32,768 default can therefore exceed
one model's trained window while unnecessarily limiting another. The endpoint
also revealed that models may carry embedded system text, seed messages,
templates, and default parameters. Diagnostics should report the presence of
those defaults without logging their content.

An exact lookup of the configured-style tag `mistral-nemo:12b` returned 404
while the longer instruct tag existed. This reproduces the class of failure
already recorded in [STATUS.md](../STATUS.md): an apparently reasonable model
name is not the same thing as an installed exact tag.

## 1. Completion integrity before canon save

### Existing risk

`GeneratedBeat` carries text and Kindroid group telemetry but no completion
state ([result type](../src/llm.ts#L71-L90)). `OllamaChatResponse` retains only
message, error, and `done`; the provider then returns any nonempty content as a
successful beat ([response parsing](../src/llm.ts#L160-L164),
[return](../src/llm.ts#L244-L263)). `continueScene()` immediately saves that
text as a scene ([save-first transition](../src/tools/continue.ts#L160-L228)).

Ollama reports `done_reason` and maps token-budget exhaustion to `length`
([response contract](https://github.com/ollama/ollama/blob/f96e7aa0513b9973a0ccc71be414c2ecb9d65b1a/api/types.go#L518-L564),
[runner mapping](https://github.com/ollama/ollama/blob/f96e7aa0513b9973a0ccc71be414c2ecb9d65b1a/llm/llama_server.go#L1711-L1724)).
Mnemosyne currently cannot distinguish a complete scene from one cut off at
`num_predict`. A truncated paragraph can therefore be auto-saved as canon.

### Recommended adaptation

Normalize provider output into a generic optional result contract rather than
adding Ollama checks throughout callers. At minimum it needs:

- text;
- `complete: boolean`;
- normalized `finishReason` (`stop`, `length`, `load`, `cancelled`, `unknown`);
- actual model and execution route when available;
- input/output token counts and provider timings when available.

For nonstreaming Ollama generation:

- require `done === true`;
- treat `done_reason: "stop"` as complete;
- return `length` text as recoverable partial output but do not automatically
  save it as a normal scene;
- do not silently retry, because a second generation is not the same scene;
- let the user raise the output budget, continue deliberately, or explicitly
  save the partial after review.

For validation, `length`, incomplete, missing-content, or schema-invalid output
is `validation_failed`; it must never become an empty, clean report.

The first slice does not need a new draft database or canon state. A response
such as `saved:false, incomplete:true` preserves the costly text while keeping
it out of automatic canon admission. A separate incomplete-scene tag should
only be added if the entity lifecycle is designed and ratified elsewhere.

### Acceptance proof

- Mocked `stop`, `length`, `done:false`, empty-content, and thinking-only
  responses have distinct typed outcomes.
- A `length` generation performs zero `saveEntity` calls and returns its text.
- A `length` validator result can never yield `validation:clean`.
- Cloud providers can adopt the same normalized finish contract incrementally.

## 2. Enforce the local-validator privacy boundary

### Existing risk

Mnemosyne's architecture says validation stays on Ollama so it remains local
and free. Current Ollama can transparently execute a `:cloud` model or a local
alias configured with a remote host while preserving the same localhost API.
Cloud models are explicitly described as automatically offloaded
([cloud behavior](https://github.com/ollama/ollama/blob/f96e7aa0513b9973a0ccc71be414c2ecb9d65b1a/docs/cloud.mdx#L6-L20)).
`/api/show` and `/api/chat` expose `remote_model` and `remote_host`
([show and chat types](https://github.com/ollama/ollama/blob/f96e7aa0513b9973a0ccc71be414c2ecb9d65b1a/api/types.go#L518-L540),
[show response](https://github.com/ollama/ollama/blob/f96e7aa0513b9973a0ccc71be414c2ecb9d65b1a/api/types.go#L736-L755)).

The request contains the retrieved story constraints and new scene. Treating
the transport name `ollama` as proof of local inference can therefore expose
private or mature canon and make a supposedly free validation call billable.

### Recommended adaptation

- Recommend `OLLAMA_NO_CLOUD=1` in the local-validator deployment profile.
- Reject an obvious `:cloud` validator tag before context gathering.
- Preflight the exact model with `/api/show`; validator use requires empty
  `remote_model` and `remote_host`.
- Verify the same fields on the final chat response so a changed alias cannot
  bypass the preflight.
- Classify execution as `local | remote | unknown`; unknown is not local.
- Keep validator startup degradation nonfatal for browsing, but fail any
  operation that explicitly requests unavailable validation.
- Do not automatically fall back from local Ollama to a cloud model.

Under today's provider naming, the Ollama generator should also default to
local-only. If Ollama Cloud becomes desirable, expose it as an explicit route
with the same content-routing and provenance semantics as other cloud
providers. Do not infer SFW/mature suitability from Ollama's technical
capability list.

Ollama Cloud currently does not support structured outputs
([structured-output limitation](https://github.com/ollama/ollama/blob/f96e7aa0513b9973a0ccc71be414c2ecb9d65b1a/docs/capabilities/structured-outputs.mdx#L5-L9)),
which independently makes it an unsuitable silent validator substitute.

### Acceptance proof

- `:cloud`, remote alias, remote final response, and unknown-route cases fail
  before validation can be reported clean.
- Tests prove that remote refusal occurs before any provider-visible canon is
  sent where the tag itself is sufficient to identify the route.
- Logs contain route classification and model identity, never prompts, remote
  credentials, or full endpoint URLs.

## 3. Schema-constrained and runtime-validated verdicts

### Existing risk

The validator's JSON shape exists only inside its prompt
([prompt](../src/validator.ts#L55-L78)). `parseValidatorJson()` uses a generic
cast, and the defensive step accepts any array plus any string
([parser](../src/validator.ts#L101-L137)). A malformed issue can survive, and a
misspelled or invalid severity will not equal `error`, allowing
`classifyVerdict()` to report clean ([classification](../src/validator.ts#L35-L40)).

Ollama accepts either `"json"` or a full JSON Schema in the top-level `format`
field and recommends keeping the schema in the prompt and validating the
parsed value afterward
([official structured-output guidance](https://github.com/ollama/ollama/blob/f96e7aa0513b9973a0ccc71be414c2ecb9d65b1a/docs/capabilities/structured-outputs.mdx#L50-L123)).

### Recommended adaptation

Define one runtime `ValidationReportSchema` with:

- required `issues` and `summary`;
- severity enum `error | warning | info`;
- required, nonempty `rule`, `violating_text`, and `explanation` strings;
- no additional fields at the report or issue level.

Send the equivalent literal JSON Schema as Ollama's `format`, retain the
semantic prompt and quote-grounding instructions, then parse the result with
the runtime schema. JSON Schema constrains shape; it does not prove that a
quoted passage exists or that a judgment is correct.

Mnemosyne currently uses Zod 3. Do not assume the Zod 4 `toJSONSchema` API or
upgrade Zod only for this feature. A hand-maintained literal schema plus a
drift/fixture test is adequate, or a small compatible converter can be
considered if several structured contracts later exist.

Do not add Ollama's `format`, `think`, `truncate`, and future native flags to
the already overloaded generic provider input. Prefer either a narrow
structured-generation capability or a validator-specific Ollama method, while
keeping normalized result metadata generic.

Set validator thinking explicitly off after compatibility verification; there
is no current evidence that hidden reasoning improves this established
quote-and-match validator, and Ollama enables thinking by default for capable
models
([thinking default](https://github.com/ollama/ollama/blob/f96e7aa0513b9973a0ccc71be414c2ecb9d65b1a/docs/capabilities/thinking.mdx#L145-L153)).

### Acceptance proof

- Bad severity, missing field, wrong type, extra field, partial JSON, fenced
  legacy JSON, and valid empty-issue reports are covered.
- The request contract proves `format` is top-level and the prompt contains the
  corresponding semantics.
- A schema violation is a failed validation pass, not an empty issues array.
- A local compatibility test proves the deployed Ollama version enforces the
  schema before the change is enabled by default.

## 4. Model-aware, fail-closed context admission

### Existing risk

Mnemosyne estimates tokens from characters and caps `num_ctx`, but a capped
request only logs a warning before dispatch
([sizing](../src/llm.ts#L121-L158),
[warning and request](../src/llm.ts#L181-L237)). The project's own long-context
incident showed why deterministic sizing and observability matter, even though
that incident was ultimately isolated to the local Ollama installation rather
than Mnemosyne's prompt ([STATUS.md](../STATUS.md)).

Ollama chat currently defaults `truncate` to true
([route](https://github.com/ollama/ollama/blob/f96e7aa0513b9973a0ccc71be414c2ecb9d65b1a/server/routes.go#L2691-L2704))
and the runner can shift/discard context when a request exceeds its window
([runner context handling](https://github.com/ollama/ollama/blob/f96e7aa0513b9973a0ccc71be414c2ecb9d65b1a/llm/llama_server.go#L279-L318)).
With one enormous canon-bearing system message and one user direction,
message-level preservation does not make an oversized rendered prompt fit.

### Recommended adaptation

Cache `/api/show` by `{OLLAMA_URL, exact model}` and derive an
`OllamaModelProfile` containing:

- exact resolved model and modification/digest identity where available;
- technical capabilities, requiring `completion`;
- trained context length from the dynamic `*.context_length` model-info key;
- local/remote/unknown route;
- presence, but not contents, of embedded system text and seed messages;
- presence of model templates/default parameters;
- model/runtime minimum-version requirements when reported.

Use the entire rendered provider-visible payload for admission, including a
structured-output schema when present. Reserve output tokens plus safety
margin. The effective window must not exceed the trained model context merely
because the global operator cap is larger. Preserve `unknown` distinctly from
unsupported.

If protected rules/style and the current direction cannot fit, fail before
inference. Do not silently summarize canon, drop protected material, or merely
raise `num_keep`.

After a request is proven to fit, send `truncate:false`. Also test and then
send `shift:false` as a server-side belt-and-braces guard against mid-generation
context shifting. These fields exist at the pinned GitHub snapshot
([chat request](https://github.com/ollama/ollama/blob/f96e7aa0513b9973a0ccc71be414c2ecb9d65b1a/api/types.go#L133-L167))
but must be contract-tested against the deployed 0.33.1 daemon and the declared
minimum supported release before relying on them.

This reinforces, rather than duplicates, the broader structured `ContextPlan`
recommended in [the OpenClaw assessment](OPENCLAW_ADOPTION_ASSESSMENT.md).
Ollama introspection supplies a trustworthy local model ceiling; the shared
planner still owns deterministic content admission across providers.

### Acceptance proof

- A plan over the effective window performs zero `/api/chat` calls.
- A 16K model is not sent a 32K window by default; an explicit override beyond
  trained context requires a visible, separately designed policy.
- Unknown context falls back conservatively without being described as known.
- Returned `prompt_eval_count` is compared with the estimate to calibrate, not
  silently replace, the deterministic planner.
- Oversized compatibility tests prove the server rejects instead of truncating
  or shifting.

## 5. Typed request contract and `keep_alive` correctness

### Existing risk

The current request is an inline, inferred object
([body](../src/llm.ts#L200-L217)). A recent bug put `keep_alive` inside
`options`, where Ollama silently ignored it; the source comment records the
fix. A second bug remains: `.env.example` documents bare `-1` as “keep loaded
indefinitely,” but configuration is typed as a string and is serialized as
`"-1"`.

Ollama gives JSON numbers and strings different semantics: negative numeric
values pin, nonnegative numbers mean seconds, and strings must parse as Go
duration values
([duration parser](https://github.com/ollama/ollama/blob/f96e7aa0513b9973a0ccc71be414c2ecb9d65b1a/api/types.go#L1242-L1280)).
A live request to the installed daemon confirmed `"keep_alive":"-1"` returns
HTTP 400 while `"keep_alive":-1` parses correctly.

### Recommended adaptation

- Define minimal `OllamaChatRequest`, `OllamaChatResponse`, `OllamaMetrics`, and
  error shapes; do not generate or import the whole API.
- Extract pure request builder and response parser functions.
- Normalize bare numeric environment input to a JSON number, preserve duration
  strings such as `30m` and `-1m`, and reject invalid values at startup.
- Skip warmup when the normalized keep-alive is zero.
- Keep `keep_alive`, `format`, `think`, `truncate`, `shift`, and `stream` at the
  documented top level; keep runner options inside `options`.
- Require a `done` terminal response in nonstreaming mode.

Do not add the official JavaScript SDK solely for this. The native surface
Mnemosyne needs is small, and direct `fetch` plus contract tests retains exact
control over local/remote checks and provider-specific fields.

### Acceptance proof

- Snapshot/body tests distinguish numeric `-1`, numeric seconds, `30m`, zero,
  and invalid duration input.
- Tests pin the top-level placement of every native control.
- Response tests preserve finish, usage, route, and error metadata.
- A regression proves the prior nested-`keep_alive` failure cannot return.

## 6. Stable context allocation and true preload

### Existing risk

Mnemosyne computes a different explicit `num_ctx` for each prompt, while its
warmup loads the configured maximum with a four-token response to `"ready"`
([generation sizing](../src/llm.ts#L171-L217),
[warmup](../src/llm.ts#L279-L290)). Ollama compares effective runner options,
including explicit context, when deciding whether a loaded runner can be
reused
([scheduler comparison](https://github.com/ollama/ollama/blob/f96e7aa0513b9973a0ccc71be414c2ecb9d65b1a/server/sched.go#L1381-L1427)).
A 32K warmup followed by a 19K request can therefore reload the model. Later
prompt-size changes can reload it again, largely defeating keep-alive and
warmup while creating latency and VRAM churn.

Ollama supports a real load operation: `/api/chat` with empty `messages` and a
nonzero keep-alive returns `done_reason: "load"`
([load path](https://github.com/ollama/ollama/blob/f96e7aa0513b9973a0ccc71be414c2ecb9d65b1a/server/routes.go#L2634-L2653)).
Empty messages plus zero keep-alive unloads the model. Mnemosyne should not
unload on shutdown because the daemon may be shared.

### Recommended adaptation

- Choose one stable effective context per model or a small set of documented
  buckets. A fixed maximum improves reuse but consumes more KV memory; buckets
  trade occasional reloads for lower memory.
- Base those values on the trained context and operator cap, not each prompt's
  exact estimate.
- Make the preflight planner decide whether a request fits; make `num_ctx`
  allocation stable after that decision.
- Replace token-generating warmup with a dedicated empty-message load request
  and assert the `load` finish reason.
- After startup warmups, query `/api/ps` once for compact residency, context,
  VRAM, and expiry diagnostics. Do not poll continuously or use it to replace
  Ollama's scheduler.
- Generator and distinct validator warmups currently run concurrently. Change
  sequencing only if `/api/ps` and load-duration telemetry demonstrate
  eviction or thrashing.

Detect the execution route before preload. Generating `"ready"` against an
Ollama Cloud alias can create needless billable inference; a local-only policy
should reject it earlier.

### Acceptance proof

- Warmup sends empty messages, produces no text, and accepts only `load`.
- The first real request uses the same context policy as the loaded runner.
- Load-duration telemetry demonstrates whether runner reuse actually improved.
- Zero keep-alive skips preload; shutdown issues no unload request.

## 7. Native telemetry, actionable errors, and bounded diagnostics

### Existing opportunity

Mnemosyne logs wall time, estimated input tokens, and output characters. Ollama
returns exact prompt/output counts, total/load/prompt-eval/eval durations,
actual model, route, and finish reason
([metrics](https://github.com/ollama/ollama/blob/f96e7aa0513b9973a0ccc71be414c2ecb9d65b1a/api/types.go#L518-L564),
[units and meanings](https://github.com/ollama/ollama/blob/f96e7aa0513b9973a0ccc71be414c2ecb9d65b1a/docs/api/usage.mdx#L5-L14)).
Durations are nanoseconds on the wire.

These values directly augment the existing `gather_ms`, `generate_ms`,
`save_ms`, and `validate_ms` stages. They can distinguish cold loading from
prompt evaluation and decoding, reveal runner reloads, calibrate the character
estimator, and explain long-context latency without logging story text.

Ollama also returns structured `{ "error": "..." }` bodies and meaningful
HTTP statuses for missing models, unsupported capability, cancellation, queue
overload, and server failures
([error guidance](https://github.com/ollama/ollama/blob/f96e7aa0513b9973a0ccc71be414c2ecb9d65b1a/docs/api/errors.mdx#L5-L24)).

### Recommended adaptation

- Carry compact optional provider telemetry through `GeneratedBeat` or a
  successor result type.
- Log input/output tokens, load/eval durations, output rate, finish reason,
  actual model, and route with a correlation ID spanning gather through
  validation.
- Never log raw prompts, entity bodies, embedded model instructions, reasoning
  traces, credentials, or full sensitive URLs.
- Parse typed errors for missing model, capability mismatch, context/schema
  rejection, overload, cloud failure, timeout, and transport failure.
- Make the five-minute timeout configurable for CPU/NAS deployment.
- Do not retry ambiguous timeouts or arbitrary 5xx. A 429/503 retry should be
  considered only when it is provably pre-inference and bounded with jitter;
  Ollama already queues work, so retries can amplify overload.

Add a small internal read-only client for `/api/version`, `/api/tags`,
`/api/show`, and `/api/ps`. Cache model inspection, including lazy inspection
of per-call overrides. Diagnostics should report exact-tag existence,
`completion` capability, trained versus loaded context, route, and minimum
version requirements when known. They must never auto-pull a model.

Keep detailed diagnostics behind an authenticated MCP/API surface. Mnemosyne's
minimal `/health` endpoint is intentionally public and should not expose model
inventory, VRAM, remote hosts, or deployment details.

### Acceptance proof

- Mock tests cover 200-with-error, 400 context/schema, 404 model, 429/503,
  timeout, abort, and malformed JSON.
- Missing generator and validator tags produce exact, actionable messages.
- Detailed diagnostics are absent from the public health response.
- Logs contain metadata only; prompt/content fixtures never appear.

## 8. Deployment hardening that fits the current boundary

Ollama's local API has no authentication
([authentication note](https://github.com/ollama/ollama/blob/f96e7aa0513b9973a0ccc71be414c2ecb9d65b1a/docs/api/authentication.mdx#L5-L16)).
For a NAS or other remote Ollama URL, keep port 11434 on a trusted private
network or place it behind TLS plus a reverse proxy with mTLS or bearer
authentication. Configurable proxy headers are justified only when that remote
deployment becomes concrete; do not invent a general auth plugin now.

A later Mnemosyne container slice could include a small project-specific
Dockerfile and optional Compose example that references a pinned official
Ollama service with:

- a persistent model volume;
- an internal-only API port;
- `OLLAMA_NO_CLOUD=1` for the local-validator contract;
- explicit operator provisioning of exact model tags;
- a tested version or image digest rather than `latest`;
- GPU/CPU and context-memory notes.

Do not copy Ollama's multi-platform Dockerfile or bundle its runner. Also do
not enable `OLLAMA_DEBUG_LOG_REQUESTS` in production; Ollama's request-body
debugging contains Mnemosyne's retrieved canon.

This section is deployment guidance, not evidence that containerization should
displace current priorities.

## Explicit thinking policy, after the contract exists

Ollama enables thinking by default for models that advertise the capability,
and returns reasoning separately from final content
([thinking behavior](https://github.com/ollama/ollama/blob/f96e7aa0513b9973a0ccc71be414c2ecb9d65b1a/docs/capabilities/thinking.mdx#L5-L23),
[default](https://github.com/ollama/ollama/blob/f96e7aa0513b9973a0ccc71be414c2ecb9d65b1a/docs/capabilities/thinking.mdx#L145-L153)).
Mnemosyne currently neither sets `think` nor reads `message.thinking`. A
per-call thinking-capable model can therefore change latency and consume the
output budget unexpectedly.

After model profiles and request-contract tests exist:

- validator default: explicitly off, benchmarked against the established
  validator suite;
- generator default: retain existing behavior until a benchmark establishes a
  safe explicit policy, then expose a model-aware operator setting only if
  thinking models are actually used;
- GPT-OSS-style level semantics require model-specific handling;
- never save or log hidden reasoning traces as canon or as validation evidence.

This is control of a server default, not a proposal to make chain-of-thought a
Mnemosyne feature.

## Conditional ideas with real triggers

These are not recommendations for current implementation.

| Idea | Legitimate trigger | Smallest defensible experiment | Why not now |
|---|---|---|---|
| Web UI streaming | Measured user abandonment or unacceptable perceived latency despite normal total completion time | Stream generator progress over an explicit REST/SSE contract; buffer atomically; save only a terminal complete response | MCP and validation should remain nonstreaming, and partial-save/cancellation semantics are not designed |
| Read-only vision reference inspection | A ratified workflow needs to compare or describe existing reference assets | Require `vision`; read only within the story reference root; return review-only structured observations | Visual features remain deferred and local inference does not make model observations canon |
| Model picker | Operators repeatedly fail on exact free-text tags | Protected UI backed by `/api/tags`, preserving explicit model selection | Preflight already solves correctness; a picker is convenience only |
| Bounded read-only recall loop | Production evidence shows deterministic context admission repeatedly misses essential canon | Expose only OpenChronicle search/read, 3–5 rounds, one shared budget, no mutations | The host already orchestrates tools and current gather/generate/save flow is intentionally deterministic |
| Application concurrency limit | Telemetry shows 503s, repeated evictions, or VRAM thrashing | Small per-Ollama-endpoint semaphore with measured limits | Ollama already owns queuing and scheduling |
| Explicit author research | Users request source-backed real-world research inside Mnemosyne | Separate read-only research operation with URLs/provenance and no automatic canon save | Host browsing already exists; automatic web search creates privacy and prompt-injection risk |

## Explicit non-adoptions

The following do not solve a current Mnemosyne problem or violate an existing
ownership boundary.

| Ollama area | Decision | Reason |
|---|---|---|
| Scheduler, GPU discovery/offload, runner, llama.cpp, model cache | Reject | Ollama already owns these process concerns; copying them creates a Go/C++/GPU build burden |
| Full agent/session/event/tool/approval runtime | Reject | Mnemosyne is a controlled story pipeline and its MCP host already orchestrates tools |
| Agent skills and model-generated compaction | Reject | OpenChronicle plus dynamic rules/style/canon are the truth system; a second instruction/summary hierarchy can erase provenance |
| Embeddings or vector index in Mnemosyne | Reject | OpenChronicle owns semantic search and canonical retrieval |
| Tool calling during story generation | Reject | The generator has no legitimate mutation need; canon and RNG operations must remain typed, host-controlled transitions |
| Story Modelfiles or server-side chat history | Reject | They create stale Ollama-only copies of dynamic canon and bypass current retrieval/validation selection |
| Model pull/create/copy/delete APIs | Reject | Model provisioning has large storage, supply-chain, and license consequences and belongs to the operator |
| Automatic local-to-cloud fallback | Reject | It can expose private/mature content, incur cost, and weaken validation without consent |
| Ollama Cloud auth/proxy subsystem | Reject | Mnemosyne already has explicit cloud providers; hidden Ollama cloud routing is the problem, not a feature |
| OpenAI-compatible facade for Ollama | Reject | It obscures native context, load, route, and metrics fields; the direct native API is already small |
| Official JavaScript SDK | Reject for now | Direct `fetch` plus builders/parsers is sufficient and more auditable |
| Automatic web search in continuation | Reject | Results are remote, untrusted, large, and unrelated to canonical-fiction truth |
| Log probabilities as narrative confidence | Reject | Token likelihood is not calibrated continuity or canon confidence |
| Ollama sampling seed as procedural RNG | Reject | Sampling repeatability is not a transparent, recorded encounter/loot roll |
| Forced model unload on shutdown | Reject | The daemon may be shared with other applications |
| Streaming validator | Reject | Atomic schema validation benefits from one terminal response |
| Image generation | Reject at this snapshot | The capability enum exists, but the audited server rejects image-generation models; no local image-capable model was installed |
| Audio/voice | Reject | No current consumer and outside the project's present scope |

Ollama embeddings could someday be an OpenChronicle backend; that would be an
OpenChronicle decision, not a Mnemosyne subsystem.

## Recommended implementation sequence if ratified

### Slice A — Integrity and contract tests

1. Extract minimal native request/response types, builder, parser, and typed
   error mapper.
2. Normalize `keep_alive`, including numeric `-1` and zero.
3. Preserve `done`, finish reason, exact model, route fields, and usage.
4. Block automatic save and clean validation on incomplete output.
5. Add mock regression coverage before changing live behavior.

This is the smallest slice that fixes confirmed integration defects.

### Slice B — Locality and model profile

1. Add cached `/api/version` and `/api/show` inspection.
2. Require exact installed `completion` models on first use.
3. Enforce local validator and verify the final response route.
4. Discover trained context and embedded-default presence.
5. Keep detailed diagnostics behind authenticated surfaces.

### Slice C — Context enforcement and structured validation

1. Turn the existing capped-context warning into a pre-dispatch error.
2. Use a stable, model-aware effective context.
3. Verify then send `truncate:false` and `shift:false`.
4. Add the strict runtime verdict schema and equivalent Ollama `format`.
5. Set validator thinking off and run the existing validator regressions plus
   adversarial malformed-output fixtures.

### Slice D — Operations

1. Replace `"ready"` generation with the empty-message load operation.
2. Add one-shot `/api/ps` residency diagnostics.
3. Carry exact token/load/eval telemetry through existing stage timings.
4. Classify actionable errors and make timeout configurable.
5. Decide whether Docker/Compose guidance is worth a separate deployment task.

### Later, only on evidence

Revisit streaming, vision, model selection UI, bounded recall, or concurrency
only when their triggers appear. None should ride along with the contract and
integrity work.

## Test strategy

Existing Ollama unit coverage largely exercises context arithmetic and
transport-error formatting, while validator tests focus on fence stripping.
The ratified slices should add:

1. Exact mocked `/api/chat` body tests for top-level keep-alive, schema,
   thinking, truncation, shifting, streaming, and runner options.
2. Response cases for stop, length, `done:false`, thinking-only exhaustion,
   malformed JSON, 200-with-error, and true empty-load success.
3. A regression proving `length` cannot auto-save or classify clean.
4. Runtime verdict-schema cases for bad severity, missing/extra fields, wrong
   types, and partial structures.
5. Locality cases for `:cloud`, remote alias, response remote host, and unknown
   route.
6. Preflight cases for missing model, non-completion model, trained-context
   clamp, and distinct generator/validator windows.
7. HTTP cases for 400 context/schema, 404 model, 429/503, timeout, abort, and
   malformed error bodies.
8. An environment-gated compatibility smoke that probes version/show first and
   reports missing prerequisites clearly.
9. CI against the declared minimum and current stable Ollama releases; untagged
   GitHub `main` should be advisory, not the production compatibility contract.

No Ollama build or upstream test suite is necessary to validate Mnemosyne's
small HTTP integration. The audit intentionally did not build Ollama or run
inference.

## Licensing and reuse

Ollama and Mnemosyne are MIT-licensed. The licenses are compatible, but copied
or substantial Ollama source portions require preservation of Ollama's
copyright and license notice
([Ollama license](https://github.com/ollama/ollama/blob/f96e7aa0513b9973a0ccc71be414c2ecb9d65b1a/LICENSE)).

The recommended implementation is clean, narrow TypeScript code against the
documented HTTP protocol. There is no reason to copy the Go client or vendor
upstream types. If substantial source is ever copied, add a third-party notice
and ensure it is included in the published npm package.

Ollama's software license does not license model weights. Model licenses are
separate and are surfaced by `/api/show`. Do not bundle or auto-pull model
weights into a Mnemosyne image.

## Audit limitations and re-evaluation triggers

- The clone is shallow and pinned to untagged GitHub `main`, not a released
  compatibility baseline.
- Static source inspection does not prove that every new request field is
  supported by the installed 0.33.1 daemon.
- Read-only local probes observed inventory and metadata only; no generation,
  load, schema enforcement, truncation, or shifting request was executed.
- No production incident currently proves users have saved a `length`-cut
  scene or used a remote validator. Those are source-demonstrated reachable
  defects, not claims of observed harm.
- Local capability counts and model tags will change over time.
- No upstream source, binaries, models, or dependencies were copied into
  Mnemosyne.

Revisit the rejected or conditional items only if one of these occurs:

- a measured Web UI latency problem needs streaming;
- a ratified visual-reference workflow needs local vision;
- deterministic retrieval repeatedly misses required canon;
- Ollama telemetry shows queue overload or runner churn;
- Ollama releases a stable image-generation path and Mnemosyne separately
  reopens illustration scope;
- operators explicitly request Ollama Cloud as a named provider route;
- OpenChronicle evaluates Ollama as an embedding backend.

Until then, the useful lesson from Ollama is disciplined use of its native API:
**inspect the actual model, prove where it will run, budget the complete
request, constrain machine-readable output, preserve terminal status, and make
runtime costs observable.**
