# Status

**Last updated:** 2026-08-23 (**The web UI exists.** WEBUI_NOTES §9 slice 1
(entity library, read-only) shipped end to end — a new `/api/*` REST layer
(`src/api/`, thin adapters over the same domain functions the MCP tools
already wrap) and a real React 19 + Vite SPA (`webui/`, its own package),
built and served by the same Express app slice 0 added. Design direction
"The Archivist's Desk" extends the Chaos Saga reader artifact's palette
into a card-catalog aesthetic. Verified twice over: 220 automated tests
passing (up from 193), and a real browser walkthrough against real
production data (Chaos Saga's 41 entities, all filter counts exact, zero
console errors). One real npm footgun found and fixed along the way:
`npm --prefix webui install` run from the root's CWD silently injects a
self-referencing `file:..` dependency into `webui/package.json` — fixed by
using an actual `cd` instead of `--prefix`. Full writeup in the dated Done
entry below. Earlier, same day — **`mnemo_list_entities` shipped — slice 1's
complete-listing primitive is now a real tool, not just internal
plumbing.** Generalizes the existing (export-only) `listAllEntities()`
into `mnemo_list_entities(type?, include_body?, story?)`: a complete,
unranked enumeration (nothing capped the way `mnemo_recall` is), body
stripped by default to keep a large story's browse response light. Live-
smoke-tested against real production data — Chaos Saga's real 41 entities
came back correctly. Full writeup in the dated Done entry below. Earlier,
same day — **Slice 0 shipped: HTTP transport + story-pointer override —
the exact prerequisite the pre-build review below called for.** `resolveStoryId()` generalizes `mnemo_export_story`'s
existing bypass pattern to all 9 story-touching tools (a per-call `story`
override, deliberately not session-scoped server state); a byte-verbatim
copy of kindroid-mcp's fleet-canonical `mountMcpHttp()` gives mnemosyne
real Streamable HTTP transport for the first time, with `src/index.ts`
mode-switching on `MCP_PORT` (unset = stdio, unchanged). Verified
end-to-end against the real compiled server, not just unit tests: `/health`
+ a real MCP initialize handshake in HTTP mode, and a confirmed
byte-for-byte-unchanged stdio boot. 193 tests passing with `OC_URL` set
(up from 144), including a new `http-integration.test.ts` proving two
concurrent sessions don't collide and the story override bypasses the
pointer over the actual wire. Full writeup in the dated Done entry below.
Earlier, same day — **WEBUI_NOTES.md got its first real review pass, and
the previous headline finding was that §9 has no slice 0.** A paired
senior-sde feasibility review and senior-ui-ux-designer critique (plus a
live browser survey of both reference apps and the real Chaos Saga reader
artifact from the import campaign) converged on the same conclusion: the
doc's build order assumes a foundation — HTTP transport, per-request story
scoping — that doesn't exist yet. New §0 names it; §3/§4's sections got
reality-checked against the actual code; the design critique added a
cold-start gap, a mode-switching layout fix, and two anti-patterns to avoid
on purpose. Full writeup below. Next: scope §0 as real engineering work,
per operator direction — see the dated Done entry for everything.) Earlier,
same day — **outgoing companion-chat messages now carry
a provenance header.** `companion-message.ts`'s `buildCompanionMessage()`
was bracketing the story-context block it prepends but sending the
direction itself, and the group-conversation nudge, bare — so an automated
`mnemo_continue` direction read as the operator typing directly in
Kindroid/Botify's own chat history. Every outgoing message now opens with
`[Mnemosyne — automated scene direction, not Carl typing]` (new
`MNEMO_USER_NAME` env var, default Carl, threaded through both
`KindroidProviderConfig` and `BotifyProviderConfig`). The wording is
researched, not guessed: a 4-agent workflow catalogued Kindroid's and AI
Dungeon's official docs plus Reddit community convention (2026-08-23) —
square brackets beat parens/OOC (AI Dungeon's own docs give the mechanism:
fiction-trained models read `[ ]` as "descriptive indicator, not story
text"; Kindroid's community independently reports brackets outperforming
parens), and the literal word "OOC" is deliberately dropped since heavy
`OOC:`-tagging is reported to train a Kin into echoing it back unprompted.
Framing is descriptive, not imperative — Kindroid's docs warn imperative
directives over-trigger. plex-companion's own `[Plex Companion — automated
... note, not Carl typing]` header already matched this shape exactly and
needed zero changes — it was the reference implementation the research
validated. Paired with a `prompt.ts` addition: every mode directive now
states the asterisk-for-action / plain-dialogue convention (Kindroid's own
documented Example Message format), so the five direct-LLM providers'
generated output stays visually consistent with the wider companion-chat
convention. Consistency is the point, not just style — the operator's own
framing: "when we run into problems, like a bot reacting poorly, it's
easier to isolate what caused it" if every generator formats the same way.
Botify's own OOC/bracket handling is unconfirmed by the research (its docs
and community were unreachable) — flagged as a follow-up empirical probe,
not assumed. 5 new/updated tests (142/142 passing); a separate same-day
plex-companion timeout fix (`KINDROID_ENGAGEMENT_TIMEOUT_MS`, split from
`REQUEST_TIMEOUT_MS`) is documented in that repo's own STATUS.md.) Earlier,
same day — **the import campaign is complete — five
live stories, ~369 entities**. All four original ChatGPT projects are
imported and a fifth story, Shadowflame, was created from material
found in Botify. Chaos Saga 41, GhostHunters 94, BattleChasers 138,
Wonderland 54, Shadowflame 42. The night's biggest methodological
finding: the operator's Botify bots hold *primary canon* — authored
profile blocks and played story logs — so an empty `Profiles/` folder
on disk proves nothing. Wonderland's entire cast was in Botify while
its folders sat empty. Two long transcripts (1,882 and 1,513 messages)
were mined with 8-agent extraction workflows plus continuity critics,
which repeatedly earned their keep: one caught a cast brief leaking
surnames into "extracted" output that appear nowhere in 6,083 lines of
source, and another caught a ratified canon clause that the source
flatly refutes. Previous, same day — **repo-local `data/` directory,
organized by storyline**: operational state moved out of the OS config dir into
gitignored `<repo>/data` — `config.json` at the root plus one
`stories/<slug>/` subtree per storyline holding `exports/` backups and
`references/` assets, `MNEMO_DATA_DIR` override, Docker-mountable as
persistent storage. Legacy OS-config-dir `config.json` auto-migrates
(copy, not move) with fail-soft on a corrupt legacy file; the
pre-commit adversarial review caught both the corrupt-legacy wedge and
an untested default-export-path branch — fixed with regression tests.
Previous, 2026-08-22 — **first generated beat on imported
canon**: `mnemo_continue` against the freshly-imported Chaos Saga
produced "Home Ground" via the Anthropic provider — full 59KB context
(28 entities), style clauses and character voices honored, saved as
canon. The road there surfaced two findings: (1) `OllamaProvider`
never set `num_ctx` — now auto-sized per request to the actual prompt
(pure `computeNumCtx`, capped by new `OLLAMA_NUM_CTX`, warns when
capped below the estimate), making the context window deterministic
regardless of any install's defaults; (2) the desktop's local Ollama
(0.32.15, GPU) turned out to corrupt long-context inference OUTSIDE
mnemosyne's control — two model families produce word salad on prompts
past ~7-8k tokens while staying perfect below ~6k, with the full
window loaded and 100% GPU; bisected and confirmed install-level, not
prompt-level. Local-Ollama big-story use needs that install fixed
(update/reinstall, or try disabling flash attention) or `OLLAMA_URL`
pointed at the NAS; cloud providers are unaffected.) Earlier: **all
four cloud providers live-verified**
— the operator dropped real API keys into `.env` and the env-gated
suites lit up: Anthropic (`claude-sonnet-4-5`), OpenAI (`gpt-5.4-mini`),
Gemini (`gemini-3.6-flash`), and Atlas Cloud
(`deepseek-ai/deepseek-v4-flash`) each completed a real generation
round-trip. One live finding, and it validated a day-old design
decision within hours: Google has retired `gemini-2.5-flash` for new
users — the explicit-model-required posture surfaced it as a clean,
self-explanatory 404 naming the replacement rather than a silently
wrong baked-in default. The live test options also stopped sending
temperature/max_tokens, matching the pass-through posture. Botify
remains env-gated pending the operator picking a storytelling chat
UUID. Earlier (2026-08-21, late): **five new generator providers** — `botify` (MCP client to botify-mcp, the companion-chat
pattern shared with Kindroid via a new extracted
`companion-message.ts` builder), plus direct-API `anthropic`, `openai`,
`gemini`, and `atlascloud` (the OpenAI-compatible pair share one class;
`OPENAI_BASE_URL` makes any compatible host work; Atlas goes direct
rather than through atlascloud-mcp because its `atlas_chat` returns
markdown a machine caller can't safely parse). Cloud providers honor
the system-prompt + per-call model surface, with temperature/token caps
passed through only when set (several current-gen models — Claude Opus
4.7+, OpenAI's reasoning series — reject the fields outright, a
pre-commit adversarial-review catch); the validator stays on Ollama for
all, so `OLLAMA_VALIDATOR_MODEL` is now required for every non-ollama
generator. Live-verification is env-gated
per provider key — wire-format contracts are documented-shape until
keys are set. Earlier: import/export family complete: the
mapping playbook + seed templates shipped as docs —
[docs/IMPORT_PLAYBOOK.md](docs/IMPORT_PLAYBOOK.md) /
[docs/SEED_TEMPLATES.md](docs/SEED_TEMPLATES.md) — closing the design's
third build phase; all that remains is the actual curated imports of
the four ChatGPT projects; earlier same day: `mnemo_import_story`
shipped and live-verified — the export→import round-trip restores a
story into a fresh OC project with pin state, validation tags, and
backdated timestamps all intact; and `mnemo_export_story` shipped
and live-verified against real OC — versioned JSON export per
[docs/IMPORT_EXPORT_DESIGN.md](docs/IMPORT_EXPORT_DESIGN.md), the
interchange schema everything else in the import/export family builds
on; and that design ratified — derived from a three-source research
pass (the operator's original ChatGPT project folders, OC v1's archived
template system, OC v2's import pipeline) plus a two-reviewer
second-opinion pass; next up: the mapping playbook + seed templates as
docs, then the curated ChatGPT-project imports); earlier (2026-08-18):
Ollama transport-error messages now surface
their real cause — `OllamaProvider.generate()`'s catch built its message
from `err.message` only, which on a real `fetch()` failure is Node's generic
`TypeError: fetch failed`, discarding the actual DNS/connection/TLS reason
in `error.cause`; found via a fleet-wide sweep prompted by a live incident
in downloader-mcp; new exported `describeTransportError()` in `src/llm.ts`,
tested in `tests/llm-transport-error.test.ts`); earlier (2026-08-12)
(group-chat generator path live-verified against a real subscriber group, which surfaced a same-speaker-repeats problem; fixed via a per-message conversation nudge, then sharpened to point at Kindroid's documented `@Name` turn-handoff mechanism — both live-verified, confirming a clean 4/4 alternating exchange; earlier (2026-08-08): per-story Kindroid target binding extended to groups — `mnemo_story_use`/`mnemo_continue` gain `kindroid_kin`/`kindroid_group_id`, resolved via `resolveKindroidTarget()`; a tsconfig bug that silently skipped typechecking every test file was found and fixed in passing; also 2026-08-08: found and committed uncommitted Atlas Cloud illustration integration design notes from a prior session — `docs/ILLUSTRATION_INTEGRATION.md`, proposal only, no code changes; earlier (2026-08-05): Phase 6 live-verified against a dedicated test kin; Phase 6 revised — keyphrase-gated story context for the Kindroid generator; v0.1.3 shipped — validator-gated scene inclusion; atlascloud-mcp registered locally in `.mcp.json` + illustration-integration scope recorded in "What's next")

## Phase

**Phase 6 (Kindroid bridge) built and live-verified.** `GENERATOR_PROVIDER=kindroid`
routes story generation through a new `KindroidProvider`, which connects to
kindroid-mcp (now deployed as a Streamable HTTP MCP server on the NAS) as an
MCP client — mirroring `OcClient`'s existing pattern rather than the
originally-planned plain fetch, since kindroid-mcp didn't have HTTP
transport when that plan was written. Generator only; the validator role
always stays on Ollama.

**Revised same day:** the Kindroid path no longer ignores story context
outright. `buildKindroidMessage()` scans the direction for a
character/location/lore/worldbuilding entity NAME mention and folds in only
the matching entries, plus the already-relevance-filtered recent scenes
(always included). This mirrors Kindroid's own keyphrase-triggered "Journal"
feature — confirmed app-only, not reachable via the public API — reimplemented
client-side and populated from the story's existing OC entities (no new
storage, no import step: `mnemo_save_entity` already is the data source).
Rules/style are never surfaced this way; the kin's own persona still carries
tone/voice. Trade-off accepted: a match becomes a visible prefix in the
actual message sent (and thus in your chat history), since Kindroid has no
side channel to inject context invisibly the way its native Journal recall
does. `gatherContext`/`buildSystemPrompt` still run unconditionally in
`continue.ts` regardless of generator, since the optional validator pass
needs the full context either way. 7 new pure unit tests for
`buildKindroidMessage` (keyphrase matching, word-boundary precision, scene
inclusion, rules/style exclusion) — see `tests/kindroid-provider.test.ts`.

**Live-verified (2026-08-05).** A dedicated test kin was designated;
`tests/kindroid-provider.test.ts`'s env-gated real-integration suite ran
against the live NAS deployment (all 11 tests pass, including the 3 real
`kindroid_send_message` round-trips and the `opts.model` override path).
Confirmed end-to-end: `KINDROID_MCP_URL`/`KINDROID_MCP_AUTH_TOKEN`/
`KINDROID_STORYTELLING_KIN` wiring, the MCP-client connection, and a real
reply coming back ignoring `systemPrompt`/`temperature`/`maxTokens` as
designed. Not yet exercised in this pass: an actual `mnemo_continue` call
with `GENERATOR_PROVIDER=kindroid` and a non-empty `ContextBundle` (the
keyphrase-injection path itself is covered by the 8 pure unit tests, not
by a live round-trip with real OC-sourced context).

**Per-story Kindroid target binding: AI or group (2026-08-08).**
`KINDROID_STORYTELLING_KIN` was a single, server-wide AI default with no
way to point different stories at different targets short of passing
`model` on every `mnemo_continue` call, and no way to target a group chat
at all. `mnemo_story_use` now accepts `kindroid_kin` / `kindroid_group_id`
(mutually exclusive; `null` clears), stored as `KindroidTarget {type: "ai"
| "group", id}` on the story's marker memory (`stories.ts` bumped to
marker schema 3 — schema-1 markers with no kin line, and schema-2 markers
with the legacy bare `Kindroid-Kin:` line, always an AI target, both still
parse fine; no migration needed). Follows "OC is canonical for story
state" rather than mnemosyne's local `config.json`, since a target id is
portable story data. `mnemo_continue` gained matching per-call
`kindroid_kin` / `kindroid_group_id` params and resolves the effective
target via `resolveKindroidTarget()`: the per-call override wins, then the
active story's bound target (only relevant when the generator actually is
Kindroid), then `KindroidProvider`'s configured `defaultTarget`
(`KINDROID_STORYTELLING_KIN` or the new `KINDROID_STORYTELLING_GROUP`,
mutually exclusive at startup). `model` is now Ollama-only — it no longer
doubles as a Kindroid override, since a Kindroid target needs a type (ai
vs group), not just a bare id. Against a group, `KindroidProvider.generate()`
drives kindroid-mcp's turn loop via the new `KindroidClient.advanceGroup()`
(`allowUser: false` forced — mnemosyne is generating a beat, not waiting on
a live human's real turn; `maxTurns` defaults to 4, matching kindroid-mcp's
own default) and joins the replies into one beat via `formatGroupReplies()`
(`Name: message` per line, in generation order). **Live-verified
2026-08-12** against a real group (a subscriber group tied to a live
Twitch stream) — see the dated Done entry below for the full
walkthrough. 8 new pure tests (`resolveKindroidTarget`,
`formatGroupReplies`, `combineKindroidTarget`), 4 new real-OC integration
tests for the marker round-trip (ai-at-creation, group-at-creation,
bind/rebind-ai-to-group/clear, legacy schema-2 compat) — see
`tests/kindroid-provider.test.ts` / `tests/stories.test.ts`.

**Also fixed in passing:** `tsconfig.typecheck.json` extended
`tsconfig.json` without overriding its inherited `exclude: ["**/*.test.ts"]`
— exclude wins over include, so despite the file's own stated purpose
("typecheck tests too"), every `*.test.ts` was silently skipped by `npm run
typecheck` the whole time. Found while investigating why a stale rename
(`setStoryKin`) in `tests/stories.test.ts` wasn't flagged; fixed by
overriding `exclude` to just `["node_modules", "dist"]` in the typecheck
config. Real errors surfaced immediately once fixed (confirming the bug was
live) and were corrected as part of this same change.

**v0.1.3 shipped** (2026-07-31, a few hours before the Phase 6 work
above landed the same day). Validator-gated scene inclusion — the real
fix for the few-shot-vs-rule diagnostic surfaced 2026-05-11: present-
tense few-shot scenes in RECENT SCENES were drowning out an explicit
past-tense RULE, and no amount of prompt-position shuffling fixed it —
the few-shot content itself had to change. `mnemo_continue(validate=true)`
now tags scenes `validation:clean`/`validation:errors`; `gatherContext`
prefers clean, falls back to untagged, hard-excludes errors; a new
`mnemo_revalidate_scenes` tool retroactively tags pre-v0.1.3 content.
See "Done" below for the full four-step writeup, the OC full-replace-tags
correctness trap it surfaced, and the review-fix follow-up.

**v0.1.2 shipped.** Three more patches from the v0.1.1 dogfooding
session, all targeting the rule-following gaps surfaced by the
Dovecoast smoke test against `nous-hermes2-mixtral` + `phi4:14b`:

1. Validator prompt restructured into a two-step process — enumerate
   each distinct constraint first, then check each independently. The
   v0.1.1 validator caught one constraint per rule and stopped, missing
   structurally identical violations and missing entire constraint
   axes (e.g., catching POV but missing tense in a compound rule).
2. Rule-precedence statement inserted between the mode directive and
   the constraint blocks. The mode directives prime narrative-present
   prose ("Narrate actions, describe the environment..."), and even
   instruction-tuned models followed the mode and the rules awkwardly.
   Explicit precedence fixes that.
3. `mnemo_validate(content)` standalone tool. Counterpart to
   `mnemo_continue`'s `validate=true`; lets the user (or the host LLM)
   feed arbitrary text through the validator without regenerating.
   Splits "did the generator violate?" from "did the validator catch
   it?" cleanly. Plus `scripts/dump-validation.mjs` companion for
   command-line A/B work.

37/37 tests passed at the time.

Current count: 138 passing, 41 integration tests skipping cleanly
without `OC_URL`/`OLLAMA_GENERATOR_MODEL`/`KINDROID_MCP_URL`/cloud
provider keys configured (179 total). See Done below for everything
that's landed since.

## Done

- **The web UI exists — WEBUI_NOTES §9 slice 1 (entity library, read-only)
  shipped end to end: story list, filterable/searchable entity roster,
  entity detail** (2026-08-23). First real UI code in this repo's history.
  Two halves, both on top of slice 0's HTTP transport:
  - **`/api/*` REST layer** (`src/api/`) — `GET /stories`, `GET
    /stories/:storyId`, `GET /stories/:storyId/entities?type=&q=`, `GET
    /stories/:storyId/entities/:memoryId`. Thin JSON adapters over the same
    domain functions the MCP tools already wrap (`listStories`,
    `findStory`, `listAllEntities`, `filterListedEntities`) — no protocol
    envelope, `docs/ARCHITECTURE.md`'s "thin adapters over the same core"
    applied literally. Every route takes `storyId` from the URL, never the
    local `current_story_id` pointer (`GET /stories` deliberately omits
    `current` for the same reason `resolveStoryId` exists — see slice 0).
    New `OcClient.memoryGet()` (`src/oc-client.ts`) backs single-entity
    lookup; its not-found detection was verified live against real OC
    rather than trusted from reading OC's source — the actual wrapped error
    is `"memory_get failed: Error executing tool memory_get: Memory not
    found: <id>"` (FastMCP adds its own "Error executing tool" layer the
    source alone didn't reveal), confirmed by a live throwaway call before
    committing the match pattern. `getEntityByMemoryId` enforces
    `project_id === storyId` itself (`memory_get` isn't project-scoped) —
    live-verified a cross-story id correctly 404s rather than leaking
    another story's entity. `filterListedEntities` gained an optional
    `query` (case-insensitive substring over name OR body, filtering before
    the existing body-strip). New `src/api-security.ts` extends slice 0's
    Host/Origin allowlist + bearer auth to `/api/*` and the static UI (not
    just `/mcp`) — deliberately duplicated logic against the byte-verbatim
    `shared/http-transport.ts` rather than exporting from it, since that
    file stays hash-compared against kindroid-mcp's canonical copy.
  - **`webui/` — a separate React 19 + Vite + react-router SPA**, its own
    `package.json`/tsconfig (browser+JSX target, incompatible with the
    server's `NodeNext`/no-DOM config). Dev: Vite's own server proxies
    `/api/*` to Express, no CORS needed. Prod: `npm run build` at root now
    builds `webui/` too and copies its output into `dist/webui/`
    (`scripts/copy-webui-dist.mjs`, `fs.cpSync`, no new dependency) — a
    complete `npm ci && npm run build && npm start` produces a working
    deploy; Express serves `dist/webui/` as static files plus a
    regex-based SPA-fallback route (excludes `/api`, `/mcp`, `/health`)
    so a deep link survives a hard refresh. Design direction: **"The
    Archivist's Desk"** — extends the Chaos Saga reader artifact's warm
    near-black palette (same amber/cold/ember tokens) into a card-catalog
    aesthetic for a denser reference-tool register: Fraunces (display) +
    Literata (body prose, regular weight — no italic-wall) + Courier Prime
    (chrome/labels/tags, evoking a typewritten catalog label) as three
    faces with three distinct jobs, plus a signature "punched index card"
    detail on every card. Entity body rendering respects mnemosyne's own
    asterisk-for-action convention (`webui/src/components/BodyText.tsx`
    turns `*action*` into styled `<em>`, never the whole paragraph) and
    preserves single-newline field structure in structured profile text
    (confirmed against a real character profile, not assumed). Screens
    follow WEBUI_NOTES' already-ratified constraints: no search/filter
    chrome on the story list (§1, discovery is solved at 5 stories),
    browsing is strictly inert (§8 anti-pattern — every roster interaction
    is a plain navigation), no edit/delete/continue controls anywhere in
    this slice.
  - **A real npm footgun found and fixed, not just noticed:** running
    `npm --prefix webui install` from the repo root's CWD (as the original
    build-script draft did) silently injects `"mnemosyne-mcp": "file:.."`
    into `webui/package.json`'s own dependencies — reproduced twice
    deliberately to confirm before concluding it wasn't one-off flakiness.
    Root cause not fully chased down, but the fix is clean: `cd webui &&
    npm install && npm run build && cd ..` (an actual working-directory
    change) instead of `--prefix`, verified clean across a full
    rm-node_modules-and-reinstall cycle.
  - **Verified for real, twice over.** Automated: `tests/api-security.test.ts`
    (mirrors `http-transport.test.ts`'s harness for the new middleware),
    `tests/api-integration.test.ts` (real OC, all 4 routes, both 404 cases,
    the cross-story guard, `type`/`q` filters), plus new pure
    `filterListedEntities` query cases in `tests/entities.test.ts` — 220
    tests passing (up from 193), 0 failed (8 pre-existing, unrelated
    Ollama-model-unavailable failures on this workstation, confirmed
    isolated by running the affected suites alone). Manual: the actual
    compiled server was booted and driven in a real browser against real
    production data — Chaos Saga's 41 entities, all 7 type-filter counts
    matching exactly, search composing correctly with an active type
    filter, hover/focus states, a full story→roster→detail→back
    navigation loop, and a console check that found zero app errors (only
    unrelated browser-extension noise) — not just curl'd JSON.
  - **Explicitly deferred, matching the plan:** entity edit/delete UI (the
    MCP tools and domain functions already exist; no route or UI yet),
    Docker deployment of the built static assets, director/participant/
    audience generation screens, the assembly panel, watch parties — all
    later WEBUI_NOTES §9 slices.

- **`mnemo_list_entities` shipped — the complete-listing primitive slice 1
  needs, registered as a real tool for the first time** (2026-08-23).
  `listAllEntities()` (`src/entities.ts`) already existed — built for
  `mnemo_export_story`, using OC's unbounded `memory_list` rather than
  `memory_search`'s ranked/capped window — but was only reachable
  internally via export/import. It's now also `mnemo_list_entities(type?,
  include_body?, story?)`: a complete, unranked enumeration (nothing left
  out the way `mnemo_recall`'s cap can), with an optional type filter and
  body content stripped by default — a large story's complete prose can
  run to hundreds of KB across its scenes, and the entity library this
  exists for (WEBUI_NOTES §9 slice 1) wants a roster to browse, not a
  content dump. Every summary still carries `created_at` so a caller
  sorts chronologically itself; the tool does no sorting of its own,
  mirroring `recall()`'s existing "caller composes" posture. The
  filter/strip logic is a new pure function, `filterListedEntities()`
  (`src/entities.ts`), covered by 5 new unit tests — kept separate from
  the MCP tool wrapper so it's testable without the framework, matching
  this repo's existing pattern for `revalidateScenes` et al. Live-smoke-
  tested against real production data (not just the test story): Chaos
  Saga's real 41 entities came back correctly (matches STATUS.md's own
  import-campaign count), the `type: "character"` filter correctly
  returned 10 with `body` absent, and `skipped_memory_ids` came back
  empty on a clean story. `mnemo_story_use`'s tool description
  (`src/index.ts`'s `INSTRUCTIONS`) updated alongside it. Noticed in
  passing, not fixed: `src/tools/export.ts` and `src/tools/import.ts`
  both inline an identical "resolve `story` to the full `MnemoStory`
  object, or 404" pattern, and this tool is now a third copy — a real
  but small duplication (flagged, not extracted, since export/import's
  existing structured error-response shape would need to survive any
  extraction unchanged, and that's out of scope for a tool-registration
  task).
  **Pre-existing, unrelated to this change:** 8 test failures observed in
  this pass (`continue.test.ts`, `revalidate.test.ts`,
  `validate-tool.test.ts`, `validator.test.ts`) — all `Ollama HTTP 404:
  model 'mistral-nemo:12b' not found` against this workstation's local
  Ollama, which doesn't have that model pulled. Confirmed unrelated by
  running the entity/story/export/import suites in isolation (67/67
  pass); flagging per the fleet's own "pre-existing issues are still
  real, surface them" practice rather than silently working around them.

- **Slice 0 shipped: HTTP transport + story-pointer override — the
  prerequisite WEBUI_NOTES.md §0 named** (2026-08-23). Both blockers the
  pre-build review found are now closed, following the plan the review
  produced (`senior-sde` feasibility review → two Explore passes mapping
  the actual codebase and the fleet's proven HTTP pattern → a `Plan`
  agent's file-by-file design → operator approval → implementation).
  - **Story-pointer override.** `resolveStoryId(oc, explicit?)` (new,
    `src/stories.ts`) generalizes `mnemo_export_story`'s existing
    `name_or_id ?? requireCurrentStoryId()` pattern to the other 8
    story-touching tools: `mnemo_save_entity`/`mnemo_delete_entity`/
    `mnemo_recall` (`src/tools/entities.ts`), `mnemo_continue`
    (`continue.ts`), `mnemo_revalidate_scenes`/`mnemo_validate`
    (`revalidate.ts`/`validate.ts`) all gained an optional `story`
    parameter; `mnemo_import_story` got export's exact inline pattern
    rather than routing through the shared helper, since it needs the
    full `MnemoStory` object downstream. Deliberately a per-call
    argument, not session-scoped server state: the HTTP transport below
    evicts idle sessions, which would silently drop a session-scoped
    "active story" mid-use — an explicit argument has no lifetime and
    can't be evicted, and a future web UI just tracks which story is
    open in its own client state. The fallback path (no `story` given)
    is pure file I/O with zero OC calls — proven by a pure test that
    passes a poisoned `OcClient` stub (throws on any method call) and
    asserts it's never touched, the strongest available evidence every
    existing stdio/Claude-Desktop caller is byte-for-byte unaffected.
    `mnemo_story_use` still writes the pointer unconditionally — noted
    as a residual gap slice 1 inherits, not silently resolved here.
  - **HTTP transport.** `src/shared/http-transport.ts` is a byte-verbatim
    copy of kindroid-mcp's fleet-canonical `mountMcpHttp()` (hash-compared
    across repos by a `/repo-standards-audit` check) — fresh `McpServer`
    per session via a `createServer()` factory, idle-session eviction,
    Host/Origin allowlist (DNS-rebinding defense), timing-safe bearer
    auth. mnemosyne's `log.info(scope, msg, meta)` signature already
    matched the file's calls, so zero adaptation was needed. New
    `src/http-config.ts` reads `MCP_PORT`/`MCP_BIND_HOST`/
    `MCP_ALLOWED_HOSTS`/`MCP_AUTH_TOKEN`/`MCP_SESSION_IDLE_MS` directly
    off `process.env` (not an injected-env parameter like kindroid's own
    `loadConfig` — `tests/env-schema.test.ts` regex-matches literal
    `process.env.` references, so an injected signature would make these
    vars invisible to that drift check). `src/index.ts` now wraps server
    construction in a `makeServer()` factory (`oc`/`generator`/`validator`
    stay startup singletons shared across sessions; only the `McpServer`
    + its tool registrations are per-session) and mode-switches on
    `httpConfig.port`: unset runs the unchanged stdio path, set runs
    Express + `mountMcpHttp` + `/health` + graceful SIGTERM/SIGINT
    shutdown. `express ^4.21.0` added (matching kindroid/plex/botify —
    not servarr-mcp's Express 5, a fleet outlier); `npm install` also
    picked up `npm audit fix` for two unrelated high-severity transitive
    advisories (brace-expansion, nanoid) already present in the lockfile.
  - **Verified end-to-end, not just unit-tested.** The compiled
    `dist/index.js` was actually booted in HTTP mode against the real NAS
    OC and a real Ollama config: `/health` returned
    `{"status":"ok","version":"0.1.3"}`, a real MCP `initialize` handshake
    minted a session id and returned correct server info, and startup
    logs showed the right transport/bind/auth lines. Booted again with
    `MCP_PORT` unset to confirm stdio mode is byte-for-byte unchanged
    (identical "ready transport=stdio" log, no new code path touched
    since every existing deployment already runs with `MCP_PORT` unset).
    New `tests/http-integration.test.ts` — the first suite in this repo
    to exercise the real tool-registration + wire protocol instead of
    calling domain functions directly — proves two concurrent sessions
    don't collide (direct evidence the per-session factory, not a shared
    instance, is actually wired correctly) and proves the story override
    bypasses the pointer *over the wire*, not just through the helper
    function. New `tests/http-config.test.ts` (pure) and
    `tests/http-transport.test.ts` (verbatim copy of kindroid-mcp's own
    test of the shared module — the 404-not-400 idle-eviction behavior,
    session lifecycle, bearer auth, host allowlist) round out coverage.
    164 pure tests passing (up from 143), 193 passing with `OC_URL` set
    (up from 144) — 209 total, 45/16 skipping cleanly without the
    relevant env vars.
  - **Explicitly out of scope, same as the plan stated:** Docker/compose
    deployment for the new HTTP mode, the actual web UI (slice 1+), and
    registering `listAllEntities` as an MCP tool (exists, used internally
    by export/import — becomes slice 1's job per WEBUI_NOTES §9).

- **WEBUI_NOTES.md got its first real review pass — a pre-build risk review
  plus a design critique, and the headline finding is that §9 has no slice
  0** (2026-08-23). A live browser survey of both reference apps' actual
  screens (not just the feature-catalog pass from the prior session) fed two
  parallel agent reviews: a senior-sde pre-build feasibility pass against the
  real codebase, and a senior-ui-ux-designer critique of both the doc and
  live use of Botify/Kindroid. Both independently converged on the same
  conclusion from different angles — the doc's build order assumes a
  foundation that doesn't exist. New **§0: Prerequisites** names it plainly:
  mnemosyne is stdio-only with nothing a browser can reach (`src/index.ts`),
  the active-story pointer is global single-writer state (`src/config.ts`,
  blocks slice 1's own "browse across all stories"), and the eventual HTTP
  layer needs a real Host/Origin allowlist per the fleet's own
  `docker-deployments.md` guidance, not just loopback binding. Also
  surfaced: §3's floor-handback mechanic turned out to already be shipped
  (the doc described finished work as future work) — but with two real gaps
  the ship missed: the provenance header now brands the *operator's own*
  turn as "not Carl typing" when the floor comes back to them, and mode
  never reaches Kindroid/Botify generation at all (systemPrompt is ignored
  by both companion providers, so participant/director/audience is pure UI
  chrome against them today). §4's assembly panel turned out to be roughly
  half real — entity identity needed for the pin/deprioritize/exclude levers
  is discarded in `pullByType` before `ContextBundle` exists, and token/
  window accounting doesn't exist outside an internal, unreturned Ollama
  estimate. The design critique added: no cold-start/empty-state path
  exists anywhere in the doc; "switching mode should re-arrange the room"
  contradicts live mid-scene switching (fixed to a stated layout invariant —
  stable landmarks, variable density); the assembly panel is now scoped
  collapsed-by-default instead of permanent display; and two anti-patterns
  worth avoiding on purpose, both observed live — Kindroid's destructive/
  safe actions sharing one undifferentiated menu with no confirmation, and
  Botify's browse-a-character-commits-you-to-a-conversation flow (fixed to
  an explicit "browsing must be strictly inert" constraint on the entity
  library, §9 slice 1). Separately, the operator surfaced the actual Chaos
  Saga reader artifact from the import campaign — not a finished audience
  mode, but real grounding for it: the serif pairing, the cold-cut color
  shift for POV/location jumps, the per-chapter provenance tags, and the
  cast-card pattern are now cited concretely in §2 instead of the doc's prior
  abstract reference to "the reader artifact." Next: scope §0 (transport +
  story-pointer fix) as real engineering work, per operator direction — this
  is now the actual first slice, ahead of anything in §9.

- **Outgoing companion-chat messages carry a provenance header; generated
  output states the asterisk-for-action convention** (2026-08-23). Found
  while investigating why a power-outage direction sent through Kindroid
  posted as a bare message from "Carl Maddox" with nothing marking it as
  automated — `companion-message.ts`'s `buildCompanionMessage()` bracketed
  the story-context block it prepends but sent the direction itself, and
  the group-conversation nudge, bare. Every outgoing message now
  unconditionally opens with `[Mnemosyne — automated scene direction, not
  ${userName} typing]` — the operator name comes from the new
  `MNEMO_USER_NAME` env var (default `Carl`), threaded through
  `KindroidProviderConfig`/`BotifyProviderConfig` and defaulted again at
  the pure-function layer (`companion-message.ts`'s exported
  `DEFAULT_USER_NAME`) so existing call sites and tests didn't need to
  thread it through everywhere. The old short-circuit
  (`if (!hasContextBlock && !opts?.groupNote) return userMessage`) is gone
  — every message now does real work, matching the invariant plex-companion
  already had.
  Wording is researched, not guessed: a 4-agent Workflow catalogued
  Kindroid's and AI Dungeon's official docs, Character.AI/SillyTavern/
  NovelAI convention, and r/KindroidAI community practice (9 threads read
  in full), every claim requiring a verbatim quote + URL. Findings that
  shaped the wording: square brackets over parens or literal "OOC" —
  AI Dungeon's own docs state the mechanism (`[ ]` is read by
  fiction-trained models as "a descriptive indicator about what should
  come next," not story text to speak), Kindroid's community independently
  reports brackets outperforming parens, and heavy `OOC:`-tagging is
  reported (GlitterBombFallout, misterjupiter on r/KindroidAI) to train a
  Kin into echoing `OOC:`-tagged text back unprompted after repeated
  exposure — a risk worth naming even though this repo hasn't observed it
  yet. Framing is descriptive ("automated ... note, not X typing"), not
  imperative — Kindroid's own docs warn imperative Response Directives
  over-trigger (their example: "narrate in 3rd person" gets read as a
  standing command and produces unwanted narration walls). Botify's own
  handling of bracket/asterisk markup is unconfirmed by the research (its
  docs are an unreachable client-rendered SPA; Reddit/Discord were
  categorically unreachable by the research tooling) — flagged as a
  follow-up empirical probe via `botify_send_message`, not assumed safe.
  **plex-companion needed zero changes** — its three message builders
  (`buildReactionMessage`/`buildStartMessage`/`buildSuggestionMessage` in
  `src/backends/kindroid.ts`) already open every message with
  `[Plex Companion — automated ... note, not ${userName} typing]`; it was
  the reference implementation the research validated, not a second thing
  to fix.
  A companion change landed in `prompt.ts`: every mode directive now ends
  with a stated asterisk-for-action / plain-dialogue convention (matching
  Kindroid's own documented Example Message format — "actions in
  asterisks, speech in quotes"), so the five direct-LLM providers'
  generated prose stays visually consistent with what a companion-chat
  reply looks like. This is a *different* half of the same ratified
  decision from the header change — outgoing-direction marking protects a
  stateful companion's memory of who's talking; asterisk-consistency is
  about the model's own generated formatting — and only the latter applies
  to `prompt.ts`, since the five direct-LLM providers are stateless
  single-shot completions with no persistent "who's typing" concept for a
  bracket header to protect.
  5 new/updated pure tests (header presence and custom-name override in
  `buildKindroidMessage`; `KindroidProviderConfig.userName` plumbing
  end-to-end against a stubbed client; the asterisk statement present in
  all three modes) — 142/142 passing, typecheck/lint/format clean.
  **Live-verified against a real Botify bot the same day.** Sent two
  `[Mnemosyne — automated scene direction, not Carl typing]`-prefixed
  directions into a real ongoing chat via the browser (a standard
  companion-style bot with a normal back-and-forth text reply — one of
  Botify's image-generation "Experience" bots was tried first and rejected:
  it turned every message into a photo-generation action with no comparable
  text reply to inspect). Both replies wove the direction in as a scene
  event rather than reading it as Carl talking (no confusion about who
  "Mnemosyne" was, no echo of the header back, and the second reply
  correctly carried continuity from the first — "a localized power
  fluctuation **and** a sitewide lockdown simultaneously"), and both used
  asterisks for action / plain text for dialogue **unprompted** — closing
  the one gap the original research couldn't reach (Botify's docs and
  community were unreachable to that research; genre analogy was the best
  available evidence until this). Two clean exchanges is proportionate
  confirmation, not exhaustive — the echo-back risk Kindroid users report
  after *repeated* exposure remains unobserved either way and still
  warrants watching for in real use, not defensive code written against a
  failure mode that hasn't happened.
  **Corroborating detail, pulled from Botify's own rendered DOM (not
  guessed):** the client parses `*asterisk*` spans into a
  `message__text_italic` CSS class and colors it context-dependently —
  solid purple in the operator's own bubble, translucent grey in the bot's
  reply bubble by default, except the *first* action span of each bot
  reply, which carries an extra `message__text_magic-glow` modifier that
  forces it back to solid purple (a deliberate "spotlight the opening
  action" visual hierarchy, not a color accident). This confirms
  asterisk-delimited action text is a first-class, client-recognized
  convention on Botify, not just an incidental pattern the model happens to
  produce.
  **Confirmed against Botify's own community, not just its DOM.**
  `r/botify_ai` (12.9K members, official `Botify_AI` account active) was
  unreachable to the original automated research (WebFetch refuses
  reddit.com outright) but not to a live logged-in browser. Four findings
  worth recording: (1) Botify exposes an "instruction and example messages"
  field per bot (Person icon > More > Edit bot) — the same mechanism
  Kindroid calls Example Message — but the community's own bot-creation
  wiki has no section documenting chat-formatting conventions, and
  `Botify_AI` has twice acknowledged that gap without filling it as of this
  check. (2) A real bug report shows genuine Example Message content using
  the identical asterisk-action/plain-dialogue split, and `Botify_AI`
  treats a bot blurring the two as a bug ("Thanks for noticing! It's sent
  to devs!") — confirming the convention is intended platform behavior, not
  incidental model habit. (3) `(OOC: ...)` parenthetical commands get the
  same mixed-reliability reports Kindroid's community gives brackets — some
  users say they work, some say they don't, no official command list
  exists, and one reply's read ("the AI does not react as if you said it,
  but incorporates it in future responses") matches Kindroid's own
  no-true-system-channel finding exactly. (4) **The one that actually
  matters for reliability:** two recent threads (2 months old: "lost the
  use of the asterisk"; 8 days old: "the purple words thing has broken...
  will convert roleplay text into speech text, and vice versa") report an
  active regression in exactly the mechanism this probe depends on, and
  `Botify_AI` confirmed it **6 days before this was written**: "We
  previously had a negative feedback about purple words/asterisks... So we
  do work on fix of this all." The two-clean-exchanges probe above is real
  evidence, but it's evidence of "worked on this bot at this moment," not a
  guarantee — the vendor's own team is mid-fix on the exact feature it
  depends on.
  **A second, adjacent gap closed the same day:** `mnemo_continue`'s
  `direction` field never told the calling LLM to phrase in-fiction
  narration using the asterisk convention — caught live when a hand-written
  test direction ("The guard's radio crackles...") was sent as plain prose,
  breaking the very consistency the header + `prompt.ts` changes above
  exist to establish. The `direction` schema description now says so
  explicitly. Deliberately a schema-description fix, not a code
  transformation: `direction` can also be a bare meta-instruction ("continue
  the scene") that asterisk-wrapping would corrupt, and it may already mix
  dialogue with action — only the caller can tell which, so this guides
  the caller rather than blindly reformatting their input.

- **A timed-out Kindroid call no longer looks like a failed one**
  (2026-08-23). Found by running a real group beat, not by review. On a group
  fed daily by plex-companion, `advanceGroup` timed out at the MCP SDK's
  default 60s — *after* both AI turns had generated and persisted. mnemosyne
  saw a bare transport error and reported total failure; retrying would have
  duplicated real messages in a real conversation. Exactly the hazard the
  read-back guard above exists for, arriving through a door it cannot cover,
  because a transport timeout throws before any result exists to inspect.
  `sendMessage` and `advanceGroup` now share one chokepoint,
  `callMutatingTool`, which does two things. It sets a per-request timeout
  (`KINDROID_MCP_TIMEOUT_MS`, default **180s**) — deliberately well above the
  SDK's 60s, because a group beat chains `maxTurns` sequential generations at
  a live-measured ~13s each, so the documented 8-turn ceiling needs ~105s of
  generation alone. Erring long is the safe direction *here specifically*: a
  too-short timeout manufactures the ambiguous, retry-hazardous failure we're
  trying to eliminate, while a too-long one only delays an error on a call
  that was already lost. And on a timeout it rethrows saying the call may
  have already posted and generated, naming the elapsed time and the env var
  to raise rather than the retry to attempt. Non-timeout failures pass
  through untouched, on purpose — a genuine "no such group" is not a
  maybe-mutated call, and dressing it up as one would teach the caller to
  ignore the real warning. Nine new tests, six verified discriminating.
  **Root cause fixed upstream the same day:** kindroid-mcp's read-back walked
  the entire conversation to reach the newest N (`get-chat-messages` is
  oldest-first with only a forward cursor), so it was O(history). Now
  anchored — measured 1 read instead of 10+, and the same beat that timed out
  at 60s completed in 22.5s. This guard remains the belt to that fix's
  braces.

- **The group turn loop can hand the floor back** (2026-08-23). The
  companion to the beat-length change below. `allowUser` was hardcoded
  `false` on the Kindroid group path, with a comment explaining that
  mnemosyne generates beats "for a caller with no way to take that turn."
  That precondition was always too pessimistic — a conversational MCP host
  *is* such a caller — so it is now settable per call via
  `mnemo_continue`'s `allow_user`, defaulting to `false` so nothing
  scheduled or webhook-driven changes behavior. **No env counterpart, on
  purpose:** it describes the caller, not the deployment, and both kinds
  hit the same server; a server-wide `true` would hand the floor to
  someone who isn't there. The comment says so, since the asymmetry with
  `KINDROID_GROUP_MAX_TURNS` otherwise looks like an oversight.
  Flipping the flag alone would have been unsafe, so two things came with
  it. **`LlmProvider.generate()` now returns `GeneratedBeat`**
  (`{text, groupEnded?, groupTurns?}`) instead of a bare string — without
  it, a beat the group handed back mid-scene is indistinguishable from one
  that ran to completion, which is the entire point of the flag. Six
  providers, two call sites, thirteen test sites; all mechanical and
  typecheck-caught. **This is not the deferred `LlmProvider` redesign** —
  that one is about `LlmGenerateOptions` (providers ignoring most input
  fields) and is still queued. This only widened the return.
  And `mnemo_continue` no longer saves an empty beat: reading kindroid-mcp's
  source showed two opposite zero-reply cases that only `turns` separates
  — `turns === 0` is a legitimate immediate yield, while `turns > 0` with
  no replies means the turns generated upstream and only the read-back
  failed. The first returns `yielded_to_user` and saves nothing, telling
  the caller the direction is already posted and to continue rather than
  re-send; the second throws and says explicitly not to retry, because a
  retry would duplicate real generations in a real conversation. Seven new
  stubbed tests, verified to fail against the old behavior.

- **Group beat length is configurable** (2026-08-23). `maxTurns` on the
  Kindroid group path had been hardcoded to 4 since Phase 6, flagged in
  CLAUDE.md as "a cheap follow-up if needed." It is now settable two
  ways, mirroring how the group *target* already resolves: server-wide
  via `KINDROID_GROUP_MAX_TURNS`, and per call via `mnemo_continue`'s
  `group_max_turns`, with the per-call value winning. Bounds are 1–8 and
  the default is 4 — both mirrored from `kindroid_advance_group`'s own
  zod schema rather than invented, so an out-of-range value fails local
  validation with a useful message instead of surfacing as an opaque
  upstream MCP error. The tool description says "turns, NOT tokens"
  out loud, because `group_max_turns` and the unrelated `max_tokens` sit
  two fields apart and differ by two characters. Single-AI targets ignore
  it (they always produce exactly one reply), as does every non-Kindroid
  provider. Five stubbed-client tests pin the precedence chain; a live
  assertion would have been flaky, since a real group loop can end early
  on `user_turn` and return fewer turns than requested.
  **Deliberately NOT changed:** the `allowUser: false` hardcode beside it.
  Its comment states the precondition honestly — mnemosyne generates
  beats "for a caller with no way to take that turn" — and that holds
  until the web UI exists. Flipping it now would just produce empty
  beats. See [WEBUI_NOTES.md](docs/WEBUI_NOTES.md) §3, where the
  floor-handback mechanic is designed out.
  *Also corrected here:* the test count above had drifted 14 tests stale
  (said 103/40/143, was really 117/41/158 before this change).

- **The curated-import campaign — five live stories, ~369 entities**
  (2026-08-23). The feature built in August finally got used in anger.
  All four original ChatGPT projects are imported per
  [IMPORT_PLAYBOOK.md](docs/IMPORT_PLAYBOOK.md), and a fifth story was
  created from material that existed nowhere on disk:
  - **Chaos Saga** (41) — backstory canonized from 2.4MB of raw
    transcripts, distilled character essences, photo-grounded
    appearances, and three per-pair relationship documents found on the
    Riley and Jenna Botify bots. The Riley/Jenna bond is recorded from
    *both* sides, because the two accounts agree on the facts and differ
    on what each woman fears.
  - **GhostHunters** (94) — 69 from files, then the Blackwood Manor case
    mined from a 1,882-message transcript. Yielded a fourth Blackwood
    sister, Lyla, who exists in no file and no memory block: she names
    the other three as "my sisters," which makes her the one left
    behind. Operator ruled "same story, early names," so Millfield →
    Dovecoast and Carl Yeager → Carl Ashcombe were normalized, with the
    rename disclosed inside the timeline entity.
  - **BattleChasers** (138) — the largest. Region files that live under
    `Profiles/Location` are regional compendia, split three ways
    (region frame → location, cities → locations, orders roll-up →
    worldbuilding). Two operator changes applied: Thorne Vex renamed
    Hodrek Sootbraid (word-boundary matched so "Thornevale" survived),
    and the Vale twins split into separate profiles by a parser that
    routes per-twin bullets and duplicates shared narrative.
  - **Wonderland** (54) — 40 from two files, then Alice Grimm's Botify
    memory blocks supplied the entire missing cast, five locations, and
    both relics.
  - **Shadowflame** (42) — NEW. A successor continuity to BattleChasers
    set several centuries later, built from the "Dark Queen Lilith" bot
    and named by the operator. Its pinned **BattleChasers Bridge** is
    the join between the two stories and is tiered: what the transcript
    sources, what has been ratified to connect them, and what is open by
    design. One ratified clause was **corrected** when the transcript
    refuted it — recorded inside the entity rather than silently
    overwritten.

  Method notes worth keeping: the adversarial-review habit extended to
  content work and paid every time — a critic caught surnames leaking
  from a task brief into supposedly extracted output, caught opposite
  dedup policies applied to identical bundle-vs-standalone patterns,
  caught two *diverging* Races documents that would both have survived
  under different names and contradicted each other, and established
  that trim-then-exact is the only delimiter rule that works across a
  corpus mixing hard-break headings with nested sub-headings. Explicit
  material throughout was reduced to one beat recording who and what
  changed — which is both appropriate and produces better continuity
  entities than choreography would.

- **Repo-local `data/` directory, organized by storyline** (2026-08-23).
  Operational state moved out of the OS config dir into `<repo>/data`
  (gitignored): `data/config.json` (current-story pointer) plus one
  `data/stories/<slug>/` subtree per storyline — `exports/` (the
  `mnemo_export_story` default; new `storySlug()` shared by folder and
  filename so they can't disagree) and `references/` (operator-curated
  assets, e.g. character reference photos; never written by the
  server). Override: `MNEMO_DATA_DIR` (empty string treated as unset;
  must be set explicitly for an npm-installed copy, where the
  repo-relative default would land inside node_modules). Motivation: a
  Docker deployment bind-mounts `data/` as persistent storage instead
  of depending on `%APPDATA%`/XDG paths that don't exist meaningfully
  in a container. A legacy `config.json` at the old OS location
  (`MNEMOSYNE_CONFIG_DIR` override still honored there) is
  auto-migrated — copied, not moved — on first read, with a stderr log
  line; a corrupt/unreadable legacy file fails soft (warn + skip, next
  write self-heals) instead of wedging every config read — caught by
  the pre-commit adversarial review. New pure test
  `tests/config-data-dir.test.ts` covers dir resolution, empty-string
  normalization, migration, migration-precedence, the
  neither-location case, and the corrupt-legacy fail-soft escape.
  Ratified the same day: **docs/DATA_LAYOUT.md** — the organization and
  naming standard for the story subtrees (every filename shell-safe
  lowercase slug — `references/<type>/<entity-slug>.<ext>` with
  `.<variant>` infixes; machine-named `art/`
  outputs each with a JSON sidecar capturing prompt/model/params/cost,
  since unseeded generation is otherwise unreproducible; master copies
  in the operator's curation archive — currently OneDrive, provisional
  — with `data/` as the operational copy that pointers cite), plus a
  server-written `story.json` identity card per story root
  (`buildStoryIndex()`, refreshed on default-path exports only) holding
  the slug↔story join that the lossy `storySlug()` can't recover —
  deliberately not a file index, which would drift.

- **Five new generator providers: botify, anthropic, openai, gemini,
  atlascloud** (2026-08-21, late same day). `GENERATOR_PROVIDER` now
  selects among seven backends. The shape per family:
  - **Botify** (`botify`) — "just like Kindroid": an MCP client to the
    deployed botify-mcp (`src/botify-client.ts`, mirroring
    `kindroid-client.ts` incl. bearer auth), driving a stateful
    character chat via its `send_message` tool; the target is a Botify
    chat UUID (`BOTIFY_STORYTELLING_CHAT`, server-wide default — a
    per-story binding would be a marker-schema bump, deliberately
    deferred until real use asks). The keyphrase-gated context folding
    is shared with Kindroid via a new `src/companion-message.ts`
    (extracted first as its own behavior-preserving commit, since the
    word-boundary matching and scene-inclusion rules are correctness
    contracts that must not drift between the two consumers).
    `extractBotReply` distinguishes "reply generated" / "message landed
    but inference failed — do NOT blindly retry, it would double-post" /
    "botify-mcp has no BOTIFY_APP_TOKEN configured" (shapes verified
    against botify-mcp's source).
  - **Anthropic / OpenAI / Gemini / Atlas Cloud** — direct HTTP, no
    SDKs (the Ollama convention). One `OpenAICompatProvider` class
    serves both `openai` and `atlascloud` (base URLs differ;
    `OPENAI_BASE_URL` override means any compatible host — Groq,
    Together, local vLLM — works without new code; Atlas's base
    verified from atlascloud-mcp's own constants). Atlas deliberately
    does NOT route through the deployed atlascloud-mcp: its
    `atlas_chat` tool returns a human-markdown envelope a machine
    caller can't safely scrape (filed as dogfooding feedback). All
    four honor systemPrompt + per-call `model` directly, with
    temperature/token caps **passed through only when set** — the
    pre-commit adversarial review caught that always-sending
    `temperature` would 400 on every current-gen Claude model (Opus
    4.7+ removed sampling controls), and the omit-by-default posture
    also covers OpenAI's reasoning models (which reject both fields)
    and Gemini 2.5's thinking-token budget in one stroke. The deferred
    "interface strain" concern shrank rather than grew, since these
    are what the interface was designed for; `model` is now documented
    as honored by every direct-LLM provider (the `mnemo_continue`
    schema + server instructions previously said Ollama-only — also a
    review catch, since that's the LLM-facing channel). Gemini's API key travels
    in the `x-goog-api-key` header, never the query string (secrets
    don't belong in URLs); its safety-block responses surface
    `promptFeedback.blockReason` distinctly from empty output. Shared
    HTTP scaffolding (timeout, HTTP-status detail, MCP-F08 transport-
    cause description) lives in `src/llm-http.ts` (three consumers —
    clears the extraction bar; Ollama keeps its own working copy).
  - **Wiring**: all zero-I/O env validation runs before `oc.connect()`
    (the batch-8 structure), each cloud provider requires an explicit
    model id (no baked-in defaults — model names age fast), and
    `OLLAMA_VALIDATOR_MODEL` is required for every non-ollama generator
    (the validator always stays on Ollama). Every new env var is
    documented in `.env.example` (the schema-drift test enforces the
    match). 13 new pure tests (request-body builders + response parsers
    per provider, fixtures matching each documented contract — the
    OpenAI-compat one additionally matching atlascloud-mcp's own
    captured `ChatCompletionResponse` type; Botify reply extraction;
    a companion-message ↔ buildKindroidMessage equivalence check) + 5
    env-gated live suites that skip until the operator sets the
    relevant key — setting a key is the opt-in, and live verification
    happens per provider as keys arrive (**all four cloud providers
    live-verified 2026-08-22**, see Last-updated). Two more review catches
    hardened the MCP-client path for everyone: `extractBotReply`
    distinguishes "inference ran but produced no text" (bot_message
    null — don't blame the app token) from "inference never attempted",
    and the shared `mcp-result.ts` helpers now throw an `isError`
    result's actual message instead of returning error prose as a reply
    (or JSON-parsing it into an unrelated SyntaxError) — a pre-existing
    gap in the Kindroid path that the Botify addition doubled. Cloud
    extractors also strip leading whitespace (the documented Ollama
    stray-space lesson, applied before it recurred).

- **Mapping playbook + seed templates shipped as docs — the
  import/export family's third and final build phase** (2026-08-21,
  same day as both tools).
  [docs/IMPORT_PLAYBOOK.md](docs/IMPORT_PLAYBOOK.md) carries the
  classification rules the host LLM applies when importing legacy
  material: folder names lie — classify by content (with the real
  observed failures as examples: BattleChasers' region configs are
  worldbuilding wearing a location label, Chaos Saga's stray misfiled
  draft, GhostHunters' concatenated instructions file); composite files
  split into one entity per concern; the full source→type mapping table
  incl. the lore-vs-worldbuilding distinction; the do-not-import list
  (canon tracking directives, group-chat log configs, raw transcripts,
  host plumbing); scene caution — finished logs only, backdated via
  `created_at`; verbatim-content hygiene.
  [docs/SEED_TEMPLATES.md](docs/SEED_TEMPLATES.md) adapts OC v1's four
  seed-shaped schemas to mnemosyne's prose-entity model: a story
  kickoff checklist (POV/tense rule mandatory — the Dovecoast lesson),
  the character-profile shape that survived four real projects (incl.
  the "core wound" field and inline per-relationship subsections), a
  style-guide skeleton with named addressable clauses, one-constraint-
  per-entity pinned rules, and a worked four-entity minimal seed.
  `{{PLACEHOLDER}}` means fill-or-drop; required floors deliberately
  minimal (elaborate specs decay unfilled — the spec-vs-practice gap
  measured in the source corpus). No code changes — per the ratified
  design, seeding is a conversation plus one `mnemo_import_story` call,
  and there is deliberately no seed tool.

- **`mnemo_import_story` shipped — the typed batch writer** (2026-08-21,
  same day as export). Two mutually exclusive input modes feed one
  machinery: `entities[]` (caller-classified records — the curated path;
  the tool validates and writes, never classifies) and `file_path` (a
  `mnemosyne_export: 1` document, deterministically deserialized — the
  round-trip path; unknown versions refused with a version-specific
  message). Safety semantics: preflight via one complete
  `listAllEntities` enumeration; any in-batch duplicate, or any conflict
  under the default `on_conflict=error`, aborts the whole batch with
  nothing written (the manifest still reports every record's would-be
  status); `skip`/`overwrite` proceed, with mid-batch write failures
  recorded per-record and never aborting the walk (the
  `revalidateScenes` convention); `dry_run` returns the same plan
  verbatim with `total_written: 0`. Writes go through the canonical
  `saveEntity` path, which re-checks existence itself — a preflight set
  gone stale mid-batch degrades to an accurate `overwritten` status,
  never a duplicate. `created_at` backdating threads through a new
  optional field on `saveEntity`/`OcClient.memorySave` (create path
  only), restoring original timestamps on round-trip — confirmed
  honored by real OC, which protects RECENT SCENES recency from
  re-imported legacy scenes. A file's embedded `kindroid_target` is
  reported in the manifest but never applied — binding is an explicit
  `mnemo_story_use` decision. The entities-vs-file mutual exclusivity
  is enforced in the handler (MCP inputSchema silently drops
  object-level zod refinements — the fleet mcp-server-authoring trap).
  A pre-commit adversarial review hardened four things: (1) writes now
  thread the preflight's resolved existence (memory_id included) into
  `saveEntity` via a new `existing` arg — overwrites go update-by-id and
  creates skip the dedupe search, because `saveEntity`'s bounded
  `SAVE_DEDUPE_SEARCH_TOPK` search can miss in exactly the bulk regime
  import creates, and a miss on the overwrite path would mint a silent
  duplicate that makes the story's next export permanently
  un-importable (it also halves OC round-trips per record); (2)
  `created_at` is statically validated (`z.datetime`, accepting both JS
  toISOString and Python isoformat) and content length is checked
  against OC's 100k cap at preflight, so statically-knowable failures
  abort before any write instead of breaking the all-or-nothing promise
  mid-batch; (3) entity names reject line breaks in both the shared
  import schema and `mnemo_save_entity` (a `\n` in a name creates a
  memory the entity parser can never match again — permanently
  invisible to recall, export, and import's own preflight); (4) the
  record schema is a single shared object reused by both the tool
  inputSchema and the file validator, so the two modes can't drift.
  13 pure tests (preflight planning incl. in-batch-duplicate,
  content-cap, and same-name-different-type cases; document parsing
  incl. the version gate, failing-path naming, created_at acceptance of
  both round-trip formats, and the newline-name rejection;
  tampered-file refusal) + 4 real-OC integration tests (full-fidelity
  round-trip into a second story — pin state, validation tags,
  backdated timestamps all intact; dry_run writes nothing; conflict
  abort leaves even the clean records unwritten; skip/overwrite
  behave) — live-verified same day.

- **`mnemo_export_story` shipped — the import/export family's first
  tool** (2026-08-21). Serializes a story's full OC project to a
  versioned JSON document (`mnemosyne_export: 1`) per
  [docs/IMPORT_EXPORT_DESIGN.md](docs/IMPORT_EXPORT_DESIGN.md): every
  entity with tags (validation state), pin state, and per-entity
  `created_at` (OC's `memory_save` supports backdating, so a future
  import can restore timestamps), plus the story's `kindroid_target`
  when bound (operator decision — portable across machines, not across
  Kindroid accounts). Enumeration uses a new `OcClient.memoryList`
  (OC's `memory_list`, strict project scope, no limit) rather than
  `memory_search`'s 100-result ranked window — an export that silently
  truncated would be quiet data loss — via a new
  `entities.listAllEntities` that excludes the story marker **by its
  memory ID** (not its tag — `extra_tags` lets a legitimate entity carry
  `story-marker`, and a tag filter would silently omit it; caught by the
  pre-commit adversarial review) and surfaces any other unparseable
  memory ids in the manifest's `skipped_memory_ids` instead of dropping
  them. The document is written to a file (default
  `<config dir>/exports/<slug>-<utc-timestamp>.json`, timestamped to the
  second so back-to-back exports never overwrite an earlier backup;
  relative `out_path` resolved to absolute since a stdio server's cwd is
  unpredictable; new `exportsDir()` in `config.ts`) and only a manifest
  returns through the tool — no reason to route a 100-scene story
  through host context. 7 pure tests (document assembly, envelope +
  literal schema-version pins so a casual version bump fails a test,
  filename slugging/collision behavior) + 2 real-OC integration tests
  (complete enumeration incl. a marker-tagged-entity regression;
  file-write round-trip asserting the manifest matches the file,
  kindroid_target survives, validation tags and timestamps preserved) —
  live-verified against real OC same day.
  Also fixed in passing: the server's `instructions` blob had drifted —
  `mnemo_delete_entity` and `mnemo_revalidate_scenes` were never added
  to its tool list; both are listed now, alongside the new export tool.

- **Per-story Kindroid target binding: AI or group chat** (2026-08-08).
  `KINDROID_STORYTELLING_KIN` had been a single, server-wide AI default
  with no way to point different stories at different targets short of
  passing `model` on every `mnemo_continue` call, and no way to target a
  group chat at all. `mnemo_story_use` gained `kindroid_kin` /
  `kindroid_group_id` params (mutually exclusive; `null` clears), stored
  as `KindroidTarget {type: "ai" | "group", id}` on the story's marker
  memory — `stories.ts` bumped to marker schema 3 (schema-1 markers with
  no kin line, and schema-2 markers with the legacy bare
  `Kindroid-Kin:` line, always an AI target, both still parse fine; no
  migration needed). Follows the existing "OC is canonical for story
  state" rule rather than mnemosyne's local `config.json`, since a
  target id is portable story data. `mnemo_continue` gained matching
  per-call `kindroid_kin` / `kindroid_group_id` params and resolves the
  effective target via the new `resolveKindroidTarget()`: the per-call
  override wins, then the active story's bound target, then
  `KindroidProvider`'s configured `defaultTarget`
  (`KINDROID_STORYTELLING_KIN` or the new `KINDROID_STORYTELLING_GROUP`,
  mutually exclusive at startup). `model` became Ollama-only — it no
  longer doubles as a Kindroid override, since a Kindroid target needs a
  type (ai vs group), not just a bare id. Against a group,
  `KindroidProvider.generate()` drives kindroid-mcp's turn loop via the
  new `KindroidClient.advanceGroup()` (`allowUser: false` forced;
  `maxTurns` defaults to 4, matching kindroid-mcp's own default) and
  joins the replies into one beat via the new `formatGroupReplies()`
  (`Name: message` per line, in generation order). 8 new pure tests
  (`resolveKindroidTarget`, `formatGroupReplies`,
  `combineKindroidTarget`) plus 4 new real-OC integration tests for the
  marker round-trip (ai-at-creation, group-at-creation,
  bind/rebind-ai-to-group/clear, legacy schema-2 compat) — see
  `tests/kindroid-provider.test.ts` / `tests/stories.test.ts`.

  **Group path live-verified 2026-08-12** against a real subscriber
  group tied to a live Twitch stream. A throwaway story ("Kimmy's Night
  Shift") was bound to the group via `setKindroidTarget`, seeded with a
  character/location/rule/style, and a real direction was run through
  the actual `gatherContext` → `buildKindroidMessage` → `advanceGroup`
  chain. Confirmed end-to-end: keyphrase matching correctly folded in
  both the character and location entities (the location matched
  because its name literally appeared in the direction text), rules/
  style stayed correctly excluded per design, the group returned 4 real
  AI turns from two distinct kins, and `formatGroupReplies()`'s output
  was saved back as a scene exactly as `mnemo_continue` would. Done via
  a new diagnostic script, `scripts/dump-kindroid-group-message.mjs`
  (same "test fresh `dist/` without restarting the host" pattern as
  `dump-prompt.mjs` — the live-connected MCP server predates this
  feature, so its exposed `mnemo_story_use` schema doesn't even accept
  `kindroid_group_id` yet).

  **Same-speaker-repeats fixed and live-verified (2026-08-12).** The
  live verification above actually surfaced a real problem on its first
  run: one kin took two of four turns in a row, both replying
  independently to the direction rather than to each other. Cross-repo
  comparison with `plex-companion`'s `KindroidBackend` (a sibling
  private repo with its own group-chat "watch party" use case) found it
  had hit and fixed the identical behavior via a static
  `groupConversationNote()` appended to every group-target message.
  Ported the idea and improved on it: mnemosyne already keyphrase-
  matches which characters a direction names, so the nudge names them
  specifically instead of gesturing at "each other." `buildKindroidMessage()`
  gained an `isGroup` parameter; `KindroidProvider.generate()` passes
  `target.type === "group"`. Live-verified immediately after against the
  same real subscriber group: alternation improved (Zephyr/Kimmy/Zephyr,
  no repeats) but wasn't yet a clean round-robin. Reading Kindroid's own
  groupchats documentation (kindroid.ai/docs/article/groupchats/)
  surfaced the actual mechanism — `@Name` mentions are the documented,
  controllable lever for who speaks next in automatic turn mode, and
  kins will hand the baton to each other the same way if told to. Added
  a line pointing the nudge at it explicitly ("@mention them by name")
  rather than leaving it to inference. Live-verified again: a clean 4/4
  alternating Zephyr/Kimmy/Zephyr/Kimmy exchange, each turn explicitly
  addressing the other by name. Both beats saved as OC scenes ("Shark vs
  Kraken Derail", "Kimmy Lands The Jump", tags `kindroid-group-live-test`
  + `conversation-nudge-v1`/`-v2-atmention`) for before/after comparison.
  6 new pure tests covering the nudge text, character-naming, the
  generic fallback, ordering, and the `@mention` line — see
  `tests/kindroid-provider.test.ts`.

  **Also fixed in passing:** `tsconfig.typecheck.json` extended
  `tsconfig.json` without overriding its inherited `exclude:
  ["**/*.test.ts"]` — exclude wins over include, so despite the file's
  own stated purpose ("typecheck tests too"), every `*.test.ts` was
  silently skipped by `npm run typecheck` the whole time. Found while
  investigating why a stale rename (`setStoryKin`) in
  `tests/stories.test.ts` wasn't flagged; fixed by overriding `exclude`
  to just `["node_modules", "dist"]` in the typecheck config. Real
  errors surfaced immediately once fixed (confirming the bug was live)
  and were corrected as part of this same change.

