# Changelog

All notable repository changes are recorded here. Historical detail before
this file was introduced remains in [STATUS.md](STATUS.md).

## Unreleased

### Added

- Narrator evaluation (`docs/NARRATOR_EVAL.md`, `scripts/narrator-eval/`): a
  synthetic corpus of twelve cases across the rubric's six rows, deterministic
  checks shared with the unit tests, Ollama validator scoring by row, a
  constant-baseline gate, and a generator that runs the corpus through a kin
  over mnemosyne's own client. The gate is decided on deterministic
  verdicts; validator counts are shown beside them with a noise floor
  measured on the baseline. Beats and reports stay under `data/`.
  Narrator design S5.

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

### Fixed

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
