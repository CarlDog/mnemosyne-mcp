# mnemosyne-mcp

MCP server for long-form storytelling on top of OpenChronicle memory.

## Status

Single source of truth: [STATUS.md](STATUS.md). Do not duplicate status
into this file, MEMORY.md, or Serena memories — reference STATUS.md.

## Current Sprint

Status lives in [STATUS.md](STATUS.md) — read it first. This section names only what
is in flight; it must never restate STATUS.md's Done log. (When the two disagree,
STATUS.md is newer.)

**Nothing application-side is currently in flight.** The genre declaration standard
(`docs/GENRE_DECLARATION_DESIGN.md`) is complete: slices 1 (tooling) and 2 (runtime)
shipped 2026-09-19, and slice 3 closed 2026-09-20. Every story with a canon tree
carries a declaration in its `canon/_story.md` under gitignored `data/` (eleven of
them), and the verifier's `REQUIRE_STORY_BLOCK` gate is ON, so an undeclared canon
now fails verification. The three drafts-only trees have no `canon/` at all, so the
validator already refuses them for that reason and the gate changes nothing there.

**Next up is the phase-end audit** (`phase-end-audit.md`), last run 2026-09-08.

**Storyline state is deliberately not summarised here.** Per standing operator rule
(2026-09-12), committed paths carry application material only: no storylines, drafts,
characters, premises or story discussion, because this repository may be made public
and its private narrative content must not travel with it. Story state, cross-story
rulings, the hook register and deferred storyline research all live in the operator's
local, gitignored `data/` tree:

- `data/stories/<slug>/` — per-story canon, drafts, history and sources.
- `data/cross-story/` — rulings that bind more than one story, the non-canon hook
  register, deferred storyline research and reboot/session handoffs.
- `data/stories/_art-library/README.md` — where installed, the private unified
  cast/reference gallery and its launcher; live refresh and offline snapshots
  are distinct. This helper is not part of the application deployment.

To orient on story state, read those trees directly. **`data/` is gitignored, so
`git status` stays clean while story trees you have not read sit on disk** — verify
counts with `node scripts/validate-canon.mjs <slug>`, which exits 0 only for a tree
that exists, is readable, and holds at least one entity.

Two standing operator instructions that outlive any sprint:

- **Nothing is locked in as canon until explicitly directed.** No story's `canon/`
  has been imported wholesale, and no story's canon is locked in. One narrow,
  explicitly-directed exception exists (2026-09-19): each live story's
  CONTENT-POLICY entities were synced from its own `canon/`, because the live
  copies still carried a cloud platform's PG-13 ceiling their canon had already
  reversed. Six entities across six stories; nothing else was imported. See
  STATUS.md's newest entry.
- **Promotion is set aside indefinitely** (2026-09-08). Do not propose or push toward
  promoting an overlay unless the operator raises it first.

## Stack

- TypeScript (Node >=26, ESM, `NodeNext` module resolution)
- `@modelcontextprotocol/sdk` (high-level `McpServer` API)
- `zod` for tool input schemas
- `vitest` for tests

## Layout

- `src/index.ts` — MCP server entry, env validation, `GENERATOR_PROVIDER`
  selection, tool registration. `makeServer()` factory + a stdio/HTTP
  mode switch on `MCP_PORT` (unset = stdio).
- `src/generator-config.ts` — every environment variable the server reads,
  the validation that rejects a bad one, and the `GeneratorConfig` provider
  construction consumes. It decides *what* to build; `index.ts` builds it.
  Importing it validates the environment and exits non-zero on a bad value,
  which is why `index.ts` imports it before anything else.
- `src/instructions.ts` — the MCP `instructions` string handed to every
  `McpServer`.
- `src/http-config.ts` — HTTP transport env config (`MCP_PORT`,
  `MCP_BIND_HOST`, `MCP_ALLOWED_HOSTS`, `MCP_AUTH_TOKEN`,
  `MCP_SESSION_IDLE_MS`).
- `src/shared/http-transport.ts` — `mountMcpHttp()`: fleet-canonical
  Streamable HTTP transport (fresh `McpServer` per session, idle-session
  eviction, Host/Origin allowlist, bearer auth) — a verbatim copy
  of kindroid-mcp's own `src/shared/http-transport.ts` — bodies are identical; only the
  4-line provenance header differs, since each repo records where its own
  copy came from. Diff past line 4 when checking for fleet drift.
