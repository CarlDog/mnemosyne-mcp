// One-time migration: read a story's export JSON (optionally merging in a
// sibling revision that forked from the same parent -- see --merge), and
// write the multi-file data/stories/<slug>/canon/ tree docs/DATA_LAYOUT.md
// documents. This is the scaffold half of the canon/ workflow; the compile
// half (canon/ -> mnemo_import_story) is a separate, not-yet-built script.
//
// Usage:
//   node scripts/scaffold-story.mjs <slug> --base <export.json> \
//     [--merge <file>|<ancestor>] [--out <dir>] [--core-threshold <n>]
//
// --merge <file>|<ancestor> resolves a sibling-revision fork: both <file>
// and the base must trace back to the same <ancestor> export. Separated by
// "|", not ":" -- a colon collides with a Windows drive letter the moment
// someone passes an absolute path instead of a relative one, and "|" is
// illegal in a Windows filename so it can never be ambiguous. For each
// entity, if <file>'s content is <ancestor>'s content plus a clean
// trailing suffix, and the base's version of that entity doesn't already
// contain that suffix, the suffix is appended to the base's content.
// Entities where <file> is NOT a clean append over <ancestor> are left
// alone and reported -- this tool never guesses at a real merge conflict.
//
// Known limitation: only `character` entities get real frontmatter
// extraction (parsed from their leading "Label: value" header lines) and
// heading normalization toward the unified template's section names.
// location/lore/worldbuilding entities are written one-file-per-entity
// with a minimal `name:` frontmatter and their body kept verbatim --
// their own header conventions (bold-label lines, italic taglines) differ
// enough from characters' that a shared parser would be guessing, not
// parsing.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

function parseArgs(argv) {
  const [slug, ...rest] = argv;
  const opts = { merges: [], out: null, coreThreshold: 2500 };
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === "--base") opts.base = rest[++i];
    else if (a === "--merge") opts.merges.push(rest[++i]);
    else if (a === "--out") opts.out = rest[++i];
    else if (a === "--core-threshold") opts.coreThreshold = Number(rest[++i]);
    else throw new Error(`unknown arg: ${a}`);
  }
  if (!slug || !opts.base) {
    throw new Error(
      "usage: node scripts/scaffold-story.mjs <slug> --base <export.json> " +
        "[--merge <file>|<ancestor>] [--out <dir>] [--core-threshold <n>]",
    );
  }
  opts.out ??= `data/stories/${slug}/canon`;
  return { slug, ...opts };
}

// type never contains a space (it's one of mnemosyne's fixed entity-type
// strings), so splitting on the FIRST space cleanly separates it from a
// name that may itself contain spaces -- unlike a naive split(" ") on every
// space, which mangles any multi-word name.
function splitKey(k) {
  const i = k.indexOf(" ");
  return i === -1 ? [k, ""] : [k.slice(0, i), k.slice(i + 1)];
}

