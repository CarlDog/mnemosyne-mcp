// The canon/ frontmatter scalar format, defined in ONE place.
//
// Writer and reader of a serialization format have to agree exactly, and they
// did not: scaffold-story.mjs wrote values with JSON.stringify while
// validate-canon.mjs read them back by stripping the outer quotes with a
// regex. Any value containing a quote therefore round-tripped with its
// backslashes intact -- e.g. battlechasers' Lilith came back as
//   Lilith (... \"Vaelorian\" ...)
// which silently became the entity's dedup key and the text of every
// DUPLICATE / error message about it. 55 canon files use the quoted form.
//
// Both scripts now import from here so the pair cannot drift again.

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
  if (/^\w[\w' -]*$/.test(value) && !value.includes(": ")) return value;
  return JSON.stringify(value);
}

/**
 * Parse a frontmatter scalar back to its value -- the exact inverse of
 * toCanonScalar.
 *
 * A double-quoted value is JSON, so unescaping is JSON.parse, not a quote
 * strip. A malformed quoted value falls back to the old strip rather than
 * throwing: this runs inside a validator whose job is to report problems, and
 * a parse crash would hide every other finding in the file.
 */
export function fromCanonScalar(raw) {
  const value = raw.trim();
  if (!value.startsWith('"')) return value;
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === "string" ? parsed : value;
  } catch {
    return value.replace(/^"|"$/g, "");
  }
}
