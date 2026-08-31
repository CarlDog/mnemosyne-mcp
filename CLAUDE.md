# mnemosyne-mcp

MCP server for long-form storytelling on top of OpenChronicle memory.

## Status

Single source of truth: [STATUS.md](STATUS.md). Do not duplicate status
into this file, MEMORY.md, or Serena memories — reference STATUS.md.

## Current Sprint

Status lives in [STATUS.md](STATUS.md) — read it first. This section names
only what is in flight; it must never restate STATUS.md's Done log. (When
the two disagree, STATUS.md is newer.)

**Nothing is in flight (2026-08-30).** The Living Canon overlay pass is closed
at its operator-approval boundary; no draft was promoted or imported. The
external-system research program also remains closed. Its one pending operator
ask is labeling the enrichment-benchmark fixtures (`MNEMO_QUERY_ENRICHMENT`
stays off until a recorded win). Read [STATUS.md](STATUS.md) first; the standing
context below still applies.

`canon/` is the permanent human-editable source
for a story's narrative content ([docs/DATA_LAYOUT.md](docs/DATA_LAYOUT.md));
OC stays canonical for *live* story state. Five stories are consolidated onto
it; Star Wars: The Black Ledger is not, and is structurally unlike the others
(ongoing, already partly live via Botify, no ChatGPT-project origin).

**Eight review-gated Living Canon overlays are complete on disk (2026-08-30):**
BattleChasers (71 operations → 143 entities), Brass & Nerve (20 → 43), Chaos
Saga (60 → 73), GhostHunters (60 → 105), Midnight Is a Suggestion (41 → 70),
Shadowflame (40 → 74), The Adjustment Protocol (19 → 41), and The Noctis Veil
(13 → 39). Each retains PASS/control evidence and passed the zero-write import
preflight. None was promoted or imported, active canon remained hash-stable,
and promotion still requires explicit operator approval. GhostHunters also has
a control-only Dovecoast prequel seed bank.

`trigun-scarlet-mercy` (55 entities) remains tracked in
[STORYLINE_RESEARCH_BACKLOG.md](docs/STORYLINE_RESEARCH_BACKLOG.md); do not build
on or scaffold over it without asking.

**Read `data/stories/` before trusting any story inventory.** `data/` is
gitignored, so `git status` stays clean while story trees you have not read
sit on disk — including draft scaffolds that no ratified doc covers. Verify
counts with `node scripts/validate-canon.mjs <slug>`, which exits 0 only for
a tree that exists, is readable, and holds at least one entity — so a sweep
over every slug is trustworthy as an integrity check.

**Nothing in any story's `canon/` has been imported to live OC.** Per
standing operator instruction, nothing is locked in as canon until
explicitly directed.

Written down but **not ratified** — design input, not specification:
[WEBUI_NOTES.md](docs/WEBUI_NOTES.md),
[CONTENT_ROUTING_DESIGN.md](docs/CONTENT_ROUTING_DESIGN.md),
[COMPANION_PROFILE_DESIGN.md](docs/COMPANION_PROFILE_DESIGN.md),
[HOOK_VAULT.md](docs/HOOK_VAULT.md), and the four external-system adoption
assessments listed under "Layout" below.

## Stack

- TypeScript (Node 22+, ESM, `NodeNext` module resolution)
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
  JSON driver adapters over the same application use cases the MCP tools wrap),
  `helpers.ts` (`asyncRoute()`, input/error handling).
- `src/application/` — transport-independent application use cases shared by
  MCP and REST drivers. Continuation, standalone validation, and bulk scene
  revalidation plus story/entity catalog reads live here. These are the first
  incremental hexagonal slices; concrete OC/LLM outbound ports remain to be
  extracted. `tests/architecture-boundaries.test.ts` prevents imports between
  the MCP/REST drivers and prevents application use cases from importing either
  driver tree.
