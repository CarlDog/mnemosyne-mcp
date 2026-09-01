import { readdirSync, readFileSync } from "node:fs";
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
  posix,
  win32,
} from "node:path";
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

interface SourceImport {
  specifier: string;
  typeOnly: boolean;
}

function sourceImports(path: string): SourceImport[] {
  const imports: SourceImport[] = [];
  sourceFile(path).forEachChild((node) => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier !== undefined &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const clause = ts.isImportDeclaration(node)
        ? node.importClause
        : undefined;
      const namedImports = clause?.namedBindings;
      const typeOnly = ts.isExportDeclaration(node)
        ? node.isTypeOnly
        : clause?.isTypeOnly === true ||
          (namedImports !== undefined &&
            ts.isNamedImports(namedImports) &&
            namedImports.elements.length > 0 &&
            namedImports.elements.every((element) => element.isTypeOnly));
      imports.push({ specifier: node.moduleSpecifier.text, typeOnly });
    }
  });
  return imports;
}

function importSpecifiers(path: string): string[] {
  return sourceImports(path).map(({ specifier }) => specifier);
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

function staysWithinDirectory(
  relativePath: string,
  pathApi: Pick<typeof posix, "isAbsolute" | "sep">,
): boolean {
  return (
    relativePath === "" ||
    (relativePath !== ".." &&
      !relativePath.startsWith(`..${pathApi.sep}`) &&
      !pathApi.isAbsolute(relativePath))
  );
}

describe("hexagonal source boundaries", () => {
  it("recognizes contained paths with Windows and POSIX separators", () => {
    expect(staysWithinDirectory("ports/catalog.js", posix)).toBe(true);
    expect(staysWithinDirectory("ports\\catalog.js", win32)).toBe(true);
    expect(staysWithinDirectory("../adapters/catalog.js", posix)).toBe(false);
    expect(staysWithinDirectory("..\\adapters\\catalog.js", win32)).toBe(false);
  });

  it("keeps the MCP and REST inbound drivers independent", () => {
    expect(importsIn(join(srcDir, "api"))).not.toEqual(
      expect.arrayContaining([expect.stringMatching(/:\s+.*\/tools(?:\/|$)/)]),
    );
    expect(importsIn(join(srcDir, "tools"))).not.toEqual(
      expect.arrayContaining([expect.stringMatching(/:\s+.*\/api(?:\/|$)/)]),
    );
  });

  it("keeps application use cases independent of drivers and infrastructure", () => {
    const applicationDir = join(srcDir, "application");
    const allowedExternalModules = new Set([
      join(srcDir, "context-plan.js"),
      join(srcDir, "run-context.js"),
      join(srcDir, "run-outcome.js"),
    ]);
    const violations = sourceFiles(join(srcDir, "application")).flatMap(
      (path) =>
        sourceImports(path)
          .filter(({ specifier }) => {
            if (!specifier.startsWith(".")) return true;
            const resolved = resolve(dirname(path), specifier);
            const applicationRelative = relative(applicationDir, resolved);
            const insideApplication = staysWithinDirectory(
              applicationRelative,
              { isAbsolute, sep },
            );
            return !insideApplication && !allowedExternalModules.has(resolved);
          })
          .map(
            ({ specifier, typeOnly }) =>
              `${relative(srcDir, path)}: ${typeOnly ? "type" : "runtime"} ${specifier}`,
          ),
    );
    expect(violations).toEqual([]);
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
