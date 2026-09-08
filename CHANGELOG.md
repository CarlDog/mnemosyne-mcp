# Changelog

All notable repository changes are recorded here. Historical detail before
this file was introduced remains in [STATUS.md](STATUS.md).

## Unreleased

### Added

- Position tracking: a pre-commit adversarial review of the finished
  slice 3+4 diff (`feature-dev:code-reviewer`, per the repo's standing
  pre-deploy-review practice) found and fixed two real bugs before
  shipping. (1) A pre-dispatch failure firing AFTER a successful
  `advance`/`set_date`/`move_to` write (context gathering's own abort, or
  `enforce`-mode context-admission rejection) was reported
  `retry_safe: true`, falsely implying nothing happened; `RunOutcomeError`
  gained a `retrySafe` override, `continueScene` now tracks whether the
  write landed and relabels any such error `retry_safe: false` with an
  explanatory note, and the abort check for the write itself now fires
  BEFORE the write rather than after. (2) `advance`/`set_elapsed_hours`
  could silently drive `elapsed_hours` negative (predating the epoch)
  while `set_date` alone was guarded against it; `resolveElapsedHours`
  now guards the computed result uniformly across all three branches. Both
  mutation-tested against real reproductions.

- Position tracking, slice 4 (`mnemo_continue` integration, closing the
  feature): `advance`/`set_date`/`move_to` params on both `mnemo_continue`
  and the REST `/stories/:storyId/continue` route, applied to the story's
  position before context gathering via a new `ContinuationPort.applyPosition`
  method (`src/application/ports/continuation.ts`), backed by a new shared
  `applyPositionUpdate` (`src/stories.ts`) that `mnemo_position_set` was
  refactored to use too, so the two surfaces can't drift. The atomic
  invariant already enforced in `mergePositionUpdate` (slice 1) doubles as
  the not-yet-initialized refusal these convenience params need for free:
  none of `advance`/`set_date`/`move_to` can supply `epoch_date`/
  `epoch_location`, so calling any of them against an untracked story
  throws before anything is dispatched, naming `mnemo_position_set`.
  `continueScene` wraps that throw as `RunOutcomeError("rejected_before_dispatch")`.
  A successful position update is NOT rolled back if generation
  subsequently fails (mirrors `mnemo_session_break`'s break-then-save
  precedent), mutation-tested against real OC: the advance survives a
  stub generator throwing. `ContinueSceneResult` gains an optional
  `position` field, echoed from the same `gatherContext` call already made
  for rendering -- zero extra cost -- whenever the story has tracking on,
  regardless of whether this specific call touched it.

