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

**v0.1.3 shipped** — eight tools (`mnemo_story_list`, `mnemo_story_use`,
`mnemo_save_entity`, `mnemo_recall`, `mnemo_delete_entity`,
`mnemo_continue`, `mnemo_validate`, `mnemo_revalidate_scenes`).
`mnemo_continue(validate=true)` now tags scenes with their validation
verdict, and the RECENT SCENES prompt block filters on it — the fix for
the few-shot-vs-rule diagnostic where present-tense example scenes drowned
out an explicit past-tense rule. A Phase 6 Kindroid-generator bridge
(second `LlmProvider` backend, opt-in via `GENERATOR_PROVIDER=kindroid`)
is also shipped and live-verified — see [STATUS.md](STATUS.md) for
details. Related docs:

- [STATUS.md](STATUS.md) — single source of truth: current phase,
  what's done, what's next
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — locked architectural
  decisions and the reasoning behind them
- [docs/V2_RETROSPECTIVE.md](docs/V2_RETROSPECTIVE.md) — schemas, prompt
  templates, and lessons mined from the v2 OC storytelling plugin
  (preserved for informational value; not being ported)

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
  node scripts/dump-prompt.mjs <story_id> "<user direction>"

# Run the validator pass against arbitrary content. Lets you A/B
# validator prompts and models without going through Claude Desktop.
OC_URL=http://your-nas:18000/mcp \
OLLAMA_VALIDATOR_MODEL=mistral-nemo:12b \
  node scripts/dump-validation.mjs <story_id> <content_file>
```

## License

MIT
