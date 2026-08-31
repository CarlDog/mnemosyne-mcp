import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const srcDir = fileURLToPath(new URL("../src", import.meta.url));

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.isFile() && entry.name.endsWith(".ts") ? [path] : [];
  });
}

function importsIn(directory: string): string[] {
  return sourceFiles(directory).flatMap((path) => {
    const source = readFileSync(path, "utf8");
    return [...source.matchAll(/\bfrom\s+["']([^"']+)["']/g)].map(
      (match) => `${path}: ${match[1]}`,
    );
  });
}

describe("hexagonal source boundaries", () => {
  it("keeps the MCP and REST inbound drivers independent", () => {
    expect(importsIn(join(srcDir, "api"))).not.toEqual(
      expect.arrayContaining([expect.stringMatching(/:\s+.*\/tools(?:\/|$)/)]),
    );
    expect(importsIn(join(srcDir, "tools"))).not.toEqual(
      expect.arrayContaining([expect.stringMatching(/:\s+.*\/api(?:\/|$)/)]),
    );
  });

  it("keeps application use cases independent of inbound drivers", () => {
    expect(importsIn(join(srcDir, "application"))).not.toEqual(
      expect.arrayContaining([
        expect.stringMatching(/:\s+.*\/(?:api|tools)(?:\/|$)/),
      ]),
    );
  });
});
