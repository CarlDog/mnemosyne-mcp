# FreeToken adoption assessment for Mnemosyne

**Recorded:** 2026-09-09 UTC. **Status:** completed comparative research;
recommendations unratified and unscheduled. This is design input, not an
accepted architecture change or a provider rollout. [STATUS.md](../STATUS.md)
remains authoritative for current work; dispositions are also recorded in the
[research decision queue](RESEARCH_DECISION_QUEUE.md).

**Work item:** `CarlDog/mnemosyne-mcp#freetoken-review-2026-09-09`.

## Sources and decision

Source: [`FlashML-org/FreeToken` at `e05cff83`](https://github.com/FlashML-org/FreeToken/tree/e05cff83a04b322fc7823678aa2d05c826aad26c).
Mnemosyne baseline: `af88429a90a7072a1100f6337e7ece17d19c8148`. The only
pre-existing untracked item observed in Mnemosyne was an unrelated spreadsheet
lock file; it is outside this work. Source links below are pinned to those
commits, not assumed to describe future upstream behavior.

**Mnemosyne is the strongest initial integration candidate in this review.**
Its generation port already supports OpenAI-compatible chat requests, so a
local FreeToken experiment can be contained at that boundary. This is a ranking
of technical fit, not measured narrative quality, throughput, cost savings,
or compatible hardware capacity.

The candidate is an explicit **local OpenAI-compatible generator**, with honest
provider/model identity and capabilities. Keep the current native Ollama
validator initially. Do not make an alternate URL masquerade as a cloud
provider or an Ollama daemon, and do not change canon-promotion policy as part
of an inference experiment.

## Recommendation register

| ID | Recommendation | Disposition | Novelty / acceptance proof |
| --- | --- | --- | --- |
| MN-FT-01 | Explicit local OpenAI-compatible generation provider | Open candidate; unscheduled | New provider/config identity, reusing the existing generation port and appropriate HTTP logic; prove through real configuration and dispatch |
| MN-FT-02 | Truthful content/model/capability and timeout/context contracts | Prerequisite to MN-FT-01 | Existing policy/ContextPlan/completion machinery is retained; add only the candidate-specific facts and verify missing/unsupported behavior |
| MN-FT-03 | Bounded narrative and service-quality benchmark | Prerequisite to adoption | Fixed noncanonical fixtures, output-quality scoring, finish integrity, cold/warm latency, memory, cancellation, concurrency, and engine failure |
| MN-FT-04 | Stable-prefix prompt-layout experiment | Parked on MN-FT-03 baseline | Measure exact-prefix reuse and narrative quality together; keep changing scene/canon context fresh |
| MN-FT-05 | Replace the native Ollama validator with FreeToken | Rejected for the initial candidate | FreeToken does not provide native `/api/chat` plus the validator's schema-constrained contract |
| MN-FT-06 | Rebuild ContextPlan, telemetry, run outcomes, or provider ports | Corroboration only; no duplicate feature | Those mechanisms already exist. Record a concrete missing contract before proposing work |
| MN-FT-07 | Automatic canon promotion, story writes, companion messages, or semantic answer reuse | Rejected from this work | Evaluation has no canonical write or companion-send authority; provider acceleration does not change editorial decisions |

## 1. A narrow generator adapter is feasible; a URL override is insufficient

The [OpenAI-compatible provider][mn-provider] sends system/user messages,
optional temperature and output limits, and appends `/chat/completions` to a
base URL that includes the API version. It already extracts completion status
and available usage, including cached-token information. That is a useful
integration seam, not a reason to introduce a parallel application service.

The [generator configuration][mn-config] binds provider identity to routing
policy. An OpenAI route remains a cloud-provider identity with its existing
content capability, even if a URL override is used. A deliberate local route
must state its actual identity, checkpoint/revision or permitted alias,
capabilities, endpoint, and content policy without altering the cloud-provider
rules. A new provider name is a design candidate, not an env var introduced by
this review.

The [shared cloud HTTP helper][mn-timeout] uses a two-minute timeout. Native
Ollama has its own configurable timeout and error handling. A local MoE
checkpoint can have materially different cold-load, queue, and generation
behavior, so reusing the cloud wire adapter must not silently inherit an
unexamined cloud timeout or unknown context window.

**Acceptance proof:** configuration constructs the intended local provider,
dispatch reaches the right route exactly once, and returned identity and
completion/usage fields survive through existing results. Test explicit output
limits, endpoint version joining, truncated/empty responses, unsupported
features, malformed envelopes, missing usage, timeout, and engine failure.
Do not report unavailable usage as zero or a requested model as a verified
effective checkpoint.

## 2. Preserve the existing validator and editorial boundaries

The [composition root][mn-validator] constructs a separate `OllamaProvider`
validator with `requireLocal: true`. Its [structured generation path][mn-schema]
uses native `/api/chat` and a JSON Schema. FreeToken's
[unsupported-feature check][ft-unsupported] explicitly rejects JSON-object and
JSON-schema `response_format` because constrained decoding is unavailable in
that path. OpenAI-shaped chat support is not a replacement for the validator
contract.

Keep that validator for the initial generator experiment. Any later validator
replacement needs its own constrained-output, locality, schema validation,
failure, and completion-integrity evidence. Prompting a model to emit JSON is
not proof of constrained decoding or a clean validation verdict.

The following existing decisions remain in force:

- Content routing and model capability are checked before generation under
  the ratified routing design. A local provider's declared capability must be
  explicit; it does not change the rules for hosted providers.
- ContextPlan, provider capability descriptors, completion status, structured
  validator parsing, and run-outcome/cancellation semantics remain the host
  application contracts. Missing candidate support must be represented honestly.
- Canon promotion remains deliberately deferred. This assessment neither
  reopens it nor treats generated prose as approved canon.
- A benchmark uses a throwaway fixture/evaluation path with no canonical
  persistence, companion-bot messages, or live continuation side effects.

## 3. FreeToken compatibility and operational blockers

The detailed source review is recorded in the local FreeToken fork at
`docs/fleet-review-2026-09-09.md`. These findings constrain a candidate service;
they are not claims that Mnemosyne has the same defects.

| Source ID | Source/probe observation | Required response in a candidate evaluation |
| --- | --- | --- |
| FT-01 | [Benchmark route][ft-benchmark] accepts an overlapping serving start while a fake benchmark child is active | Avoid shared-resource evaluation until whole-operation ownership is proven; exercise cancellation and child cleanup |
| FT-02 | [Profile endpoint helper][ft-profile-import] imports model dependencies from the lightweight daemon | Verify real readiness/control routes under missing-model-library conditions |
| FT-03 | [Request conversion][ft-spec] ignores some accepted penalties/seed/tool controls; schema output is explicitly unsupported | Declare capabilities accurately; reject unsupported settings instead of claiming the experiment honored them |
| FT-04 | [Chat response][ft-chat] can echo an unserved requested model | Verify effective model/revision and explicit aliases before comparing quality or attributing usage |
| FT-05 | [Sampling defaults][ft-sampling] use 32,768 when chat omits a limit despite a configured server default | Send a deliberate output budget and test it; do not rely on the server default until corrected |
| FT-06 | Nonstreaming chat lacks the streaming disconnect wrapper, and running limits do not bound all pending work | Prove caller cancellation reaches the worker; bound queue/concurrency and avoid blind retries after unknown outcomes |
| FT-07 | [Release workflow][ft-release] publishes builds without a Python test-suite gate | Validate the actual pinned artifact and required CPU/GPU contracts before adoption |

The model process also needs an explicit trust boundary: the daemon's optional
token does not automatically protect the separate generation application, and
the [checkpoint encoder loader][ft-encoder] can execute model-supplied Python.
A future local runtime must not inherit Mnemosyne's OpenChronicle or companion
credentials merely because it serves text generation. No service or credential
configuration was changed in this review.

## 4. A bounded pilot, only if selected

Before running anything, select the hardware/checkpoint and declare the finite
fixture set, resource/time budget, comparison provider, metrics, and acceptance
thresholds. Do not download a model or reserve shared hardware on the strength
of this assessment alone.

1. **Narrative correctness:** compare complete outputs for continuity, character
   consistency, instruction adherence, repetition, prose quality, and required
   length. Blind scoring where practical should identify model/revision only
   after judgments are recorded. Include difficult long-context fixtures.
2. **Completion and validation:** truncated or incomplete text retains its
   finish reason and cannot become success-shaped canon. Keep the native
   validator, and score failures/refusals separately from valid completions.
3. **Context and routing:** effective context budget, actual tokenization,
   explicit output limits, and content capability behave as declared. Unknown
   facts must not be presented as measured support.
4. **Performance and resources:** compare cold/warm time to useful completed
   output, latency distribution, GPU/host RAM, queue delay, and concurrency.
   Measure prefill separately where the runtime exposes it. A decode-only
   headline does not predict a long-prompt story continuation.
5. **Failure ownership:** cancel a request, disconnect a caller, exceed queue
   capacity, and stop the worker. Verify bounded cleanup and truthful errors
   without unintended writes or duplicate remote generation.

If no quality-preserving benefit is demonstrated within the budget, retain the
current backend. Any implementation requires its own design decision and
tests; a benchmark win is not automatic production acceptance.

## 5. Prefix reuse is a later, measurable prompt experiment

FreeToken's [hybrid radix cache][ft-prefix] reuses exact token prefixes with
supported recurrent-state boundaries. It does not perform semantic answer
caching, compress canon, or make similar prompts interchangeable. Stable
system/style/canon-prefix placement may help repeated generation, but that is
a hypothesis until measured with the actual model/template.

Once a baseline is available, compare current prompt order with a variant
that keeps truly stable material byte/token stable and puts changing scene
instructions at a deliberate boundary. Cache identity must account for the
model, tokenizer/template, and relevant settings. Canon edits and scene changes
must invalidate the affected reuse naturally. Record cache hit/prefill changes
alongside quality; do not trade away continuity to improve a hit-rate counter.

No new Mnemosyne response cache is proposed. Existing context assembly remains
authoritative, and the GPU runtime owns its internal prefix cache.

## Explicit non-adoptions and verification

- No validator migration, generator switch, new dependency, or model download.
- No provider-policy bypass by relabeling a cloud endpoint as local.
- No duplicate ContextPlan/capability/telemetry/run registry implementation;
  earlier rejected registry work is not revived by this source.
- No semantic reuse of generated continuations against changed canon.
- No automatic canon promotion/import, live story write, or companion send.
- No hardware, savings, or narrative-quality claim from published decode speed.

The source review parsed 463 Python files, obtained 29 passing daemon tests
and two POSIX-only skips across successful selections after a temporary-path
recovery, and used two ASGI diagnostics plus isolated API/source probes with
inference collaborators replaced. No complete GPU serving stack or narrative
benchmark was run. No Mnemosyne runtime suite was rerun for this
documentation-only recording pass.

The research decision queue records every recommendation above. All candidates
remain unratified and unscheduled; only the documentation work is completed.
The original external-system research closure and existing ratified designs
are preserved, with this review recorded as a later addendum.

[mn-provider]: https://github.com/CarlDog/mnemosyne-mcp/blob/af88429a90a7072a1100f6337e7ece17d19c8148/src/openai-compat-provider.ts#L65-L166
[mn-config]: https://github.com/CarlDog/mnemosyne-mcp/blob/af88429a90a7072a1100f6337e7ece17d19c8148/src/generator-config.ts#L413-L444
[mn-timeout]: https://github.com/CarlDog/mnemosyne-mcp/blob/af88429a90a7072a1100f6337e7ece17d19c8148/src/llm-http.ts#L16-L25
[mn-validator]: https://github.com/CarlDog/mnemosyne-mcp/blob/af88429a90a7072a1100f6337e7ece17d19c8148/src/index.ts#L178-L189
[mn-schema]: https://github.com/CarlDog/mnemosyne-mcp/blob/af88429a90a7072a1100f6337e7ece17d19c8148/src/ollama-provider.ts#L266-L334
[ft-unsupported]: https://github.com/FlashML-org/FreeToken/blob/e05cff83a04b322fc7823678aa2d05c826aad26c/python/freetoken/server/openai_api.py#L627-L640
[ft-benchmark]: https://github.com/FlashML-org/FreeToken/blob/e05cff83a04b322fc7823678aa2d05c826aad26c/python/freetoken/daemon/app.py#L338-L381
[ft-profile-import]: https://github.com/FlashML-org/FreeToken/blob/e05cff83a04b322fc7823678aa2d05c826aad26c/python/freetoken/daemon/app.py#L61-L69
[ft-spec]: https://github.com/FlashML-org/FreeToken/blob/e05cff83a04b322fc7823678aa2d05c826aad26c/python/freetoken/server/openai_api.py#L58-L83
[ft-chat]: https://github.com/FlashML-org/FreeToken/blob/e05cff83a04b322fc7823678aa2d05c826aad26c/python/freetoken/server/openai_api.py#L147-L228
[ft-sampling]: https://github.com/FlashML-org/FreeToken/blob/e05cff83a04b322fc7823678aa2d05c826aad26c/python/freetoken/server/generation.py#L151-L187
[ft-release]: https://github.com/FlashML-org/FreeToken/blob/e05cff83a04b322fc7823678aa2d05c826aad26c/.github/workflows/release.yml
[ft-encoder]: https://github.com/FlashML-org/FreeToken/blob/e05cff83a04b322fc7823678aa2d05c826aad26c/python/freetoken/tokenizer/tokenize.py#L172-L188
[ft-prefix]: https://github.com/FlashML-org/FreeToken/blob/e05cff83a04b322fc7823678aa2d05c826aad26c/python/freetoken/kvcache/hybrid_radix_cache.py#L75
