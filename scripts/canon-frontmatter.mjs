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
