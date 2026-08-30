// Structural validation for a story's data/stories/<slug>/canon/ tree:
// every file's frontmatter actually parses, no duplicate (type, name)
// pairs anywhere (across one-file-per-entity files AND headings inside
// the batched/multi-entity files), no empty entities. This does not
// validate CONTENT (truth-tier violations, cross-story leaks, prose
// quality) -- that needs a human or an adversarial review pass, the same
// way the Living Canon Audit did it. This only validates structure.
//
// Exit contract: 0 only when the canon/ tree EXISTS, is readable, holds at
// least one entity, and has no structural problems. A missing directory, an
// unreadable one, or an empty one exits 1 -- so a sweep over every slug can be
// trusted as a restore/integrity check.
//
// Usage:
//   node scripts/validate-canon.mjs <slug> [--dir <canon-dir>]

import { lstat, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { parseCanonScalar } from "./canon-frontmatter.mjs";
import { fileURLToPath } from "node:url";

const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;
const SCENE_CATALOG_KEY_RE = /^[A-Z0-9]+(?:-[A-Z0-9]+){3}$/;
const ISO_WITH_OFFSET_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const BATCH_METADATA_RE =
  /^<!--\s*mnemosyne-meta:\s*(\{[^\r\n]*\})\s*-->\s*(?:\n|$)/;

// Normalizes CRLF to LF so a file saved by a Windows-native editor doesn't
// fail the frontmatter check purely on line-ending grounds.
function normalizeNewlines(text) {
  return text.replace(/\r\n/g, "\n");
}

function parseArgs(argv) {
  const [slug, ...rest] = argv;
  let dir = null;
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] !== "--dir" || dir !== null || !rest[i + 1]) {
      throw new Error(
        "usage: node scripts/validate-canon.mjs <slug> [--dir <canon-dir>]",
      );
    }
    dir = rest[++i];
  }
  if (!slug || !SLUG_RE.test(slug)) {
    throw new Error(
      "usage: node scripts/validate-canon.mjs <slug> [--dir <canon-dir>] " +
        "(slug must start with a lowercase letter or digit and contain only " +
        "lowercase letters, digits, and hyphens)",
    );
  }
  // Resolved against this script's location, not the cwd. A cwd-relative
  // default made a run from the wrong directory report "canon directory does
  // not exist" for every slug -- so an all-slug sweep, which CLAUDE.md sells
  // as a trustworthy integrity check, would claim all eleven stories had lost
  // their canon. An explicit --dir is still honored as given.
  const defaultDir = fileURLToPath(
    new URL(`../data/stories/${slug}/canon`, import.meta.url),
  );
  return { slug, dir: dir ?? defaultDir };
}

function parseFrontmatter(content, file) {
  if (!content.startsWith("---\n")) {
    return {
      error: `${file}: does not start with a frontmatter block ("---")`,
    };
  }
  const lines = content.split("\n");
  const closingLine = lines.findIndex(
    (line, index) => index > 0 && line === "---",
  );
  if (closingLine === -1) {
    return { error: `${file}: frontmatter opened but never closed` };
  }
  const fields = Object.create(null);
  const fmLines = lines.slice(1, closingLine);
  for (let index = 0; index < fmLines.length; index += 1) {
    const line = fmLines[index];
    if (!line.trim()) continue;
    const m = line.match(/^([a-z_][a-z0-9_]*):\s*(.*)$/);
    if (!m) {
      return {
        error: `${file}: unparseable frontmatter line: ${JSON.stringify(line)}`,
      };
    }
    if (Object.hasOwn(fields, m[1])) {
      return {
        error: `${file}: duplicate frontmatter key ${JSON.stringify(m[1])}`,
      };
    }
    let rawValue = m[2];
    if (!rawValue.trim() && fmLines[index + 1]?.trimStart().startsWith("[")) {
      index += 1;
      rawValue = fmLines[index].trim();
    }
    if (
      rawValue.trimStart().startsWith("[") &&
      !rawValue.trimEnd().endsWith("]")
    ) {
      const parts = [rawValue];
      let closed = false;
      while (index + 1 < fmLines.length) {
        index += 1;
        const continuation = fmLines[index].trim();
        parts.push(continuation);
        if (continuation.endsWith("]")) {
          closed = true;
          break;
        }
      }
      if (!closed) {
        return {
          error:
            file +
            ": frontmatter array " +
            JSON.stringify(m[1]) +
            " is missing its closing bracket",
        };
      }
      rawValue = parts.join(" ");
    }
    fields[m[1]] = rawValue;
  }
  const body = lines
    .slice(closingLine + 1)
    .join("\n")
    .trimStart();
  return { fields, body };
}