async function loadExport(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

function key(e) {
  return `${e.type} ${e.name}`;
}

function toMap(exportDoc) {
  const m = new Map();
  for (const e of exportDoc.entities) m.set(key(e), e);
  return m;
}

// Resolves a fork: for every entity in mergeMap, if its content is a clean
// append over ancestorMap's version, and baseMap's version doesn't already
// have that suffix, append it. Mutates baseMap in place. Returns a report.
function mergeFork(baseMap, mergeMap, ancestorMap, sourceLabel) {
  const report = {
    appended: [],
    skippedAlreadyPresent: [],
    notCleanAppend: [],
    newInMerge: [],
  };
  for (const [k, mergeEntity] of mergeMap) {
    const ancestorEntity = ancestorMap.get(k);
    const baseEntity = baseMap.get(k);
    if (!ancestorEntity) {
      report.newInMerge.push(k);
      continue;
    }
    if (!mergeEntity.content.startsWith(ancestorEntity.content)) {
      report.notCleanAppend.push(k);
      continue;
    }
    const suffix = mergeEntity.content.slice(ancestorEntity.content.length);
    if (!suffix.trim()) continue;
    if (!baseEntity) continue; // entity doesn't exist in base at all -- leave for human review
    if (baseEntity.content.includes(suffix)) {
      report.skippedAlreadyPresent.push(k);
      continue;
    }
    baseEntity.content += suffix;
    report.appended.push({
      key: k,
      source: sourceLabel,
      suffixPreview: suffix.slice(0, 80),
    });
  }
  return report;
}

// Splits a character's content into a leading "Label: value" header block
// and the remaining Markdown body. Stops at the first blank line followed
// by a `## ` heading, or the first `## ` heading if there's no blank line.
//
// A header line that doesn't match the "Label: value" shape is NOT
// dropped -- it's folded back onto the front of the body instead. Every
// core character checked so far happens to have a clean header block, but
// nothing guarantees the next story's does, and silently discarding a line
// that didn't parse is exactly the kind of loss this whole tool exists to
// prevent.
function splitHeaderBody(content) {
  const lines = content.split("\n");
  let splitAt = lines.length;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith("## ")) {
      splitAt = i;
      break;
    }
  }
  const headerLines = lines.slice(0, splitAt).filter((l) => l.trim() !== "");
  let body = lines.slice(splitAt).join("\n").trim();

  const frontmatter = {};
  const unparsed = [];
  for (const line of headerLines) {
    const m = line.match(/^([A-Za-z][A-Za-z /]*):\s*(.*)$/);
    if (!m) {
      unparsed.push(line);
      continue;
    }
    const fmKey = m[1].trim().toLowerCase().replace(/\s+/g, "_");
    frontmatter[fmKey] = m[2].trim();
  }
  if (unparsed.length > 0) {
    body = `${unparsed.join("\n")}\n\n${body}`.trim();
  }
  return { frontmatter, body };
}

const HEADING_RENAMES = new Map([
  ["## interpersonal dynamics:", "## Relationships"],
  ["## interpersonal dynamics", "## Relationships"],
  ["## tattoos/piercings:", "## Tattoos / Piercings"],
  ["## tattoos/piercings", "## Tattoos / Piercings"],
  ["## scene behavior & live hooks:", "## Hooks"],
  ["## scene behavior & live hooks", "## Hooks"],
]);

function normalizeHeadings(body) {
  return body
    .split("\n")
    .map((line) => {
      const lower = line.trim().toLowerCase();
      return HEADING_RENAMES.get(lower) ?? line;
    })
    .join("\n");
}

function toYamlScalar(v) {
  // Must start with a word character specifically, not just any char in the
  // allowed set -- a leading "-", quote, or space is a YAML plain-scalar
  // indicator and would be ambiguous left unquoted (e.g. "- test" reads as
  // a block-sequence item, not a string starting with a hyphen).
  if (/^\w[\w' -]*$/.test(v) && !v.includes(": ")) return v;
  return JSON.stringify(v);
}

function renderFrontmatter(fields) {
  const lines = ["---"];
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined || v === null || v === "") continue;
    lines.push(`${k}: ${toYamlScalar(v)}`);
  }
  lines.push("---");
  return lines.join("\n");
}

async function writeCoreCharacter(outDir, entity, threshold) {
  const { frontmatter, body } = splitHeaderBody(entity.content);
  frontmatter.name ??= entity.name;
  const slug = entity.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const file = path.join(outDir, "characters", `${slug}.md`);
  const rendered = `${renderFrontmatter(frontmatter)}\n\n${normalizeHeadings(body)}\n`;
  await writeFile(file, rendered, "utf8");
  return file;
}

