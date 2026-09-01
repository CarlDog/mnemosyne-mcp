# mnemosyne-mcp

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
- [docs/DATA_LAYOUT.md](docs/DATA_LAYOUT.md) — canonical authoring layout,
  compile contract, and review-gated draft-overlay workflow
- [docs/LIVING_CANON_STANDARD.md](docs/LIVING_CANON_STANDARD.md) — ratified
  editorial minimum for complete, playable, provenance-backed story canon
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
- [docs/COMPANION_PROFILE_DESIGN.md](docs/COMPANION_PROFILE_DESIGN.md) —
  proposed provider-neutral character/voice profiles, bounded Kindroid and
  Botify projections, and snapshot-before-write workflow; design only, not
  implemented or ratified

## Architecture

Mnemosyne is hexagonal: `src/tools/` and `src/api/` are independent inbound
drivers over the same bound application contract. `src/application/` owns the
continuation, validation, scene-revalidation, and catalog use cases, their
structural models, outbound ports, and pure policy. `src/adapters/` implements OC, model-provider,
persistence, environment, clock, and logging capabilities. `src/index.ts` is
the only composition root: it builds concrete adapters, binds
`ApplicationUseCases`, and injects that bundle into both drivers.

`tests/architecture-boundaries.test.ts` parses the TypeScript AST to prevent
driver cross-imports and infrastructure dependencies from entering the
application layer, require port routing, and keep concrete construction at the
composition root. Application-internal relative imports are resolved by path;
only an explicit allowlist of pure legacy modules may sit outside that layer.
See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full
dependency rules.

## Setup

Mnemosyne is a *client* of two services you run yourself. Neither is bundled,
and the server exits at startup without the first:

1. **[OpenChronicle](https://github.com/CarlDog/openchronicle-mcp)** — the
   memory database every story's state lives in. Required.
2. **A generator** — [Ollama](https://ollama.com) by default (local, free), or
   one of the six alternatives behind `GENERATOR_PROVIDER`. The *validator*
   pass always runs on Ollama regardless, so an Ollama endpoint is needed
   either way.

```bash
npm ci
npm run build
cp .env.example .env      # then edit -- see below
```

**Nothing auto-loads `.env`.** The server reads its configuration from the
process environment, so pass it one of three ways:

```bash
node --env-file=.env dist/index.js   # Node 22+, manual run
```

…or export the vars into your shell before `npm run dev`, or — most commonly —
put them in the `env` block of the server entry in your MCP client config:

```json
{
  "mcpServers": {
    "mnemosyne": {
      "command": "node",
      "args": ["/absolute/path/to/mnemosyne-mcp/dist/index.js"],
      "env": {
        "OC_URL": "http://your-oc-host:18000/mcp",
        "OLLAMA_GENERATOR_MODEL": "mistral-nemo:12b"
      }
    }
  }
}
```

The minimum is `OC_URL` plus a generator model. [.env.example](.env.example)
is the full reference and states what each provider additionally requires.

**Transports.** With `MCP_PORT` unset the server speaks stdio — the default,
and what an MCP client expects. Set `MCP_PORT` and it serves Streamable HTTP
instead, plus a REST API and the web UI at that port. Read
[HTTP Trust Boundary](#http-trust-boundary) before exposing that anywhere.

**Web UI.** `npm run build` also builds the React app in `webui/` into
`dist/webui/`, served automatically in HTTP mode. It covers the entity library
and the continue/validate flow; entity editing and the remaining
[WEBUI_NOTES](docs/WEBUI_NOTES.md) slices are not built. For UI development,
`npm --prefix webui run dev` runs Vite with `/api/*` proxied to the server
started by `npm run dev`.

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
npm ci                 # deterministic install (Node 22, npm 10.9.8)
npm run build          # compile server + build/copy Web UI into dist/
npm run dev            # tsx src/index.ts
npm run typecheck      # tsc -p tsconfig.typecheck.json (src + tests)
npm run lint           # eslint .
npm run format         # prettier --write .
npm run format:check   # prettier --check . (CI gates on this -- run before pushing)
npm test               # vitest run
```

Canon authoring has a separate offline import-contract check. Build the server
first so the script can use the runtime's real import parser and preflight:

```bash
npm run build:server
node scripts/compile-story.mjs <story-slug> --check
node scripts/verify-draft-overlay.mjs <story-slug>
```

The check compiles `data/stories/<story-slug>/canon/` in memory and performs
zero writes. Pass `--dir <path>` for a staged canon-shaped tree. The `--out
<file>` mode exclusively creates a checked `mnemosyne_export:1` artifact
without importing it. See [docs/DATA_LAYOUT.md](docs/DATA_LAYOUT.md) for the
authoring mapping and rejection rules. The overlay verifier checks the exact
manifest, baseline/draft hashes, active/isolated/merged structures, and merged
import preflight; it performs no promotion or import.

`npm test` green does **not** mean the integration surface ran. 64 of the 482
tests are env-gated and skip unless their variables are exported **into the
shell** — `vitest.config.ts` loads no dotenv, so a populated `.env` does not
enable them. Use `OC_URL=...` for the OpenChronicle suites, adding
`OLLAMA_GENERATOR_MODEL=...` for the validator suites.

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