async function walkEntityFiles(dir, subdir) {
  const full = path.join(dir, subdir);
  let fullStat;
  try {
    fullStat = await lstat(full);
  } catch (err) {
    if (err.code === "ENOENT") return [];
    throw new Error(
      `${full}: cannot inspect directory (${err.code ?? err.message})`,
      { cause: err },
    );
  }
  if (fullStat.isSymbolicLink() || !fullStat.isDirectory()) {
    throw new Error(`${full}: expected a real directory, not a link`);
  }
  let entries;
  try {
    entries = await readdir(full, { withFileTypes: true });
  } catch (err) {
    // An absent category folder is legitimate -- not every story has
    // locations/ or worldbuilding/. Anything else (permissions, I/O error,
    // a corrupted directory entry) must NOT read as "empty": that is how a
    // damaged tree passes validation.
    if (err.code === "ENOENT") return [];
    throw new Error(
      `${full}: cannot read directory (${err.code ?? err.message})`,
      { cause: err },
    );
  }
  const files = [];
  for (const e of entries) {
    const lower = e.name.toLowerCase();
    if (e.isDirectory() && (e.name === "_control" || e.name.startsWith("_"))) {
      continue;
    }
    if (
      lower === "readme.md" ||
      (e.name.startsWith("_") && lower.endsWith(".md"))
    ) {
      continue;
    }
    const child = path.join(full, e.name);
    if (e.isSymbolicLink()) {
      throw new Error(
        `${child}: symbolic links are outside canon path authority`,
      );
    }
    if (e.isDirectory()) {
      files.push(...(await walkEntityFiles(dir, path.join(subdir, e.name))));
    } else if (e.isFile() && lower.endsWith(".md")) {
      files.push(path.join(subdir, e.name));
    }
  }
  return files;
}

