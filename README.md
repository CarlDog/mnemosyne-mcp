# mnemosyne-mcp

MCP server for long-form storytelling on top of OpenChronicle memory.

Mnemosyne owns narrative logic; OpenChronicle (OC) owns persistent memory.
Together they support continuity-aware storytelling sessions across many
conversations — characters, scenes, lore, and rules persist between
sessions because they live as OC memories, not as ephemeral context.

The name honors Mnemosyne, Greek personification of remembering and
mother of the Muses — the force by which memory becomes story.

## Status

**Scaffolded — no tools yet.** Design and build sequence are documented;
v0 tool surface is the next decision. See:

- [STATUS.md](STATUS.md) — current phase, what's done, what's next
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
npm run typecheck      # tsc --noEmit
npm run lint           # eslint .
npm run format         # prettier --write .
npm test               # vitest run
```

## License

MIT