- `webui/` — the actual web UI: entity-library browse/detail plus the
  interactive continue/validate flow. A separate npm package — React 19 +
  Vite + react-router,
  its own tsconfig (browser/JSX target, incompatible with the server's
  `NodeNext`/no-DOM config) and its own eslint config (pinned to eslint 9;
  `eslint-plugin-react-hooks`'s peer range doesn't reach 10 yet). `npm run
  build` at the repo root builds this too and copies its output into
  `dist/webui/` (`scripts/copy-webui-dist.mjs`) for `src/index.ts` to
  serve as static files + a SPA-fallback route. Dev: `npm --prefix webui
  run dev` runs Vite's own server, proxying `/api/*` to the Express
  server started via the root's `npm run dev`.
- `src/oc-client.ts` — Streamable HTTP MCP client wrapper for OC.
- `src/kindroid-client.ts` — Streamable HTTP MCP client wrapper for
  kindroid-mcp (same shape as `oc-client.ts`).
- `src/config.ts` — local config (current story pointer; repo-local
  `data/` dir, gitignored, `MNEMO_DATA_DIR` override — Docker-mountable
  as persistent storage; legacy OS-config-dir location auto-migrates).
- `src/stories.ts` — story marker logic, plus `resolveStoryId(oc,
  explicit?)`: the per-call `story` override every story-touching tool
  accepts, falling back to the active-story pointer (pure file I/O, no
  OC call) when omitted.
- `src/entities.ts` — entity CRUD + recall, plus `listAllEntities()` (a
  complete, unranked enumeration — no cap, unlike `recall()`) and
  `filterListedEntities()` (pure: optional type filter + default body
  strip, backing `mnemo_list_entities`).
- `src/prompt.ts`, `src/validator.ts`, `src/llm.ts`, `src/export.ts`,
  `src/import.ts` — domain logic.
- `src/kindroid-provider.ts` — `KindroidProvider implements LlmProvider`;
  generator-only (validator always stays on Ollama). Exports
  `buildKindroidMessage()` (pure, unit-tested) — a wrapper over the
  shared companion-message builder that adds the group @-mention nudge.