// A minor entity's own content sometimes contains its own "## " sub-headings
// (e.g. "## Visual Presence" / "## Encounter Presence") -- demote those to
// "### " so they can't be mistaken for the next entity's heading. Without
// this, a batched file has no way to tell "new entity" from "subsection of
// the current one" apart, since both are bare "## " lines.
function demoteHeadings(body) {
  return body.replace(/^## /gm, "### ");
}

async function appendMinorCharacter(minorLines, entity) {
  minorLines.push(
    `## ${entity.name}\n\n${demoteHeadings(entity.content.trim())}\n`,
  );
}

async function writeSimpleEntity(outDir, subdir, entity) {
  const slug = entity.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const file = path.join(outDir, subdir, `${slug}.md`);
  const rendered = `---\nname: ${toYamlScalar(entity.name)}\n---\n\n${entity.content.trim()}\n`;
  await writeFile(file, rendered, "utf8");
  return file;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  const base = await loadExport(opts.base);
  const baseMap = toMap(base);

  const mergeReports = [];
  for (const spec of opts.merges) {
    const [mergeFile, ancestorFile] = spec.split("|");
    if (!mergeFile || !ancestorFile) {
      throw new Error(`--merge expects <file>|<ancestor>, got: ${spec}`);
    }
    const mergeDoc = await loadExport(mergeFile);
    const ancestorDoc = await loadExport(ancestorFile);
    const report = mergeFork(
      baseMap,
      toMap(mergeDoc),
      toMap(ancestorDoc),
      path.basename(mergeFile),
    );
    mergeReports.push({ source: mergeFile, ancestor: ancestorFile, ...report });
  }

  for (const dir of [
    "characters",
    "locations",
    "lore",
    "lore/objects",
    "worldbuilding",
  ]) {
    await mkdir(path.join(opts.out, dir), { recursive: true });
  }

  const written = {
    core: [],
    minor: 0,
    locations: [],
    lore: [],
    worldbuilding: [],
  };
  const minorLines = [];
  const rulesLines = [];
  const styleLines = [];

  for (const entity of baseMap.values()) {
    if (entity.type === "character") {
      if (entity.content.length >= opts.coreThreshold) {
        written.core.push(
          await writeCoreCharacter(opts.out, entity, opts.coreThreshold),
        );
      } else {
        await appendMinorCharacter(minorLines, entity);
        written.minor++;
      }
    } else if (entity.type === "location") {
      written.locations.push(
        await writeSimpleEntity(opts.out, "locations", entity),
      );
    } else if (entity.type === "lore") {
      written.lore.push(await writeSimpleEntity(opts.out, "lore", entity));
    } else if (entity.type === "worldbuilding") {
      written.worldbuilding.push(
        await writeSimpleEntity(opts.out, "worldbuilding", entity),
      );
    } else if (entity.type === "rule") {
      rulesLines.push(`## ${entity.name}\n\n${entity.content.trim()}\n`);
    } else if (entity.type === "style") {
      styleLines.push(`## ${entity.name}\n\n${entity.content.trim()}\n`);
    } else if (entity.type === "scene") {
      // deliberately excluded from canon/ -- generated output, not hand-authored (see DATA_LAYOUT.md)
    }
  }

  if (minorLines.length > 0) {
    await writeFile(
      path.join(opts.out, "characters", "_minor.md"),
      minorLines.join("\n"),
      "utf8",
    );
  }
  if (rulesLines.length > 0) {
    await writeFile(
      path.join(opts.out, "rules.md"),
      rulesLines.join("\n"),
      "utf8",
    );
  }
  if (styleLines.length > 0) {
    await writeFile(
      path.join(opts.out, "style.md"),
      styleLines.join("\n"),
      "utf8",
    );
  }

  console.log(`Scaffolded ${opts.slug} -> ${opts.out}`);
  console.log(`  core characters: ${written.core.length}`);
  console.log(`  minor characters (batched): ${written.minor}`);
  console.log(`  locations: ${written.locations.length}`);
  console.log(`  lore: ${written.lore.length}`);
  console.log(`  worldbuilding: ${written.worldbuilding.length}`);
  console.log(`  rules: ${rulesLines.length}, style: ${styleLines.length}`);

  for (const r of mergeReports) {
    console.log(`\nMerge report: ${r.source} (ancestor ${r.ancestor})`);
    console.log(`  appended: ${r.appended.length}`);
    console.log(
      `  already present (skipped): ${r.skippedAlreadyPresent.length}`,
    );
    if (r.notCleanAppend.length > 0) {
      console.log(
        `  NOT a clean append -- needs manual review: ${r.notCleanAppend.length}`,
      );
      for (const k of r.notCleanAppend) {
        const [t, n] = splitKey(k);
        console.log(`    - ${t}: ${n}`);
      }
    }
    if (r.newInMerge.length > 0) {
      console.log(
        `  new in merge source (no ancestor entity) -- needs manual review: ${r.newInMerge.length}`,
      );
      for (const k of r.newInMerge) {
        const [t, n] = splitKey(k);
        console.log(`    - ${t}: ${n}`);
      }
    }
  }
}

await main();
