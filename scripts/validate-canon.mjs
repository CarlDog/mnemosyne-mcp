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

import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fromCanonScalar } from "./canon-frontmatter.mjs";

// Normalizes CRLF to LF so a file saved by a Windows-native editor doesn't
// fail the frontmatter check purely on line-ending grounds.
function normalizeNewlines(text) {
  return text.replace(/\r\n/g, "\n");
}

function parseArgs(argv) {
  const [slug, ...rest] = argv;
  let dir = null;
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === "--dir") dir = rest[++i];
  }
  if (!slug) {
    throw new Error(
      "usage: node scripts/validate-canon.mjs <slug> [--dir <canon-dir>]",
    );
  }
  return { slug, dir: dir ?? `data/stories/${slug}/canon` };
}

function parseFrontmatter(content, file) {
  if (!content.startsWith("---\n")) {
    return {
      error: `${file}: does not start with a frontmatter block ("---")`,
    };
  }
  const end = content.indexOf("\n---", 4);
  if (end === -1) {
    return { error: `${file}: frontmatter opened but never closed` };
  }
  const fmBlock = content.slice(4, end);
  const fields = {};
  for (const line of fmBlock.split("\n")) {
    if (!line.trim()) continue;
    const m = line.match(/^([a-z_]+):\s*(.*)$/);
    if (!m) {
      return {
        error: `${file}: unparseable frontmatter line: ${JSON.stringify(line)}`,
      };
    }
    fields[m[1]] = m[2];
  }
  const body = content.slice(end + 4).trimStart();
  return { fields, body };
}

async function walkEntityFiles(dir, subdir) {
  const full = path.join(dir, subdir);
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
    );
  }
  const files = [];
  for (const e of entries) {
    if (e.isDirectory()) {
      files.push(...(await walkEntityFiles(dir, path.join(subdir, e.name))));
    } else if (
      e.name.endsWith(".md") &&
      !e.name.startsWith("_") &&
      e.name !== "README.md"
    ) {
      files.push(path.join(subdir, e.name));
    }
  }
  return files;
}

function extractHeadings(text) {
  return [...text.matchAll(/^## (.+)$/gm)].map((m) => m[1].trim());
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
    dirStat = await stat(dir);
  } catch (err) {
    if (err.code === "ENOENT") {
      throw new Error(
        `${dir}: canon directory does not exist (story "${slug}" has no canon/ tree)`,
      );
    }
    throw new Error(
      `${dir}: cannot stat canon directory (${err.code ?? err.message})`,
    );
  }
  if (!dirStat.isDirectory()) {
    throw new Error(`${dir}: exists but is not a directory`);
  }

  const problems = [];
  const seen = new Map(); // (type,name) -> first file that claimed it
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
  for (const subdir of ["characters", "locations", "lore", "worldbuilding"]) {
    for (const rel of await walkEntityFiles(dir, subdir)) {
      const file = path.join(dir, rel);
      const content = normalizeNewlines(await readFile(file, "utf8"));
      const parsed = parseFrontmatter(content, rel);
      if (parsed.error) {
        problems.push(parsed.error);
        continue;
      }
      if (!parsed.fields.name) {
        problems.push(`${rel}: frontmatter has no "name" field`);
        continue;
      }
      if (!parsed.body.trim()) {
        problems.push(`${rel}: has a name but no body content`);
      }
      const type =
        subdir === "characters"
          ? "character"
          : subdir === "locations"
            ? "location"
            : subdir;
      claim(type, fromCanonScalar(parsed.fields.name), rel);
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
      content = normalizeNewlines(await readFile(full, "utf8"));
    } catch (err) {
      // Absent is fine -- not every story batches minor characters, and
      // rules/style may not exist yet. Unreadable is not.
      if (err.code === "ENOENT") continue;
      throw new Error(`${full}: cannot read file (${err.code ?? err.message})`);
    }
    const headings = extractHeadings(content);
    if (headings.length === 0) {
      problems.push(
        `${file}: exists but has no "## " headings -- nothing would import from it`,
      );
    }
    const localSeen = new Set();
    for (const h of headings) {
      if (localSeen.has(h)) {
        problems.push(
          `${file}: duplicate heading "## ${h}" within the same file`,
        );
      }
      localSeen.add(h);
      claim(type, h, file);
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