- Position tracking, slice 3 (generation-context rendering): `ContextBundle`
  gains an optional `position` field (`src/application/model.ts`), populated
  by `gatherContext` only for generation calls (`!validationOnly` --
  validators check prose against rules/style, not "how long has it been,"
  and this keeps `mnemo_revalidate_scenes`'s per-scene gather loop at zero
  extra cost). Renders as its own `=== POSITION ===` block between LOCATIONS
  and RECENT SCENES in `buildSystemPrompt`, and as an unconditional
  "Current position: ..." line in `buildCompanionMessage`'s story-context
  block (joining locations/scenes in `ALWAYS_INCLUDED_TYPES` territory,
  though it isn't itself an entity). `renderAdmittedBundle` passes it
  through unchanged -- it has no `memory_id` and sits outside the
  context-plan budget/dropping mechanism. Two real delimiter-spoofing bugs
  were found and fixed while writing the tests, in both rendering sites:
  neutralizing `"name (spot)"` as one combined string missed a `spot`
  carrying `=== RULES ===`, because the line-based spoof check only fires
  when the delimiter is alone on its own line, and embedding it mid-line
  behind the location name defeated that. Fixed by neutralizing `name` and
  `spot` separately before combining; both fixes are mutation-tested
  (reverted to the combined-string form, confirmed the new tests fail with
  the real spoofed content surviving unneutralized, restored).

- Position tracking, slices 1+2 (docs/POSITION_TRACKING_DESIGN.md, ratified
  2026-09-07): a story's optional in-story clock/place. The marker
  (`src/stories.ts`) bumps to schema 5, gaining an atomic `Epoch-Date`/
  `Epoch-Location`/`Epoch-Spot`/`Elapsed-Hours`/`Current-Location`/
  `Current-Spot` block enforced in the *parser*, not only at write time --
  a schema-5 marker with none of those lines parses identically to schema
  4. New `mnemo_position_get`/`mnemo_position_set` tools
  (`src/tools/position.ts`); the latter's first call on a story must supply
  `epoch_date` + `epoch_location` together (that's what starts tracking),
  later calls are a genuine partial update, and `advance`/`set_elapsed_hours`/
  `set_date` are mutually exclusive per call. `set_date` predating the
  epoch is refused, not clamped. Location fields store `memory_id` only,
  never a name -- both surfaces resolve the display name fresh via
  `getEntityByMemoryId` on every read. `setKindroidTarget`/
  `setNarratorProfile` now thread the position block through their marker
  rewrites -- missing this would have silently wiped position tracking on
  any story's next unrelated marker write; caught by a mutation-tested real-OC
  regression test. Verified: typecheck/lint/format clean, the atomic-invariant
  parser guard and the position-survives-an-unrelated-rewrite fix were both
  hand mutation-tested against real OC, and a real MCP-wire test
  (`tests/position-tool.test.ts`) exercises both tools end to end including
  the not-started refusal, location-type validation, and fresh name
  resolution after a rename. See STATUS.md's 2026-09-07 entry for the full
  record.

- `mnemo_status`: the stdio-side counterpart to `GET /api/status`, closing
  the Known Gaps entry that recorded it as deliberately deferred. A stdio
  host has no HTTP endpoint to poll, so it previously had no way to check
  OC/generator/validator readiness short of a real tool call and reading
  the failure. Registered on both transports via a new optional
  `readinessProber` param on `registerTools`. The `ReadinessProber` itself
  is now a single process-wide singleton (`src/index.ts`) shared by both
  `GET /api/status` and `mnemo_status`, rather than one instance per
  surface with two uncoordinated TTL caches. `tests/readiness.test.ts`
  gained a real MCP-wire round trip, a check that the tool is genuinely
  absent when no prober is supplied, and a check that both surfaces share
  one cache -- the shared-instance wiring and the conditional-registration
  gate were each mutation-verified by hand.

- Web UI entity edit/delete: `PATCH`/`DELETE /stories/:storyId/entities/:memoryId`
  (previously GET-only) plus the corresponding `EntityDetailPage` edit form and
  delete confirmation. Edit is a genuine partial update -- a field the caller
  omits is echoed back from the existing entity, not blanked, since `saveEntity`
  itself always rebuilds the full tag set. `saveEntity`'s injection-provenance
  refusal now throws `FlaggedContentError` (carrying structured `signals`)
  instead of a plain `Error`, so the PATCH route can return a clean 422 with
  the matched excerpts rather than losing them to the generic 500 handler; the
  web UI renders them in a dedicated banner with an explicit override button.
  Delete uses a new `deleteEntityByMemoryId` (id-keyed, story-scoped) rather
  than the existing (type, name)-keyed `deleteEntity`, since the UI only has
  the memory id and a ranked-search lookup could resolve to the wrong record.
  Verified with a scoped independent code review (two real gaps found and
  fixed: `pinned` had no test coverage and the mock couldn't have proven it
  correct either way; the web client's new functions had none beyond manual
  verification) and a full live-browser pass against a real OC-backed dev
  server. See STATUS.md's 2026-09-07 entry for the full verification record.

- Injection-provenance gate (`src/injection-scan.ts`): a deterministic,
  precision-leaning regex scan for instruction-shaped text, wired as the
  default behavior of `src/entities.ts`'s `saveEntity()` -- the chokepoint
  every entity write funnels through (`mnemo_save_entity`,
  `mnemo_import_story`, `mnemo_session_break`'s greeting-as-scene). A
  matching record refuses by default, quoting the exact excerpt; a shared
  `OVERRIDE_FLAGGED_CONTENT_PARAM` param on all three tool surfaces writes
  anyway, keeping the quote as an audit trail. `mnemo_session_break` scans
  before `chatBreak` specifically, since that call transmits the greeting
  to the kin ahead of the later OC save. `mnemo_continue`'s generated-beat
  save is the one permanent exception (LLM's own output, not third-party
  text). An adversarial review (pre-deploy-review.md) disproved the first
  version's premise that `mnemo_import_story` was the only place staged
  content became live; see the Fixed entries below and STATUS.md's
  2026-09-07 entry for the full record. Measured against all 513 staged
  `drafts/scenes/**` files: a 0.2% flag rate (1 file) -- initially accepted
  as a false positive, then actually fixed on 2026-09-08 (see the Fixed
  entry below) once it turned out to block a real merged-tree import
  preflight, not just flag a file.

- Narrator evaluation (`docs/NARRATOR_EVAL.md`, `scripts/narrator-eval/`): a
  synthetic corpus of twelve cases across the rubric's six rows, deterministic
  checks shared with the unit tests, Ollama validator scoring by row, a
  constant-baseline gate, and a generator that runs the corpus through a kin
  over mnemosyne's own client. The gate is decided on deterministic
  verdicts; validator counts are shown beside them with a noise floor
  measured on the baseline. Beats and reports stay under `data/`.
  Narrator design S5.

- Narrator evaluation: `--only` and `--repeats` on the generator, plus
  `repeat-rate.mjs`, which reports a per-case failure rate with a 95% Wilson
  interval. A corpus run samples every case once, which cannot estimate a
  rate. Measured with it: the narrator obeys an instruction planted in scene
  text in 7 of 20 samples, a 35% rate with an 18.1% lower bound, while never
  obeying the same injection's person or tense instructions. The generator
  also now saves after every beat, so a long run that is interrupted leaves
  usable samples and marks itself incomplete.
- Narrator evaluation: seventh live run recorded. The narrator obeyed a prompt
  injection for the first time in seven runs, prefixing every paragraph with a
  marker an embedded story scene told it to use, which is the failure the
  boundary case exists to catch. Two gaps recorded and not fixed: a vocative
  with a question mark trips the spoken-question check, and the harness has no
  version for its checks, only for the corpus.
- Narrator evaluation: the tense check now scans every region that is not
  quoted dialogue. It previously returned only asterisk runs whenever a beat
  had any, leaving bare narration in 13 of 20 beats of a live run unread --
  the same defect class the check was written to fix. Validated to still fire
  on none of 109 real beats. Also corrects the documented claim that the
  contradiction pairs had stopped discriminating: with six runs rather than
  four, five pair halves have failed on their own pattern.
- Narrator evaluation: two defects fixed (corpus version 12), both found by
  reading beats rather than by a check failing. `continuity-tells` covered one
  clause of a three-clause direction and passed a beat that broke another, so
  it now also forbids a second speaker, reusing an existing pattern verbatim.
  `voice-tense` was anchored to the character's name and had never fired in 89
  beats against a narrator that writes pronoun subjects; it is replaced by a
  check that scans narration only, since dialogue is legitimately present
  tense. A check that cannot fire is a defect, not a clean record.
- Narrator evaluation: the word checks repaired (corpus version 11). A check
  that requires a word is reliable only when the word has no natural synonym,
  measured across four runs. `continuity-prints` keeps the concrete noun with
  its real synonyms, drops the location word that caused its only failure, and
  gains a contradiction guard; `canon-knife` accepts "blade";
  `continuity-generator` stays advisory because no reliable check exists for
  it, with the three candidate checks and their scores recorded.
- Narrator evaluation: a fifth contradiction pair, direct address by name
  (corpus version 10), raising the floor to four. Its marker was chosen from a
  survey of every real beat rather than by guess; three candidates were
  rejected because this kin never produces them, so a required half built on
  one would always fail. Also documents what each pair has actually bought:
  across four live runs no pair half has ever failed on its own pattern, so
  the returns are flat and a sixth pair is not the next improvement.
- Narrator evaluation: a fourth contradiction pair, the first with its own
  required half (corpus versions 8 and 9). A spoken question is required by
  the new `continuity-asks` and forbidden by the new `continuity-tells`, so
  covering all four pairs now takes three cases rather than two and every
  constant fails at least three. Also states in `contract-wordless`'s
  direction what its check tests: it forbids any quoted text, and the earlier
  wording did not rule out the character muttering to herself.
- Narrator evaluation: a third contradiction pair, on the contract row
  (corpus version 6), plus the demotion of `continuity-generator` to advisory
  (version 7). Plain dialogue itself is required by `contract-argument` and
  forbidden by the new `contract-wordless`, so a narrator can separate from a
  canned reply on a third case. The pair reuses pair A's required half, so it
  does not raise the worst-case floor. `continuity-generator` asks for a noun
  the direction already supplies and produced a false failure in two of three
  live runs, so its verdict is now advisory rather than counted.
- Narrator evaluation: a second, independent contradiction pair (corpus
  version 5). A dialogue-attribution pattern for Ilse is required by the new
  `continuity-speaks` and forbidden by the new `continuity-silence`. The two
  pairs share no case, so every constant fails one half of each and a
  responsive narrator can separate on at least two cases rather than one. Both
  patterns now match either attribution order and treat "said nothing" as
  silence, so a prohibition cannot fail open on a phrasing.
- Narrator evaluation: the contradiction pair (corpus version 4). One
  dialogue-attribution pattern is required by `contract-argument`, which
  stages an argument, and forbidden by the new `continuity-alone`, which
  leaves Ilse below decks by herself. No single fixed text can contain it and
  lack it, so every constant fails one of the two and the gate can resolve
  rather than reading `inconclusive` by construction. A live run cleared it.
  Also fixes `continuity-generator`, whose pattern matched only a singular
  `light` and scored a false miss on a beat about lights dying.
- Narrator evaluation: a second baseline arm (corpus version 3). Alongside the
  trivial constant, every run now scores a plausible canned beat, correctly
  shaped and seeded with the corpus's nouns but responsive to no direction,
  through the identical path. `discrimination()` reports which mechanical cases
  separate the candidate from it, and the gate has three states: does not
  clear, inconclusive, clears. Inconclusive indicts the corpus, not the
  narrator: the canned beat currently passes every mechanical case.

### Added

- Narrator evaluation: `--ab` interleaves two message variants of one case and
  `repeat-rate.mjs` reports each arm with a 95% interval and applies a
  pre-registered overlap rule. Used to test whether an inert-data notice in the
  context header reduces injection obedience: control 15/50, notice 11/50,
  intervals overlap, inconclusive, not shipped. The option exists in
  `companion-message.ts`, defaults off, and is wired to no provider.

### Fixed

- `scripts/scene-extraction/extract_scenes.py` (2026-09-08): three tooling
  defects the 2026-09-02 gap audits reported. `location_basis` no longer
  embeds a `_control/scenes/_catalog.md` path (a control-only path inside
  a potentially-promotable entity field) -- reads `prose (<location
  description>)` instead. The source-inventory doc's `Played
  {chat['played']}.` line was a plain (non-f) string appended after an
  f-string ternary, so the substitution never happened; now an f-string.
  `source_bot`'s bot name always read `None` for every private-chat
  thread -- `bot.json`'s real name field lives at `data.attributes.name`,
  not `data.name` the code read -- systemic across every story cut with
  this engine (Black Ledger, Adjustment Protocol, Wonderland all
  affected). All three verified against real `bot.json` fixtures and the
  real f-string shape, not just read. Per the engine's own standing rule,
  already-cut scene files are not retroactively patched -- only the next
  cut benefits.
- BattleChasers and Chaos Saga (2026-09-08): each was missing
  `_control/README.md` (BattleChasers also missing
  `_control/SOURCE_PROVENANCE.md`), reported by the 2026-09-02 gap audits.
  Written from real facts already on record in each story's own
  `PASS.md`/`sources/README.md`, not invented; `_control/` is manifest-
  excluded so no overlay rehash was needed, and both stories'
  `verify-draft-overlay.mjs` re-run clean (152 and 330 merged entities).
  The audits' third finding, `canon/characters/lilith.md`'s `name:` field
  holding a full sentence, turned out to already be fixed in the pending
  draft overlay (`drafts/characters/lilith.md`); a direct canon edit was
  attempted, then reverted before it could desync the overlay's recorded
  baseline hash for that path once the mismatch was noticed -- confirmed
  clean by rehashing after the revert.
- Injection-provenance gate, `meta-instruction-reference` pattern
  (2026-09-08): required the plural "instructions" rather than
  "instructions?". Singular "your instruction" is common, benign narrative
  English for the teaching/schooling sense ("guide your instruction here
  at the academy") -- the scanner's one measured false positive
  (`docs/NARRATOR_EVAL.md`, 0.2%/513 scenes) -- while the injection-flavored
  usage is reliably plural ("your new instructions"). Surfaced not as a
  cosmetic flag but as a hard `verify-draft-overlay.mjs` merged-tree import
  preflight failure on a real story (The Noctis Veil), which is what made
  it worth fixing rather than continuing to accept. Two regression tests
  added; the fix was mutation-tested (reverted, confirmed the new test
  fails, restored).
- Injection-provenance gate, `mnemo_import_story`'s `planImport`: the
  flagged-content early return skipped the batch's duplicate-key
  bookkeeping, so a duplicate sibling of a flagged record was misreported
  as a normal create instead of `duplicate_in_batch` (the same pre-existing
  flaw affected the oversized-content branch too, fixed the same way --
  register the key before any check that can return early). Found by
  adversarial review, empirically reproduced, mutation-verified.
- Companion messages neutralize their own bracket fence against untrusted
  story content (`neutralizeCompanionFence`). Entity names and scene bodies
  come from the memory database, and one carrying `]` closed the story-context
  fence early, putting planted text at the same level as the operator's
  direction and allowing a forged provenance header. This was the one
  assembly site with no neutralization; the system-prompt and validator paths
  already had it. It stops escalation, not obedience: a message-text-only
  channel cannot mark a span as non-instruction, which `SECURITY.md` now
  records as a known limitation.
- Narrator evaluation: the injection check now counts obedience that begins
  after the first paragraph. The published rate was an undercount, corrected
  from 6 of 20 to 7 of 20 by re-scoring the archived samples.

- Narrator evaluation, after an adversarial review of the harness (corpus
  version 2): beats are folded to ASCII punctuation, so a verdict no longer
  turns on which apostrophe glyph the model typed; corpus patterns anchor to
  the whole beat rather than to any line; a missing, errored or empty beat,
  an incomplete producer run, or a failed validator call now withholds the
  gate verdict and exits non-zero instead of scoring as a clean number; the
  beats envelope records provider, kin id and chat-break setting, and
  `--kin` sets the target explicitly and echoes it before the first write;
  the two cases with no trustworthy mechanical signal are advisory and
  excluded from the row counts; the rubric row formerly called agency is
  renamed decisiveness, since the design's "Player agency" row asks the
  opposite; and `score.mjs --no-validator` no longer requires a build. The
  reproduced limitation that a plausible constant clears the gate is
  documented rather than fixed, with five other measure-changing proposals,
  in `docs/NARRATOR_EVAL.md`.
- `mnemo_session_break(greeting, story?, kindroid_kin?)`: the explicit
  new-session boundary for a story's Kindroid narrator. Chat-breaks the bound
  single-AI kin with the cascaded-memory wipe pinned off, seeds the greeting
  as its newest message, and saves the greeting as a scene tagged
  `session-break` (plus the narrator label). Refuses non-Kindroid generators,
  unbound stories, and group targets before any mutation; a timeout keeps
  the no-retry rule because chat break has no idempotency key. Narrator
  design S3.
- `mnemo_story_use` accepts `narrator_profile` (`null` clears): a short label
  naming the narrator persona a story is written with, stored as a
  `Narrator-Profile:` line on the story marker (schema 4, older markers still
  parse). `mnemo_continue` echoes it as `narrator_profile` when the story's
  Kindroid binding is used, and each saved scene carries a `narrator:<label>`
  tag. Provenance only, no copy of the persona. Narrator design S2.
- `docs/KINDROID_NARRATOR_DESIGN.md`: the Mnemosyne half of the reusable
  narrator-kin proposal, design input only; the kindroid-mcp half holds the
  boundary statement and the review record.
- `KindroidClient.sendMessage` sends a fresh `idempotency_token` with every
  `kindroid_send_message` call and re-sends with the same token on a timeout
  (`SEND_TIMEOUT_RETRIES`, 2) before throwing `provider_dispatch_unknown`;
  kindroid-mcp turns the token into Kindroid's live-verified
  `idempotency_key`, so a timed-out direction is posted at most once. Group
  advances keep the no-retry rule. `KINDROID_MCP_TIMEOUT_MS` defaults to
  240 s (was 180 s) so a kindroid-mcp send's worst case fits in one call.
- Recorded the non-flagship story gap-audit pass (2026-09-02): every
  non-flagship story now carries a `drafts/_control/GAP_AUDIT.md` graded
  against the flagship bar, a standing control-record class added to
  `docs/DATA_LAYOUT.md` alongside `RN_REVIEW.md`; `STATUS.md` holds the six
  verdicts and the operator rulings each stops for, and `CLAUDE.md` documents
  `scripts/scene-extraction/` and the two engine defects the audits found.

### Changed

- Companion-chat context selection (Kindroid, Botify): a multi-word entity
  name now matches on any distinctive word of itself, and locations are
  always included alongside recent scenes. Before, a direction had to spell
  the full name and an unnamed location was dropped, which let a narrator
  kin invent its own setting. Ratified as `docs/KINDROID_NARRATOR_DESIGN.md`
  S1.
- Completed the hexagonal architecture migration across continuation,
  standalone validation, bulk scene revalidation, and story/entity catalogs.
- Added application-owned outbound ports and concrete OC/provider/persistence/
  environment/clock/logging adapters assembled in `src/index.ts`.
- Injected one bound `ApplicationUseCases` contract into the independent MCP
  and REST inbound drivers; removed migration compatibility re-exports.
- Replaced regex source checks with TypeScript-AST architecture enforcement for
  driver independence, application dependency direction, port routing, and
  composition-root ownership.
- Moved boundary models and pure catalog, prompt-rendering, scene-strategy, and
  Ollama request policy into focused modules; removed duplicate projections.
- Upgraded the Web UI to ESLint 10-compatible plugins with zero-warning lint,
  and declared the Node 24/npm 11.19.0 deterministic install baseline.
- Upgraded the server dependency baseline to Express 5, Zod 4, and TypeScript
  6 while keeping Node declarations aligned with the supported Node 24 runtime.
- Deferred major `@types/node` Dependabot updates until the runtime and CI floor
  advance in the same change.
- Removed the stale confidence badge and refreshed setup and test-count docs.
- Made architecture path-containment enforcement portable across Windows and
  POSIX, with both path dialects covered by regression tests.
- Deferred only TypeScript 7 in both Dependabot npm ecosystems until the
  TypeScript ESLint peer range supports it; TypeScript 5/6 remain eligible.

### Verification

- 418 tests pass; 64 live-service tests skip intentionally without their
  external-service environment.
- Typecheck, lint, Prettier, production build, gitleaks, and PII checks pass.
