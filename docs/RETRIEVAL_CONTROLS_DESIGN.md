# OC Retrieval Controls & Vague-Direction Enrichment Design

**Status:** Proposal, recorded 2026-08-28; **not ratified**. This document
does not schedule work. [STATUS.md](../STATUS.md) remains the source of
current priority. Rationale lives in
[OPENCLAW_ADOPTION_ASSESSMENT.md §5](OPENCLAW_ADOPTION_ASSESSMENT.md#5-openchronicle-retrieval-controls-and-vague-direction-enrichment).

**Live evidence (2026-08-28):** the deployed OC's `memory_search`
advertises `query, top_k, project_id, tags, offset, compact, mode, phrase,
pinned_limit, include_pinned` — probed against the NAS deployment's actual
tools/list, not inferred from pinned source. Exposing the controls is
therefore mechanical; nothing here waits on an OC release.

## Problem (what the code does today)

- `OcClient.memorySearch` exposes only query/project/tags/topK and its
  result type omits relevance ([src/oc-client.ts](../src/oc-client.ts)),
  so Mnemosyne cannot ask for keyword-vs-semantic mode, exact phrases,
  compact rows, or a pinned-float cap — and drops the ranking signal the
  ContextPlan design wants to preserve.
- Entity overwrite detection can miss an exact existing name when the
  hybrid top-50 window is occupied — a documented limitation in
  [src/entities.ts](../src/entities.ts) that produces false creates.
- Context gathering queries every entity type with the raw direction;
  `continue`-style directions carry almost no signal.

## Design

### 1. Expose the existing controls (mechanical)

`OcMemorySearchOptions` gains `mode?: "hybrid" | "keyword" | "semantic"`,
`phrase?: boolean`, `compact?: boolean`, `pinnedLimit?: number`, passed
through verbatim. The result schema gains OC's per-result `relevance`
(nullish — feeds `ContextEntry.relevance` in
[CONTEXT_PLAN_DESIGN.md](CONTEXT_PLAN_DESIGN.md)). Semantics documented at
the option, per the assessment: `pinnedLimit` caps the pinned *float*;
zero disables the float but pins still rank normally; an RRF score is not
a probability.

### 2. Phrase-first overwrite lookup

`saveEntity`'s overwrite detection runs a keyword+phrase search for the
exact name before the existing header comparison. Reduces false creates;
it is **not** an absolute guarantee for arbitrarily large stories — the
deterministic fix remains an eventual OC exact `(project, type, name)`
endpoint (an OC-side item, to be filed as `mcp-feedback` when this
ships). Regression test: an exact-name entity placed outside the original
hybrid window is found.

### 3. Vague-direction enrichment (benchmark-gated, last)

Deterministic, no LLM query rewriting:

1. Information-rich directions are untouched. "Vague" = a small
   normalized set (`continue`, `go on`, `next`, …) or below a length
   floor (proposal: < 20 chars) — the classifier is a pure function with
   its own tests.
2. For vague directions only, entity queries (character/location/lore/
   worldbuilding) get the newest validation-safe scene's **name plus a
   bounded tail excerpt** (proposal: 300 chars) appended. Scene selection
   itself stays deterministic and keeps ranking by the raw direction.
3. `validation:errors` scenes never enrich a query.

**Benchmark before default-on.** Measured on real story data: vague and
explicit direction sets scored separately; metrics are (a) recall of the
entities a human marks as expected for the scene and (b) unwanted
persistence of characters/locations that have exited. Ships behind
`MNEMO_QUERY_ENRICHMENT` (default off) until the benchmark shows a lift
on (a) without regressing (b).

**Benchmark caveat (live evidence):** an open `mcp-feedback` issue —
hybrid search returning 0 hits for just-saved memories, most plausibly
async-embedding lag (filed 2026-08-28 in openchronicle-mcp's OC project;
the same defect currently fails one live `continue.test.ts` case) — sits
on exactly the `memory_search` path this benchmark exercises. The
benchmark must either wait on that diagnosis or control for it by running
against **settled fixtures** (stories saved long enough ago that
embeddings exist — the five live consolidated stories qualify), never
freshly-saved test data.

## Explicitly out of scope

- LLM query rewriting (assessment: rejected).
- An OC-side ordered/tag-filtered query or exact-name endpoint — OC's
  decision; already filed as dogfooding feedback.
- Changing the scene-context strategies themselves (recency-first /
  query-ranked are ratified behavior).

## Acceptance tests

- Pass-through tests: each new option lands verbatim in the OC request;
  relevance survives into results.
- Phrase-lookup regression: exact name outside the hybrid window found;
  overwrite (not create) performed.
- Vague classifier: table-driven cases; excerpt bounded by count and
  chars.
- Enrichment off by default; enabled only via the env flag until the
  benchmark result is recorded in STATUS.
- `validation:errors` scenes excluded from enrichment (regression).

## Slices

1. Options + relevance pass-through (mechanical, live-schema-confirmed).
2. Phrase-first overwrite lookup with regression coverage.
3. Enrichment behind the flag + the benchmark run against settled
   fixtures; default flips only on a recorded win.

## Decisions needed at ratification

1. Confirm the vague-direction heuristic (list + <20-char floor) and the
   300-char excerpt bound.
2. Whether the benchmark waits on the embedding-lag diagnosis or runs on
   settled fixtures now (recommendation: settled fixtures now — the five
   consolidated stories are ideal and the diagnosis is OC-side work with
   no schedule).
