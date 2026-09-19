// The canon/ frontmatter scalar format, defined in ONE place.
//
// Writer and reader of a serialization format have to agree exactly, and they
// did not: scaffold-story.mjs wrote values with JSON.stringify while
// validate-canon.mjs read them back by stripping the outer quotes with a
// regex. Any value containing a quote therefore round-tripped with its
// backslashes intact -- e.g. story-01' Lilith came back as
//   Lilith (... \"Vaelorian\" ...)
// which silently became the entity's dedup key and the text of every
// DUPLICATE / error message about it. 55 canon files use the quoted form.
//
// Both scripts now import from here so the pair cannot drift again.
//
// A second frontmatter shape exists beside the flat one: the nested
// character/3 profile, declared by a top-level `schema:` key and parsed as
// real YAML (folded scalars, flow maps, sequences, comments). The nested
// parser and the resolver that maps its keys onto the flat names the
// consumers read live here too, so the three scripts that read entity files
// (validate-canon, compile-story, verify-draft-overlay) share one
// implementation. Flat files never carry a `schema:` key, and the flat path
// is untouched by any of this.

import { readFileSync } from "node:fs";
import { parse as parseYaml } from "yaml";

/**
 * Render a value as a frontmatter scalar.
 *
 * Plain (unquoted) is used only when the value is unambiguous. It must start
 * with a word character specifically, not just any allowed char -- a leading
 * "-", quote, or space is a YAML plain-scalar indicator and would be read as
 * structure (e.g. `- test` is a block-sequence item, not a string).
 */
export function toCanonScalar(value) {
  // A value must also survive being read back off a line, so anything with
  // leading or trailing whitespace is quoted: the reader trims, and a plain
  // `name: trailing space ` would silently lose its trailing space. The
  // leading case is already excluded by the ^\w anchor; trimming here covers
  // both explicitly rather than relying on that.
  if (value !== value.trim()) return JSON.stringify(value);
  if (
    /^\w[\w' -]*$/.test(value) &&
    !value.includes(": ") &&
    !["true", "false", "null"].includes(value)
  ) {
    return value;
  }
  return JSON.stringify(value);
}

/**
 * Parse the deliberately small frontmatter scalar subset accepted by the
 * canon compiler. This is not a general YAML parser: nested objects, null,
 * nested arrays, and single-quoted array items are intentionally unsupported.
 */
export function parseCanonScalar(raw) {
  const value = raw.trim();
  if (!value) throw new Error("frontmatter value cannot be empty");

  if (value.startsWith("[")) return parseInlineArray(value);

  if (value.startsWith('"')) {
    let parsed;
    try {
      parsed = JSON.parse(value);
    } catch (error) {
      throw new Error(
        `malformed JSON-style frontmatter value (${errorMessage(error)})`,
        { cause: error },
      );
    }
    if (typeof parsed !== "string") {
      throw new Error("quoted frontmatter value must decode to a string");
    }
    if (/\r|\n/.test(parsed)) {
      throw new Error("frontmatter string contains a line break");
    }
    return parsed;
  }

  if (value.startsWith("'")) {
    if (value.length < 2 || !value.endsWith("'")) {
      throw new Error("unterminated single-quoted frontmatter value");
    }
    const body = value.slice(1, -1);
    let parsed = "";
    for (let index = 0; index < body.length; index += 1) {
      const character = body[index];
      if (character !== "'") {
        parsed += character;
        continue;
      }
      if (body[index + 1] !== "'") {
        throw new Error(
          "single quotes inside a single-quoted YAML value must be doubled",
        );
      }
      parsed += "'";
      index += 1;
    }
    return parsed;
  }

  if (value.startsWith("{")) {
    throw new Error(
      "nested objects are unsupported; use a quoted scalar or array",
    );
  }
  if (value === "true") return true;
  if (value === "false") return false;
  if (value === "null") throw new Error("null is not valid metadata");
  return value;
}

/**
 * Backward-compatible name retained for existing validator consumers.
 */
export function fromCanonScalar(raw) {
  return parseCanonScalar(raw);
}

function parseInlineArray(value) {
  if (!value.endsWith("]")) {
    throw new Error("inline array is missing its closing bracket");
  }

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      for (const [index, item] of parsed.entries()) {
        if (
          item === null ||
          !["string", "number", "boolean"].includes(typeof item) ||
          (typeof item === "string" && /\r|\n/.test(item))
        ) {
          throw new Error(
            `array item ${index} must be a one-line scalar value`,
          );
        }
      }
      return parsed;
    }
  } catch (error) {
    // Syntax errors fall through to the compiler's supported YAML-style
    // inline-array subset. Semantic errors from a valid JSON array do not.
    if (!(error instanceof SyntaxError)) throw error;
  }

  const body = value.slice(1, -1).trim();
  if (!body) return [];
  const tokens = [];
  let token = "";
  let quoted = false;
  let escaped = false;
  for (const character of body) {
    if (escaped) {
      token += character;
      escaped = false;
      continue;
    }
    if (character === "\\" && quoted) {
      token += character;
      escaped = true;
      continue;
    }
    if (character === '"') {
      token += character;
      quoted = !quoted;
      continue;
    }
    if (character === "," && !quoted) {
      tokens.push(token.trim());
      token = "";
      continue;
    }
    token += character;
  }
  if (quoted || escaped) throw new Error("unterminated quoted array item");
  const finalToken = token.trim();
  if (finalToken) {
    tokens.push(finalToken);
  } else if (!body.trimEnd().endsWith(",")) {
    throw new Error("array item cannot be empty");
  }

  return tokens.map((item, index) => {
    if (!item) throw new Error(`array item ${index} cannot be empty`);
    if (item.startsWith('"')) {
      let parsed;
      try {
        parsed = JSON.parse(item);
      } catch (error) {
        throw new Error(
          `array item ${index} is malformed (${errorMessage(error)})`,
          { cause: error },
        );
      }
      if (typeof parsed !== "string" || /\r|\n/.test(parsed)) {
        throw new Error(`array item ${index} must be a one-line string`);
      }
      return parsed;
    }
    if (/[[\]{}]/.test(item) || item.startsWith("'")) {
      throw new Error(
        `array item ${index} uses unsupported nesting or single quotes`,
      );
    }
    if (item === "true") return true;
    if (item === "false") return false;
    if (item === "null") {
      throw new Error(`array item ${index}: null is not valid metadata`);
    }
    return item;
  });
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

