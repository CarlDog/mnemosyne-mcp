# mnemosyne-mcp

<!-- fleet-confidence -->
![code confidence](https://img.shields.io/badge/code_confidence-fair-orange) <sub>· `claude-opus-4-8[1m]` · 2026-07-07 · [details](https://github.com/CarlDog/mnemosyne-mcp/issues/1)</sub>
<!-- /fleet-confidence -->


MCP server for long-form storytelling on top of OpenChronicle memory.

Mnemosyne owns narrative logic; OpenChronicle (OC) owns persistent memory.
Together they support continuity-aware storytelling sessions across many
conversations — characters, scenes, lore, and rules persist between
sessions because they live as OC memories, not as ephemeral context.

The name honors Mnemosyne, Greek personification of remembering and
mother of the Muses — the force by which memory becomes story.

## Status

**The current v0.1.3 codebase exposes eleven tools** —
`mnemo_story_list`, `mnemo_story_use`, `mnemo_save_entity`,
`mnemo_recall`, `mnemo_list_entities`, `mnemo_delete_entity`,
`mnemo_continue`, `mnemo_validate`, `mnemo_revalidate_scenes`,
`mnemo_export_story`, and `mnemo_import_story`.
`mnemo_continue(validate=true)` now tags scenes with their validation
verdict, and the RECENT SCENES prompt block filters on it — the fix for
the few-shot-vs-rule diagnostic where present-tense example scenes drowned
out an explicit past-tense rule. **Seven generator backends** sit behind
`GENERATOR_PROVIDER`: `ollama` (default), the companion-chat pair
`kindroid` + `botify` (via their sibling MCP servers, both with
keyphrase-gated story-context folding), and the direct-API cloud four —
`anthropic`, `openai` (any OpenAI-compatible host via
`OPENAI_BASE_URL`), `gemini`, `atlascloud` (sampling knobs pass through
only when set — each API's own defaults apply). The validator pass
always runs on Ollama. See [STATUS.md](STATUS.md) for details and
live-verification status per provider. Related docs:

- [STATUS.md](STATUS.md) — single source of truth: current phase,
  what's done, what's next
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — locked architectural
  decisions and the reasoning behind them
- [docs/OLLAMA_ADOPTION_ASSESSMENT.md](docs/OLLAMA_ADOPTION_ASSESSMENT.md)
  — pinned source/API/runtime comparison of Ollama against Mnemosyne's
  existing integration; research recommendations only, not ratified architecture
- [docs/OPENCLAW_ADOPTION_ASSESSMENT.md](docs/OPENCLAW_ADOPTION_ASSESSMENT.md)
  — dated comparison of OpenClaw patterns against Mnemosyne's demonstrated
  needs; research recommendations only, not ratified architecture
- [docs/OPEN_WEBUI_ADOPTION_ASSESSMENT.md](docs/OPEN_WEBUI_ADOPTION_ASSESSMENT.md)
  — pinned Open WebUI comparison covering optional-host interoperability,
  provider telemetry, recoverable runs, and UI patterns; research only
- [docs/NEMOCLAW_ADOPTION_ASSESSMENT.md](docs/NEMOCLAW_ADOPTION_ASSESSMENT.md)
  — pinned NemoClaw security, readiness, and MCP-boundary comparison;
  research recommendations only, not ratified architecture
- [docs/ATLAS_CAPABILITY_BENCHMARK.md](docs/ATLAS_CAPABILITY_BENCHMARK.md) —
  bounded, evidence-only Atlas Cloud route evaluation protocol, with dated
  results per run:
  [2026-08-27](docs/ATLAS_CAPABILITY_RESULTS_2026-08-27.md) (initial live
  check) and
  [2026-08-28](docs/ATLAS_CAPABILITY_RESULTS_2026-08-28.md) (first full
  catalog run through the CLI runner)
- [docs/HOOK_VAULT.md](docs/HOOK_VAULT.md) — non-canon development register
  for promising story and character seeds that are not ready for promotion
- [docs/STORYLINE_RESEARCH_BACKLOG.md](docs/STORYLINE_RESEARCH_BACKLOG.md) —
  operator-selected deferred research and follow-ups for directed or founded
  story concepts
- [docs/V2_RETROSPECTIVE.md](docs/V2_RETROSPECTIVE.md) — schemas, prompt
  templates, and lessons mined from the v2 OC storytelling plugin
  (preserved for informational value; not being ported)
- [docs/IMPORT_EXPORT_DESIGN.md](docs/IMPORT_EXPORT_DESIGN.md) — the
  ratified import/export design (`mnemo_export_story` /
  `mnemo_import_story`, versioned interchange schema, caller-side
  classification)
- [docs/IMPORT_PLAYBOOK.md](docs/IMPORT_PLAYBOOK.md) — classification
  rules for importing legacy story material (the host LLM classifies,
  the human approves, the tool writes)
- [docs/SEED_TEMPLATES.md](docs/SEED_TEMPLATES.md) — fill-in skeletons
  for seeding a new story (character, style guide, rules) via one
  import call
## Stack

- TypeScript (Node 22+, ESM, `NodeNext` module resolution)
- `@modelcontextprotocol/sdk` (high-level `McpServer` API)
- `zod` for tool input schemas
- `vitest` for tests

## HTTP Trust Boundary

The default stdio transport treats explicit import/export paths as local
operator capabilities. The HTTP server currently exposes the same tool
schemas, including `mnemo_import_story(file_path)` and
`mnemo_export_story(out_path)`. Until transport-specific path confinement is
implemented, do not give an untrusted or third-party HTTP host the unrestricted
tool surface. Loopback binding, Host/Origin checks, and bearer authentication
reduce who can connect; they do not turn arbitrary server-side paths into a
safe remote capability. See the
[NemoClaw assessment](docs/NEMOCLAW_ADOPTION_ASSESSMENT.md#1-constrain-filesystem-authority-by-transport).

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

## Diagnostic Scripts

```bash
# Dump the exact system prompt mnemo_continue would send to Ollama.
# Triages "model ignored the rule" vs. "rule never reached the prompt".
OC_URL=http://your-nas:18000/mcp \
  node scripts/dump-prompt.mjs <story_id> "<user direction>" --scene-context-strategy query-ranked

# Or keep the script using the same env-driven default as the server:
MNEMO_SCENE_CONTEXT_STRATEGY=query-ranked \
OC_URL=http://your-nas:18000/mcp \
  node scripts/dump-prompt.mjs <story_id> "<user direction>"

# Run the validator pass against arbitrary content. Lets you A/B
# validator prompts and models without going through Claude Desktop.
OC_URL=http://your-nas:18000/mcp \
OLLAMA_VALIDATOR_MODEL=mistral-nemo:12b \
  node scripts/dump-validation.mjs <story_id> <content_file>

# Bind a story's Kindroid target to a group chat and build the exact
# message mnemo_continue would send it (context-gathering + keyphrase
# folding) -- without needing the live-connected MCP server to already
# know about GENERATOR_PROVIDER=kindroid.
OC_URL=http://your-nas:18000/mcp \
  node scripts/dump-kindroid-group-message.mjs <story_id> <group_id> "<user direction>" --scene-context-strategy query-ranked

# Or keep this script aligned with the server default:
MNEMO_SCENE_CONTEXT_STRATEGY=query-ranked \
OC_URL=http://your-nas:18000/mcp \
  node scripts/dump-kindroid-group-message.mjs <story_id> <group_id> "<user direction>"
```

## Third-Party Tools

- **[Atlas Cloud CLI](https://github.com/AtlasCloudAI/cli)** (vendored as a
  git submodule at `vendor/atlascloud-cli`) — credit to AtlasCloudAI. A
  development/operations and research tool for shell-side account, model, and
  connectivity checks; `scripts/atlas-capability-benchmark.mjs` also consumes
  a compatible CLI through `ATLAS_CLI_BIN` or `PATH`. Mnemosyne's runtime
  `atlascloud` generator provider (`src/openai-compat-provider.ts`) talks to
  the Atlas Cloud API directly and does not call the CLI. After cloning, run
  `git submodule update --init --recursive` to pull it in.

## License

MIT
