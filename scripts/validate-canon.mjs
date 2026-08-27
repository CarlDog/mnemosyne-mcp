// Structural validation for a story's data/stories/<slug>/canon/ tree:
// every file's frontmatter actually parses, no duplicate (type, name)
// pairs anywhere (across one-file-per-entity files AND headings inside
// the batched/multi-entity files), no empty entities. This does not
// validate CONTENT (truth-tier violations, cross-story leaks, prose
// quality) -- that needs a human or an adversarial review pass, the same
// way the Living Canon Audit did it. This only validates structure.
//
// Usage:
//   node scripts/validate-canon.mjs <slug> [--dir <canon-dir>]

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

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
  } catch {
    return [];
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
      claim(type, parsed.fields.name.replace(/^"|"$/g, ""), rel);
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
    } catch {
      continue;
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

await main();
