// The genre declaration at runtime (docs/GENRE_DECLARATION_DESIGN.md §4):
// the controlled vocabulary, the validation every write surface shares, and
// the lenient read-side parsing the story marker uses.
//
// The dictionary is imported as JSON rather than read through
// import.meta.url. `src/version.ts` can use readFileSync("../package.json")
// because dist/ mirrors src/ one level below the repo root, so that one
// relative path is identical from both trees. `src/genre-dictionary.json`
// has no such path: it is "./" from src/ and "../src/" from dist/, and a
// packaged artifact ships only dist/ (package.json "files"). A typed import
// resolves correctly in both, and `resolveJsonModule` makes tsc emit the
// file into dist/ -- verified, not assumed -- so there is still exactly one
// tracked source of truth and no hand-maintained copy.
//
// `scripts/canon-frontmatter.mjs` enforces the same rules for the authoring
// tree. It cannot import this module (scripts must work without a build,
// and src/ is the compiler's rootDir), so the rules exist twice on purpose.
// `tests/genre-parity.test.ts` pins the two implementations against one
// shared table of cases so they cannot drift.

import dictionary from "./genre-dictionary.json" with { type: "json" };

export interface GenreTerm {
  parent: string | null;
  definition: string;
  promises: string;
  avoid: string;
}

const TERMS = dictionary.terms as Record<string, GenreTerm>;

export const GENRE_DICTIONARY_VERSION: number = dictionary.version;

/** Must equal STORY_BLOCK_LIMITS in scripts/canon-frontmatter.mjs. */
export const GENRE_LIMITS = Object.freeze({
  genresMax: 3,
  leanMax: 200,
  listMax: 8,
  itemMax: 160,
  guidanceMax: 1500,
});

export interface GenreGuidance {
  lean: string;
  conventions?: string[];
  avoid?: string[];
}

/** A story's declared genre: an ordered term list, broadest first, plus the
 * story's own guidance. Guidance without genres is meaningless and is
 * rejected by assertGenreDeclaration. */
export interface GenreDeclaration {
  genres: string[];
  guidance?: GenreGuidance;
}

export function isGenreTerm(term: string): boolean {
  return Object.hasOwn(TERMS, term);
}

export function genreTerm(term: string): GenreTerm | undefined {
  return isGenreTerm(term) ? TERMS[term] : undefined;
}

/** Every ancestor of a term, nearest first; [] for a root or unknown term. */
export function genreAncestors(term: string): string[] {
  const ancestors: string[] = [];
  let cursor = TERMS[term]?.parent ?? null;
  while (cursor !== null && !ancestors.includes(cursor)) {
    ancestors.push(cursor);
    cursor = TERMS[cursor]?.parent ?? null;
  }
  return ancestors;
}

function isOneLineString(value: unknown): value is string {
  return (
    typeof value === "string" && value.trim().length > 0 && !/\r|\n/.test(value)
  );
}

/**
 * Throws unless `genres` is one to three dictionary terms with no repeat and
 * no term beside its own parent or ancestor. The message names the offending
 * term, because a caller correcting a declaration needs to know which one.
 */
export function assertGenres(genres: unknown): asserts genres is string[] {
  if (!Array.isArray(genres) || genres.length === 0) {
    throw new Error("genres must list one to three dictionary terms");
  }
  if (genres.length > GENRE_LIMITS.genresMax) {
    throw new Error(
      `genres lists ${genres.length} terms; at most ${GENRE_LIMITS.genresMax}`,
    );
  }
  genres.forEach((term, index) => {
    if (typeof term !== "string" || !isGenreTerm(term)) {
      throw new Error(
        `genres[${index}] ${JSON.stringify(term)} is not a dictionary term`,
      );
    }
    if (genres.indexOf(term) !== index) {
      throw new Error(`genres repeats ${JSON.stringify(term)}`);
    }
  });
  for (const term of genres as string[]) {
    const ancestor = genreAncestors(term).find((candidate) =>
      (genres as string[]).includes(candidate),
    );
    if (ancestor) {
      throw new Error(
        `genres: ${JSON.stringify(term)} cannot appear with its parent or ancestor ${JSON.stringify(ancestor)}`,
      );
    }
  }
}

