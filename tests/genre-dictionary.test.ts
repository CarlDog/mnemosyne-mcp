import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The dictionary is read through import.meta.url, the same way src/version.ts
// reads package.json, so the server and the tracked scripts resolve one file
// and no emitted copy exists to go stale (docs/GENRE_DECLARATION_DESIGN.md §1).
const DICTIONARY_URL = new URL("../src/genre-dictionary.json", import.meta.url);

type Term = {
  parent: string | null;
  definition: string;
  promises: string;
  avoid: string;
};

function loadDictionary(): {
  version: number;
  rule: string;
  terms: Record<string, Term>;
} {
  return JSON.parse(readFileSync(DICTIONARY_URL, "utf-8"));
}

describe("genre dictionary", () => {
  const dictionary = loadDictionary();
  const terms = dictionary.terms;
  const names = Object.keys(terms);

  it("is a versioned list of lowercase hyphenated terms with the rule stated", () => {
    expect(dictionary.version).toBe(1);
    expect(dictionary.rule).toContain("broadest true term comes first");
    expect(names.length).toBeGreaterThanOrEqual(30);
    for (const name of names) {
      expect(name, name).toMatch(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/);
    }
  });

  it("gives every term its four fields as one-line strings", () => {
    for (const [name, term] of Object.entries(terms)) {
      expect(Object.keys(term).sort(), name).toEqual([
        "avoid",
        "definition",
        "parent",
        "promises",
      ]);
      for (const field of ["definition", "promises", "avoid"] as const) {
        const value = term[field];
        expect(typeof value, `${name}.${field}`).toBe("string");
        expect(value.trim(), `${name}.${field}`).not.toBe("");
        expect(value, `${name}.${field}`).not.toMatch(/\r|\n/);
      }
      expect(
        term.parent === null || typeof term.parent === "string",
        `${name}.parent`,
      ).toBe(true);
    }
  });

  it("resolves every parent to another term, without self-reference or cycles", () => {
    for (const [name, term] of Object.entries(terms)) {
      if (term.parent === null) continue;
      expect(names, `${name}.parent`).toContain(term.parent);
      expect(term.parent, name).not.toBe(name);
      const seen = new Set<string>([name]);
      let cursor: string | null = term.parent;
      while (cursor !== null) {
        expect(seen.has(cursor), `cycle through ${name}`).toBe(false);
        seen.add(cursor);
        cursor = terms[cursor]!.parent;
      }
    }
  });

  it("has no two terms with the same definition", () => {
    const definitions = names.map((name) =>
      terms[name]!.definition.toLowerCase(),
    );
    expect(new Set(definitions).size).toBe(definitions.length);
  });

  it("keeps at least one root and every root parentless", () => {
    const roots = names.filter((name) => terms[name]!.parent === null);
    expect(roots.length).toBeGreaterThan(0);
    for (const root of roots) expect(terms[root]!.parent).toBeNull();
  });
});
