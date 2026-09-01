import { readdirSync, readFileSync } from "node:fs";
import { basename, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const srcDir = fileURLToPath(new URL("../src", import.meta.url));

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.isFile() && entry.name.endsWith(".ts") ? [path] : [];
  });
}

function sourceFile(path: string): ts.SourceFile {
  return ts.createSourceFile(
    path,
    readFileSync(path, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
}

function importSpecifiers(path: string): string[] {
  const imports: string[] = [];
  sourceFile(path).forEachChild((node) => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier !== undefined &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      imports.push(node.moduleSpecifier.text);
    }
  });
  return imports;
}

function importsIn(directory: string): string[] {
  return sourceFiles(directory).flatMap((path) =>
    importSpecifiers(path).map(
      (specifier) => `${relative(srcDir, path)}: ${specifier}`,
    ),
  );
}

function calledIdentifiers(path: string): string[] {
  const calls: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      calls.push(node.expression.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile(path));
  return calls;
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

  it("keeps application use cases independent of drivers and infrastructure", () => {
    const forbidden =
      /:\s+.*\/(?:api|tools|adapters|oc-client|log|generator-config|(?:anthropic|botify|gemini|kindroid|openai-compat)-provider)(?:\.js|\/|$)/;
    expect(importsIn(join(srcDir, "application"))).not.toEqual(
      expect.arrayContaining([expect.stringMatching(forbidden)]),
    );
  });

  it("routes each use case through application-owned ports", () => {
    const expectedPorts: Record<string, string[]> = {
      "continue-scene.ts": ["./ports/continuation.js"],
      "list-entities.ts": ["./ports/catalog.js"],
      "list-stories.ts": ["./ports/catalog.js"],
      "revalidate-scenes.ts": [
        "./ports/scene-validation.js",
        "./ports/story-validation.js",
      ],
      "validate-story.ts": ["./ports/story-validation.js"],
    };
    for (const path of sourceFiles(join(srcDir, "application"))) {
      const expected = expectedPorts[basename(path)];
      if (!expected) continue;
      expect(importSpecifiers(path)).toEqual(expect.arrayContaining(expected));
    }
  });

  it("constructs every outbound adapter only at the composition root", () => {
    const indexPath = join(srcDir, "index.ts");
    expect(calledIdentifiers(indexPath)).toEqual(
      expect.arrayContaining([
        "createContinuationAdapter",
        "createEntityCatalogAdapter",
        "createStoryCatalogAdapter",
        "createStoryValidationAdapter",
        "createSceneRevalidationAdapter",
        "createContinueScene",
        "createListEntityCatalog",
        "createListStoryCatalog",
      ]),
    );

    for (const path of sourceFiles(srcDir)) {
      if (path === indexPath || path.startsWith(join(srcDir, "adapters"))) {
        continue;
      }
      expect(calledIdentifiers(path)).not.toEqual(
        expect.arrayContaining([
          "createContinuationAdapter",
          "createEntityCatalogAdapter",
          "createStoryCatalogAdapter",
          "createStoryValidationAdapter",
          "createSceneRevalidationAdapter",
        ]),
      );
    }
  });
});
