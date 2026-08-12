// Single source of truth for this server's own MCP protocol identity
// version. Reads package.json's "version" field once at import time so it
// never drifts out of sync with the three {name, version} objects passed to
// the SDK's Client/McpServer constructors.
//
// Resolved via import.meta.url rather than a relative import so this works
// identically under both "tsx src/index.ts" (dev) and "node dist/index.js"
// (built) -- dist/ mirrors src/ one level below the repo root, so
// "../package.json" from either version.ts or dist/version.js lands on the
// same file.

import { readFileSync } from "node:fs";

const packageJsonUrl = new URL("../package.json", import.meta.url);
const packageJson = JSON.parse(readFileSync(packageJsonUrl, "utf-8")) as {
  version: string;
};

export const MNEMOSYNE_VERSION: string = packageJson.version;