function assertOneLineList(
  value: unknown,
  label: string,
): asserts value is string[] | undefined {
  if (value === undefined) return;
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be a list of one-line strings`);
  }
  if (value.length > GENRE_LIMITS.listMax) {
    throw new Error(
      `${label} has ${value.length} entries; at most ${GENRE_LIMITS.listMax}`,
    );
  }
  value.forEach((item, index) => {
    if (!isOneLineString(item)) {
      throw new Error(`${label}[${index}] must be a non-empty one-line string`);
    }
    if (item.length > GENRE_LIMITS.itemMax) {
      throw new Error(
        `${label}[${index}] is ${item.length} characters; at most ${GENRE_LIMITS.itemMax}`,
      );
    }
  });
}

/**
 * Throws unless the guidance is a required one-line lean plus optional
 * one-line conventions and avoid lists, all within the caps that let the
 * whole declaration ride on the story marker and into every prompt.
 */
export function assertGenreGuidance(
  guidance: unknown,
): asserts guidance is GenreGuidance {
  if (guidance === null || typeof guidance !== "object") {
    throw new Error("genre_guidance must be an object");
  }
  const { lean, conventions, avoid } = guidance as Record<string, unknown>;
  if (!isOneLineString(lean)) {
    throw new Error("genre_guidance.lean must be a non-empty one-line string");
  }
  if (lean.length > GENRE_LIMITS.leanMax) {
    throw new Error(
      `genre_guidance.lean is ${lean.length} characters; at most ${GENRE_LIMITS.leanMax}`,
    );
  }
  assertOneLineList(conventions, "genre_guidance.conventions");
  assertOneLineList(avoid, "genre_guidance.avoid");
  const total =
    lean.length +
    ((conventions as string[] | undefined) ?? []).reduce(
      (sum, item) => sum + item.length,
      0,
    ) +
    ((avoid as string[] | undefined) ?? []).reduce(
      (sum, item) => sum + item.length,
      0,
    );
  if (total > GENRE_LIMITS.guidanceMax) {
    throw new Error(
      `genre_guidance (lean, conventions, avoid) is ${total} characters; at most ${GENRE_LIMITS.guidanceMax}`,
    );
  }
}

/** Throws unless the whole declaration is valid. */
export function assertGenreDeclaration(
  declaration: GenreDeclaration,
): asserts declaration is GenreDeclaration {
  assertGenres(declaration.genres);
  if (declaration.guidance !== undefined) {
    assertGenreGuidance(declaration.guidance);
  }
}

/** Every guidance string, for the injection scan and for rendering. */
export function genreGuidanceStrings(guidance: GenreGuidance): string[] {
  return [
    guidance.lean,
    ...(guidance.conventions ?? []),
    ...(guidance.avoid ?? []),
  ];
}

// ---- lenient read side (the story marker) ----
//
// A hand-edited marker must never carry an arbitrary string into a prompt,
// and must never make a story unresolvable. Anything that does not validate
// is dropped and the story reads as undeclared, matching how the narrator
// profile and the content rating already parse.

/**
 * Parses a `Genre:` marker value, or undefined when it does not validate.
 * Comma-separated is lossless here and only here: a dictionary term is
 * validated kebab-case, so it can never contain the separator. Guidance
 * strings are free prose and get one marker line each instead.
 */
export function parseGenresValue(
  raw: string | undefined,
): string[] | undefined {
  if (!raw) return undefined;
  const genres = raw
    .split(",")
    .map((term) => term.trim())
    .filter((term) => term.length > 0);
  try {
    assertGenres(genres);
    return genres;
  } catch {
    return undefined;
  }
}

/** Assembles guidance from already-split marker values, or undefined when
 * it does not validate. */
export function parseGuidanceValues(
  lean: string | undefined,
  conventions: string[],
  avoid: string[],
): GenreGuidance | undefined {
  if (!lean) return undefined;
  const guidance: GenreGuidance = {
    lean: lean.trim(),
    ...(conventions.length > 0 && { conventions }),
    ...(avoid.length > 0 && { avoid }),
  };
  try {
    assertGenreGuidance(guidance);
    return guidance;
  } catch {
    return undefined;
  }
}
