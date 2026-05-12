# Status

**Last updated:** 2026-05-11 (v0.1.0 — feature-complete v0)

## Phase

**v0.1.0 shipped.** All five v0 tools live: `mnemo_story_list`,
`mnemo_story_use`, `mnemo_save_entity`, `mnemo_recall`,
`mnemo_continue` (with optional LLM validation pass). 28/28 tests
pass against real OC + real Ollama. Tagged on the way out.

## Done

- Architecture lockdown — see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
- v2 retrospective mined and documented — see
  [docs/V2_RETROSPECTIVE.md](docs/V2_RETROSPECTIVE.md).
- Repo scaffolded: TypeScript + MCP SDK + zod + vitest, ESLint + Prettier,
  pre-commit hooks (gitleaks + PII + author identity), `.gitattributes`.
  Initial commit `4e573ed`. Public repo at
  https://github.com/CarlDog/mnemosyne-mcp.
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
  pushed.

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
    env-gated). 5 tests, 1.7s. Test stories use `mnemosyne-test-`
    prefix; OC has no `project_delete` so they accumulate but are
    identifiable.
  - `.env.example` documenting `OC_URL`, `MNEMOSYNE_CONFIG_DIR`,
    `LOG_LEVEL`.

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
- **Local config:** `%APPDATA%\mnemosyne-mcp\config.json` (Windows) /
  `~/.config/mnemosyne-mcp/config.json` (Linux/Mac). Override:
  `MNEMOSYNE_CONFIG_DIR`. v0 holds `current_story_id` only.
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

## What's next (post-v0)

These are not yet planned; they're the natural follow-ups when v0 gets
real use and pressure points emerge:

- **Web UI.** Per ARCHITECTURE.md §1+§4, the standalone web frontend
  is the bypass for Claude Desktop's content-policy refusals on
  uncensored content. Daily-driver SFW use through Claude Desktop
  works now via the MCP; NSFW use requires either a non-Anthropic MCP
  host (Cline, LM Studio, etc.) or the web UI.
- **Botify provider** — second LLM provider, validates the
  `LlmProvider` interface holds.
- **Anthropic provider** — for SFW work where Claude is appropriate.
- **Recent-scenes-by-recency** — see Known Gaps; needs OC API
  improvement or client-side workaround.
- **Game mechanics** (StatBlock, dice, HP, inventory) — v2 Phase 4
  territory; deferred to ARCHITECTURE.md §8 unless a real session
  demands them.
- **Import / export tooling** — `mnemo_export_story`,
  `mnemo_import_story`, `mnemo_seed_from_template`. Planned in
  ARCHITECTURE.md §2; defer until there's a portability use case.

## Open Decisions

- **HTTP transport.** Out of scope for v0 (stdio only). Add when a
  deployment scenario needs it (e.g., the planned web UI).

## Known Gaps

- No CI yet. Add when v0 lands and there's a stable surface to gate.
- No Dockerfile yet (deferred per scaffolding decision).
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