- **Phase 6 — Kindroid generator bridge, code-complete** (2026-07-31).
  `src/kindroid-client.ts` (MCP client wrapper for kindroid-mcp, mirroring
  `oc-client.ts`) + `src/kindroid-provider.ts` (`KindroidProvider implements
  LlmProvider`, generator-only). `GENERATOR_PROVIDER` env var in
  `src/index.ts` selects `ollama` (default, zero behavior change) or
  `kindroid` (requires `KINDROID_MCP_URL`, `KINDROID_STORYTELLING_KIN`, and
  makes `OLLAMA_VALIDATOR_MODEL` required instead of defaulting from
  `OLLAMA_GENERATOR_MODEL`, since the validator always runs on Ollama and
  there's no generator model to fall back to in Kindroid mode). Plan
  changed from the original "plain-fetch send-message" note (written when
  kindroid-mcp was stdio-only) to an MCP-client connection now that
  kindroid-mcp runs Streamable HTTP — gets kindroid-mcp's rate
  limiting/retry/name-registry for free. `tests/kindroid-provider.test.ts`
  added, env-gated on `KINDROID_MCP_URL`/`KINDROID_STORYTELLING_KIN` like
  the existing OC/Ollama integration tests — unlike those, it hits a real
  paid third-party service, so it only runs when both are explicitly set.
  **Live-verified 2026-08-05** against a dedicated test kin — all 11 tests
  pass, including the 3 real `kindroid_send_message` round-trips.

- **v0.1.3 shipped — validator-gated scene inclusion** (2026-07-31).
  The real fix for the few-shot-vs-rule diagnostic from 2026-05-11:
  present-tense few-shot scenes in RECENT SCENES were drowning out an
  explicit past-tense RULE, and prompt-position shuffling couldn't fix
  it — the few-shot content itself had to change. Four steps, each its
  own commit:
  1. **Tag at save** (`0fd9a3c`). `mnemo_continue(validate=true)` tags
     the saved scene `validation:clean` (0 errors) or
     `validation:errors` (1+ errors) once the verdict is known — no tag
     when `validate` is false, the save failed, or the validator itself
     failed. `src/entities.ts` gained `retagValidation(oc, memoryId,
     currentTags, verdict)`, the sole place a validation tag is
     constructed, and `SaveEntityResult` now returns the entity's
     actual current `tags`. `src/validator.ts` gained
     `classifyVerdict(report)` as the single source of truth for the
     clean/errors split.
  2. **Filter on recall** (`bd4729b`). `gatherContext`'s RECENT SCENES
     pull (`pullFilteredScenes` in `src/prompt.ts`) pulls a
     `SCENE_POOL_SIZE=20` candidate pool — OC's `memory_search` tags
     filter is AND-only with no exclusion, so the clean/untagged/errors
     split has to happen client-side over a pool wider than the final
     cap, same pattern as `SAVE_DEDUPE_SEARCH_TOPK` — prefers
     `validation:clean`, falls back to untagged, hard-excludes
     `validation:errors`, and returns `[]` if nothing survives, which
     is the intended behavior: the diagnostic proved the generator
     follows the rule cleanly with an empty RECENT SCENES block.
  3. **`mnemo_revalidate_scenes`** (`9c0a1f6`). New no-arg tool backed
     by an exported `revalidateScenes(oc, validator, storyId)` — pure,
     testable, no MCP dependency. Walks every scene sequentially
     (matching this codebase's OC rate-limit convention), re-validates
     each against fresh context, and retags. Capped at
     `MAX_RECALL_LIMIT` (100 scenes) — documented as a known limit
     rather than silently truncating. One scene's failure is caught and
     recorded in the response's `failures` list, not allowed to abort
     the walk.
  4. **Tests** (`92c0d99`). Pure coverage for the scene-filter bucketing
     (prefer-clean, fallback-to-untagged, hard-exclude-errors, empty
     result, cap respected) and `retagValidation`'s exact tag-array
     output; integration coverage in `continue.test.ts` (tag-on-validate
     vs. no-tag-when-skipped) and a new `tests/revalidate.test.ts`.

  **Correctness trap found and closed during implementation:** OC's
  `memory_update` replaces the `tags` array wholesale, not a merge
  (confirmed against the OpenChronicle server source). Every tag update
  in this feature echoes the complete current tag list through
  `retagValidation` rather than ever writing a bare validation tag —
  omitting the base tags would have silently broken `mnemo_recall`'s
  AND-tag filter for that memory forever.

  **Review follow-up** (`cf4ed3f`, same day). An adversarial review pass
  after implementation found `mnemo_save_entity`'s own
  overwrite-by-(type,name) path had the identical full-replace exposure
  one level up: re-saving a scene (e.g. hand-editing it) would silently
  drop its `validation:*` tag, since that path rebuilt tags from scratch
  with no knowledge of the out-of-band validation tag. `saveEntity`'s
  update branch now carries an existing `validation:*` tag forward
  unless the caller is setting one explicitly. Also documented (not
  fixed — accepted as a known limit) the previously-undocumented
  `mnemo_revalidate_scenes` 100-scene cap. Two smaller findings were
  deliberately deferred: no test exercises `mnemo_continue`'s tool
  handler directly (only the underlying primitives, tested in
  isolation), and `revalidateScenes`' per-scene failure-continuation
  branch has no test forcing the failure path.

  **Trade-offs accepted going in**, unchanged from the original plan:
  cached verdicts go stale on rule edits (no auto-invalidation — re-run
  `mnemo_revalidate_scenes` after editing rules); users who never
  validate get no anchor benefit (same failure mode as before v0.1.3);
  an all-excluded scene pool loses narrative continuity context until
  the first clean scene re-anchors it. `mnemo_continue`'s `validate`
  default is unchanged (`false`) — still opt-in until `keep_alive`
  lands and validator latency drops (see "What's next").

- **Lint and typecheck actually cover the repo** (2026-07-23). Two gaps
  surfaced while verifying the teardown work above:
  - `npm run lint` failed out of the box on anyone's machine that had
    scratch files in the gitignored `tmp/` dir — eslint's ignore list
    covered `dist/`, `.serena/`, `scripts/` but not `tmp/`. Added.
  - `npm run typecheck` never looked at `tests/`. `tsconfig.json` is the
    build config (`include: src/**/*` with a matching `rootDir`, so
    `dist/` mirrors `src/`), and vitest only transpiles — so a type
    error in a test file surfaced at runtime or not at all. New
    `tsconfig.typecheck.json` extends the build config with
    `noEmit` + `rootDir: "."` and widens `include` to src + tests +
    `vitest.config.ts`; `npm run typecheck` now runs against it.
    `npm run build` still uses the narrow config, so `dist/` is
    unchanged. Verified by planting a deliberate type error in a test
    file and watching it fail.

- **OC delete surface: `project_delete` wrapper + `memory_delete` confirm
  fix** (2026-07-23). OC's delete tools use a preview/confirm two-step —
  called without `confirm`, they return `{status:"preview", ...}` and
  change nothing; with `confirm=true` they hard-delete (no soft-delete,
  no recovery).
  - **Bug fixed:** `OcClient.memoryDelete` never passed `confirm`, so it
    had silently degraded to a preview when OC added the guard.
    `mnemo_delete_entity` was reporting success while deleting nothing,
    and `tests/entities.test.ts`'s "recall no longer returns it"
    assertion was failing on `main`. Both delete wrappers now pass
    `confirm: true` internally — a programmatic caller that reached the
    method has already decided, so it isn't exposed as a parameter no
    caller would set to false.
  - `OcClient.projectDelete(projectId)` added for test teardown (next
    entry). No product tool deletes a story; that stays a deliberate
    OC-side action.

- **Integration-test teardown — test projects no longer leak**
  (2026-07-23). Each env-gated suite created an OC project per run and
  never removed it; 46 stale `mnemosyne-test-*` projects holding 127
  memories had accumulated and were manually deleted on 2026-07-23.
  Now that OC exposes `project_delete`, the suite cleans up after itself:
  - `tests/helpers.ts` — shared test helper. `testStoryName(label?)`
    lifts the `TEST_STORY_PREFIX` constant that was duplicated across
    five test files, and `teardownStory(oc, storyId)` deletes the
    project then closes the client.
  - Teardown never fails the suite: delete and close errors are logged,
    not thrown, so a cleanup failure can't mask the real error or turn a
    passing run red. Tolerates an undefined `storyId` for a suite that
    died before creating its story (vitest still runs `afterAll`).
  - Wired into all five project-creating files: `stories`, `entities`,
    `continue`, `validate-tool`, `validator`.
  - Verified: 37/37 against real OC + real Ollama with every suite
    active, and `project_list` shows no `mnemosyne-test-*` projects
    afterward.

- Architecture lockdown — see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
- v2 retrospective mined and documented — see
  [docs/V2_RETROSPECTIVE.md](docs/V2_RETROSPECTIVE.md).
- Repo scaffolded: TypeScript + MCP SDK + zod + vitest, ESLint + Prettier,
  pre-commit hooks (gitleaks + PII + author identity), `.gitattributes`.
  Initial commit `4e573ed`. Public repo at
  https://github.com/CarlDog/mnemosyne-mcp.
- **v0.1.2 shipped** — three patches from v0.1.1 dogfooding:
  - **Validator prompt: enumerate constraints first.** Two-step
    SYSTEM_PROMPT in `src/validator.ts`. Step 1 forces the LLM to
    decompose compound rules (e.g., "third-person past tense from
    Aria's perspective" = three constraints: third-person, past tense,
    Aria's perspective only) into atomic constraints. Step 2 walks
    each constraint through the new content independently. Fixes the
    v0.1.1 failure where the validator caught one constraint per
    rule and missed the rest.
  - **Rule-precedence statement.** In `src/prompt.ts`'s
    `buildSystemPrompt`, a single sentence inserted between the mode
    directive and the RULES block when the story has rules or style
    entries. States the constraints below are absolute and override
    narration conventions implied by the mode. Fixes the
    "even mixtral defaulted to present tense because the director
    directive's verbs ('narrate', 'describe', 'advance') primed
    narrative-present" issue from v0.1.1 testing.
  - **`mnemo_validate(content)`** standalone tool —
    `src/tools/validate.ts`. Pulls the active story's
    rules / style / characters / locations and runs the validator LLM
    against the supplied content. Returns the same `ValidationReport`
    shape as `mnemo_continue`'s `validate=true`. Was deferred in the
    v0 design as a "later if needed" tool; v0.1.1 testing made it
    necessary for diagnostic A/B work.
  - `scripts/dump-validation.mjs` companion to the existing
    `dump-prompt.mjs`. Reads content from a file and runs the
    validation pass against a story id from the command line. Useful
    for A/B-ing validator prompts and models without going through
    Claude Desktop.

- **v0.1.1 shipped** — three patches from v0.1.0 dogfooding:
  - **Leading whitespace strip** in `OllamaProvider.generate()` —
    `replace(/^\s+/, "")` on the response. mythomax-l2 (and likely
    other roleplay finetunes) prefix responses with a stray space.
  - **Validator prompt restructured** to force quote-and-match: each
    issue must include a `rule` reference, a `violating_text` quote
    pulled from the new content character-for-character, and an
    `explanation` linking quote to rule. The v0.1.0 validator
    fabricated a "she is first-person" objection because the prompt
    let it evaluate abstractly; quote-and-match makes hallucinated
    issues much harder (no quote, no issue). `ValidationIssue` shape
    changed to `{severity, rule, violating_text, explanation}` —
    breaking change for any caller that consumed v0.1.0's
    `description` field.
  - **`mnemo_delete_entity(type, name)`** tool. Same `(type, name)`
    lookup as `save_entity`'s overwrite path. Throws when no match
    exists. `OcClient` gains `memoryDelete` wrapper.
  - 30/30 tests pass against real OC + real Ollama (~95s).

- **Phase C-2 shipped** — validation pass:
  - `src/validator.ts` — `validateContent` builds a constraints block
    (RULES + STYLE + CHARACTERS + LOCATIONS), prompts the validator LLM
    to return a structured verdict (`{issues: [...], summary: ...}`),
    and parses the response. `parseValidatorJson` strips markdown code
    fences (```json ... ``` or bare ``` ... ```) — a pattern v2 had
    duplicated across four validators per the retro; factored once
    here.
  - `mnemo_continue` gains `validate?: boolean`. When true, runs the
    validation pass after the beat is saved. Save-first: validation
    failures (LLM returned unparseable JSON) land as a
    `validation_error` field in the response, never as a thrown
    exception. The beat is persisted regardless.
  - `OLLAMA_VALIDATOR_MODEL` env var (defaults to
    `OLLAMA_GENERATOR_MODEL`). A smaller / faster model is fine here —
    the validator just needs to return structured JSON.
  - OC client retry bumped to 5 attempts with exponential backoff
    (1s/2s/4s/8s/16s) to better handle OC v3's 120 RPM per-IP limit
    under burst load.
  - `tests/validator.test.ts` — 5 pure tests for the JSON parser
    (plain JSON, ```json fences, bare ``` fences, whitespace,
    unparseable input) + 1 integration test (validateContent end-to-end
    against real Ollama).
  - Tagged `v0.1.0` on the way out.

- **Phase C-1 shipped** — generator + prompt + continue:
  - `src/llm.ts` — `LlmProvider` interface (one method, `generate`) and
    `OllamaProvider` implementation. Plain `fetch` to `/api/chat`, no
    SDK dep. 5-minute timeout via `AbortController`. Per-call `model`
    override.
  - `src/prompt.ts` — `gatherContext` pulls per-type entity lists from
    OC (sequential to avoid rate-limit bursts) and `buildSystemPrompt`
    assembles them with v2's load-bearing block ordering (mode → rules
    → style → characters → locations → recent scenes → lore →
    worldbuilding). Empty blocks omitted entirely. Per-type caps
    documented in code.
  - `src/tools/continue.ts` — `mnemo_continue(direction, mode?,
    max_tokens?, temperature?, model?)` ties it all together: gather
    context, assemble prompt, call generator, auto-save the result as
    a scene entity (name = ISO timestamp), return beat + memory_id +
    context summary.
  - `OcClient` extended with linear-backoff retry on rate-limit errors
    (1s, 2s — handles OC v3's per-window limiter when bursting).
  - `vitest.config.ts` — 30s test timeout, sequential file execution
    (tests share one OC).
  - `tests/prompt.test.ts` — 4 pure tests for block assembly and order.
  - `tests/continue.test.ts` — 3 integration tests: gather context,
    build prompt, full end-to-end generation against real Ollama.
  - `.env.example` documents `OLLAMA_GENERATOR_MODEL` (recommended
    starting points: HammerAI/mythomax-l2:latest, nous-hermes2-mixtral)
    and `OLLAMA_URL`.

- **Phase B shipped** — entity management:
  - `src/entities.ts` — `EntityType` enum (`character | location | rule |
    style | scene | lore | worldbuilding`), content format
    (`[Type] Name\n\n<body>`), parser, `saveEntity` (overwrite by
    type+name with explicit-pin honoring), `recall` (project-scoped
    semantic search with type filter and client-side `slice(0, limit)`
    to enforce hard cap past OC's pinned-always-surface bias).
  - `src/tools/entities.ts` — `mnemo_save_entity` and `mnemo_recall`
    tool registrations. Both require an active story (call
    `mnemo_story_use` first).
  - `OcClient` extended with `memoryUpdate` and `memoryPin`.
  - `requireCurrentStoryId()` helper in `src/config.ts` for tools that
    need an active story.
  - `tests/entities.test.ts` — 11 tests (3 pure, 8 integration). All 15
    suite tests now pass against real OC in ~10s.

- **OpenChronicle docs note** (separate repo): added `project_delete`
  MCP tool / API surface to `docs/V3_PLAN.md` "Post-cutover follow-ups"
  with a recommended shape (hard-delete + `confirm:bool` flag, matching
  `memory_delete`'s no-soft-delete posture). OC commit `34b3a5b2`,
  pushed. **Shipped on the OC side and consumed here 2026-07-23** — it's
  what made test teardown possible.

- **Phase A shipped** — story management:
  - `src/oc-client.ts` — MCP client wrapper around OpenChronicle's HTTP
    MCP. Surfaces `project_create`, `project_list`, `memory_save`,
    `memory_search`. Auto-unwraps FastMCP's `{result: [...]}` text-content
    wrapping for list-returning tools.
  - `src/config.ts` — local config helpers (OS-appropriate config dir,
    `MNEMOSYNE_CONFIG_DIR` override). v0 stores `current_story_id` only.
  - `src/stories.ts` — story marker logic. A Mnemosyne story is an OC
    project with a pinned marker memory tagged
    `["mnemosyne", "story-marker"]`. Discovery uses a single
    cross-project `memory_search` filtered by the marker tags — one
    round trip regardless of project count, no N+1, no rate-limit
    pressure.
  - `src/tools/stories.ts` — `mnemo_story_list` and `mnemo_story_use`
    tool registrations.
  - `src/index.ts` — env validation (OC_URL required), OC client init at
    startup (fail-fast if unreachable), tool registration.
  - `tests/stories.test.ts` — integration smoke test (real OC,
    env-gated). 5 tests, 1.7s. Test stories use the `mnemosyne-test-`
    prefix. (They accumulated until 2026-07-23, when OC gained
    `project_delete` and the suite got teardown — see the top of Done.)
  - `.env.example` documenting `OC_URL`, `MNEMOSYNE_CONFIG_DIR`,
    `LOG_LEVEL`.

- **Dev-chain eslint 10 + SDK 1.30 audit sweep (2026-07-29).** eslint
  ^10.8.0, @eslint/js ^10.0.1, eslint-config-prettier ^10.1.8;
  @modelcontextprotocol/sdk ^1.30.0 with @hono/node-server 2.0.12
  (GHSA-frvp-7c67-39w9). npm audit 0, was 5 high + 2 moderate. No
  eslint-10 code changes needed. Lockfile via pinned npm 10.9.8.
  Verified: lint, typecheck, tests, format:check. Runtime majors stay
  deferred per the closed npm-major PR.

## v0 Contract (locked)

### Tools (5)

| Tool | Purpose |
|---|---|
| `mnemo_story_list` | List Mnemosyne stories (OC projects bearing the story marker). |
| `mnemo_story_use(name_or_id, create_if_missing?)` | Set active story. Combined create+use. |
| `mnemo_save_entity(type, name, content, pinned?)` | Write characters / rules / locations / style / lore / scenes to OC. Overwrites by name+type. |
| `mnemo_recall(query?, type?, limit?)` | Semantic recall over the current story's memories. With no query, falls back to listing by type+recency. |
| `mnemo_continue(direction, mode?, validate?)` | Pull context from OC → call generator LLM → save the resulting beat → optionally run validation pass. Auto-saves the beat. |

### Design choices (locked)

- **Marker-based stories.** A Mnemosyne story is an OC project containing
  a pinned memory like `[Mnemosyne Story] {name}\nCreated: {iso}\nSchema: 1`
  with tags `["mnemosyne", "story-marker"]`. `story_list` filters all OC
  projects to those with this marker.
- **Combined `story_use`.** Single tool with `create_if_missing` parameter.
- **Auto-save in `continue`.** The beat is "what just happened" — no
  separate save step. Re-run `continue` with different direction if
  unwanted.
- **Validation as parameter, not separate tool.** Skippable per-turn.
  Standalone validate tool deferred until hand-written-content workflow
  appears.
- **Ollama first.** Lowest friction (no API key, supports NSFW from day
  one). Botify and Anthropic providers slot in later via the
  `LlmProvider` interface.
- **v2 prompt block ordering preserved and documented.** Order:
  mode → canon → instructions → style → characters → locations →
  recent scenes → worldbuilding. This was undocumented load-bearing
  knowledge in v2; Mnemosyne writes it down explicitly.

### Implementation choices (locked)

- **OC client:** `@modelcontextprotocol/sdk/client/streamableHttp.js`
  over Streamable HTTP. Mnemosyne is a first-class MCP client to OC.
- **Local config:** `<repo>/data/config.json` (gitignored; override:
  `MNEMO_DATA_DIR`) — repo-local so a Docker deployment can bind-mount
  `data/` as persistent storage. Exports default to `data/exports/`.
  The legacy OS config dir (`%APPDATA%\mnemosyne-mcp` /
  `~/.config/mnemosyne-mcp`, override `MNEMOSYNE_CONFIG_DIR`) is
  auto-migrated — copied, not moved — on first read. v0 holds
  `current_story_id` only.
- **Ollama config:** `OLLAMA_URL` (default `http://localhost:11434`),
  `OLLAMA_GENERATOR_MODEL`, `OLLAMA_VALIDATOR_MODEL` (defaults to
  generator). Plain `fetch` to `/api/chat`. No SDK dep.
- **Provider abstraction:** Minimal `LlmProvider` interface, one
  implementation. Don't pre-design — second provider reveals what the
  interface needs.
- **Tests:** Real OC + real Ollama, env-gated like plex-mcp. Skip
  cleanly when env not set. Mock-vs-real divergence is the bigger risk.

## Build phases

- **Phase A — Foundation** ✅ shipped — OC MCP client wrapper, env
  validation, local config helpers, story marker logic, `story_list` +
  `story_use` tools.
- **Phase B — Entities** ✅ shipped — `save_entity` + `recall` with
  overwrite-by-(type,name) and client-side hard-cap slicing.
- **Phase C-1 — Continue (no validation)** ✅ shipped.
- **Phase C-2 — Validation pass** ✅ shipped. Tagged `v0.1.0`.
- **Phase 6 — Kindroid generator bridge** ✅ shipped and live-verified (2026-08-05) —
  `GENERATOR_PROVIDER=kindroid`, `KindroidProvider`, `KindroidClient`, against
  a dedicated test kin.

## What's next (post-v0)

These are not yet planned; they're the natural follow-ups when v0 gets
real use and pressure points emerge:

- **`stages` timing field in `mnemo_continue` response (v0.1.4 candidate).**
  Per-phase elapsed time so the host LLM can report timings without
  greasing the user into the log file. Phases: `gather_ms`,
  `generate_ms`, `save_ms`, `validate_ms`. Surfaced 2026-05-11 when a
  v0.1.2 test exceeded Claude Desktop's ~4-minute MCP tool timeout
  even though Mnemosyne completed in 5:24 — generator took 2:23,
  validator took 2:57. With per-phase timing in the response, the
  user (and the host LLM) can see immediately which phase dominated
  without diffing log timestamps.
- **Ollama warmup + extended keep-alive (v0.1.4 candidate).** First
  `mnemo_continue` after Ollama idle pays a cold start while the model
  reloads into VRAM (Ollama unloads after default 5min idle). Two-part
  fix, both server-side; no client background process needed (that
  would duplicate what Ollama already exposes):
  1. Add `keep_alive` to the OllamaProvider request body. Default
     `"30m"`, env-overridable via `OLLAMA_KEEP_ALIVE`. Each
     `mnemo_continue` refreshes the timer, so active sessions never
     evict. `OLLAMA_KEEP_ALIVE=-1` pins the model permanently for
     users who want zero cold start (trade-off: 7-26GB VRAM held).
  2. Add a `warmup()` method on `OllamaProvider` that sends a 4-token
     generation to force model load. Call `void generator.warmup()`
     and `void validator.warmup()` (when they differ) after MCP init,
     fire-and-forget. Doesn't block server startup; happens in
     parallel with Claude Desktop's own init work.
  Skipped intentionally: a client-side heartbeat process. Pure
  duplication of `keep_alive`'s server-side timer; adds complexity
  without benefit.
- **Web UI.** Per ARCHITECTURE.md §1+§4, the standalone web frontend
  is the bypass for Claude Desktop's content-policy refusals on
  uncensored content. Daily-driver SFW use through Claude Desktop
  works now via the MCP; NSFW use requires either a non-Anthropic MCP
  host (Cline, LM Studio, etc.) or the web UI.
  Design input, captured 2026-08-23 and explicitly not ratified:
  [docs/WEBUI_NOTES.md](docs/WEBUI_NOTES.md) — three modes as three
  postures, a storyline control plane alongside the character one,
  showing the retrieval assembly, media generation inside the beat
  flow, plex-companion watch parties, and a parked graphic-novel
  reading format.
- ~~**Botify provider**~~ / ~~**Anthropic provider**~~ — **shipped
  2026-08-21** along with OpenAI, Gemini, and Atlas Cloud; see the Done
  log. Seven generators now sit behind `GENERATOR_PROVIDER`; the
  validator stays on Ollama for all of them (a `VALIDATOR_PROVIDER`
  selection for the JSON-capable cloud providers is the natural cheap
  follow-up if local validation ever becomes the bottleneck).
- **Per-call story selector on `mnemo_continue`.** Today it operates on
  the *active* story, and that pointer is machine-local config mutated
  globally by `mnemo_story_use`. Fine for an interactive session; wrong
  for a programmatic caller, which must not stomp the pointer a
  concurrent Claude session is using. Surfaced 2026-08-23 while designing
  the plex-companion passthrough (docs/WEBUI_NOTES.md §7) — the only new
  API that integration needs on our side. Not urgent until a
  non-interactive caller actually exists.
- **Recent-scenes-by-recency** — see Known Gaps; needs OC API
  improvement or client-side workaround.
- **Game mechanics** (StatBlock, dice, HP, inventory) — v2 Phase 4
  territory; deferred to ARCHITECTURE.md §8 unless a real session
  demands them.
- **Import / export tooling — design ratified 2026-08-21, build
  underway.** The portability use case arrived: importing the operator's
  original ChatGPT storytelling projects (the OpenChronicle template
  system's ancestors). Full design record in
  [docs/IMPORT_EXPORT_DESIGN.md](IMPORT_EXPORT_DESIGN.md) — core
  decision: classification happens caller-side in the host conversation;
  the server is a typed batch writer that never guesses. Build order:
  `mnemo_export_story` (versioned JSON interchange schema — the riskiest
  commitment, so it went first; **shipped 2026-08-21**, see Done), then
  `mnemo_import_story` (curated `entities[]` mode + deterministic
  export-doc round-trip mode — **also shipped 2026-08-21**, see Done),
  then the mapping playbook + seed templates as docs (**also shipped
  2026-08-21** —
  [docs/IMPORT_PLAYBOOK.md](docs/IMPORT_PLAYBOOK.md) /
  [docs/SEED_TEMPLATES.md](docs/SEED_TEMPLATES.md), see Done). **The
  first curated import is done: Chaos Saga landed 2026-08-22** — 28
  entities (10 characters, 6 locations, 1 style, 7 pinned rules, 3
  worldbuilding, 1 scene backdated to its 2025 lock date) via one
  dry-run-previewed `mnemo_import_story` call, immediately re-exported
  as a backup. Curation per the playbook: tattoos folded back into
  characters, the divergent Vanessa profiles merged, Cassie's stale
  profile reconciled with locked scene CH-017, all PG-13/platform
  content boundaries stripped as ChatGPT artifacts (operator decision),
  named style clauses extracted to individual pinned rules, and the
  C.H.A.O.S. availability schedules salvaged as worldbuilding.
  **Campaign complete (2026-08-23):** GhostHunters, BattleChasers,
  Wonderland, and a new fifth story (Shadowflame) all landed the same
  process — five live stories, ~369 entities total. See the dated Done
  entry above for the full per-story writeup. (Dogfooding note filed:
  unfiltered `mnemo_recall` with a small limit gets its window consumed by
  OC's pinned-prepend in rule-heavy stories; type-filtered recall is
  unaffected.)
  `mnemo_seed_from_template` is retired as a planned tool — seeding is a
  host conversation plus one import call.
- **Atlas Cloud illustration integration (scope recorded 2026-08-05,
  design notes added 2026-08-06 — proposal only, not started, not
  scheduled).** ARCHITECTURE.md §8 still lists "image generation tied to
  scenes" as out of scope for v0 — this entry doesn't reopen that. Full
  design thinking (character reference images, durable-storage question,
  async/timeout handling, entity-schema options, candidate tool surface,
  loose-vs-tight coupling) lives in
  [docs/ILLUSTRATION_INTEGRATION.md](docs/ILLUSTRATION_INTEGRATION.md) —
  update that file, not this bullet, when the design itself changes.
  Shape in brief: mirrors the existing `src/kindroid-client.ts` pattern
  (a new `src/atlascloud-client.ts` Streamable HTTP MCP client,
  `ATLASCLOUD_MCP_URL` + `ATLASCLOUD_MCP_AUTH_TOKEN` config) against
  [atlascloud-mcp](https://github.com/CarlDog/atlascloud-mcp) (deployed
  `http://carldog-nas:3010/mcp`). In the meantime, atlascloud-mcp is
  already registered in this repo's `.mcp.json` (2026-08-05, gitignored —
  carries a real bearer token), so an interactive Claude session working
  in this repo can call its tools ad hoc today without any of the
  server-side work described in the design doc.

## Open Decisions

- **HTTP transport.** Out of scope for v0 (stdio only). Add when a
  deployment scenario needs it (e.g., the planned web UI).

## Known Gaps

- ~~No CI yet~~ — stale. CI has existed since 2026-07-23 (`test.yml`,
  typecheck/build/test matrixed across ubuntu/windows/macos) and 2026-08-01
  (`gitleaks.yml`); a `quality` job runs lint + format check. Verified green
  against the actual GitHub Actions runs (not a local proxy) on 2026-08-23.
- No Dockerfile yet (deferred per scaffolding decision; confirmed still
  true 2026-08-23).
- **Recent scenes ordering** — `gatherContext` pulls scenes via
  `memory_search` ranked by relevance to the user's direction, not
  strict recency. OC's `memory_search` exposes no `order_by` parameter
  and `memory_list` isn't project-scoped. Workable for v0; revisit if
  recency becomes a noticeable problem.
- **OC rate limit (120 RPM per IP)** — OC v3's `RateLimitMiddleware`
  defaults to 120 requests/minute per client (configurable via
  `OC_API_RATE_LIMIT_RPM`). Bursts from `gatherContext` (7 sequential
  reads per `mnemo_continue`) plus a full integration test run can
  saturate the window. The OC client retries with exponential backoff
  (1s/2s/4s/8s/16s) which masks the issue most of the time, but the
  test suite is occasionally flaky under back-to-back runs. For
  reliable test runs, bump `OC_API_RATE_LIMIT_RPM` on the OC stack
  (e.g., 600) or wait ~60s between runs.
