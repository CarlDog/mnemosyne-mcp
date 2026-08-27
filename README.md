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

**v0.1.3 shipped** — ten tools (`mnemo_story_list`, `mnemo_story_use`,
`mnemo_save_entity`, `mnemo_recall`, `mnemo_delete_entity`,
`mnemo_continue`, `mnemo_validate`, `mnemo_revalidate_scenes`,
`mnemo_export_story`, `mnemo_import_story`).
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
  node scripts/dump-validation.mjs <story_id> <content_file> --scene-context-strategy query-ranked

# ...or set env once and use the default flag-free call:
MNEMO_SCENE_CONTEXT_STRATEGY=query-ranked \
OC_URL=http://your-nas:18000/mcp \
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
  manual dev/ops tool for checking Atlas Cloud account balance, model
  availability, and API connectivity from the shell; mnemosyne's own
  `atlascloud` generator provider (`src/openai-compat-provider.ts`) talks
  to the Atlas Cloud API directly and does not call this CLI. After
  cloning, run `git submodule update --init --recursive` to pull it in.

## License

MIT
