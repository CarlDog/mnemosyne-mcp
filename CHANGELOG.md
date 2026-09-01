# Changelog

All notable repository changes are recorded here. Historical detail before
this file was introduced remains in [STATUS.md](STATUS.md).

## Unreleased

### Changed

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
