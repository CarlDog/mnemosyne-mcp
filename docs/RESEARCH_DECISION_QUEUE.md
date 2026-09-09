# External-System Research Decision Queue

**Status:** Reconciliation artifact, created 2026-08-28, last revised
2026-09-09. The original four adoption assessments (Ollama, OpenClaw, Open WebUI,
NemoClaw) were read end-to-end and triaged on 2026-08-28 (see
[STATUS.md](../STATUS.md)'s Done log); that entry claims "a decision queue
of 20 live proposals" without enumerating it. This document is that
enumeration: every row of the four docs' recommendation tables, with its
current disposition. **Nothing here is ratified.** An "open candidate"
becomes work only by explicit operator decision, and the 2026-08-28 pause
("next direction deliberately unset, shaped by live use") stands.

A fifth assessment, [FreeToken](FREETOKEN_ADOPTION_ASSESSMENT.md), was
recorded 2026-09-09 UTC as a later research addendum. Its recommendation
table is reconciled below; the original program closure and existing
ratifications are preserved. Its candidates remain unratified and
unscheduled.

Dispositions:

- **Shipped** — landed, with the commit named.
- **Rejected at triage** — deliberately not taken on 2026-08-28, with the
  recorded reason.
- **Open candidate** — unratified; sits here until live use or an operator
  decision picks it up.
- **Parked** — open in principle but blocked on a prerequisite that is itself
  unratified or rejected.

## Verification record (2026-08-28)

The three shipped items were re-verified against their documents' own
acceptance proofs, not just the Done log:

- **`ebb6d36` (keep_alive)** — fully covered.
  `tests/ollama-keep-alive.test.ts` pins value shape and top-level placement,
  proven non-vacuous by reintroducing the old nesting.
- **`a12e992` (HTTP filesystem authority)** — behavior verified live on both
  transports at ship time, but **one acceptance-proof gap remains**:
  NemoClaw §1 requires "an HTTP MCP integration test proves the policy is
  wired through the actual per-session server factory."
  `tests/filesystem-path-authority.test.ts` unit-tests only the guard helper;
  `tests/http-integration.test.ts` never exercises `out_path`/`file_path`. A
  refactor that stopped passing `httpConfig.port === undefined` through
  `makeServer()` would re-open the hole with every test green. **Closed later
  the same day** — see the NemoClaw table below.
- **`9be11f3` (a11y)** — all four cited defects fixed and verified in the
  built bundles. The rest of Open WebUI §6's proof list (full keyboard
  walkthrough, continuation phase/result announcements) depends on the run
  contract and travels with it.

Drift check: the "five drift items" in the triage entry were all corrections
to the Atlas benchmark doc, all fixed in `32e027f` (its commit message
enumerates the five). No unrecorded drift item is outstanding. The docs'
Mnemosyne-side line links are pinned to snapshot `cfd9d7f` and some cited
code has since moved (notably the `src/index.ts` split); each doc's header
now says so.

## Ollama ([OLLAMA_ADOPTION_ASSESSMENT.md](OLLAMA_ADOPTION_ASSESSMENT.md))