- `src/companion-message.ts` — the shared keyphrase-gated context
  builder both companion-chat providers (Kindroid, Botify) fold story
  entities through. Extracted so the word-boundary matching and
  scene-inclusion rules can't drift between consumers.
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
  `not_probed`; 15s TTL cache. `/health` stays public liveness-only.
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
- `tests/` — vitest, real OC + real Ollama (env-gated — see "Common
  Commands" for which vars enable which suites).
- `scripts/dump-prompt.mjs`, `scripts/dump-validation.mjs`,
  `scripts/dump-kindroid-group-message.mjs` — command-line diagnostics.
  Used during v0.1.2 dogfooding to pin the few-shot-vs-rule cause
  without going through Claude Desktop. They import from `dist/`, so
  rebuild first (a long-running MCP server holds the old `dist/`).
- `scripts/scaffold-story.mjs` — one-time export-JSON → `canon/` seeding
  for a story adopting the authoring layer. It skips generated scenes unless
  they are explicitly promoted and preserves the export entity key as a
  character's runtime identity even when its body contains a display/current
  `Name:` field.
- `scripts/validate-canon.mjs <slug> [--dir <canon-dir>]` — structural check of
  active or staged canon: entity/frontmatter shape, duplicate identities,
  scene catalog keys, reference/image containment, and non-empty bodies.
  Content correctness still needs a human pass. Missing, unreadable, or empty
  trees exit 1.
- `scripts/compile-story.mjs <slug> [--dir <canon-dir>] --check` — compiles a
  canon-shaped tree and runs the built server's real import schema/preflight
  with `writes=0`; `--out <file>` exclusively creates a checked export artifact
  but never imports it.
- `scripts/verify-draft-overlay.mjs <slug>` — verifies a manifest-driven draft
  overlay's operation inventory and hashes, validates active/isolated/merged
  trees, and runs the merged import preflight without promotion or import.
- `scripts/canon-frontmatter.mjs` — the canon frontmatter scalar format in one
  place (`toCanonScalar`/`fromCanonScalar`), imported by both the writer and
  the reader so they cannot disagree about quoting again.
- `scripts/dist-preflight.mjs` — reports a missing `dist/` with a build hint.
  Import it statically, then reach for `dist/` with `await import(...)`: ESM
  resolves static imports before evaluating anything, so a static `dist/`
  import fails during linking before any guard could run.
- `scripts/verify-provenance.mjs` — checks reference/art images against
  their JSON sidecars.
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
- `docs/RESEARCH_DECISION_QUEUE.md` — the enumerated decision queue from the
  2026-08-28 research triage: every recommendation-table row of the four
  adoption assessments with its disposition (shipped / rejected at triage /
  open candidate / parked) and the verification record for the shipped items.
  Reconciliation artifact, not ratified work.
- `docs/ATLAS_CAPABILITY_BENCHMARK.md` and the dated results documents —
  bounded, evidence-only Atlas Cloud route evaluation; the accompanying
  `scripts/atlas-capability-benchmark.mjs` never automates explicit-content
  generation or stores raw generated output.
- `docs/HOOK_VAULT.md` — non-canon development register for promising story
  and character seeds. Promotion requires an explicit creative decision and a
  canon-first scaffold.
- `docs/STORYLINE_RESEARCH_BACKLOG.md` — operator-selected deferred research
  and follow-up work for concepts with a deliberate direction or existing
  story foundation; raw salvage remains in the Hook Vault.
- `docs/DATA_LAYOUT.md` — the data-directory organization and naming
  standard: per-story `references/` and `art/` conventions, generation
  sidecars, `companion-logs/`'s external-addon/plugin provenance
  requirement, and the server-written `story.json` identity card.
- `docs/LIVING_CANON_STANDARD.md` — the ratified editorial quality contract
  for curated story references and polished export derivatives: proportional
  character depth, playable locations, material objects, relationship and
  knowledge geometry, hook ecology, truth tiers, current-state extraction,
  provenance, mature-content/routing separation, and cross-story improvement
  without forced canon connections.
- `docs/WEBUI_NOTES.md` — design input for the shipped-but-incomplete web UI
  (explicitly not ratified beyond implemented slices): mode-adaptive layout,
  the storyline control plane, the retrieval-assembly panel, media in the beat
  flow, watch-companion watch parties, and a parked graphic-novel reading
  format.
- `docs/CONTENT_ROUTING_DESIGN.md` — proposal (not yet ratified) for
  implementing Living Canon Standard §10's SFW/NSFW routing boundary: a
  story-level content-rating declaration on the story marker, a
  provider-level capability declaration, and a fail-closed pre-flight
  check at `mnemo_continue`'s one real generation call site. Grounded in
  OpenChronicle v1's `ContentRoutingConfig`/`ModelSelector` (a real
  design that was built and never wired to anything).
- `docs/COMPANION_PROFILE_DESIGN.md` — proposal for keeping canonical
  character/voice identity separate from desired provider projections,
  observed Kindroid/Botify snapshots, and account-specific bindings. Records
  the detailed voice-profile and voice-asset provenance shape plus the
  snapshot → diff → reviewed-apply workflow; no runtime sync is built.
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
  character/location/lore/worldbuilding entity NAME mention and folds in
  only the matching entries, plus the already-relevance-filtered recent
  scenes (always included, never keyphrase-gated). This mirrors Kindroid's
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
  | "group", id}` on the story's marker memory (`stories.ts`, schema 3 —
  schema-1 markers with no kin line and schema-2 markers with the legacy
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
  timeout (`KINDROID_MCP_TIMEOUT_MS`, default 180s, well above the SDK's 60s
  because a group chains sequential generations at ~13s each) and, on a
  timeout **specifically**, rethrows saying the call may have already posted
  and generated — do not retry. Non-timeout failures pass through untouched
  so the warning stays scarce enough to mean something. `maxTurns`
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
npm install            # install deps
npm run build          # compile server + build/copy Web UI into dist/
npm run dev            # tsx src/index.ts
npm run typecheck      # tsc -p tsconfig.typecheck.json (src + tests)
npm run lint           # eslint .
npm run format         # prettier --write .
npm run format:check   # prettier --check . (CI gates on this -- run before pushing)
npm test               # vitest run (64 of 463 tests are env-gated; see below)
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