- `src/api-security.ts` — `apiSecurity()`: the same Host/Origin allowlist
  + bearer-auth check as `shared/http-transport.ts`, reimplemented (not
  imported — that file's body must stay verbatim) as Express middleware
  protecting `/api/*` and the static web UI.
- `src/api/` — the REST layer the web UI talks to: `index.ts`
  (`createApiRouter()`, mirrors `tools/index.ts`'s orchestrator shape),
  `stories.ts`, `entities.ts`, and `interactive.ts` (route handlers — thin
  JSON driver adapters; `interactive.ts` wraps the same application use
  cases the MCP tools do, while `entities.ts`'s single-entity GET/PATCH/
  DELETE call `src/entities.ts`'s domain functions directly — no
  application-layer write use case exists yet, and the GET route set this
  precedent first), `helpers.ts` (`asyncRoute()`, input/error handling).
- `src/application/` — transport-independent application use cases shared by
  MCP and REST drivers. Continuation, standalone validation, and bulk scene
  revalidation plus story/entity catalog reads live here. `application/ports/`
  owns the continuation, catalog, validation, scene-persistence, and observer
  contracts; catalog/verdict policy is pure and application-owned.
  `tests/architecture-boundaries.test.ts` parses TypeScript ASTs to enforce
  driver independence, application dependency direction, port routing, and
  composition-root ownership.
- `src/adapters/` — concrete outbound adapters for OC, generators, validation,
  persistence, environment, clock, and logging. `src/index.ts` constructs these
  bindings once, assembles one `ApplicationUseCases` contract, and injects it
  into both inbound drivers.
- `webui/` — the actual web UI: entity-library browse/detail/edit/delete
  plus the interactive continue/validate flow. Edit is a partial update
  (missing fields echo back the existing value, never blanked) and refusing
  flagged content surfaces a dedicated banner with the matched excerpts and
  an explicit override button; delete has an inline (non-native) confirm
  step. A separate npm package — React 19 +
  Vite + react-router,
  its own tsconfig (browser/JSX target, incompatible with the server's
  `NodeNext`/no-DOM config) and its own eslint config (pinned to eslint 9;
  `eslint-plugin-react-hooks`'s peer range doesn't reach 10 yet). `npm run
  build` at the repo root builds this too and copies its output into
  `dist/webui/` (`scripts/copy-webui-dist.mjs`) for `src/index.ts` to
  serve as static files + a SPA-fallback route. Dev: `npm --prefix webui
  run dev` runs Vite's own server, proxying `/api/*` to the Express
  server started via the root's `npm run dev`.
- `src/oc-client.ts` — Streamable HTTP MCP client wrapper for OC. Every
  project-scoped method asserts its scope at the wire (see
  `src/story-scope.ts`); `memorySearch` is the one that can opt out, and
  only through an explicit `allProjects: true`.
- `src/kindroid-client.ts` — Streamable HTTP MCP client wrapper for
  kindroid-mcp (same shape as `oc-client.ts`).
- `src/config.ts` — local config (current story pointer; repo-local
  `data/` dir, gitignored, `MNEMO_DATA_DIR` override — Docker-mountable
  as persistent storage; legacy OS-config-dir location auto-migrates).
- `src/stories.ts` — story marker logic, plus `resolveStoryId(oc,
  explicit?)`: the per-call `story` override every story-touching tool
  accepts, falling back to the active-story pointer (pure file I/O, no
  OC call) when omitted. Also owns position tracking's marker fields
  (schema 5, `docs/POSITION_TRACKING_DESIGN.md`): `mergePositionUpdate`/
  `resolveElapsedHours`/`currentStoryDatetime` (pure) and `setPosition`/
  `applyPositionUpdate` (OC-backed) — the latter the single shared
  validate-then-apply chokepoint both `mnemo_position_set` and
  `mnemo_continue`'s `advance`/`set_date`/`move_to` call through.
- `src/entities.ts` — entity CRUD + recall, plus `listAllEntities()` (a
  complete, unranked enumeration — no cap, unlike `recall()`) and
  `filterListedEntities()` (pure: optional type filter + default body
  strip, backing `mnemo_list_entities`), and `deleteEntityByMemoryId()` (the
  id-keyed counterpart to `deleteEntity()`'s (type, name) lookup, for a
  caller — the web UI — that only has the memory id; reuses
  `getEntityByMemoryId`'s story-ownership check rather than `deleteEntity`'s
  ranked search, which can miss or resolve to the wrong record in a
  same-type-crowded story). `saveEntity()` is the default chokepoint every
  entity write funnels through and scans by default (`src/injection-scan.ts`)
  unless the caller sets `skipInjectionScan` (already scanned upstream, or —
  the one true "never scan" exception — `mnemo_continue`'s generated-beat
  save) or `allowFlagged` (write anyway, keeping the matched signals as an
  audit trail on the result). A flagged, non-overridden write throws
  `FlaggedContentError` (not a plain `Error`) carrying the matched
  `InjectionSignal[]` as structured data, so a caller like `src/api/
  entities.ts`'s PATCH route can catch it specifically and return a clean
  4xx instead of losing the excerpt to a generic error handler.
- `src/injection-scan.ts` — `scanForInjectionSignals()` /
  `describeInjectionSignals()`: the deterministic, precision-leaning
  regex scan for instruction-shaped text (docs/NARRATOR_EVAL.md's
  measured 35% companion-chat obedience rate). `saveEntity()` is the
  default chokepoint; `mnemo_import_story`'s `planImport` and
  `mnemo_session_break`'s greeting check scan directly via this module
  instead, because each needs the verdict before `saveEntity` would even
  run (a whole-batch preflight; a check before `chatBreak` transmits the
  greeting to the kin, ahead of the later OC save). Exports
  `OVERRIDE_FLAGGED_CONTENT_PARAM`, the one shared constant every tool's
  `override_flagged_content` zod field and hint text reference, so they
  can't drift apart.
- `src/prompt.ts`, `src/validator.ts`, `src/llm.ts`, `src/export.ts`,
  `src/import.ts` — domain logic.
- `src/kindroid-provider.ts` — `KindroidProvider implements LlmProvider`;
  generator-only (validator always stays on Ollama). Exports
  `buildKindroidMessage()` (pure, unit-tested) — a wrapper over the
  shared companion-message builder that adds the group @-mention nudge.
- `src/companion-message.ts` — the shared keyphrase-gated context
  builder both companion-chat providers (Kindroid, Botify) fold story
  entities through. Extracted so the word-boundary matching and the
  scene/location-inclusion rules can't drift between consumers. Position
  (`docs/POSITION_TRACKING_DESIGN.md`), when the story has tracking on,
  joins scenes/locations as unconditional rather than keyphrase-gated,
  as a "Current position: ..." line.
- `src/botify-client.ts` / `src/botify-provider.ts` — Botify generator
  (MCP client to botify-mcp, same shape as the Kindroid pair; target is
  a chat UUID via `BOTIFY_STORYTELLING_CHAT`).
- `src/llm-http.ts` — shared POST/timeout/transport-error scaffolding
  for the direct-API cloud providers.
- `src/anthropic-provider.ts`, `src/gemini-provider.ts`,
  `src/openai-compat-provider.ts` — direct HTTP cloud generators (no
  SDKs). The OpenAI-compatible class serves both `openai` and
  `atlascloud` (and any compatible host via `OPENAI_BASE_URL`).
- `src/tools/*.ts` — MCP driver registrations (one file per tool surface),
  responsible for protocol schemas and response mapping rather than shared
  orchestration policy.
- `src/run-context.ts` / `src/run-outcome.ts` — run identity + typed
  replay-safe outcomes (RUN_OUTCOMES_DESIGN, ratified): `RunContext`
  carries the caller's abort signal (consulted at phase boundaries only —
  a dispatched generation always completes and saves), `RunOutcomeError`
  carries the retry-safety projection and ratified HTTP status map.
  `retry_safe` is table-derived by default but overridable per instance
  (constructor `opts.retrySafe`, mirroring the existing
  `externalMutationPossible` override) — added 2026-09-07 so a caller that
  knows a LOCAL mutation happened before an otherwise-pre-dispatch failure
  (position tracking's `advance`/`set_date`/`move_to`, see
  `docs/POSITION_TRACKING_DESIGN.md` refinement 5) can correct the stock
  projection instead of it silently telling a retrying caller nothing
  happened.
- `src/context-plan.ts` — pure deterministic context admission
  (CONTEXT_PLAN_DESIGN, ratified): `planContext` drop tiers (protected
  rules/style never drop; untagged scenes → clean scenes → references,
  memory_id terminal tie-break), the `context_plan` response manifest,
  estimator calibration logging, `MNEMO_CONTEXT_ADMISSION` warn/enforce.
- `src/capabilities.ts` — generator capability descriptors
  (GENERATOR_CAPABILITIES_DESIGN, ratified): instance-keyed async
  resolver (Ollama effective window from live `/api/show`; cloud windows
  all-unknown by decision), `GET /api/capabilities` source,
  warn-don't-break `capabilityWarnings`.
- `src/mcp-discovery.ts` — bounded, name-only `tools/list` verification of
  sibling MCP services' required tool sets (NemoClaw §2): OC fails
  startup on a missing contract; companions fail before any message
  posts. Zero `tools/call` by construction.
- `src/readiness.ts` — the protected `GET /api/status` prober (NemoClaw
  §3): non-mutating, non-billable probes; cloud generators honestly
  `not_probed`; 15s TTL cache. `/health` stays public liveness-only. One
  `ReadinessProber` instance is constructed as a process-wide singleton in
  `src/index.ts` and shared by both `GET /api/status` and `mnemo_status`
  (`src/tools/status.ts`) — a second independent instance per surface would
  mean two uncoordinated caches instead of one that actually bounds probe
  frequency across every caller.
- `src/story-scope.ts` — `assertStoryScope()`: the one check that a story
  (OC project) id is actually present. OpenChronicle reads a MISSING project
  scope as every project, so an undefined or empty `storyId` silently widens
  a search into the whole database — which on 2026-09-19 made `saveEntity`
  overwrite an identically-named entity in an unrelated story and return a
  success shape. Asserted twice: at each story-scoped entry point in
  `src/entities.ts`, before its first OC call, and again on `OcClient`'s
  `memorySearch`/`memoryList`/`memoryListCompact`/`memorySave`. The one
  deliberate cross-project read (`listStories`) says so with a flag, so
  every exception is greppable rather than inferred from a missing field.
  Do not add a story-scoped path without the guard.
- `src/service-url.ts` — the one parser every configured service endpoint
  passes through (NemoClaw §4): http(s)-only, no embedded
  credentials/fragment/query; private addresses deliberately allowed.
- `src/log.ts` — structured stderr logger, with recursive sensitive-key +
  URL-userinfo redaction at the final sink (meta values; the authored
  message string is not scanned). Tool-argument prose never logs by
  default (`MNEMO_LOG_CONTENT=true` + `LOG_LEVEL=debug` is the explicit
  short-lived opt-in).
- `src/mcp-result.ts` — unwraps a sibling MCP server's tool result;
  throws an `isError` result's real message rather than returning error
  prose as a reply. Shared by the OC/Kindroid/Botify clients.
- `src/version.ts` — package version, surfaced in the server banner.
- `src/tools/helpers.ts` — `asyncRoute`-style tool wrappers plus
  `sanitizeToolArgsForLog`, which keeps narrative prose out of telemetry.
  It recurses into nested objects: an object used to fall through verbatim,
  which put a whole `genre_guidance` block into an INFO line.
- `src/genre.ts` — the genre declaration at runtime: the dictionary (a typed
  JSON import, so `tsc` emits it into `dist/` and one tracked file serves both
  `tsx src/` and `node dist/`), the validation every write surface shares
  (`assertGenres`/`assertGenreGuidance`, 1-3 terms broadest-first with no
  ancestor pair, the length caps), and the LENIENT read side the story marker
  uses, where anything that does not validate is dropped and the story simply
  reads as undeclared. Deliberately duplicates the rules in
  `scripts/canon-frontmatter.mjs` (scripts must run without a build);
  `tests/genre-runtime.test.ts` pins the two against one shared case table.
- `src/genre-dictionary.json` — the controlled genre vocabulary of
  `docs/GENRE_DECLARATION_DESIGN.md` §1: 40 parent-annotated terms
  (27 roots), each with a definition, what it promises and what it
  avoids, plus the broadest-first rule. Read through `import.meta.url` (the
  way `src/version.ts` reads `package.json`) by the scripts today and by the
  server in slice 2, so no emitted copy exists to go stale. Pinned by
  `tests/genre-dictionary.test.ts`, which pins the `version` too, so a
  revised term set cannot pass as the old shape. This file is the dictionary
  of record: no document keeps a prose copy of the term list.
- `tests/` — vitest, real OC + real Ollama (env-gated — see "Common
  Commands" for which vars enable which suites). `tests/helpers/story-fixtures.ts`
  sweeps orphaned overlay fixtures out of the REAL `data/stories/` tree before
  either overlay suite runs: those two suites must build fixtures there, because
  the verifier and the promotion tool resolve a story by slug under that root, and
  their `afterEach` cannot run when a test times out or the process is killed. The
  sweep deletes only a name matching the generator's exact shape AND whose owning
  process id is gone, so a sibling worktree's in-flight run is never deleted out
  from under it.
- `scripts/dump-prompt.mjs`, `scripts/dump-validation.mjs`,
  `scripts/dump-kindroid-group-message.mjs` — command-line diagnostics.
  Used during v0.1.2 dogfooding to pin the few-shot-vs-rule cause
  without going through Claude Desktop. They import from `dist/`, so
  rebuild first (a long-running MCP server holds the old `dist/`).
- `scripts/scaffold-story.mjs` — one-time export-JSON → `canon/` seeding
  for a story adopting the authoring layer. It skips generated scenes unless
  they are explicitly promoted and preserves the export entity key as a
  character's runtime identity even when its body contains a display/current
  `Name:` field. An export carrying `story.genres` and `story.genre_guidance`
  scaffolds `_story.md` as well, and the staged compile must reproduce the
  declaration; one field without the other is refused before any target exists.
- `scripts/validate-canon.mjs <slug> [--dir <canon-dir>] [--require-story-block]`
  — structural check of active or staged canon: entity/frontmatter shape,
  duplicate identities, scene catalog keys, reference/image containment, and
  non-empty bodies. Content correctness still needs a human pass. Missing,
  unreadable, or empty trees exit 1. The story block `_story.md`
  (`docs/GENRE_DECLARATION_DESIGN.md`) is read explicitly at the canon root,
  outside the entity walk: checked whenever it exists, required under the flag,
  which the overlay verifier now passes (every story is declared, 2026-09-20).
- `scripts/compile-story.mjs <slug> [--dir <canon-dir>] --check` — compiles a
  canon-shaped tree and runs the built server's real import schema/preflight
  with `writes=0`; `--out <file>` exclusively creates a checked export artifact
  but never imports it. A present `_story.md` is carried into the export's
  story block (`genres`, `genre_guidance`) and an invalid one fails the
  compile; its absence never does, and a name differing from `story.json` is
  a stderr warning only.
- `scripts/verify-draft-overlay.mjs <slug>` — verifies a manifest-driven draft
  overlay's operation inventory and hashes, validates active/isolated/merged
  trees, and runs the merged import preflight without promotion or import.
  `--canon-only <slug>` checks active canon alone; `--manifest _control/<file>.json`
  verifies a subset manifest (the promotion tool's partial-promotion path).
  `REQUIRE_STORY_BLOCK` (module constant, ON since slice 3 of the genre standard,
  2026-09-20) passes `--require-story-block` to the active, baseline and merged
  validator runs, never to the isolated drafts run: an overlay revising one
  character carries no story block of its own. A `drafts/_story.md` is
  manifested and promoted like any other draft file.
- `scripts/promote-overlay.mjs <slug> --revision <label> (--all | --paths a,b)
  [--apply --approved-by <name>]` — the only path from `drafts/` into `canon/`:
  verifier-gated, content-backed-up, hash-rechecked, atomic-ordered, evidence to
  `history/overlays/<revision>/`. Dry run without `--apply`. Never run it
  against a real overlay without explicit operator direction.
- `scripts/prose-lint.mjs <chapter.md> [--brief <brief.md>]` — mechanical
  checks for a prose chapter against its brief (`docs/PROSE_PIPELINE.md`):
  prolepsis phrases, outline vocabulary, banned refrains, terms the chapter's
  head cannot know, a house chapter opening on a pronoun, the simile budget,
  the thought-verb budget. Errors fail; warnings are for the reviewer. Story rules and briefs live under
  the story's `drafts/_control/` (`PROSE_RULES.md`, `briefs/`).
- `scripts/draft-notice.mjs` — the one implementation of the draft-banner
  strip rule, imported by both the verifier and the promotion tool so staged
  bytes equal promoted bytes.
- `scripts/canon-frontmatter.mjs` — the canon frontmatter scalar format in one
  place (`toCanonScalar`/`fromCanonScalar`), imported by both the writer and
  the reader so they cannot disagree about quoting again. Since 2026-09-18 it
  also holds the nested `character/3` frontmatter parser and resolver
  (`parseNestedFrontmatter`/`resolveEntityFields`, real YAML through the
  `yaml` package) that the validator, compiler and overlay verifier share;
  the flat path is untouched and a top-level `schema:` key is the only
  discriminator. Since 2026-09-19 it also holds the story block
  (`parseStoryBlock`/`storyBlockExportFields`, with `loadGenreDictionary` and
  `genreAncestors`) that the validator, compiler and scaffolder share for
  `canon/_story.md`.
- `scripts/dist-preflight.mjs` — reports a missing `dist/` with a build hint.
  Import it statically, then reach for `dist/` with `await import(...)`: ESM
  resolves static imports before evaluating anything, so a static `dist/`
  import fails during linking before any guard could run.
- `scripts/verify-provenance.mjs` — checks that a curated export's
  `editorial_revision` block describes the revision it is attached to; with no
  arguments it picks each story's newest editorial export across `exports/`
  and `exports/archive/` and reports server-backup-only stories as `SKIP`.
- `scripts/verify-references.mjs` — checks every story's `references/` and
  `art/` trees: sidecar per image, `image_sha256` matches, hash cross-links
  resolve (the data architecture standard's one-image-one-place rule).
- `scripts/intake.py` — **moved out of this repository on 2026-09-20.** It is
  the only writer of `data/archive/` (index, ingest, verify per source family;
  snapshot and diff for migration proofs) and it writes nothing here, so it now
  lives beside the tree it maintains: in the private `mnemosyne-data` repository
  that `data/` is a junction to, at `scripts/intake.py` relative to the data tree
  root. The two measurement scrapers that invoke it resolve it from that root.
- `scripts/narrator-eval/` — the narrator evaluation (`docs/NARRATOR_EVAL.md`,
  narrator design S5): `corpus.json` (synthetic Halvard seed, twelve cases
  across the six rows, two of them advisory, plus a constant baseline),
  `checks.mjs` (pure, deterministic checks shared with the unit tests;
  punctuation is normalised so no verdict turns on a glyph), `score.mjs`
  (checks + Ollama validator + baseline gate + run-integrity guards that
  withhold the gate and exit non-zero on an incomplete run), and
  `generate-kindroid.mjs` (runs the corpus through a kin over mnemosyne's own
  client and message builder, writing real messages into that kin's chat;
  `--only <case> --repeats <n>` samples one case many times when the
  question is a rate), and `repeat-rate.mjs` (failure rate with a Wilson
  interval for such a run). Measured this way: the narrator obeys an
  instruction planted in scene text in 7 of 20 samples. `companion-message.ts`
  neutralizes its own bracket fence against that content
  (`neutralizeCompanionFence`), which stops planted text escalating to the
  operator's level but does not stop obedience; the doc records what this
  layer cannot fix and why provenance at ingest is the real control.
  Two baseline arms: a trivial constant, and a plausible canned beat that
  answers no direction, whose `discrimination` result drives a three-state
  gate (does not clear / inconclusive / clears). Corpus v10 carries five
  contradiction pairs -- dialogue attribution for Bram, for Ilse, plain
  dialogue itself, a spoken question, and direct address by name -- each
  pattern required by one case and forbidden by another, so every constant
  fails at least four cases. Only rows whose property varies by occasion can
  host a pair; canon, voice and boundary encode invariants. Two measured
  findings live in the doc: the pairs' returns have gone flat, since no pair
  half has ever failed on its own pattern across four runs; and a word check
  is reliable only when the required word has no synonym, which is why
  `continuity-prints` no longer requires "hatch" and `continuity-generator`
  is advisory. Two defects found by reading beats (v12): a check covering
  one clause of a three-clause direction passed output that broke the
  others, and a check anchored to the character's name could not fire at all
  against a narrator that writes pronoun subjects. Reports go under
  gitignored `data/`. Read "What it does not measure" before quoting a
  number.
- `data/scene-extraction/` (gitignored, not in this repository) — the Botify chat
  scene-cutting engine, its per-story cut tables, and the one-off extraction scripts.
  Moved out of `scripts/` on 2026-09-12: it is story tooling rather than application
  tooling, and its per-story configs carried private material. If a genericised engine is
  ever wanted back in the repository, it must read every per-story table from `data/` at
  runtime and carry no story names, character names, content flags or role provenance.
- `docs/ARCHITECTURE.md` — locked architectural decisions. Read this
  first to understand project shape, state model, validation strategy,
  provider strategy, and build sequence.
- `docs/OLLAMA_ADOPTION_ASSESSMENT.md` — research-only audit of Ollama's
  native API, runtime behavior, capabilities, and operational boundary against
  Mnemosyne's existing integration. Records integrity/privacy findings,
  bounded adaptations, acceptance proof, and explicit non-adoptions. It is
  not ratified architecture or an implementation commitment.
- `docs/OPENCLAW_ADOPTION_ASSESSMENT.md` — research-only comparison of
  OpenClaw against Mnemosyne's demonstrated needs. Records the narrow
  patterns worth considering, evidence and acceptance criteria, conditional
  ideas, and explicit non-adoptions. It is not ratified architecture or an
  implementation commitment.
- `docs/OPEN_WEBUI_ADOPTION_ASSESSMENT.md` — research-only comparison of
  Open WebUI as an optional host and pattern library. Records provider
  telemetry, recoverable-run, alternatives, and accessibility findings while
  rejecting a frontend/provider/memory-platform transplant.
- `docs/NEMOCLAW_ADOPTION_ASSESSMENT.md` — research-only comparison of
  NemoClaw's authority, MCP-contract, readiness, and endpoint patterns against
  Mnemosyne's demonstrated boundaries. It is not ratified architecture or an
  implementation commitment.
- `docs/FREETOKEN_ADOPTION_ASSESSMENT.md` — research-only comparison of
  an explicit local OpenAI-compatible generator, truthful capabilities and
  identity, bounded service/quality gates, and exact-prefix reuse. Native
  Ollama validation stays; recommendations remain unratified and unscheduled.
- `docs/RUN_OUTCOMES_DESIGN.md`, `docs/CONTEXT_PLAN_DESIGN.md`,
  `docs/GENERATOR_CAPABILITIES_DESIGN.md`, `docs/RETRIEVAL_CONTROLS_DESIGN.md`
  — the four designs written 2026-08-28, adversarially reviewed, ratified after
  their measurement gates, and implemented: cancellation +
  replay-safe typed outcomes, structured/budgeted context admission,
  static provider capability descriptors, and OC retrieval controls +
  vague-direction enrichment. Query enrichment remains flag-off until the
  operator-labeled benchmark records a win. Each document records the concrete
  types, chosen semantics, slice order, and acceptance tests, and cites its
  assessment for rationale rather than restating it.
- `docs/POSITION_TRACKING_DESIGN.md` — a story's optional in-story
  clock/place: ratified 2026-09-07, implemented the same day across all
  four slices (marker schema 5, `mnemo_position_get`/`mnemo_position_set`,
  generation-context rendering in both the direct-provider and
  companion-chat paths, `mnemo_continue`/REST `advance`/`set_date`/
  `move_to` integration). Records the ratified decisions plus five
  refinements from two adversarial passes -- four from a pre-implementation
  pass before any code shipped (the parser-level atomic invariant, the
  `set_date`-predates-epoch refusal, validation-context gating, and the
  accepted position-advance-survives-generation-failure semantics), and a
  fifth from a pre-commit review of the finished diff (a pre-dispatch
  failure landing after a successful position write was wrongly reported
  retry-safe; `advance`/`set_elapsed_hours` could drive elapsed_hours
  negative where `set_date` alone was guarded).
- `docs/GENRE_RUNTIME_REVIEW.md` — the adversarial review of the genre
  standard's runtime slice (2026-09-19): six dimension passes plus a
  completeness critic, run AFTER the commit shipped, which the repository's
  own pre-deploy rule says should have happened first. Records the blocker (a
  newline in a marker value forged a genre declaration past both gates), the
  correctness and cost findings, the 29-mutant campaign that found 20 escapes,
  the findings deliberately recorded and not fixed, and the measured exposure.
- `docs/GENRE_DICTIONARY_SOURCE_REVIEW.md` — the adversarial review of
  `src/genre-dictionary.json` against external sources (2026-09-19): the book
  trade's BISAC fiction headings, the Library of Congress genre authority, the
  Encyclopedia of Science Fiction and the genre bodies' own definitions. Records
  the findings, what the sources confirm as already correct, the coverage gaps,
  what could not be verified, and the disposition of every finding. It is the
  evidence for the dictionary's current shape, not a design document.
- `docs/GENRE_DECLARATION_DESIGN.md` — the genre declaration standard (Draft 2,
  two adversarial passes, the operator's eight decisions recorded; slice 1
  shipped 2026-09-19): every story declares one to three dictionary genres,
  broadest first and never a term beside its own ancestor, plus a one-line
  lean and conventions/avoid lists capped to travel on the story marker, in
  `canon/_story.md` (authoring truth, slice 1) and on the marker (runtime,
  slice 2). Complete: slice 3 declared every story and turned enforcement on
  (2026-09-20).
- `docs/RESEARCH_DECISION_QUEUE.md` — the enumerated decision queue from the
  2026-08-28 research triage: every recommendation-table row of the four
  adoption assessments with its disposition (shipped / rejected at triage /
  open candidate / parked) and the verification record for the shipped items.
  Reconciliation artifact, not ratified work.
- `docs/ATLAS_CAPABILITY_BENCHMARK.md` and the dated results documents —
  bounded, evidence-only Atlas Cloud route evaluation; the accompanying
  `scripts/atlas-capability-benchmark.mjs` never automates explicit-content
  generation or stores raw generated output.
- `docs/NARRATOR_EVAL.md` — the narrator evaluation protocol (S5): what the
  corpus measures and what it does not, the advisory cases, the two verdicts
  per row and the validator noise floor, the constant-baseline rule and the
  reproduced limitation that a plausible constant clears it, run integrity,
  and the six reviewed design changes deliberately not built.
- `docs/PROSE_PIPELINE.md` — the story-agnostic loop for writing and reviewing
  a chapter of prose (brief, draft, lint, two adversarial review rounds, line
  pass, stop), written after a storyline's sample chapters.
- `data/cross-story/` (gitignored, not in this repository) — records that bind more
  than one story: ratified cross-story authoring rulings, the non-canon register of
  promising story and character seeds, and deferred storyline research. Moved out of
  `docs/` on 2026-09-12 under the application-only rule.
- `docs/DATA_LAYOUT.md` — the data-directory organization and naming
  standard (rewritten 2026-09-02 to the ratified data architecture:
  `archive/` as the one master of originals, `history/` per story,
  `sources/` as a read-only pointing view, one copy of every approved image,
  primary/derived classes; `docs/DATA_ARCHITECTURE_PROPOSAL.md` is the design
  record and review log): per-story `references/` and `art/` conventions, generation
  sidecars, `companion-logs/`'s external-addon/plugin provenance
  requirement, and the server-written `story.json` identity card.
- `docs/LIVING_CANON_STANDARD.md` — the ratified editorial quality contract
  for curated story references and polished export derivatives: proportional
  character depth, playable locations, material objects, relationship and
  knowledge geometry, hook ecology, truth tiers, current-state extraction,
  provenance, mature-content/routing separation, and cross-story improvement
  without forced canon connections.
- `docs/PLAYABLE_STORY_STANDARD.md` — proposed companion authoring standard for
  turning a story bible into interactive play through agency boundaries,
  actor/director knowledge separation, state-sensitive beats, independent
  pressures, a live run ledger, and outcome axes rather than a prescribed
  scene sequence.
- `docs/WEBUI_NOTES.md` — design input for the shipped-but-incomplete web UI
  (explicitly not ratified beyond implemented slices): mode-adaptive layout,
  the storyline control plane, the retrieval-assembly panel, media in the beat
  flow, watch-companion watch parties, and a parked graphic-novel reading
  format.
- `docs/CONTENT_ROUTING_DESIGN.md` — **ratified and fully implemented**
  (2026-09-08, all three slices) closing Living Canon Standard §10's
  SFW/NSFW routing boundary: a story-level `content_rating` declaration
  on the story marker (schema 6), a per-provider `contentCapability`
  declaration (four new env vars; anthropic/openai/gemini fixed `sfw`,
  no override), and a fail-closed check in `dispatchGenerate()`, the one
  real generation call site — refuses before dispatch on a mismatch, never
  blocks an undeclared rating. Grounded in OpenChronicle v1's
  `ContentRoutingConfig`/`ModelSelector` (a real design that was built and
  never wired to anything) — this design's own single, unconditional call
  site was built specifically to not repeat that failure.
- `docs/COMPANION_PROFILE_DESIGN.md` — proposal for keeping canonical
  character/voice identity separate from desired provider projections,
  observed Kindroid/Botify snapshots, and account-specific bindings. Records
  the detailed voice-profile and voice-asset provenance shape plus the
  snapshot → diff → reviewed-apply workflow; no runtime sync is built.
- `docs/KINDROID_NARRATOR_DESIGN.md` — the Mnemosyne half of the operator's
  reusable-narrator-kin proposal (2026-09-03; the kindroid-mcp half, boundary
  statement and review record, is `kindroid-mcp/docs/narrator-kin-design.md`).
  Records what the day's smoke and end-to-end runs verified, the findings that
  shape the design (persona is the style, mode never reaches Kindroid,
  full-name keyphrase gating), the slices, and the decisions the operator's
  rulings settled. Decisions ratified 2026-09-03; S1, S2, S3 and S5 shipped
  the same day; S4 unscheduled, its share check answered (a share is a
  snapshot, and generation through one is gated only by `enable_filter`).
- `docs/V2_RETROSPECTIVE.md` — entity schemas, verbatim prompt templates,
  lessons learned, and anti-patterns from the v2 OpenChronicle
  storytelling plugin. v2 code is NOT being ported; this doc is the
  bridge that captures the durable informational value.
- `docs/IMPORT_EXPORT_DESIGN.md`, `docs/IMPORT_PLAYBOOK.md`,
  `docs/SEED_TEMPLATES.md` — the ratified import/export design, the
  mapping playbook for a curated import, and the authoring templates.
- `docs/ILLUSTRATION_INTEGRATION.md` — parked design for scene-tied image
  generation (out of scope per ARCHITECTURE.md §8; not reopened).
- `docs/WORLD_CONTEXT_COMPANION.md` — parked idea for real-world facts
  (weather, events) reaching kins, optionally per storyline/bot, via a
  standalone `*-companion` app (mirroring the watch-companion split) rather
  than code inside mnemosyne. Not started, not scheduled.
- `docs/COMPANION_PROVIDER_CANDIDATES.md` — research-only survey (2026-08-31)
  of Nomi.ai, SpicyChat.ai, and Candy.ai as candidate `GENERATOR_PROVIDER`
  additions alongside Kindroid/Botify: API availability, capability surface,
  and ToS stance on automation for each. Only Nomi.ai has a documented
  official API; SpicyChat.ai's ToS is silent on automation (reverse-engineered
  access only); Candy.ai's ToS explicitly prohibits off-platform AI use of
  its content. Not ratified architecture, no MCP server started for any of
  the three.
- `SECURITY.md` — disclosure policy. Private vulnerability reporting is
  enabled; the file lists the three known limitations (unconfined filesystem
  authority by transport is now closed for HTTP, what Host/Origin + bearer auth
  do and do not cover, unvalidated sibling-MCP results) so a reporter does not
  rediscover them.
- `.githooks/pre-commit` — gitleaks + PII pattern scan + author identity check.
- `.gitleaks.toml` — secret-scanning config.
- `vendor/atlascloud-cli` — [Atlas Cloud CLI](https://github.com/AtlasCloudAI/cli)
  (credit: AtlasCloudAI), vendored as a git submodule. Development/operations
  and research tool for shell-side balance/model/connectivity checks;
  `scripts/atlas-capability-benchmark.mjs` consumes a compatible CLI via
  `ATLAS_CLI_BIN` or `PATH`. The runtime `atlascloud` generator provider talks
  to the API directly and does not use the CLI.

## Architecture Overview

Mnemosyne is a *separate* MCP server that *uses* OpenChronicle (OC) for
memory. It is NOT an OC plugin. OC v3 deliberately stayed lean and cut
its v2 storytelling code; Mnemosyne is the new home for that capability.

Key architectural decisions (see ARCHITECTURE.md for full reasoning):

- **MCP server plus a web UI (shipped, partial).** The web UI is required
  for uncensored ("spicy") storytelling because Claude Desktop's host
  LLM sits in the response path and triggers content-policy refusals on
  tool outputs containing graphic content. SFW use works fine in
  Claude Desktop / Claude Code via the MCP. The entity library and the
  continue/validate flow are built; see ARCHITECTURE.md §4/§7 and
  "Layout" below for what remains.
- **OC is canonical for story state.** Characters, scenes, rules,
  style, lore — all live as OC memories with structured tags. Local
  config holds one operational field only: the current-story pointer.
- **A story is chosen per call, not per connection.** Every story-touching
  tool accepts an optional `story` (name or OC project UUID) that
  overrides the active-story pointer for that one call — `resolveStoryId()`
  in `stories.ts`, generalizing the pattern `mnemo_export_story` always
  used. Deliberately not session-scoped server state: the HTTP transport
  (below) evicts idle sessions, which would silently drop a session-bound
  "active story" mid-use, so a caller that cares (including the current web
  UI) just
  passes `story` explicitly on every call instead. Omitting it falls back
  to the pointer with zero OC calls, so every existing stdio caller is
  unaffected.
- **Two transports, one process.** `MCP_PORT` unset (every current
  deployment) runs stdio, unchanged. Set, it runs Streamable HTTP via
  `shared/http-transport.ts` — a verbatim copy of kindroid-mcp's
  fleet-canonical module, chosen over a bespoke implementation because it
  provides the shared fleet baseline (fresh `McpServer` per session via a
  `createServer` factory, idle-session eviction, Host/Origin allowlisting
  against DNS rebinding, and bearer auth). The OpenClaw and NemoClaw
  assessments record the remaining gates before non-loopback or third-party
  host exposure, including filesystem path authority. `oc`/`generator`/
  `validator` stay singletons
  shared across every HTTP session; only the `McpServer` instance and its
  tool registrations are rebuilt per session.
- **Validation is an LLM second pass.** Mnemosyne pulls relevant rules
  + entities from OC, builds a "check this against these constraints"
  prompt, calls a (potentially cheaper) validator LLM, surfaces flagged
  issues to the user. No auto-regeneration. No deterministic checker
  (that was a v2 anti-pattern).
- **Provider-pluggable from day one.** Seven generators behind
  `GENERATOR_PROVIDER` (2026-08-21): `ollama` (default), the
  companion-chat pair `kindroid`/`botify` (MCP clients to their sibling
  servers; message-text-only channel, keyphrase-gated context via
  `companion-message.ts`), and the direct-API cloud four
  `anthropic`/`openai`/`gemini`/`atlascloud` (system-prompt + per-call
  model fidelity; temperature/token caps pass through only when set,
  since several current-gen models reject the fields outright; the
  OpenAI-compatible pair share one class; Atlas goes direct because
  atlascloud-mcp's `atlas_chat` returns unscrapeable markdown). The
  validator role always stays on Ollama regardless of
  `GENERATOR_PROVIDER` — a companion-chat model is a poor fit for
  structured-JSON output, and keeping validation local means it's free —
  so `OLLAMA_VALIDATOR_MODEL` is required for every non-ollama
  generator.
- **Kindroid generator: keyphrase-gated context, not the full assembled
  prompt.** `KindroidProvider.generate()` ignores `systemPrompt`/
  `temperature`/`maxTokens` (no Kindroid equivalent) but does NOT ignore
  `context` — `buildKindroidMessage()` scans the direction for a
  character/lore/worldbuilding entity name (since 2026-09-03 any distinctive
  word of a multi-word name counts, so "Ilse" folds in "Ilse Varga") and
  folds in only the matching entries, plus every location and the
  already-relevance-filtered recent scenes (both always included, never
  keyphrase-gated; `docs/KINDROID_NARRATOR_DESIGN.md` S1). This mirrors Kindroid's
  own "Journal" feature (keyphrase-triggered lorebook entries), which isn't
  exposed by the public API — so mnemosyne reimplements the same mechanic
  client-side, populated from the story's existing OC entities (no new
  storage, no import step). Rules/style are never surfaced this way — the
  dedicated storytelling kin's own persona carries tone/voice, not
  mnemosyne's prescriptive constraints. `gatherContext`/`buildSystemPrompt`
  in `continue.ts` still run unconditionally regardless of generator,
  because the optional validator pass needs the full context either way.
  Trade-off accepted: since Kindroid has no side-channel for context, a
  match becomes a visible prefix in the actual message sent (and thus in
  your own chat history) — there's no way to inject it invisibly the way
  Kindroid's native Journal recall does.
- **Per-story Kindroid target (AI or group), OC-canonical.** A story can
  bind its own dedicated Kindroid target — a single AI, or a group chat —
  via `mnemo_story_use`'s `kindroid_kin` / `kindroid_group_id` params
  (mutually exclusive; `null` clears), stored as `KindroidTarget {type: "ai"
  | "group", id}` on the story's marker memory (`stories.ts`, schema 4 since
  2026-09-03, which added the optional `Narrator-Profile:` label line;
  schema-3 markers without it, schema-1 markers with no kin line and
  schema-2 markers with the legacy
  bare `Kindroid-Kin:` line, always an AI target, both still parse fine).
  This follows the existing "OC is canonical for story state" rule rather
  than mnemosyne's local `config.json`, since a target id is portable story
  data, not machine-local operational state. `mnemo_continue` resolves the
  effective target via `resolveKindroidTarget()`: an explicit per-call
  `kindroid_kin`/`kindroid_group_id` on that call always wins, then the
  active story's bound target (only relevant when the generator actually is
  Kindroid), then `KindroidProvider`'s own configured `defaultTarget`
  (`KINDROID_STORYTELLING_KIN` or `KINDROID_STORYTELLING_GROUP`). The
  story-marker lookup is skipped entirely unless both conditions hold, so
  an Ollama-generated story pays no extra OC round trip for a field it'll
  never use. `model` overrides the configured model for every direct provider
  (`ollama`, `anthropic`, `openai`, `gemini`, `atlascloud`) and is ignored by
  companion providers. It no longer doubles as a Kindroid override, since a
  Kindroid target needs a type (ai vs group), not just a bare id.
- **Group targets drive kindroid-mcp's turn loop, not a single reply.**
  `KindroidProvider.generate()` against a group target calls
  `KindroidClient.advanceGroup()` (→ kindroid-mcp's `kindroid_advance_group`
  tool). `allowUser` defaults to **false** — AI-only turns, correct for a
  caller that cannot take a turn (scheduled, webhook-driven) — and is
  settable per call via `mnemo_continue`'s `allow_user` (2026-08-23).
  Deliberately per-call with **no env counterpart**, unlike
  `KINDROID_GROUP_MAX_TURNS`: it describes the *caller*, not the
  deployment, and both kinds of caller can hit the same server, so a
  server-wide `true` would hand the floor to someone who isn't there.
  `generate()` returns a `GeneratedBeat` (`{text, groupEnded?,
  groupTurns?}`) rather than a bare string, so a caller can tell a
  finished beat from one the group handed back mid-scene. Two zero-reply
  cases exist and only `turns` separates them: `turns === 0` is a
  legitimate immediate yield (empty beat, nothing saved — the direction is
  already posted, so continue rather than re-send), while `turns > 0` with
  no replies means the turns generated upstream and only the read-back
  failed, which throws and says explicitly not to retry.
  Every kindroid-mcp call goes through one chokepoint,
  `KindroidClient.callMutatingTool` — they all mutate a real conversation, so
  a failure leaves "did anything happen?" unanswerable. It sets a per-request
  timeout (`KINDROID_MCP_TIMEOUT_MS`, default 240s, well above the SDK's 60s
  because a group chains sequential generations at ~13s each, and above
  kindroid-mcp's worst case for one send: its 60s request timeout plus its
  120s same-key re-send budget) and, on a
  timeout **specifically**, rethrows saying the call may have already posted
  and generated — do not retry. Non-timeout failures pass through untouched
  so the warning stays scarce enough to mean something. The one exception
  since 2026-09-03 is `kindroid_send_message`: every send carries a fresh
  `idempotency_token` that kindroid-mcp composes into Kindroid's
  `idempotency_key` (live-verified: Kindroid answers `409 Request already in
  progress` while generating and replays the original reply afterwards,
  never a duplicate), so a timeout there is re-sent with the same token up
  to `SEND_TIMEOUT_RETRIES` times before the unknown-outcome error is
  thrown. `kindroid_advance_group` keeps the no-retry rule, and so does
  `kindroid_chat_break`, which `mnemo_session_break` (2026-09-03) calls with
  `wipe_cascaded` pinned off: chat break rejects an idempotency key outright.
  `maxTurns`
  is configurable (2026-08-23): server-wide via `KINDROID_GROUP_MAX_TURNS`
  and per call via `mnemo_continue`'s `group_max_turns`, defaulting to 4
  and bounded 1–8 to mirror `kindroid_advance_group`'s own schema rather
  than invent a range. Single-AI targets ignore it entirely. The turn loop's replies are joined into a
  single beat string by `formatGroupReplies()` — one `"Name: message"` line
  per speaker, in generation order — since a "beat" against a group
  naturally involves a few characters exchanging lines, and `LlmProvider`'s
  contract stays a single string regardless of target type. **Live-verified
  2026-08-12** against a real subscriber group tied to a live Twitch
  stream — see STATUS.md's Done log for the full walkthrough (context
  gathering, keyphrase matching, the real `advanceGroup` round-trip, and
  `formatGroupReplies()` all confirmed working end-to-end).
- **Group-target messages get an appended conversation nudge.**
  `buildKindroidMessage()`'s `isGroup` param (true whenever
  `target.type === "group"`) appends a `groupConversationNote()` —
  without it, kins tend to each independently react to the direction
  rather than to each other (live-observed as one kin taking two of
  four turns in a row). Names keyphrase-matched characters specifically
  when the direction mentions them, and its closing line ("@mention them
  by name") points at Kindroid's own documented turn-handoff mechanism
  rather than a guessed phrasing — confirmed against
  kindroid.ai/docs/article/groupchats/, not assumed. Single-AI targets
  never see it (there's no "each other" to talk to). Live-verified
  2026-08-12 to produce a clean 4/4 alternating exchange against the
  same real group — see STATUS.md's Done log.

## Common Commands

```bash
npm ci                 # deterministic install (Node >=26, npm 11.19.0)
npm run build          # compile server + build/copy Web UI into dist/
npm run dev            # tsx src/index.ts
npm run typecheck      # tsc -p tsconfig.typecheck.json (src + tests)
npm run lint           # eslint .
npm run format         # prettier --write .
npm run format:check   # prettier --check . (CI gates on this -- run before pushing)
npm test               # vitest run (95 of 871 tests are env-gated; see below)
```

`npm test` green does **not** mean the integration surface ran. Every
real-OC, Ollama-validator, Kindroid, and cloud-provider suite is skipped
unless its env vars are exported **into the shell** — `vitest.config.ts`
loads no dotenv, so a populated `.env` does not enable them. Use
`OC_URL=...` for the OC suites and add `OLLAMA_GENERATOR_MODEL=...` for the
validator suites.

## Conventions

- All logging goes to **stderr** (`console.error` via `src/log.ts`).
  In stdio mode, stdout is the MCP wire protocol — writing to it
  corrupts the transport.
- Tool names use `mnemo_` prefix and snake_case.
- Tool inputs validated with `zod`. Outputs returned as a single
  JSON-stringified text content block.
- **Git workflow: commit directly to `main` and push.** This is a
  personal repo — no PRs, no feature branches, no review gate. The
  pre-commit hook (gitleaks + PII + author-identity check) is the
  safety net.
- Author identity must be a GitHub noreply alias. The pre-commit
  hook enforces this (rejects personal-domain emails).
- **`package.json` is `@carldog/mnemosyne-mcp` and `private: true` — both
  deliberate.** The unscoped name `mnemosyne-mcp` belongs to an unrelated
  package (Anckur Singh's "Agent-First Knowledge Database", first published
  2026-08-10), which is what the scope is for: a scope is reserved to the
  account, so no name inside it can be taken. Nothing here publishes to npm and
  nothing publishes anywhere else either: there is no publish workflow, no
  `NPM_TOKEN`, and no Dockerfile — a container image is the *intended*
  distribution (see STATUS.md), not a shipped one. `private: true` blocks an
  accidental publish while `bin` + `files` advertise a publishable shape. If
  npx distribution is ever wanted, drop the flag and add `"publishConfig":
  {"access": "public"}` — scoped packages default to private, so a first
  publish without it fails with a 402.
- **Caller-supplied filesystem paths are refused over HTTP.**
  `mnemo_export_story(out_path)` and `mnemo_import_story(file_path)` resolve a
  path with the process's full authority, which is a local-operator capability;
  the HTTP transport registers the same tool surface. `registerTools` takes
  `allowFilesystemPaths`, defaulting **true** so stdio is unchanged, and
  `index.ts` passes `httpConfig.port === undefined`. Do not add a new
  path-bearing tool argument without the same guard.
- **Companion-chat output conventions live in code, not here.** The
  outgoing provenance header (`MNEMO_USER_NAME`) is built in
  `src/companion-message.ts`; the asterisk-for-action / plain-dialogue
  rule and its cross-platform sourcing are documented at
  `src/prompt.ts` alongside the mode directives.

## Relationship to OpenChronicle

OC lives at `D:\GitHub\openchronicle-mcp` (Python, hexagonal architecture,
v3). It's a memory database with semantic search, pinning, and
project-scoped storage.

Mnemosyne talks to OC via OC's HTTP MCP endpoint (the same
`http://your-nas:18000/mcp` used by other Claude sessions). Mnemosyne
is an MCP **client** to OC, not embedded into it. Each Mnemosyne story
is one OC project.

The v2 storytelling plugin lived inside OC at
`plugins/storytelling/`. It was preserved on the
`archive/openchronicle.v2` branch (`bb217d94`) when v3 cut it. See
`docs/V2_RETROSPECTIVE.md` for what was captured. To browse the v2
source if needed:

```bash
git -C D:\GitHub\openchronicle-mcp worktree add --detach \
  D:\GitHub\openchronicle-v2-archive bb217d94
# when done:
git -C D:\GitHub\openchronicle-mcp worktree remove \
  D:\GitHub\openchronicle-v2-archive
```

## Out of Scope (v0)

Per ARCHITECTURE.md §8: game mechanics, multi-user/auth/cloud,
auto-regen on validation failure, voice, image generation tied to
scenes, cross-story memory bleed — plus portrait-driven layouts, scene
trees, and other richer visual controls in the Web UI (the shipped
entity and continue surfaces stay text-first). To be revisited only
after v0 ships and gets real use. Quote §8 rather than paraphrasing it;
this list has drifted from the source before.
