# Security Policy

## Reporting a vulnerability

Please report security issues **privately**, not as a public issue.

Use GitHub's private vulnerability reporting for this repository:
**[Report a vulnerability](https://github.com/CarlDog/mnemosyne-mcp/security/advisories/new)**
(also reachable from the repository's **Security** tab).

This is a personal project maintained by one person in their own time. There
is no service-level agreement and no bounty. Reports are read and acted on as
capacity allows; please allow a reasonable window before disclosing publicly.

## Supported versions

Only `main` is supported. There are no maintained release branches, no
published npm package, and no published container image — the version tags
that exist are historical markers, not supported releases.

## Scope

In scope: the MCP server, its HTTP transport and `/api/*` REST layer, the web
UI in `webui/`, and the operator scripts in `scripts/`.

Out of scope: OpenChronicle, Ollama, Kindroid, Botify, Atlas Cloud, and any
other upstream service this project talks to. Report those to their own
maintainers.

## Known and documented limitations

Please check these before reporting — they are deliberate, documented, and
already tracked, so a report describing one is not a new finding:

- **Filesystem authority is not confined by transport.** `mnemo_import_story`
  and `mnemo_export_story` accept caller-supplied paths, and the HTTP
  transport currently exposes the same tool surface as stdio. This is
  documented in [the README](README.md#http-trust-boundary) and analysed in
  [the NemoClaw assessment](docs/NEMOCLAW_ADOPTION_ASSESSMENT.md#1-constrain-filesystem-authority-by-transport).
  **Do not expose the HTTP transport to an untrusted host.**
- **Host/Origin allowlisting and bearer auth are the HTTP defences.** They
  govern who may connect; they do not make caller-selected server-side paths
  safe. See `MCP_ALLOWED_HOSTS` and `MCP_AUTH_TOKEN` in
  [.env.example](.env.example).
- **Sibling MCP results are not schema-validated at runtime.** Responses from
  OpenChronicle, Kindroid, and Botify are unwrapped and cast.

A concrete exploit that defeats a control which is *supposed* to hold — an
allowlist bypass, an auth bypass, a path escape in a context the docs claim is
confined — is very much in scope, even if it touches the areas above.

## What this project stores

Story content lives in OpenChronicle, not in this repository. The local
`data/` directory is gitignored. Credentials are read from the environment and
are never written to disk by the server; if you find a path where a secret is
logged or persisted, that is a valid report.
