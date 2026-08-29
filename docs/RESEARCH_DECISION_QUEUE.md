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
| P1 | Model-aware, fail-closed context admission (`/api/show` profile, `truncate:false`/`shift:false`) | Open candidate |
| P1 | Typed native request/response contract | **Partially shipped** — `ebb6d36` fixed numeric `keep_alive` and pinned placement/shape in tests; the full builder/parser/typed-error contract (Slice A) is open |
| P1 | Stable `num_ctx`, preload without inference (empty-message load), `/api/ps` residency | Open candidate — warmup-at-configured-ceiling shipped earlier (2026-08-27 remediation); the load-op and residency pieces are open |
| P1 | Consume native usage/route/error metadata | Open candidate — overlaps the Open WebUI `ModelUsage` envelope; implement once, together |
| P2 | Bounded preflight/diagnostics + deployment guidance | Open candidate |

## NemoClaw ([NEMOCLAW_ADOPTION_ASSESSMENT.md](NEMOCLAW_ADOPTION_ASSESSMENT.md))

| Doc rank | Item | Disposition |
|---|---|---|
| P0 | HTTP filesystem authority | **Shipped** `a12e992` — flat rejection per the assessment's own argument; see verification record above for the remaining integration-test gap |
| — | HTTP-transport integration test for the path refusal (the §1 acceptance proof) | **Shipped 2026-08-28** — `tests/http-integration.test.ts` now registers with `allowFilesystemPaths: false` exactly as `makeServer()` does for HTTP, proves `out_path`/`file_path` are refused over the wire before any filesystem operation, and proves the server-managed default export still works; non-vacuity confirmed by flipping the wiring (1 of 5 fails) |
| P1 | Runtime-validate sibling-MCP results + bounded required-tool discovery | **Open candidate** — mirrored in STATUS.md Known Gaps |
| P1 | Separate liveness from protected semantic readiness (`/api/status` / `mnemo_status`) | **Open candidate** — mirrored in Known Gaps |
| P2 | Endpoint/redirect/error-body/final-sink-redaction hygiene | Open candidate — mirrored in Known Gaps |
| Conditional | NemoClaw as an MCP host (compatibility spike) | **Rejected at triage** — blocked on the boundary items; revisit only per the doc's own triggers |
| Corroboration | Provider capability descriptor | Not a separate item — see OpenClaw row 4 |

## Open WebUI ([OPEN_WEBUI_ADOPTION_ASSESSMENT.md](OPEN_WEBUI_ADOPTION_ASSESSMENT.md))

| Doc rank | Item | Disposition |
|---|---|---|
| High-value experiment | Open WebUI host compatibility spike (native MCP, then optional Pipe) | **Rejected at triage** — the doc's own analysis predicts a structural failure (host-model paraphrase vs the already-saved exact beat) |
| Medium-high | Provider usage/timing telemetry (`ModelUsage` envelope, generator/validator kept separate) | **Open candidate** — the set's clearest genuinely new capability; pairs with Ollama P1 telemetry |
| High | Recoverable continuation runs + SSE events | **Parked** — the HTTP projection of the per-story run registry, which was deliberately not taken (no incident proves the race) |
| Conditional | Stale-aware, noncommitting beat proposals | **Parked** — needs capability descriptors + structured context identity first; companion providers excluded by side effect |
| Low-risk | Accessibility hardening | **Shipped** `9be11f3` (the four cited defects); walkthrough/announcement items travel with the run contract |

## OpenClaw ([OPENCLAW_ADOPTION_ASSESSMENT.md](OPENCLAW_ADOPTION_ASSESSMENT.md))

| Doc rank | Item | Disposition |
|---|---|---|
| High | Structured, budgeted, inspectable `ContextPlan` | Open candidate |
| High | Per-story continuation lane / run registry | **Rejected at triage** — the doc itself records no production incident; revisit on real evidence |
| High | Cancellation, idempotency, replay-safe typed outcomes (`RunContext`, `canon_write_unknown`, Botify timeout parity, REST error fidelity) | Open candidate |
| Medium | Static generator capability descriptors | Open candidate — prerequisite for variants, capability-aware UI, and usage telemetry labeling |
| Medium | OC retrieval controls (mode/phrase/compact/pinnedLimit) + vague-direction enrichment | Open candidate |
| Later | Provenance-bound current-state proposals | Parked — prototype-only per the doc; needs an OC compare-and-set contract for any apply path |
| High | Operational safety: prose out of default logs, admission/shutdown ownership, OC retry classification, atomic config writes | Open candidate — the logging item is the sharpest (narrative prose is default telemetry today) |

## Ranked next-up, if and when the pause ends

Dependency-and-severity order from the docs' own rankings — a menu, not a
schedule:

1. ~~**Ollama P0 ×3**~~ — all three shipped 2026-08-28 (completion
   integrity, validator locality, schema-validated verdicts — see the
   Ollama table above). No P0 remains anywhere in the set.
2. ~~**NemoClaw §1 integration test**~~ — shipped 2026-08-28 (see above).
3. **NemoClaw P1 ×2** — sibling-MCP contract validation; semantic readiness.
4. **Privacy-safe logging** (OpenClaw §7) — prose out of default logs.
5. **Usage telemetry** (Open WebUI §3 + Ollama §7, one implementation).
6. Everything else waits for its documented trigger.

The ~60 explicit non-adoptions across the four docs are not restated here;
each doc's own "Explicit non-adoptions" table remains authoritative for what
was rejected and why.
