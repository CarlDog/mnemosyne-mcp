# Status

**Last updated:** 2026-05-11 (scaffold landed)

## Phase

**Scaffolded.** Architecture and v2 retrospective documented; repo
initialized with TypeScript + MCP SDK skeleton. No tools implemented
yet — that's the next phase.

## Done

- Architecture lockdown — see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
  for the four locked decisions: MCP-first project shape (with planned
  web UI for NSFW path), OC-canonical hybrid state model, LLM-based
  validation pass, "read for context, write fresh" approach to v2 archive.
- v2 retrospective mined and documented — see
  [docs/V2_RETROSPECTIVE.md](docs/V2_RETROSPECTIVE.md). Captures entity
  schemas, verbatim prompt templates, lessons learned, and anti-patterns
  to avoid. v2 source is not being ported.
- Repo scaffolded: TypeScript + MCP SDK + zod + vitest, ESLint + Prettier,
  `.githooks/pre-commit` (gitleaks + PII patterns + author email check),
  `.gitleaks.toml`, `.gitattributes` for LF line endings.
- Stub `src/index.ts` runs an empty `McpServer` over stdio. Tool
  registrations are TODO.

## Next

- **v0 tool surface design.** Decide the small set of tools Mnemosyne
  exposes in its first usable version. Likely candidates based on the
  v2 retro:
  - `mnemo_continue_scene` — generate the next scene segment using OC
    context (rules, characters, recent scenes, style)
  - `mnemo_recall` — semantic recall across the current story's memories
  - `mnemo_save_beat` — persist a scene/beat to OC with proper tags
  - `mnemo_set_mode` — switch engagement mode (participant / director / audience)
  - `mnemo_validate` — LLM second pass over a draft against pinned rules
  - `mnemo_set_current_story` — switch active OC project
  - `mnemo_export_story` / `mnemo_import_story` — portable serialization
  Final list to be settled in design discussion before implementation.
- **OC client.** Build the Mnemosyne→OC MCP client wrapper. OC v3 lives
  at an HTTP MCP endpoint; Mnemosyne is a client to it (not embedded).
- **LLM provider abstraction.** Provider-pluggable from day one. First
  three: Ollama (local uncensored), Botify MCP (alternate uncensored),
  Anthropic API (SFW). Per-role config (`generator_provider`,
  `validator_provider`).
- **First tool implementation.** Whichever ranks highest from v0 design.
  Wire end-to-end: tool input → OC context retrieval → LLM call →
  optional validation → response.

## Open Decisions

- **Final v0 tool list.** See "Next" above for candidates. To be locked
  before any tool code is written.
- **First LLM provider to wire up.** Probably Ollama (lowest friction,
  no API key, supports the NSFW path). To be confirmed.
- **HTTP transport.** Out of scope for v0 (stdio only). Add when there's
  a deployment scenario that needs it (e.g., the planned web UI).

## Known Gaps

- No CI yet. Add when there are tests worth running.
- No Dockerfile yet (deferred per scaffolding decision).
- No `.env.example` yet — add when first env vars land.
