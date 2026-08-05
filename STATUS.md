# Status

**Last updated:** 2026-08-05 (v0.1.3 shipped — validator-gated scene inclusion; Phase 6 Kindroid bridge still code-complete, pending live verification; atlascloud-mcp registered locally in `.mcp.json` + illustration-integration scope recorded in "What's next" — no code changes)

## Phase

**Phase 6 (Kindroid bridge) built, not yet live-verified.** `GENERATOR_PROVIDER=kindroid`
routes story generation through a new `KindroidProvider`, which connects to
kindroid-mcp (now deployed as a Streamable HTTP MCP server on the NAS) as an
MCP client — mirroring `OcClient`'s existing pattern rather than the
originally-planned plain fetch, since kindroid-mcp didn't have HTTP
transport when that plan was written. Generator only; the validator role
always stays on Ollama. The Kindroid path deliberately does NOT re-inject
OC-assembled context (rules/style/characters/etc.) into every message —
the dedicated storytelling kin's own persona/memory on Kindroid's servers
carries continuity instead (`gatherContext`/`buildSystemPrompt` still run
for the optional validator pass, just unused by `KindroidProvider` itself).

**Not yet done:** no dedicated storytelling kin has been designated, so
`tests/kindroid-provider.test.ts` (env-gated, real integration) hasn't
actually run against the live service. Typecheck/lint/test/format are all
clean; the untested surface is specifically the real `kindroid_send_message`
round-trip.

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

Current count: 26 passing, 25 integration tests skipping cleanly
without `OC_URL`/`OLLAMA_GENERATOR_MODEL`/`KINDROID_MCP_URL` configured
(51 total). See Done below for everything that's landed since.

## Done

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
  **Not yet live-verified** — no dedicated storytelling kin exists yet to
  test against.

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
- **Phase 6 — Kindroid generator bridge** ⏳ code-complete, not yet live-verified —
  `GENERATOR_PROVIDER=kindroid`, `KindroidProvider`, `KindroidClient`. Needs
  a dedicated storytelling kin designated before the real integration test
  can run.

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
- **Atlas Cloud illustration integration (scope recorded 2026-08-05, not
  started).** ARCHITECTURE.md §8 still lists "image generation tied to
  scenes" as out of scope for v0 — this entry only captures the shape
  for when that's revisited, mirroring the existing
  `src/kindroid-client.ts` pattern: a new `src/atlascloud-client.ts`
  Streamable HTTP MCP client against
  [atlascloud-mcp](https://github.com/CarlDog/atlascloud-mcp) (deployed
  `http://carldog-nas:3010/mcp`; a fork of Atlas Cloud's official MCP
  server adding Docker/Portainer deployment — 400+ image/video/audio/LLM
  models), config'd via `ATLASCLOUD_MCP_URL` + `ATLASCLOUD_MCP_AUTH_TOKEN`
  (same shape as `KINDROID_MCP_URL`/`KINDROID_MCP_AUTH_TOKEN`). Candidate
  surface: a new `mnemo_illustrate_scene` tool, or an optional step in
  `mnemo_continue`/`mnemo_save_entity` that calls atlascloud's
  `atlas_generate_image`/`atlas_quick_generate` against a scene's prose
  and attaches the resulting image URL to the saved entity. In the
  meantime, atlascloud-mcp is already registered in this repo's
  `.mcp.json` (2026-08-05, gitignored — carries a real bearer token), so
  an interactive Claude session working in this repo can call its tools
  ad hoc today without any of the server-side work above.

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
