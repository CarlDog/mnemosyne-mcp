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

### Verification

- 417 tests pass; 64 live-service tests skip intentionally without their
  external-service environment.
- Typecheck, lint, Prettier, production build, gitleaks, and PII checks pass.
