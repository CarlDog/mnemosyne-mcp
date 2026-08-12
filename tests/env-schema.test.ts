// Schema-drift test: every env var read via process.env.* in src/**/*.ts must
// be documented in .env.example (as either an active `VAR=value` line or a
// commented-out `# VAR=value` line), and every var documented in .env.example
// must actually be read somewhere in src/. Catches the classic drift where a
// new config knob lands in code but nobody updates the example file (or a var
// gets renamed/removed in one place and not the other).
//
// Pure/local -- reads files off disk, no OC/Ollama/Kindroid required.

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));
const ENV_EXAMPLE_PATH = join(REPO_ROOT, ".env.example");
const SRC_DIR = join(REPO_ROOT, "src");

// OS-standard vars read directly by src/config.ts as part of resolving the
// local config directory -- intentionally not documented in .env.example
// since they're platform environment, not app config.
const EXCLUDED_VARS = new Set(["APPDATA", "XDG_CONFIG_HOME"]);

// Matches a var name at the very start of a line (after stripping a leading
// "# " comment marker), immediately followed by "=" -- e.g. "OC_URL=..." or,
// after stripping, "GENERATOR_PROVIDER=ollama". Deliberately anchored so
// prose comments that merely *mention* a var name mid-sentence (e.g. "when
// GENERATOR_PROVIDER=kindroid, ...") don't produce false negatives -- they
// just add a harmless duplicate of a name already found on its own line.
const VAR_LINE_PATTERN = /^([A-Z][A-Z0-9_]*)=/;
const PROCESS_ENV_PATTERN = /process\.env\.([A-Z][A-Z0-9_]*)/g;

function extractDocumentedVars(envExampleContent: string): Set<string> {
  const vars = new Set<string>();
  for (const rawLine of envExampleContent.split(/\r?\n/)) {
    const line = rawLine.startsWith("# ") ? rawLine.slice(2) : rawLine;
    const match = VAR_LINE_PATTERN.exec(line);
    const name = match?.[1];
    if (name) vars.add(name);
  }
  return vars;
}

function walkTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkTsFiles(full));
    } else if (entry.isFile() && entry.name.endsWith(".ts")) {
      out.push(full);
    }
  }
  return out;
}

function extractReferencedVars(files: string[]): Set<string> {
  const vars = new Set<string>();
  for (const file of files) {
    const content = readFileSync(file, "utf8");
    for (const match of content.matchAll(PROCESS_ENV_PATTERN)) {
      const name = match[1];
      if (name) vars.add(name);
    }
  }
  return vars;
}

describe("env schema drift — .env.example vs process.env usage", () => {
  it("documents exactly the env vars read in src/**/*.ts (minus OS-standard exclusions)", () => {
    const documented = extractDocumentedVars(
      readFileSync(ENV_EXAMPLE_PATH, "utf8"),
    );
    const referenced = extractReferencedVars(walkTsFiles(SRC_DIR));

    const expectedDocumented = [...referenced].filter(
      (name) => !EXCLUDED_VARS.has(name),
    );

    const missingFromEnvExample = expectedDocumented.filter(
      (name) => !documented.has(name),
    );
    const staleInEnvExample = [...documented].filter(
      (name) => !referenced.has(name),
    );

    expect(
      missingFromEnvExample,
      "read in src/ but undocumented in .env.example",
    ).toEqual([]);
    expect(
      staleInEnvExample,
      "documented in .env.example but never read in src/",
    ).toEqual([]);
  });
});
