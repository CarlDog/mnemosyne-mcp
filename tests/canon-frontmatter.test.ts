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

const { genreAncestors, parseStoryBlock, storyBlockExportFields } = frontmatter;

const STORY_BLOCK = `schema: "story/1"
name: "Harbor Story"
genres: ["mystery", "romance"]
subgenres: ["cozy"]
lean: "A harbor mystery whose clues are all favours owed."
conventions:
  - "Every clue is something a character wanted hidden."
avoid:
  - "No detective monologue."
`;

describe("story block (story/1)", () => {
  it("parses a declared block into ordered genres and one-line guidance", () => {
    const block = parseStoryBlock(STORY_BLOCK);
    expect(block).toEqual({
      schema: "story/1",
      name: "Harbor Story",
      genres: ["mystery", "romance"],
      subgenres: ["cozy"],
      lean: "A harbor mystery whose clues are all favours owed.",
      conventions: ["Every clue is something a character wanted hidden."],
      avoid: ["No detective monologue."],
    });
    expect(storyBlockExportFields(block)).toEqual({
      genres: ["mystery", "romance"],
      genre_guidance: {
        lean: "A harbor mystery whose clues are all favours owed.",
        conventions: ["Every clue is something a character wanted hidden."],
        avoid: ["No detective monologue."],
      },
    });
  });

  it("defaults the optional lists to empty", () => {
    const block = parseStoryBlock(
      `schema: "story/1"\nname: "Bare"\ngenres: ["drama"]\nlean: "Quiet."\n`,
    );
    expect(block.subgenres).toEqual([]);
    expect(block.conventions).toEqual([]);
    expect(block.avoid).toEqual([]);
    expect(storyBlockExportFields(block).genre_guidance).toEqual({
      lean: "Quiet.",
      conventions: [],
      avoid: [],
    });
  });

  it("walks a term's ancestors nearest first and finds none for a root or an unknown term", () => {
    expect(genreAncestors("heist")).toEqual(["crime"]);
    expect(genreAncestors("crime")).toEqual([]);
    expect(genreAncestors("not-a-genre")).toEqual([]);
    expect(
      genreAncestors("leaf", {
        terms: {
          root: { parent: null },
          branch: { parent: "root" },
          leaf: { parent: "branch" },
        },
      }),
    ).toEqual(["branch", "root"]);
  });

  it("rejects each rule breach with a one-line message naming the field or term", () => {
    const lean200 = "x".repeat(200);
    const item160 = "y".repeat(160);
    const cases: [string, RegExp][] = [
      [
        STORY_BLOCK.replace('"story/1"', '"story/2"'),
        /schema must be "story\/1"/,
      ],
      [
        STORY_BLOCK.replace(
          'genres: ["mystery", "romance"]',
          'genres: ["mystery", "spaghetti-western"]',
        ),
        /genres\[1\] "spaghetti-western" is not a dictionary term/,
      ],
      [
        STORY_BLOCK.replace(
          'genres: ["mystery", "romance"]',
          'genres: ["crime", "heist"]',
        ),
        /"heist" cannot appear with its parent or ancestor "crime"/,
      ],
      [
        STORY_BLOCK.replace(
          'genres: ["mystery", "romance"]',
          'genres: ["mystery", "mystery"]',
        ),
        /genres repeats "mystery"/,
      ],
      [
        STORY_BLOCK.replace(
          'genres: ["mystery", "romance"]',
          'genres: ["action", "comedy", "drama", "horror"]',
        ),
        /genres lists 4 terms; at most 3/,
      ],
      [
        STORY_BLOCK.replace('genres: ["mystery", "romance"]', "genres: []"),
        /genres must list one to three dictionary terms/,
      ],
      [
        STORY_BLOCK.replace(/^lean: .*$/m, `lean: "${lean200}z"`),
        /lean is 201 characters; at most 200/,
      ],
      [
        STORY_BLOCK.replace(/^lean: .*\n/m, ""),
        /lean must be a non-empty one-line string/,
      ],
      [
        STORY_BLOCK.replace(/^name: .*$/m, 'name: ""'),
        /name must be a non-empty one-line string/,
      ],
      [
        STORY_BLOCK.replace(
          '  - "No detective monologue."',
          `  - "${item160}z"`,
        ),
        /avoid\[0\] is 161 characters; at most 160/,
      ],
      [
        STORY_BLOCK.replace(
          '  - "Every clue is something a character wanted hidden."',
          Array.from({ length: 9 }, (_, i) => `  - "Convention ${i}"`).join(
            "\n",
          ),
        ),
        /conventions has 9 entries; at most 8/,
      ],
      [
        STORY_BLOCK.replace(/^lean: .*$/m, `lean: "${lean200}`.concat('"'))
          .replace(
            '  - "Every clue is something a character wanted hidden."',
            Array.from({ length: 8 }, () => `  - "${item160}"`).join("\n"),
          )
          .replace('  - "No detective monologue."', `  - "${item160}"`),
        /guidance \(lean, conventions, avoid\) is 1640 characters; at most 1500/,
      ],
      [
        STORY_BLOCK.replace(/^conventions:\n.*\n/m, "conventions: yes\n"),
        /conventions must be a list/,
      ],
      [`schema: "story/1"\nname: [\n`, /not valid YAML/],
    ];
    for (const [text, message] of cases) {
      expect(() => parseStoryBlock(text), text).toThrow(message);
    }
  });

  it("checks terms against the dictionary it is given", () => {
    const own = {
      terms: { mystery: { parent: null }, romance: { parent: null } },
    };
    expect(parseStoryBlock(STORY_BLOCK, own).genres).toEqual([
      "mystery",
      "romance",
    ]);
    expect(() =>
      parseStoryBlock(STORY_BLOCK, { terms: { mystery: { parent: null } } }),
    ).toThrow(/"romance" is not a dictionary term/);
  });
});
