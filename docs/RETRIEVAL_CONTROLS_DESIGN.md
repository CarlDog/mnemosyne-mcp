# OC Retrieval Controls & Vague-Direction Enrichment Design

**Status:** Proposal, recorded 2026-08-28, revised same day after an
adversarial review (5 findings; see the revision note at the end);
since **RATIFIED** — see the ratification block below. This document does not schedule work by itself; the ratified slices are in build.
[STATUS.md](../STATUS.md) remains the source of current priority.
Rationale lives in
[OPENCLAW_ADOPTION_ASSESSMENT.md §5](OPENCLAW_ADOPTION_ASSESSMENT.md#5-openchronicle-retrieval-controls-and-vague-direction-enrichment).

**Live evidence (2026-08-28):**

- Request side: the deployed OC's `memory_search` advertises `query,
  top_k, project_id, tags, offset, compact, mode, phrase, pinned_limit,
  include_pinned` — probed against the NAS deployment's actual
  tools/list.
- Response side: a captured live `memory_search` response shows the
  ranking metadata as `relevance: {channel, rrf_score,
  semantic_similarity, keyword_rank}` — an **object**, not a bare score
  (the first draft assumed a number; a wrong shape under `.nullish()`
  would have deserialized to silent `undefined` forever). Hybrid-mode
  capture only; keyword/semantic modes must be captured before slice 1
  pins the schema.

**Ratified 2026-08-28** (operator "go ahead" on the reviewed revision) with
decisions: ① the revised vague heuristic (normalized set, OR <20 chars
AND no entity-name token) and ≤120-char excerpt; ② settled-fixtures
benchmark, flag ships OFF and flips only on a recorded win. Per-mode
`relevance` fixtures captured live 2026-08-28: hybrid
`{channel,rrf_score,semantic_similarity}`, keyword
`{channel,keyword_rank}` (NO rrf_score), semantic
`{channel,semantic_similarity}` (NO rrf_score); pinned-floated rows omit
`relevance` entirely — so the schema is a four-field nullish object and
`rrf_score` exists only in hybrid mode.

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

### 1. Expose the existing controls (mechanical — with one schema split)

`OcMemorySearchOptions` gains `mode?: "hybrid" | "keyword" | "semantic"`,
`phrase?: boolean`, `pinnedLimit?: number`, passed through verbatim.
`compact` is **not** bolted onto the same method: OC's compact rows carry
`content_preview`/`content_length` instead of `content`, so a
`compact: true` result would be rejected wholesale by the shared
`OcMemorySchema` (the repo already models this split for `memory_list` —
`memoryListCompact`). If a compact search consumer appears, it gets a
`memorySearchCompact` variant with the compact schema; none is needed for
the consumers named here, so v1 omits it.

The search result schema gains a `relevance` object
(`{channel?, rrf_score?, semantic_similarity?, keyword_rank?}`, whole
field `.nullish()`), added on a **search-specific** schema
(`OcMemorySchema.extend(...)`) — `memory_get`/`memory_list`/save/update
results never carry it and keep the base schema.
`ContextEntry.relevance` in
[CONTEXT_PLAN_DESIGN.md](CONTEXT_PLAN_DESIGN.md) carries the extracted
`rrf_score`. Semantics documented at the option, per the assessment:
`pinnedLimit` caps the pinned *float*; zero disables the float but pins
still rank normally; an RRF score is not a probability.

### 2. Phrase-first overwrite lookup

`saveEntity`'s overwrite detection runs a keyword+phrase search for the
exact name before the existing header comparison. The type-tag filter
already confines candidates to the same entity type, so cross-type
mentions can't crowd the window — but **the residual miss mode remains
in kind**: within-type body mentions (a character named in thirty other
characters' relationship sections) can still outrank the
`[Character] Name` header memory past the top-50 window. This narrows
the failure, it does not eliminate it; the deterministic fix remains an
eventual OC exact `(project, type, name)` endpoint (an OC-side item, to
be filed as `mcp-feedback` with exactly this residual-miss justification
when this ships). Regression test: an exact-name entity placed outside
the original hybrid window is found and overwritten, not duplicated.

### 3. Vague-direction enrichment (benchmark-gated, last)

Deterministic, no LLM query rewriting:

1. Information-rich directions are untouched. **"Vague" = (a member of a
   small normalized set — `continue`, `go on`, `next`, … ) OR (below a
   20-char floor AND containing no token that matches a known entity
   name in the story)**. The entity-name condition exists because a
   short direction can be maximally information-rich ("Aria dies", 9
   chars) — enriching it would bury its subject under the previous
   scene's vocabulary. The classifier is a pure function with its own
   table-driven tests.
2. For vague directions only, entity queries (character/location/lore/
   worldbuilding) get the newest validation-safe scene's **name plus a
   bounded tail excerpt** appended. The excerpt bound is a ratification
   decision with the tradeoff stated: at 300 chars the excerpt outweighs
   a short direction ~30:1 in the query, ranking the prior scene's cast
   — the exact "unwanted persistence" the benchmark's metric (b)
   penalizes; the revised proposal is **≤120 chars**, direction first.
3. **The excerpt scene is selected via the recency scan
   (`memoryListCompact` + created_at sort), never via search** — the
   list path has no embedding dependency, so live immediate-continue use
   (save a beat, continue seconds later) selects the true newest scene
   even while the open embedding-lag defect stands. This is what makes
   the settled-fixtures benchmark a valid control rather than a blind
   spot.
4. `validation:errors` scenes never enrich a query.

**Benchmark before default-on.** Measured on real story data: vague and
explicit direction sets scored separately; the vague fixture set MUST
include short-but-rich negatives ("Aria dies"-shaped) that the
classifier is expected to leave untouched. Metrics: (a) recall of the
entities a human marks as expected for the scene, (b) unwanted
persistence of characters/locations that have exited. Ships behind
`MNEMO_QUERY_ENRICHMENT` (default off) until the benchmark shows a lift
on (a) without regressing (b).

**Benchmark caveat:** the open embedding-lag `mcp-feedback` issue (filed
2026-08-28 in openchronicle-mcp's OC project; it currently fails one
live `continue.test.ts` case) sits on the `memory_search` path the
benchmark's *queries* exercise, so the benchmark runs against **settled
fixtures** (the five consolidated stories) — and the excerpt-scene
selection above is list-based precisely so that lag cannot skew which
scene enriches.

## Explicitly out of scope

- LLM query rewriting (assessment: rejected).
- A `memorySearchCompact` variant (no consumer yet).
- An OC-side ordered/tag-filtered query or exact-name endpoint — OC's
  decision; already filed as dogfooding feedback.
- Changing the scene-context strategies themselves (recency-first /
  query-ranked are ratified behavior).

## Acceptance tests

- Pass-through tests: each new option lands verbatim in the OC request.
- Response-shape tests against **captured fixtures of the real wire
  shape** (per mode): the relevance object survives into results on the
  search-specific schema; base-schema tools are unaffected.
- Phrase-lookup regression: exact name outside the hybrid window found;
  overwrite (not create) performed.
- Vague classifier: table-driven cases including short-but-rich
  negatives (entity-name condition) and long-but-vague strings.
- Excerpt selection uses the list path (test: enrichment picks the
  newest scene even when a search for it returns nothing).
- Enrichment off by default; enabled only via the env flag until the
  benchmark result is recorded in STATUS.
- `validation:errors` scenes excluded from enrichment (regression).

## Slices

1. Options + relevance pass-through (request side live-confirmed;
   response schema pinned from captured per-mode fixtures first).
2. Phrase-first overwrite lookup with regression coverage.
3. Enrichment behind the flag + the benchmark on settled fixtures;
   default flips only on a recorded win.

## Decisions needed at ratification

1. Confirm the revised vague-direction heuristic (normalized set, OR
   <20 chars AND no entity-name token) and the ≤120-char excerpt bound.
2. Confirm settled-fixtures-now for the benchmark (the list-based
   excerpt selection removes the lag blind spot; the OC diagnosis has no
   schedule).

## Revision note (2026-08-28)

An adversarial review confirmed 5 findings against the first draft; all
are folded in above. The load-bearing corrections: `compact` on
`memorySearch` would have been rejected wholesale by the shared result
schema (the request-side pass-through test would stay green while every
response failed) — dropped from v1 with the variant split specified; the
live evidence covered only the request schema while the response's
`relevance` was assumed a number — a captured live response shows an
object, and the schema is now search-specific and fixture-pinned per
mode; the <20-char floor classified short-but-rich directions
("Aria dies") as vague and the 300-char excerpt would have drowned them
~30:1 — the classifier gains the entity-name condition, the bound drops
to ≤120, and the benchmark must include such negatives; the excerpt
scene's selection mechanism was unpinned — now mandated list-based,
which is also what makes the settled-fixtures control valid; and the
phrase-lookup's residual within-type miss mode is stated precisely so
the OC exact-endpoint ask carries the right justification.
