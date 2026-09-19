import { describe, expect, it } from "vitest";
// The frontmatter module is an operator-facing Node ESM script rather than
// part of the TypeScript build; its exported pure functions are the surface.
// @ts-expect-error -- operational .mjs modules do not emit TypeScript declarations.
import * as frontmatter from "../scripts/canon-frontmatter.mjs";

const {
  hasNestedSchema,
  parseCanonScalar,
  parseNestedFrontmatter,
  resolveEntityFields,
  toCanonScalar,
} = frontmatter;

const NESTED = `schema: "character/3"
id: "test-story/anna-vale"

names:
  display: "Anna Vale"
  aliases: ["the Keeper", "Nan"]

tier: "recurring"
status: "active"

# ---- card: the first block is the whole character ----
card:
  role: >-
    Keeps the harbor key and the ledger that says
    who may hold it.

identity:
  pronouns: "she/her"
  age: 42

physical:
  height_cm: 168
  measurements_cm: { bust: 89, waist: 61, hips: 90 }

relationships:
  - name: "Toma Reed"
    relation: "brother; the one who never asks"

meta:
  created: "2026-09-18"
  pinned: false
  tags: ["keeper", "harbor"]
`;

describe("nested (character/3) frontmatter", () => {
  it("parses folded scalars, flow maps, sequences of maps and comments as one document", () => {
    const document = parseNestedFrontmatter(NESTED);
    expect(document.names.display).toBe("Anna Vale");
    expect(document.card.role).toBe(
      "Keeps the harbor key and the ledger that says who may hold it.",
    );
    expect(document.identity.age).toBe(42);
    expect(document.physical.measurements_cm).toEqual({
      bust: 89,
      waist: 61,
      hips: 90,
    });
    expect(document.relationships[0].name).toBe("Toma Reed");
    // YAML 1.2 core leaves a date-only string a string; nothing maps it to
    // created_at, which requires an offset.
    expect(document.meta.created).toBe("2026-09-18");
  });

  it("resolves the flat names the consumers read and nothing else", () => {
    const fields = resolveEntityFields(parseNestedFrontmatter(NESTED));
    expect([...fields.keys()]).toEqual([
      "name",
      "aliases",
      "schema",
      "id",
      "tier",
      "status",
      "pinned",
      "tags",
    ]);
    expect(fields.get("name")).toBe("Anna Vale");
    expect(fields.get("aliases")).toEqual(["the Keeper", "Nan"]);
    expect(fields.get("pinned")).toBe(false);
    expect(fields.get("tags")).toEqual(["keeper", "harbor"]);
    expect(fields.has("created_at")).toBe(false);
  });

  it("leaves pinned and tags out when the document has no meta", () => {
    const fields = resolveEntityFields(
      parseNestedFrontmatter(
        'schema: "character/3"\nnames:\n  display: "Solo"\n',
      ),
    );
    expect(fields.has("pinned")).toBe(false);
    expect(fields.has("tags")).toBe(false);
    expect(fields.get("name")).toBe("Solo");
  });

  it("discriminates on a top-level schema line only", () => {
    expect(hasNestedSchema(NESTED.split("\n"))).toBe(true);
    expect(hasNestedSchema(["name: Aria", "aliases: [Ace]"])).toBe(false);
    expect(hasNestedSchema(["meta:", '  schema: "character/3"'])).toBe(false);
    expect(hasNestedSchema(["schema:"])).toBe(false);
  });

  it("rejects the shapes the consumers cannot trust, with one-line messages", () => {
    const cases: Array<[string, string]> = [
      [
        'schema: "character/3"\nnames:\n  display: "A"\nnames:\n  display: "B"\n',
        "Map keys must be unique",
      ],
      ['schema: "character/3"\nnames:\n  aliases: ["x"]\n', "names.display"],
      ['schema: "character/3"\nnames:\n  display: ""\n', "names.display"],
      ['schema: "character/3"\nname: "Flat"\n', "names mapping"],
      [
        'schema: "character/3"\nnames:\n  display: "A"\nmeta:\n  pinned: "yes"\n',
        "meta.pinned must be true or false",
      ],
      [
        'schema: "character/3"\nnames:\n  display: "A"\nmeta:\n  tags: "keeper"\n',
        "meta.tags must be an array",
      ],
      ["- just\n- a\n- list\n", "must be a YAML mapping"],
      [
        'schema: 3\nnames:\n  display: "A"\n',
        "schema must be a non-empty one-line string",
      ],
    ];
    for (const [text, expected] of cases) {
      let message = "";
      try {
        parseNestedFrontmatter(text);
      } catch (error) {
        message = (error as Error).message;
      }
      expect(message, text).toContain(expected);
      expect(message.split("\n")).toHaveLength(1);
    }
  });

  it("round-trips a display name through the flat scalar pair only when re-serialized", () => {
    // The validator re-serializes the resolved name through toCanonScalar so
    // its unchanged flat reader gets the same string back; a raw display name
    // like "[Redacted]" would otherwise read back as an array.
    for (const display of [
      "[Redacted]",
      "true",
      "null",
      "  padded  ",
      'Aria "Ace" Voss',
    ]) {
      expect(parseCanonScalar(toCanonScalar(display))).toBe(display);
    }
    expect(parseCanonScalar("[Redacted]")).toEqual(["Redacted"]);
  });
});
