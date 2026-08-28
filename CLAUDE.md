# mnemosyne-mcp

MCP server for long-form storytelling on top of OpenChronicle memory.

## Status

Single source of truth: [STATUS.md](STATUS.md). Do not duplicate status
into this file, MEMORY.md, or Serena memories — reference STATUS.md.

## Current Sprint

See [STATUS.md](STATUS.md). The curated-import campaign is complete
(2026-08-23) — five live stories, ~369 entities, all four original
ChatGPT projects plus a new fifth story (Shadowflame).

**A `canon/` authoring-layer standard replaces the single-JSON-export
workflow, and BattleChasers is the first story fully consolidated onto
it** (2026-08-26) — `data/stories/<slug>/canon/` (one Markdown file per
character/location/lore/worldbuilding entity, YAML frontmatter for
structured fields, documented in [docs/DATA_LAYOUT.md](docs/DATA_LAYOUT.md))
is now the permanent human-editable source of a story's content; OC stays
canonical for *live* story state exactly as before. Two new scripts do the
migration and checking: `scripts/scaffold-story.mjs` (export → canon/,
with a generic merge for sibling revision forks) and
`scripts/validate-canon.mjs` (structural check only — no duplicate
entities, no empty bodies; content correctness still needs a human pass).
BattleChasers is fully migrated (143 entities, verified complete against
both its own export lineage and the original ChatGPT source, one
Shadowflame truth-tier leak fixed, a cosmetic polish pass done). **Chaos
Saga is the second story fully consolidated** (2026-08-27, 62 entities) —
fixing the script's header/body splitter for its flat `Label:`-only
template (no Markdown headings at all, unlike BattleChasers) also caught
a real latent bug that had silently dropped three BattleChasers
characters' `Voice` content, now restored. A 7-agent completeness sweep
against the original ChatGPT source found detail-level gaps (missing
locations, missing mechanical rules, compressed-out narrative anecdotes,
one internal rules.md/style.md contradiction) which were restored/
resolved per operator direction; `validate-canon.mjs` reports it clean.
**GhostHunters is the third** (2026-08-27, 105
entities) — a 4-agent sweep found the large majority of content already
present verbatim; real gaps were narrow (a second Interpersonal Dynamics
list for Carl's corgi Max, a missing group-chat message-format system in
a new `worldbuilding/group-chat.md`, the Chapter Lock Trigger Clause, and
one unilateral judgment call re-adding sensory/craft intimacy guidance as
craft advice rather than a censorship-era relic). The same content-rating
liberalization pattern (PG-13/implication-only → Mature/hard-R explicit)
holds consistently across every consolidated story. **Shadowflame is the
fourth, and the cleanest by a wide margin** (2026-08-27, 69 entities) — it
has no ChatGPT-project origin at all, coming entirely from a Botify bot
("Dark Queen Lilith"). That bot's source material named its founding
thrall "Briar Rose Blackwood" — colliding with GhostHunters' central
mystery family — but a 12-agent extraction sweep of the full ~3,900-
message source chat confirmed an earlier pass had already handled this
properly (`lore/open-questions.md` documents the deliberate Ravenscroft
rename; a full-tree grep found "Blackwood" exactly once, inside that
note). The Lilith/Karl truth-tier continuity with BattleChasers held up
well on direct inspection. A real `scaffold-story.mjs` diacritic bug
(`Karl von Jäger` → a mangled filename) was found and fixed, which also
caught the same latent bug already live in BattleChasers' canon
(`Kharag-dûm`). **Wonderland is the fifth story, and the last of the five
original curated-import stories** (2026-08-27, 76 entities) — its
ChatGPT-project source was unusually sparse (just Project Instructions +
Style Guide, no character/location files), so the real depth came from a
Botify bot ("Alice Grimm," bot 3197891, found only via a private chat-list
search). A 10-agent extraction sweep of its ~24,000-line export hit the
worst intermittent file-read failure rate yet (2 of 6 chunks succeeded),
compensated with direct grep/manual verification. Found a second
scaffold-script bug in the same family as the diacritic fix — a rule/style
entity with its own internal `##` sub-headings wasn't demoted before being
folded into `rules.md`/`style.md` — fixed, and regression-checking found
the identical bug already live in Chaos Saga's `rules.md` and
GhostHunters' `style.md`; both fixed by hand. Six real source divergences
were found and, in every case but one blend (cinnamon-scented mushrooms
layered onto canon's morel visual), the operator ruled to keep canon's
more mysterious version over the source's more-explicit one — the
Wrong-Song Child stays unnamed, the mechanical lantern stays unexplained,
the Vorpal Blade stays masterless, the Market Below's location stays
unresolved. Real narrative-color gaps (Alice's pre-Wonderland childhood,
a Carl survival-promise exchange, a washbasin-as-hat moment) were folded
in; one source-grounded gap (Carl's hunting background) was deliberately
skipped because his own file cautions against inventing unestablished
civilian-life specifics. **All five original curated-import stories are
now fully consolidated onto `canon/`; only Star Wars: The Black Ledger
remains** — a different shape entirely (no ChatGPT-project origin, already
partially live via Botify, an ongoing story rather than a completed-arc
consolidation). Nothing in any story's `canon/` has been imported to live
OC; per standing instruction, nothing gets "locked in" as canon until
explicitly told to. Full detail in STATUS.md's dated Done entry.

**Outgoing companion-chat messages carry a provenance header, and
in-fiction narration follows one asterisk/bracket convention everywhere**
(2026-08-23) — every Kindroid/Botify direction now opens with
`[Mnemosyne — automated scene direction, not Carl typing]`
(`MNEMO_USER_NAME`), and every mode directive in `prompt.ts` states the
same asterisk-for-action / plain-dialogue rule so the five direct-LLM
providers' output stays visually consistent with it. Grounded in real
research, not invented: Kindroid's and AI Dungeon's own docs plus Reddit
community convention, then confirmed live against a real Botify bot and
cross-checked against r/botify_ai — a bracketed direction read as a
scene event, not Carl typing, and asterisk-for-action came back
unprompted, though two active regression threads mean Botify's own team
was mid-fix on that exact mechanism at the time.

**The web UI exists** (2026-08-23) — its entity library and interactive
continue flow have shipped: browse stories, filter/search a story's entities,
view one entity in full, and generate/validate the next beat through the
shared continue core. A new `/api/*` REST layer
(`src/api/`, thin adapters over the same domain functions the MCP tools
already wrap) plus a real React + Vite SPA (`webui/`, its own package,
built and served by the same Express app slice 0 added — see "Layout"
below). Verified twice over: 220 automated tests passing, and an actual
browser walkthrough against real production data with zero console
errors at the original entity-library milestone. Entity edit/delete UI,
mode-specific postures and control planes, the assembly panel, Docker
deployment, media, and watch parties remain unbuilt.

This landed on top of two same-day prerequisites: **slice 0**
(`resolveStoryId()`'s per-call `story` override generalized across every
story-touching tool, plus real Streamable HTTP transport via a
byte-verbatim copy of kindroid-mcp's fleet-canonical `mountMcpHttp()`)
and **`mnemo_list_entities`** (the complete/unranked entity-listing
primitive, previously export-only plumbing, now a real tool). Both grew
out of a pre-build review of [docs/WEBUI_NOTES.md](docs/WEBUI_NOTES.md)
(paired senior-sde feasibility review + senior-ui-ux-designer critique)
that found the doc's original build order had no working prerequisite
at all. See STATUS.md's Done log for the full writeup of every stage.

**The Living Canon Standard is ratified, and story references moved to
per-entity folders** (2026-08-24/25) —
[docs/LIVING_CANON_STANDARD.md](docs/LIVING_CANON_STANDARD.md) is now
the editorial quality contract for curated story references and export
derivatives (character depth, playable locations, material objects,
relationship/knowledge geometry, hook ecology, truth tiers, provenance,
mature-content routing); `references/` moved from flat `<slug>.jpg`
files to one folder per entity per
[docs/DATA_LAYOUT.md](docs/DATA_LAYOUT.md), with a new `objects/`
category alongside `characters/`/`locations/`.

## Stack

- TypeScript (Node 22+, ESM, `NodeNext` module resolution)
- `@modelcontextprotocol/sdk` (high-level `McpServer` API)
- `zod` for tool input schemas
- `vitest` for tests

## Layout

- `src/index.ts` — MCP server entry, env validation, `GENERATOR_PROVIDER`
  selection, tool registration. `makeServer()` factory + a stdio/HTTP
  mode switch on `MCP_PORT` (unset = stdio).
- `src/http-config.ts` — HTTP transport env config (`MCP_PORT`,
  `MCP_BIND_HOST`, `MCP_ALLOWED_HOSTS`, `MCP_AUTH_TOKEN`,
  `MCP_SESSION_IDLE_MS`).
- `src/shared/http-transport.ts` — `mountMcpHttp()`: fleet-canonical
  Streamable HTTP transport (fresh `McpServer` per session, idle-session
  eviction, Host/Origin allowlist, bearer auth) — a byte-verbatim copy
  of kindroid-mcp's own `src/shared/http-transport.ts`.
- `src/api-security.ts` — `apiSecurity()`: the same Host/Origin allowlist
  + bearer-auth check as `shared/http-transport.ts`, reimplemented (not
  imported — that file must stay byte-verbatim) as Express middleware
  protecting `/api/*` and the static web UI.
- `src/api/` — the REST layer the web UI talks to: `index.ts`
  (`createApiRouter()`, mirrors `tools/index.ts`'s orchestrator shape),
  `stories.ts`, `entities.ts`, and `interactive.ts` (route handlers — thin
  JSON adapters over the same domain functions the MCP tools wrap),
  `helpers.ts` (`asyncRoute()`, input/error handling).
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
- `src/tools/*.ts` — tool registrations (one file per tool surface).
- `src/log.ts` — structured stderr logger.
- `tests/` — vitest, real OC + real Ollama (env-gated).
- `scripts/dump-prompt.mjs`, `scripts/dump-validation.mjs` —
  command-line diagnostics. Used during v0.1.2 dogfooding to pin the
  few-shot-vs-rule cause without going through Claude Desktop.
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
  sidecars, and the server-written `story.json` identity card.
- `docs/LIVING_CANON_STANDARD.md` — the ratified editorial quality contract
  for curated story references and polished export derivatives: proportional
  character depth, playable locations, material objects, relationship and
  knowledge geometry, hook ecology, truth tiers, current-state extraction,
  provenance, mature-content/routing separation, and cross-story improvement
  without forced canon connections.
- `docs/WEBUI_NOTES.md` — design input for the shipped-but-incomplete web UI
  (explicitly not ratified beyond implemented slices): mode-adaptive layout,
  the storyline control plane, the retrieval-assembly panel, media in the beat
  flow, plex-companion watch parties, and a parked graphic-novel reading
  format.
- `docs/CONTENT_ROUTING_DESIGN.md` — proposal (not yet ratified) for
  implementing Living Canon Standard §10's SFW/NSFW routing boundary: a
  story-level content-rating declaration on the story marker, a
  provider-level capability declaration, and a fail-closed pre-flight
  check at `mnemo_continue`'s one real generation call site. Grounded in
  OpenChronicle v1's `ContentRoutingConfig`/`ModelSelector` (a real
  design that was built and never wired to anything).
- `docs/V2_RETROSPECTIVE.md` — entity schemas, verbatim prompt templates,
  lessons learned, and anti-patterns from the v2 OpenChronicle
  storytelling plugin. v2 code is NOT being ported; this doc is the
  bridge that captures the durable informational value.
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

- **MCP server first, web UI on the roadmap.** The web UI is required
  for uncensored ("spicy") storytelling because Claude Desktop's host
  LLM sits in the response path and triggers content-policy refusals on
  tool outputs containing graphic content. SFW use works fine in
  Claude Desktop / Claude Code via the MCP.
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
  `shared/http-transport.ts` — a byte-verbatim copy of kindroid-mcp's
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
npm test               # vitest run
```

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

Per ARCHITECTURE.md §8: game mechanics, multi-user, visual UI elements,
auto-regen on validation failure, voice, image generation, cross-story
memory bleed. To be revisited only after v0 ships and gets real use.