function extractBatchSections(text) {
  const lines = text.split("\n");
  const headings = [];
  let fence = null;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const fenceMatch = line.match(/^\s*(`{3,}|~{3,})/);
    if (fenceMatch) {
      const run = fenceMatch[1];
      const marker = run[0];
      if (fence === null) {
        fence = { marker, length: run.length, line: index + 1, run };
      } else if (fence.marker === marker && run.length >= fence.length) {
        fence = null;
      }
      continue;
    }
    if (fence !== null) continue;
    const heading = line.match(/^##\s+(.+?)\s*$/);
    if (heading) headings.push({ index, name: heading[1].trim() });
  }
  const sections = headings.map((heading, index) => {
    const rawBody = lines
      .slice(heading.index + 1, headings[index + 1]?.index ?? lines.length)
      .join("\n")
      .trim();
    const metadataMatch = rawBody.match(BATCH_METADATA_RE);
    return {
      name: heading.name,
      line: heading.index + 1,
      body: metadataMatch
        ? rawBody.slice(metadataMatch[0].length).trim()
        : rawBody,
      hasMetadata: metadataMatch !== null,
    };
  });
  return { sections, unterminatedFence: fence };
}

function parseStringScalar(raw, file, field, problems) {
  let value;
  try {
    value = parseCanonScalar(raw);
  } catch (error) {
    problems.push(
      `${file}: frontmatter ${JSON.stringify(field)} is invalid: ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  }
  if (typeof value !== "string") {
    problems.push(
      `${file}: frontmatter ${JSON.stringify(field)} must be a string`,
    );
    return null;
  }
  return value;
}

async function main() {
  const { slug, dir } = parseArgs(process.argv.slice(2));

  // A missing canon/ tree must FAIL, not pass vacuously. Before this guard the
  // script printed "OK -- no structural problems found" and exited 0 against a
  // directory that did not exist, because every readdir below swallowed its
  // ENOENT and returned []. That made a pass useless as a restore check: it
  // could not tell an intact tree from a lost one.
  let dirStat;
  try {
    dirStat = await lstat(dir);
  } catch (err) {
    if (err.code === "ENOENT") {
      throw new Error(
        `${dir}: canon directory does not exist (story "${slug}" has no canon/ tree)`,
        { cause: err },
      );
    }
    throw new Error(
      `${dir}: cannot stat canon directory (${err.code ?? err.message})`,
      { cause: err },
    );
  }
  if (dirStat.isSymbolicLink() || !dirStat.isDirectory()) {
    throw new Error(`${dir}: canon root must be a real directory, not a link`);
  }

  const problems = [];
  const seen = new Map(); // (type,name) -> first file that claimed it
  const seenSceneCatalogKeys = new Map();
  let entityCount = 0;

  function claim(type, name, file) {
    entityCount++;
    const key = `${type}::${name.toLowerCase()}`;
    if (seen.has(key)) {
      problems.push(
        `DUPLICATE (${type}, "${name}"): claimed by both ${seen.get(key)} and ${file}`,
      );
    } else {
      seen.set(key, file);
    }
  }

  // One-file-per-entity categories.
  for (const subdir of [
    "characters",
    "locations",
    "lore",
    "scenes",
    "worldbuilding",
  ]) {
    for (const rel of await walkEntityFiles(dir, subdir)) {
      const file = path.join(dir, rel);
      const content = normalizeNewlines(await readFile(file, "utf8"));
      const parsed = parseFrontmatter(content, rel);
      if (parsed.error) {
        problems.push(parsed.error);
        continue;
      }
      if (!Object.hasOwn(parsed.fields, "name")) {
        problems.push(`${rel}: frontmatter has no "name" field`);
        continue;
      }
      const name = parseStringScalar(parsed.fields.name, rel, "name", problems);
      if (name === null) continue;
      if (!name.trim() || /\r|\n/.test(name)) {
        problems.push(`${rel}: frontmatter has no "name" field`);
        continue;
      }
      if (!parsed.body.trim()) {
        problems.push(`${rel}: has a name but no body content`);
      }
      if (subdir === "scenes") {
        if (!parsed.fields.catalog_key) {
          problems.push(`${rel}: scene frontmatter has no "catalog_key" field`);
        } else {
          const catalogKey = parseStringScalar(
            parsed.fields.catalog_key,
            rel,
            "catalog_key",
            problems,
          );
          if (catalogKey !== null) {
            if (!SCENE_CATALOG_KEY_RE.test(catalogKey)) {
              problems.push(
                `${rel}: scene catalog_key ${JSON.stringify(catalogKey)} must be four uppercase alphanumeric segments separated by hyphens`,
              );
            }
            const expectedPrefix = `${catalogKey.toLowerCase()}--`;
            const basename = path.basename(rel);
            if (!basename.startsWith(expectedPrefix)) {
              problems.push(
                `${rel}: filename must start with ${JSON.stringify(expectedPrefix)} from catalog_key`,
              );
            }
            const normalizedKey = catalogKey.toLowerCase();
            if (seenSceneCatalogKeys.has(normalizedKey)) {
              problems.push(
                `DUPLICATE scene catalog_key ${JSON.stringify(catalogKey)}: claimed by both ${seenSceneCatalogKeys.get(normalizedKey)} and ${rel}`,
              );
            } else {
              seenSceneCatalogKeys.set(normalizedKey, rel);
            }
          }
        }
        if (!parsed.fields.created_at) {
          problems.push(`${rel}: scene frontmatter requires "created_at"`);
        } else {
          const createdAt = parseStringScalar(
            parsed.fields.created_at,
            rel,
            "created_at",
            problems,
          );
          if (createdAt !== null) {
            if (
              !ISO_WITH_OFFSET_RE.test(createdAt) ||
              Number.isNaN(Date.parse(createdAt))
            ) {
              problems.push(
                `${rel}: scene created_at must be an ISO datetime with Z or an explicit offset`,
              );
            }
          }
        }
      }
      const type =
        subdir === "characters"
          ? "character"
          : subdir === "locations"
            ? "location"
            : subdir === "scenes"
              ? "scene"
              : subdir;
      claim(type, name, rel);
    }
  }

  // Batched multi-entity files: one heading = one entity.
  for (const [file, type] of [
    ["characters/_minor.md", "character"],
    ["rules.md", "rule"],
    ["style.md", "style"],
  ]) {
    const full = path.join(dir, file);
    let content;
    try {
      const fileStat = await lstat(full);
      if (fileStat.isSymbolicLink() || !fileStat.isFile()) {
        throw new Error(`${full}: expected a real file, not a link`);
      }
      content = normalizeNewlines(await readFile(full, "utf8"));
    } catch (err) {
      // Absent is fine -- not every story batches minor characters, and
      // rules/style may not exist yet. Unreadable is not.
      if (err.code === "ENOENT") continue;
      if (err.message?.includes("expected a real file, not a link")) {
        throw err;
      }
      throw new Error(
        `${full}: cannot read file (${err.code ?? err.message})`,
        { cause: err },
      );
    }
    const { sections, unterminatedFence } = extractBatchSections(content);
    if (unterminatedFence) {
      problems.push(
        `${file}:${unterminatedFence.line}: unterminated fenced code block opened with ${JSON.stringify(unterminatedFence.run)}`,
      );
    }
    if (sections.length === 0) {
      problems.push(
        `${file}: exists but has no "## " headings -- nothing would import from it`,
      );
    }
    const localSeen = new Set();
    for (const section of sections) {
      if (!section.body) {
        problems.push(
          section.hasMetadata
            ? `${file}:${section.line}: "## ${section.name}" has metadata but no body`
            : `${file}:${section.line}: "## ${section.name}" has an empty body`,
        );
      }
      if (localSeen.has(section.name)) {
        problems.push(
          `${file}: duplicate heading "## ${section.name}" within the same file`,
        );
      }
      localSeen.add(section.name);
      claim(type, section.name, file);
    }
  }

  if (entityCount === 0) {
    problems.push(
      `${dir}: canon directory exists but contains no entities at all`,
    );
  }

  console.log(`Validated ${slug} -> ${dir}`);
  console.log(`  total entities claimed: ${entityCount}`);
  console.log(`  unique (type, name) keys: ${seen.size}`);
  if (problems.length === 0) {
    console.log("  OK -- no structural problems found");
    process.exit(0);
  } else {
    console.log(`  ${problems.length} problem(s):`);
    for (const p of problems) console.log(`    - ${p}`);
    process.exit(1);
  }
}

await main().catch((err) => {
  console.error(`validate-canon: ${err.message}`);
  process.exit(1);
});