| Doc rank | Item | Disposition |
|---|---|---|
| P0 | Preserve completion status; block auto-save of a `done_reason: "length"` beat as canon | **Shipped 2026-08-28** — `GeneratedBeat.complete`/`finishReason`, `done === true` required, `continueScene` returns `incomplete:true` with zero saves and skips validation, a truncated validator verdict throws instead of reading clean; `tests/completion-integrity.test.ts` |
| P0 | Prove the validator route is local (`:cloud`/remote-alias refusal, `/api/show` preflight, final-response route check) | **Shipped 2026-08-28** — `OllamaConfig.requireLocal` on the validator instance: startup `:cloud` tag refusal (generator-config), per-model cached `/api/show` preflight refusing `remote_model`/`remote_host` before any canon is sent, actionable 404 mapping, and a final-response route re-check; `.env.example` recommends daemon-side `OLLAMA_NO_CLOUD=1`; `tests/validator-locality.test.ts` + live-verified against the NAS daemon |
| — | Ollama *generator* local-by-default (assessment §2's second half: expose Ollama Cloud only as an explicit named route with content-routing semantics) | **Open candidate** — deliberately not folded into the validator P0; needs the content-routing design |
| P0 | Schema-constrained + runtime-validated validator verdicts (Ollama `format` + strict runtime schema) | **Shipped 2026-08-28** — strict zod report schema replaces the permissive fallback (malformed verdict throws, never reads clean); Ollama sends the literal JSON Schema as top-level `format` via a narrow `StructuredOutputCapable` surface, live-verified against the deployed daemon (0.32.15); drift guard pins the two schema copies together; `tests/validator-schema.test.ts`. Validator `think: false` deliberately deferred pending its own compatibility verification per the doc's sequencing |
| — | Cloud providers adopt the `complete`/`finishReason` contract | **Shipped 2026-08-28** — all four cloud providers (Anthropic `max_tokens`, OpenAI-compat/Atlas `length`, Gemini `MAX_TOKENS`) now map their finish reasons through one shared `completionFromFinishReason()` normalizer, so a truncated cloud beat hits the same no-auto-save guard as Ollama; kindroid/botify report nothing (no truncation concept), treated as complete by design |
| P1 | Model-aware, fail-closed context admission (`/api/show` profile, `truncate:false`/`shift:false`) | **Shipped 2026-08-28** — this row and the OpenClaw ContextPlan row (below) are one design; [CONTEXT_PLAN_DESIGN.md](CONTEXT_PLAN_DESIGN.md) slices 1–2. Verified against code 2026-09-08: `truncate: false`/`shift: false` are set on every Ollama request in `src/ollama-provider.ts` |
| P1 | Typed native request/response contract | **Partially shipped** — `ebb6d36` fixed numeric `keep_alive` and pinned placement/shape in tests; the typed-error half **shipped 2026-08-29**: `classifyOllamaHttpError` (404 exact-tag, `exceed_context_size_error` with the daemon's counts, 429/503 no-auto-retry) + configurable `OLLAMA_TIMEOUT_MS` with a no-blind-retry timeout message. The remaining builder/parser extraction is refactoring with no behavior gap |
| P1 | Stable `num_ctx`, preload without inference (empty-message load), `/api/ps` residency | **Shipped 2026-08-28** — [CONTEXT_PLAN_DESIGN.md](CONTEXT_PLAN_DESIGN.md) slice 2, decision #1. Verified against code 2026-09-08: stable per-model `num_ctx` and the warmup/`/api/ps` plumbing are both in `src/ollama-provider.ts` |
| P1 | Consume native usage/route/error metadata | **Partially shipped** — usage/timing landed 2026-08-28 (`ModelUsage` envelope, exact tokens + ns→ms load/eval durations); typed error classification landed 2026-08-29 (`classifyOllamaHttpError`, see the row above). **Still genuinely open** (verified against code 2026-09-08: neither `ModelUsage` nor `GeneratedBeat` carries a `route` field): carrying route fields through results |
| P2 | Bounded preflight/diagnostics + deployment guidance | **Split 2026-09-08.** The diagnostics-breadth half (capability-mismatch/transport-failure/malformed-JSON classification, a preemptive `/api/tags`/`/api/version` client) is **rejected at triage** — no incident shows the existing generic fallback (`Ollama HTTP {status}: {bodyText}`) is actually opaque in practice, same reasoning as the rejected per-story run registry. The deployment-hardening half **shipped 2026-09-08** — see `SECURITY.md`'s new "no authentication layer in front of Ollama" bullet |

## NemoClaw ([NEMOCLAW_ADOPTION_ASSESSMENT.md](NEMOCLAW_ADOPTION_ASSESSMENT.md))

| Doc rank | Item | Disposition |
|---|---|---|
| P0 | HTTP filesystem authority | **Shipped** `a12e992` — flat rejection per the assessment's own argument; see verification record above for the remaining integration-test gap |
| — | HTTP-transport integration test for the path refusal (the §1 acceptance proof) | **Shipped 2026-08-28** — `tests/http-integration.test.ts` now registers with `allowFilesystemPaths: false` exactly as `makeServer()` does for HTTP, proves `out_path`/`file_path` are refused over the wire before any filesystem operation, and proves the server-managed default export still works; non-vacuity confirmed by flipping the wiring (1 of 5 fails) |
| P1 | Runtime-validate sibling-MCP results + bounded required-tool discovery | **Shipped 2026-08-28** — zod schemas for every OC/Kindroid/Botify result at the extraction chokepoint (both `structuredContent` and text-fallback paths; errors name field paths, never payload values); `src/mcp-discovery.ts` does bounded name-only `tools/list` discovery (page/tool/name/cursor caps, duplicate and loop detection, zero `tools/call`) at each client's connect — OC fails startup, companions fail before any message is posted; live-verified against real OC (317 tests); `tests/mcp-contracts.test.ts` |
| P1 | Separate liveness from protected semantic readiness (`/api/status` / `mnemo_status`) | **Shipped 2026-08-28** (as `/api/status` only) — `src/readiness.ts` prober behind the existing bearer/Host-Origin boundary: OC re-verified via bounded tools/list, Ollama via `/api/show` (no inference), companions via non-mutating connect+discovery, cloud generators honestly `not_probed` (a real probe is billable); 15s TTL cache; `/health` stays public liveness-only. An MCP `mnemo_status` twin for stdio operators is a recorded non-goal of this slice, not an omission |
| P2 | Endpoint/redirect/error-body/final-sink-redaction hygiene | **Shipped 2026-08-29** — `src/service-url.ts` central parser (http(s)-only, no credentials/fragment/query; private addresses deliberately allowed) applied to every configured endpoint, sanitized origin+path connection logs, `redirect: "error"` on credential-bearing cloud requests, 2KB-bounded upstream error bodies, and recursive sensitive-key + URL-userinfo redaction at the log sink; `tests/hardening.test.ts` |
| Conditional | NemoClaw as an MCP host (compatibility spike) | **Rejected at triage** — blocked on the boundary items; revisit only per the doc's own triggers |
| Corroboration | Provider capability descriptor | Not a separate item — see OpenClaw row 4 |

## Open WebUI ([OPEN_WEBUI_ADOPTION_ASSESSMENT.md](OPEN_WEBUI_ADOPTION_ASSESSMENT.md))

| Doc rank | Item | Disposition |
|---|---|---|
| High-value experiment | Open WebUI host compatibility spike (native MCP, then optional Pipe) | **Rejected at triage** — the doc's own analysis predicts a structural failure (host-model paraphrase vs the already-saved exact beat) |
| Medium-high | Provider usage/timing telemetry (`ModelUsage` envelope, generator/validator kept separate) | **Shipped 2026-08-28** — `ModelUsage` on `GeneratedBeat` from Ollama (exact counts + ns→ms load/eval timings), Anthropic (incl. cache creation/reads), OpenAI-compat/Atlas (incl. `cached_tokens`), and Gemini (`usageMetadata`); continuation responses carry `usage.generator`/`usage.validator` separately; unknown values stay absent, totals only reported-or-both-parts, no invented dollar cost; `tests/usage-telemetry.test.ts` |
| High | Recoverable continuation runs + SSE events | **Parked** — the HTTP projection of the per-story run registry, which was deliberately not taken (no incident proves the race) |
| Conditional | Stale-aware, noncommitting beat proposals | **Parked** — needs capability descriptors + structured context identity first; companion providers excluded by side effect |
| Low-risk | Accessibility hardening | **Shipped** `9be11f3` (the four cited defects); walkthrough/announcement items travel with the run contract |

## OpenClaw ([OPENCLAW_ADOPTION_ASSESSMENT.md](OPENCLAW_ADOPTION_ASSESSMENT.md))

| Doc rank | Item | Disposition |
|---|---|---|
| High | Structured, budgeted, inspectable `ContextPlan` | **Ratified and shipped 2026-08-28 (slices 1–2)** — [CONTEXT_PLAN_DESIGN.md](CONTEXT_PLAN_DESIGN.md): structured `ContextEntry` through gather, pure deterministic `planContext` with the ratified drop tiers and memory_id tie-break, plan-driven rendering (the prompt is exactly the admitted set), `context_plan` manifest + companion `context_selection` on responses, estimator-calibration logging, `MNEMO_CONTEXT_ADMISSION` warn/enforce, stable per-model `num_ctx` = min(trained, cap) via one shared cached `/api/show`, `truncate:false`/`shift:false` (measurement-gated), empty-message load warmup + one-shot `/api/ps`. Slice 3 (cloud enforcement) is a documented no-op while capability windows are all-unknown |
| High | Per-story continuation lane / run registry | **Rejected at triage** — the doc itself records no production incident; revisit on real evidence |
| High | Cancellation, replay-safe typed outcomes (`RunContext`, `canon_write_unknown`, Botify timeout parity, REST error fidelity) | **Ratified 2026-08-28; slices 1–2 shipped same day** — [RUN_OUTCOMES_DESIGN.md](RUN_OUTCOMES_DESIGN.md): RunContext + phase-boundary aborts (guarded `res.close` on REST, `extra.signal` on MCP), `RunOutcomeError` with the ratified status map through the REST error handler, `run_id` on success, companion producers mapped (Kindroid timeout/readback, Botify readback + new timeout parity), and success-shaped `canon_write_outcome`. Slice 3 (lifecycle) shipped same day: bounded-grace shutdown owner on both transports (OC closed last -- the libuv lesson), single-flight connect on all three clients, the OC mutating-retry safety dependency made explicit with an abortable backoff threaded through the whole gather path, and atomic serialized config writes. Idempotency keys stay excluded with the rejected registry |
| Medium | Static generator capability descriptors | **Ratified and shipped 2026-08-28** — [GENERATOR_CAPABILITIES_DESIGN.md](GENERATOR_CAPABILITIES_DESIGN.md): `src/capabilities.ts` static table + instance-keyed async resolver (Ollama effective window from live `/api/show`, cloud all-unknown), `GET /api/capabilities` with both descriptors, capability-gated Web UI controls (`supported:false` removed, `unknown` enabled-with-hint), and warn-don't-break `capability_warnings` on continuation responses; `tests/capabilities.test.ts`. ContextPlan stage 3 stays a documented no-op while cloud windows are unknown |
| Medium | OC retrieval controls (mode/phrase/compact/pinnedLimit) + vague-direction enrichment | **Ratified 2026-08-28; slices 1–2 shipped same day** — [RETRIEVAL_CONTROLS_DESIGN.md](RETRIEVAL_CONTROLS_DESIGN.md): `mode`/`phrase`/`pinnedLimit` pass-through with the captured per-mode relevance object on a search-specific schema, and phrase-first overwrite lookup (live-exercised against real OC). Slice 3's flag-off enrichment shipped same day (ratified heuristic incl. the entity-name condition, ≤120-char tail, list-path scene selection immune to the embedding-lag issue, `MNEMO_QUERY_ENRICHMENT` default off); the settled-fixtures benchmark run — which needs operator-labeled expected-entity fixtures — remains, and the flag stays OFF until its win is recorded |
| Later | Provenance-bound current-state proposals | Parked — prototype-only per the doc; needs an OC compare-and-set contract for any apply path |
| High | Operational safety: prose out of default logs, admission/shutdown ownership, OC retry classification, atomic config writes | **Partially shipped 2026-08-28** — the logging half landed: tool logs record lengths/counts instead of story text (prose fields always, long strings and arrays generally), full args require the `MNEMO_LOG_CONTENT=true` opt-in; `tests/tool-logging-privacy.test.ts`. Fully shipped as of 2026-08-29: logging (2026-08-28), lifecycle/retry/config (RUN_OUTCOMES_DESIGN slice 3), and final-sink recursive redaction (with the hardening batch) |

## FreeToken ([FREETOKEN_ADOPTION_ASSESSMENT.md](FREETOKEN_ADOPTION_ASSESSMENT.md))

Recorded 2026-09-09 UTC. This is a research addendum, not a new scheduled
phase or authorization to run a model pilot. The following rows enumerate
the assessment's complete recommendation register.

| Doc ID | Item | Disposition |
| --- | --- | --- |
| MN-FT-01 | Explicit local OpenAI-compatible generator | **Open candidate** — new provider identity/configuration only if selected; reuse existing ports and suitable HTTP logic |
| MN-FT-02 | Truthful model/content/capability, timeout, and context contracts | **Parked on MN-FT-01 selection** — prerequisite to a pilot; retain existing content routing, ContextPlan, completion integrity, and cloud-provider policies |
| MN-FT-03 | Bounded narrative and service-quality benchmark | **Parked on explicit pilot approval** — fixed noncanonical fixtures, quality, latency/resources, cancellation, queueing, and failure gates before adoption |
| MN-FT-04 | Stable-prefix prompt-layout experiment | **Parked on MN-FT-03 baseline** — exact-token reuse only; changing canon/scene context remains fresh |
| MN-FT-05 | FreeToken replaces the native Ollama validator | **Rejected for the initial candidate** — native API/schema-constrained contract is absent at the reviewed snapshot; retain the current validator |
| MN-FT-06 | Rebuild ContextPlan, telemetry, run outcomes, or provider ports | **Corroboration only** — mechanisms already exist; no duplicate feature or revival of the rejected run registry |
| MN-FT-07 | Canon promotion, live writes/messages, or semantic answer reuse | **Rejected from this work** — canon promotion remains deliberately deferred; evaluation has no canonical-write or companion-send authority |

No new runtime verification or adoption is claimed by these rows. See the
assessment for pinned source evidence, upstream blockers, acceptance proofs,
and full explicit non-adoptions.

## Ranked next-up, if and when the pause ends

The 2026-08-28 pause stands: "next direction deliberately unset, shaped by
live use." What follows is a punch list for whenever the pause lifts, not
a schedule. Recorded 2026-09-08 after finding this section itself had
drifted — it named NemoClaw P1×2 and the OpenClaw §7 remainder as still
open when the tables above already showed both shipped, and two
Ollama-table ContextPlan rows the same way. That drift is what Phase 1
below fixed.

**Phase 1 — doc accuracy (this revision, done).** Corrected five stale
disposition claims by checking real code, not just re-reading tables:
NemoClaw P1×2 and the OpenClaw §7 remainder (both already shipped, this
section hadn't caught up); the two Ollama-table ContextPlan rows
(model-aware context admission; stable `num_ctx`/preload/`/api/ps` — both
shipped via CONTEXT_PLAN_DESIGN slices 1–2, confirmed against
`src/ollama-provider.ts`); and the "consume native usage/route/error
metadata" row, split into its true state — typed error classification
shipped 2026-08-29, route-field-through-results genuinely still open (no
`route` field exists on `ModelUsage`/`GeneratedBeat`).

**Phase 2 — triage before any code (done, 2026-09-08).**
- 2a. Ollama P2 "bounded preflight/diagnostics + deployment guidance" was
  really two unrelated things under one row. Split: the diagnostics-
  breadth half rejected at triage (no incident, existing fallback already
  actionable); the deployment-hardening half shipped as a `SECURITY.md`
  addition — see the Ollama-table row above.
- 2b. Re-confirmed the two correctly-Parked items still have unmet
  prerequisites: no race/duplicate-generation incident anywhere in
  STATUS.md since 2026-08-28, and no OC compare-and-set contract exists
  anywhere in the docs. Both stay parked, unchanged.

**Phase 3 — content-routing design gate.**
- 3a. **Done, ratified 2026-09-08.** Refreshed `CONTENT_ROUTING_DESIGN.md`
  against current architecture first — two claims had drifted (the
  generate() call site moved to `dispatchGenerate()` in
  `continue-scene.ts`; the story marker schema is 5 in code, not the 3 the
  design assumed, so the proposed `Content-Rating` line now needs schema
  6) — then put it up for an explicit ratify/reject/revise decision, the
  same gate CONTEXT_PLAN_DESIGN, RUN_OUTCOMES_DESIGN,
  GENERATOR_CAPABILITIES_DESIGN, and RETRIEVAL_CONTROLS_DESIGN each went
  through. Ratified as refined, with four decisions resolved: undeclared
  rating stays permanently non-blocking; vocabulary is `sfw`/`nsfw` (not
  the originally proposed `sfw`/`mature`); `content_rating` stays optional
  on new story creation; no escape hatch for cloud providers, final. Full
  record in the design doc's "Ratified decisions" section.
- 3b. Implementing in slices, same pattern as the four designs above,
  each slice its own commit + tests. **Slice 1 done, 2026-09-08**
  (`265955d`): marker schema 6, `content_rating` field
  (`src/stories.ts`/`src/application/model.ts`), `setContentRating`,
  `mnemo_story_use`'s `content_rating` param, `toStorySummary`. The
  round-trip-preservation property was mutation-tested against real OC
  at all three rewrite call sites (`setKindroidTarget`/
  `setNarratorProfile`/`applyPositionUpdate`) -- one mutation
  (`applyPositionUpdate`) initially survived because the test asserted
  only the in-memory return value, which stays correct via object-spread
  even when the persisted write drops the field; fixed to re-fetch via
  `findStory` before any later write could mask it. **Slice 2 done,
  2026-09-08** (`f546f1c`): `LlmProvider.contentCapability` on every
  provider (getter over config, mirroring `name`); four new env vars
  (`OLLAMA_CONTENT_CAPABILITY`/`KINDROID_CONTENT_CAPABILITY`/
  `BOTIFY_CONTENT_CAPABILITY`/`ATLASCLOUD_CONTENT_CAPABILITY`), each
  default `sfw`; anthropic/openai/gemini hardcoded `sfw` with no env var
  at all, per ratified decision 4. No test file exists for
  `generator-config.ts` (a pre-existing gap, not new scope for this
  slice), so the one genuinely risky branch -- only atlascloud reads an
  override -- was verified by executing the real module with real env
  vars via a throwaway probe script, not just read: all 7 provider/
  override combinations resolved correctly, and an invalid value failed
  startup with the expected actionable error. **Slice 3 done, 2026-09-08**
  (`04691a3`), closing the design: the gate in `dispatchGenerate()`,
  `content_rating` wired through `ContextBundle`/`ContinuationPort` at
  zero extra OC round trips (piggybacks on the fetch `position` already
  needed), mutation-tested both directions (gate disabled entirely; the
  "undeclared never blocks" rule broken specifically), real-OC-verified
  that `content_rating` resolves from an actual story marker. Two
  implementation refinements recorded in the design doc's "Implementation
  record": the refusal message names the provider, not the story; the
  position-write relabeling postscript is a shared helper, not duplicated
  across the two pre-dispatch throw sites now in that span.

  **Phase 3 fully closed.** Design-wise this unblocks "Ollama generator
  local-by-default" (Ollama-table row above) -- the content-routing
  machinery it would lean on now exists -- but that item is still a
  separate, unscoped piece of work; shipping this design doesn't itself
  complete it.

**Phase 4 — query-enrichment fixture labeling (operator-owned).**
RETRIEVAL_CONTROLS_DESIGN slice 3's settled-fixtures benchmark needs
operator-labeled expected-entity fixtures before `MNEMO_QUERY_ENRICHMENT`
can get a real win/no-win verdict (see the OpenClaw table's retrieval-
controls row).

- **4a done, 2026-09-08**: `ENRICHMENT_BENCHMARK_FIXTURES.xlsx` (this
  directory; a spreadsheet, not a markdown doc — a `Fixtures` sheet, one
  row per fixture with dedicated "Operator: corrected expected/excluded"
  and "Operator notes" columns to fill in directly; a `Story Context`
  sheet with each story's premise and real exited-entity quotes; a
  `How to Review` sheet with instructions). 14 candidate fixtures across
  the five settled stories (battlechasers, brass-and-nerve, chaos-saga,
  midnight-is-a-suggestion, miskatonic-archives-the-blackwood-case),
  grounded in real character/scene content read fresh from each story's
  `data/` tree (gitignored), not fabricated. 4 vague/enrichment-exercising,
  4 short-but-rich negatives (the "Aria dies" shape the design's own
  revision note requires), 4 explicit controls, 2 recall-only baselines
  for `midnight-is-a-suggestion` (which has zero played scenes anywhere,
  so no enrichment fixture is possible there yet). Three rows are
  highlighted (Judgment call = YES) where this session could not
  confidently resolve the expected labels alone (most notably `BC-1`:
  whether a dead-since-1888 lore thread the current investigation is
  actively pursuing counts as "unwanted persistence" or legitimate
  recall — the design's two metrics don't cleanly separate that case).
- **4b next, operator-owned**: review/correct the candidate labels in
  that spreadsheet — genuinely a narrative-judgment call, not something
  to automate.
- **4c after that**: build the (not-yet-existing) benchmark script, run
  it against the corrected fixtures, record the verdict in
  RETRIEVAL_CONTROLS_DESIGN.md, decide `MNEMO_QUERY_ENRICHMENT`'s
  default accordingly.

The ~60 explicit non-adoptions across the original four docs are not restated here;
each doc's own "Explicit non-adoptions" table remains authoritative for what
was rejected and why.
