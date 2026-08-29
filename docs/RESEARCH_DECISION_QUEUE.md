# External-System Research Decision Queue

**Status:** Reconciliation artifact, created 2026-08-28. The four adoption
assessments (Ollama, OpenClaw, Open WebUI, NemoClaw) were read end-to-end and
triaged on 2026-08-28 (see [STATUS.md](../STATUS.md)'s Done log); that entry
claims "a decision queue of 20 live proposals" without enumerating it. This
document is that enumeration: every row of the four docs' recommendation
tables, with its current disposition. **Nothing here is ratified.** An "open
candidate" becomes work only by explicit operator decision, and the
2026-08-28 pause ("next direction deliberately unset, shaped by live use")
stands.

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
| P1 | Model-aware, fail-closed context admission (`/api/show` profile, `truncate:false`/`shift:false`) | Open candidate — designed as part of [CONTEXT_PLAN_DESIGN.md](CONTEXT_PLAN_DESIGN.md) (this row and the OpenClaw ContextPlan row are one design) |
| P1 | Typed native request/response contract | **Partially shipped** — `ebb6d36` fixed numeric `keep_alive` and pinned placement/shape in tests; the full builder/parser/typed-error contract (Slice A) is open. **Mechanical — ratifiable from the assessment directly, no design doc needed** |
| P1 | Stable `num_ctx`, preload without inference (empty-message load), `/api/ps` residency | Open candidate — designed as part of [CONTEXT_PLAN_DESIGN.md](CONTEXT_PLAN_DESIGN.md) slice 2 (stable-context policy is that design's decision #1) |
| P1 | Consume native usage/route/error metadata | **Partially shipped 2026-08-28** — the usage/timing half landed with the `ModelUsage` envelope (exact tokens + ns→ms load/eval durations). Still open: carrying route fields through results, and the typed error classification (missing model / capability mismatch / 429/503 / timeout / abort mapping, configurable timeout) |
| P2 | Bounded preflight/diagnostics + deployment guidance | Open candidate |

## NemoClaw ([NEMOCLAW_ADOPTION_ASSESSMENT.md](NEMOCLAW_ADOPTION_ASSESSMENT.md))

| Doc rank | Item | Disposition |
|---|---|---|
| P0 | HTTP filesystem authority | **Shipped** `a12e992` — flat rejection per the assessment's own argument; see verification record above for the remaining integration-test gap |
| — | HTTP-transport integration test for the path refusal (the §1 acceptance proof) | **Shipped 2026-08-28** — `tests/http-integration.test.ts` now registers with `allowFilesystemPaths: false` exactly as `makeServer()` does for HTTP, proves `out_path`/`file_path` are refused over the wire before any filesystem operation, and proves the server-managed default export still works; non-vacuity confirmed by flipping the wiring (1 of 5 fails) |
| P1 | Runtime-validate sibling-MCP results + bounded required-tool discovery | **Shipped 2026-08-28** — zod schemas for every OC/Kindroid/Botify result at the extraction chokepoint (both `structuredContent` and text-fallback paths; errors name field paths, never payload values); `src/mcp-discovery.ts` does bounded name-only `tools/list` discovery (page/tool/name/cursor caps, duplicate and loop detection, zero `tools/call`) at each client's connect — OC fails startup, companions fail before any message is posted; live-verified against real OC (317 tests); `tests/mcp-contracts.test.ts` |
| P1 | Separate liveness from protected semantic readiness (`/api/status` / `mnemo_status`) | **Shipped 2026-08-28** (as `/api/status` only) — `src/readiness.ts` prober behind the existing bearer/Host-Origin boundary: OC re-verified via bounded tools/list, Ollama via `/api/show` (no inference), companions via non-mutating connect+discovery, cloud generators honestly `not_probed` (a real probe is billable); 15s TTL cache; `/health` stays public liveness-only. An MCP `mnemo_status` twin for stdio operators is a recorded non-goal of this slice, not an omission |
| P2 | Endpoint/redirect/error-body/final-sink-redaction hygiene | Open candidate — mirrored in Known Gaps. **Mechanical — ratifiable from the assessment directly, no design doc needed** |
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
| High | Structured, budgeted, inspectable `ContextPlan` | **Ratified 2026-08-28, in build** — [CONTEXT_PLAN_DESIGN.md](CONTEXT_PLAN_DESIGN.md); measurement gates run (any-mismatch reloads confirmed live → stable per-model context; truncate/shift accepted on both daemons) |
| High | Per-story continuation lane / run registry | **Rejected at triage** — the doc itself records no production incident; revisit on real evidence |
| High | Cancellation, replay-safe typed outcomes (`RunContext`, `canon_write_unknown`, Botify timeout parity, REST error fidelity) | **Ratified 2026-08-28; slices 1–2 shipped same day** — [RUN_OUTCOMES_DESIGN.md](RUN_OUTCOMES_DESIGN.md): RunContext + phase-boundary aborts (guarded `res.close` on REST, `extra.signal` on MCP), `RunOutcomeError` with the ratified status map through the REST error handler, `run_id` on success, companion producers mapped (Kindroid timeout/readback, Botify readback + new timeout parity), and success-shaped `canon_write_outcome`. Slice 3 (lifecycle: shutdown owner, single-flight connect, OC retry classification, atomic config) still to land. Idempotency keys stay excluded with the rejected registry |
| Medium | Static generator capability descriptors | **Ratified and shipped 2026-08-28** — [GENERATOR_CAPABILITIES_DESIGN.md](GENERATOR_CAPABILITIES_DESIGN.md): `src/capabilities.ts` static table + instance-keyed async resolver (Ollama effective window from live `/api/show`, cloud all-unknown), `GET /api/capabilities` with both descriptors, capability-gated Web UI controls (`supported:false` removed, `unknown` enabled-with-hint), and warn-don't-break `capability_warnings` on continuation responses; `tests/capabilities.test.ts`. ContextPlan stage 3 stays a documented no-op while cloud windows are unknown |
| Medium | OC retrieval controls (mode/phrase/compact/pinnedLimit) + vague-direction enrichment | **Ratified 2026-08-28, in build** — [RETRIEVAL_CONTROLS_DESIGN.md](RETRIEVAL_CONTROLS_DESIGN.md); per-mode relevance fixtures captured; enrichment flag ships OFF pending the recorded benchmark |
| Later | Provenance-bound current-state proposals | Parked — prototype-only per the doc; needs an OC compare-and-set contract for any apply path |
| High | Operational safety: prose out of default logs, admission/shutdown ownership, OC retry classification, atomic config writes | **Partially shipped 2026-08-28** — the logging half landed: tool logs record lengths/counts instead of story text (prose fields always, long strings and arrays generally), full args require the `MNEMO_LOG_CONTENT=true` opt-in; `tests/tool-logging-privacy.test.ts`. Admission/shutdown ownership, OC retry classification, and atomic config writes are now designed in [RUN_OUTCOMES_DESIGN.md](RUN_OUTCOMES_DESIGN.md); final-sink secret redaction remains open and is mechanical (no design doc needed) |

## Ranked next-up, if and when the pause ends

Dependency-and-severity order from the docs' own rankings — a menu, not a
schedule:

1. ~~**Ollama P0 ×3**~~ — all three shipped 2026-08-28 (completion
   integrity, validator locality, schema-validated verdicts — see the
   Ollama table above). No P0 remains anywhere in the set.
2. ~~**NemoClaw §1 integration test**~~ — shipped 2026-08-28 (see above).
3. **NemoClaw P1 ×2** — sibling-MCP contract validation, then semantic
   readiness (readiness builds on the discovery machinery). The largest
   remaining items; each wants its own design pass before code.
4. ~~**Privacy-safe logging**~~ — the logging half shipped 2026-08-28 (see
   the OpenClaw table); the §7 remainder (shutdown ownership, OC retry
   classification, atomic config writes, final-sink redaction) stays open.
5. ~~**Usage telemetry**~~ — shipped 2026-08-28 (see the Open WebUI
   table). (Cloud finish-reason adoption, added later, also shipped
   2026-08-28.) Every item on this ranked list is now shipped except the
   §7 operational-safety remainder.
6. Everything else waits for its documented trigger.

The ~60 explicit non-adoptions across the four docs are not restated here;
each doc's own "Explicit non-adoptions" table remains authoritative for what
was rejected and why.
