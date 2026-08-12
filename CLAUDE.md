# mnemosyne-mcp

MCP server for long-form storytelling on top of OpenChronicle memory.

## Status

Single source of truth: [STATUS.md](STATUS.md). Do not duplicate status
into this file, MEMORY.md, or Serena memories — reference STATUS.md.

## Current Sprint

See [STATUS.md](STATUS.md). Current: v0.1.3 shipped (validator-gated
scene inclusion — fix for the few-shot-vs-rule diagnostic from the
Dovecoast smoke test). Phase 6 (Kindroid generator bridge) is shipped
and live-verified against a dedicated test kin. Per-story Kindroid
target binding (AI or group chat) landed via
`mnemo_story_use`/`mnemo_continue`, resolved through
`resolveKindroidTarget()` — both the single-AI and group-chat paths are
now live-verified (2026-08-12) against real Kindroid targets. That
live verification surfaced a same-speaker-repeats problem in group
chats, now fixed via a conversation nudge pointing kins at Kindroid's
documented `@Name` turn-handoff mechanism (2026-08-12) — see
"Kindroid generator" below and STATUS.md's Done log.

## Stack

- TypeScript (Node 22+, ESM, `NodeNext` module resolution)
- `@modelcontextprotocol/sdk` (high-level `McpServer` API)
- `zod` for tool input schemas
- `vitest` for tests

## Layout

- `src/index.ts` — MCP server entry, env validation, `GENERATOR_PROVIDER`
  selection, tool registration.
- `src/oc-client.ts` — Streamable HTTP MCP client wrapper for OC.
- `src/kindroid-client.ts` — Streamable HTTP MCP client wrapper for
  kindroid-mcp (same shape as `oc-client.ts`).
- `src/config.ts` — local config (current story pointer, OS-appropriate
  config dir).
- `src/stories.ts`, `src/entities.ts`, `src/prompt.ts`, `src/validator.ts`,
  `src/llm.ts` — domain logic.
- `src/kindroid-provider.ts` — `KindroidProvider implements LlmProvider`;
  generator-only (validator always stays on Ollama). Exports
  `buildKindroidMessage()` (pure, unit-tested) — the keyphrase-matching
  logic that folds matched story entities into the outgoing message.
- `src/tools/*.ts` — tool registrations (one file per tool surface).
- `src/log.ts` — structured stderr logger.
- `tests/` — vitest, real OC + real Ollama (env-gated).
- `scripts/dump-prompt.mjs`, `scripts/dump-validation.mjs` —
  command-line diagnostics. Used during v0.1.2 dogfooding to pin the
  few-shot-vs-rule cause without going through Claude Desktop.
- `docs/ARCHITECTURE.md` — locked architectural decisions. Read this
  first to understand project shape, state model, validation strategy,
  provider strategy, and build sequence.
- `docs/V2_RETROSPECTIVE.md` — entity schemas, verbatim prompt templates,
  lessons learned, and anti-patterns from the v2 OpenChronicle
  storytelling plugin. v2 code is NOT being ported; this doc is the
  bridge that captures the durable informational value.
- `.githooks/pre-commit` — gitleaks + PII pattern scan + author identity check.
- `.gitleaks.toml` — secret-scanning config.

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
  config holds operational state only (current story pointer, turn
  scratchpad).
- **Validation is an LLM second pass.** Mnemosyne pulls relevant rules
  + entities from OC, builds a "check this against these constraints"
  prompt, calls a (potentially cheaper) validator LLM, surfaces flagged
  issues to the user. No auto-regeneration. No deterministic checker
  (that was a v2 anti-pattern).
- **Provider-pluggable from day one.** Ollama, Kindroid (Phase 6, via
  kindroid-mcp as an MCP client), Botify MCP, Anthropic. Per-role
  (`generator_provider`, `validator_provider`) — in practice today the
  validator role always stays on Ollama regardless of `GENERATOR_PROVIDER`,
  since a companion-chat model is a poor fit for structured-JSON output.
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
  never use. `model` stays Ollama-only (an Ollama model tag) — it no
  longer doubles as a Kindroid override, since a Kindroid target needs a
  type (ai vs group), not just a bare id.
- **Group targets drive kindroid-mcp's turn loop, not a single reply.**
  `KindroidProvider.generate()` against a group target calls
  `KindroidClient.advanceGroup()` (→ kindroid-mcp's `kindroid_advance_group`
  tool) with `allowUser: false` forced — mnemosyne is generating a story
  beat, not waiting on a live human's real-time turn in the chat, so
  letting the loop hand the turn back to "the user" would just produce zero
  AI replies for a caller with no way to take that turn. `maxTurns`
  defaults to 4 (matching kindroid-mcp's own default; not yet configurable
  — a cheap follow-up if needed). The turn loop's replies are joined into a
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
npm run build          # tsc → dist/
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