// ---- the nested (character/3) frontmatter shape ----

const NESTED_SCHEMA_LINE_RE = /^schema:[ \t]*\S/;

/**
 * True when a frontmatter block (its lines, without the `---` delimiters)
 * declares the nested shape with a top-level `schema:` key. Flat legacy
 * frontmatter never carries one, so this is the discriminator every consumer
 * branches on; an indented `schema:` under some parent does not count.
 */
export function hasNestedSchema(frontmatterLines) {
  return frontmatterLines.some((line) => NESTED_SCHEMA_LINE_RE.test(line));
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isOneLineString(value) {
  return typeof value === "string" && !/\r|\n/.test(value);
}

function isNonEmptyOneLineString(value) {
  return isOneLineString(value) && value.trim() !== "";
}

/**
 * Parse a nested frontmatter block (the text between the `---` lines) as
 * YAML and check the few fields the consumers rely on. Everything else in
 * the document is carried through untouched for the compiler to render.
 *
 * Throws an Error whose message is a single line: yaml's own errors carry a
 * multi-line code frame, and the validator prints one problem per line.
 */
export function parseNestedFrontmatter(frontmatterText) {
  let document;
  try {
    document = parseYaml(frontmatterText, { uniqueKeys: true });
  } catch (error) {
    const firstLine = errorMessage(error).split(/\r?\n/, 1)[0];
    throw new Error(`nested frontmatter is not valid YAML: ${firstLine}`, {
      cause: error,
    });
  }
  if (!isPlainObject(document)) {
    throw new Error("nested frontmatter must be a YAML mapping");
  }
  if (!isNonEmptyOneLineString(document.schema)) {
    throw new Error(
      "nested frontmatter schema must be a non-empty one-line string",
    );
  }
  if (!isPlainObject(document.names)) {
    throw new Error("nested frontmatter must have a names mapping");
  }
  if (!isNonEmptyOneLineString(document.names.display)) {
    throw new Error(
      "nested frontmatter names.display must be a non-empty one-line string",
    );
  }
  const { aliases } = document.names;
  if (
    aliases !== undefined &&
    !(Array.isArray(aliases) && aliases.every(isOneLineString))
  ) {
    throw new Error(
      "nested frontmatter names.aliases must be an array of one-line strings",
    );
  }
  const { meta } = document;
  if (meta !== undefined) {
    if (!isPlainObject(meta)) {
      throw new Error("nested frontmatter meta must be a mapping");
    }
    if (meta.pinned !== undefined && typeof meta.pinned !== "boolean") {
      throw new Error("nested frontmatter meta.pinned must be true or false");
    }
    if (
      meta.tags !== undefined &&
      !(Array.isArray(meta.tags) && meta.tags.every(isNonEmptyOneLineString))
    ) {
      throw new Error(
        "nested frontmatter meta.tags must be an array of non-empty one-line strings",
      );
    }
  }
  return document;
}

/**
 * Map a nested document onto the flat field names the consumers read:
 * `name` (names.display), `aliases`, `pinned` and `tags` (only when present),
 * plus the one-line identity strings `schema`, `id`, `tier` and `status`.
 * Nothing else is flattened; the compiler renders the whole document.
 */
export function resolveEntityFields(document) {
  const fields = new Map();
  fields.set("name", document.names.display);
  if (document.names.aliases !== undefined) {
    fields.set("aliases", [...document.names.aliases]);
  }
  for (const key of ["schema", "id", "tier", "status"]) {
    if (isOneLineString(document[key])) fields.set(key, document[key]);
  }
  if (document.meta?.pinned !== undefined) {
    fields.set("pinned", document.meta.pinned);
  }
  if (document.meta?.tags !== undefined) {
    fields.set("tags", [...document.meta.tags]);
  }
  return fields;
}

/**
 * Parse a nested frontmatter block as a plain YAML mapping, with no shape
 * checks beyond "it is a mapping". For consumers that only walk the values
 * (the overlay verifier's pointer scan) and must accept every nested shape,
 * the character/3 entity and the story/1 block alike.
 */
export function parseNestedDocument(frontmatterText) {
  let document;
  try {
    document = parseYaml(frontmatterText, { uniqueKeys: true });
  } catch (error) {
    const firstLine = errorMessage(error).split(/\r?\n/, 1)[0];
    throw new Error(`nested frontmatter is not valid YAML: ${firstLine}`, {
      cause: error,
    });
  }
  if (!isPlainObject(document)) {
    throw new Error("nested frontmatter must be a YAML mapping");
  }
  return document;
}

// ---- the story block (story/1) and the genre dictionary ----
//
// docs/GENRE_DECLARATION_DESIGN.md. One dictionary file under src/, read
// through import.meta.url the way src/version.ts reads package.json, so the
// scripts and the server resolve the same file and no emitted copy can go
// stale.

const GENRE_DICTIONARY_URL = new URL(
  "../src/genre-dictionary.json",
  import.meta.url,
);
let cachedDictionary = null;

export function loadGenreDictionary() {
  if (cachedDictionary === null) {
    cachedDictionary = JSON.parse(readFileSync(GENRE_DICTIONARY_URL, "utf-8"));
  }
  return cachedDictionary;
}

export const STORY_BLOCK_SCHEMA = "story/1";
export const STORY_BLOCK_LIMITS = Object.freeze({
  genresMax: 3,
  leanMax: 200,
  listMax: 8,
  itemMax: 160,
  guidanceMax: 1500,
});

/** Every ancestor of a term, nearest first; [] for a root or unknown term. */
export function genreAncestors(term, dictionary = loadGenreDictionary()) {
  const ancestors = [];
  let cursor = dictionary.terms[term]?.parent ?? null;
  while (cursor !== null && !ancestors.includes(cursor)) {
    ancestors.push(cursor);
    cursor = dictionary.terms[cursor]?.parent ?? null;
  }
  return ancestors;
}

function requireOneLineList(value, label, { max, itemMax, required }) {
  if (value === undefined) {
    if (required) throw new Error(`story block ${label} is required`);
    return [];
  }
  if (!Array.isArray(value)) {
    throw new Error(`story block ${label} must be a list of one-line strings`);
  }
  if (value.length > max) {
    throw new Error(
      `story block ${label} has ${value.length} entries; at most ${max}`,
    );
  }
  value.forEach((item, index) => {
    if (!isNonEmptyOneLineString(item)) {
      throw new Error(
        `story block ${label}[${index}] must be a non-empty one-line string`,
      );
    }
    if (item.length > itemMax) {
      throw new Error(
        `story block ${label}[${index}] is ${item.length} characters; at most ${itemMax}`,
      );
    }
  });
  return [...value];
}

/**
 * Parse and check a story block (the frontmatter of canon/_story.md):
 * schema story/1, a one-line name, one to three dictionary genres with no
 * term beside its own parent or ancestor, a required one-line lean, and
 * optional conventions, avoid and subgenres lists, all within the limits
 * the marker and the prompt can carry. Throws one-line errors that name the
 * offending field or term.
 */
export function parseStoryBlock(
  frontmatterText,
  dictionary = loadGenreDictionary(),
) {
  const document = parseNestedDocument(frontmatterText);
  if (document.schema !== STORY_BLOCK_SCHEMA) {
    throw new Error(
      `story block schema must be ${JSON.stringify(STORY_BLOCK_SCHEMA)}`,
    );
  }
  if (!isNonEmptyOneLineString(document.name)) {
    throw new Error("story block name must be a non-empty one-line string");
  }
  const { genres } = document;
  if (!Array.isArray(genres) || genres.length === 0) {
    throw new Error(
      "story block genres must list one to three dictionary terms",
    );
  }
  if (genres.length > STORY_BLOCK_LIMITS.genresMax) {
    throw new Error(
      `story block genres lists ${genres.length} terms; at most ${STORY_BLOCK_LIMITS.genresMax}`,
    );
  }
  genres.forEach((term, index) => {
    if (typeof term !== "string" || !Object.hasOwn(dictionary.terms, term)) {
      throw new Error(
        `story block genres[${index}] ${JSON.stringify(term)} is not a dictionary term`,
      );
    }
    if (genres.indexOf(term) !== index) {
      throw new Error(`story block genres repeats ${JSON.stringify(term)}`);
    }
  });
  for (const term of genres) {
    const ancestor = genreAncestors(term, dictionary).find((candidate) =>
      genres.includes(candidate),
    );
    if (ancestor) {
      throw new Error(
        `story block genres: ${JSON.stringify(term)} cannot appear with its parent or ancestor ${JSON.stringify(ancestor)}`,
      );
    }
  }
  if (!isNonEmptyOneLineString(document.lean)) {
    throw new Error("story block lean must be a non-empty one-line string");
  }
  if (document.lean.length > STORY_BLOCK_LIMITS.leanMax) {
    throw new Error(
      `story block lean is ${document.lean.length} characters; at most ${STORY_BLOCK_LIMITS.leanMax}`,
    );
  }
  const listLimits = {
    max: STORY_BLOCK_LIMITS.listMax,
    itemMax: STORY_BLOCK_LIMITS.itemMax,
    required: false,
  };
  const conventions = requireOneLineList(
    document.conventions,
    "conventions",
    listLimits,
  );
  const avoid = requireOneLineList(document.avoid, "avoid", listLimits);
  const subgenres = requireOneLineList(document.subgenres, "subgenres", {
    max: STORY_BLOCK_LIMITS.listMax,
    itemMax: STORY_BLOCK_LIMITS.itemMax,
    required: false,
  });
  const guidanceLength =
    document.lean.length +
    conventions.reduce((sum, item) => sum + item.length, 0) +
    avoid.reduce((sum, item) => sum + item.length, 0);
  if (guidanceLength > STORY_BLOCK_LIMITS.guidanceMax) {
    throw new Error(
      `story block guidance (lean, conventions, avoid) is ${guidanceLength} characters; at most ${STORY_BLOCK_LIMITS.guidanceMax}`,
    );
  }
  return {
    schema: STORY_BLOCK_SCHEMA,
    name: document.name,
    genres: [...genres],
    subgenres,
    lean: document.lean,
    conventions,
    avoid,
  };
}

/** The export document's story-block fields, from a parsed story block. */
export function storyBlockExportFields(block) {
  return {
    genres: [...block.genres],
    genre_guidance: {
      lean: block.lean,
      conventions: [...block.conventions],
      avoid: [...block.avoid],
    },
  };
}
