// One-shot check: does a curated story export's editorial_revision block
// actually describe the revision it's attached to? Written after the
// Living Canon Audit (2026-08-26) found that every one of five stories'
// newest mature-content revision named its parent revision by number in
// `notes`, then appended new content with no number of its own -- so "this
// revision" read as still describing the parent. See
// docs/LIVING_CANON_STANDARD.md section 13, step 11.
//
// Usage:
//   node scripts/verify-provenance.mjs <export-file.json> [<export-file.json> ...]
//   node scripts/verify-provenance.mjs
//     (no args: for every story, checks the most-recently-modified EDITORIAL
//      export -- one carrying an editorial_revision block -- under
//      data/stories/*/exports/ and exports/archive/. Server-written backups
//      have no such block and are not curated derivatives, so a story with
//      only those is reported as SKIP, not FAIL. Since 2026-09-02 the
//      hand-named editorial exports live under exports/archive/.)
//
// Exit code 0 if every checked file passes, 1 if any fails (SKIP is not a
// failure). Naming a server backup explicitly still fails it, on purpose.
//
// Deliberately narrow: this checks one export file's internal consistency
// (does it name itself?), not a diff against its stated parent_derivative.
// It won't catch every possible provenance problem -- see
// LIVING_CANON_STANDARD.md section 2 for the full list of what a curated
// derivative should preserve, most of which still relies on editorial
// judgment this script can't automate (e.g. whether a "revision purpose"
// is actually concise and accurate, not just present).

import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

const REQUIRED_FIELDS = [
  "revision",
  "source_file",
  "final_entity_count",
  "notes",
];

async function findDefaultTargets() {
  const storiesDir = "data/stories";
  let storySlugs;
  try {
    storySlugs = await readdir(storiesDir);
  } catch {
    console.error(`Could not read ${storiesDir} -- run from the repo root.`);
    process.exit(2);
  }

  const targets = [];
  const skipped = [];
  for (const slug of storySlugs) {
    const exportsDir = path.join(storiesDir, slug, "exports");
    const candidates = [];
    for (const dir of [exportsDir, path.join(exportsDir, "archive")]) {
      let files;
      try {
        files = (await readdir(dir)).filter((f) => f.endsWith(".json"));
      } catch {
        continue; // no such dir for this story
      }
      for (const f of files) candidates.push(path.join(dir, f));
    }
    if (candidates.length === 0) continue;
    const editorial = [];
    for (const full of candidates) {
      try {
        const data = JSON.parse(await readFile(full, "utf8"));
        if (data.editorial_revision) {
          editorial.push({ full, mtimeMs: (await stat(full)).mtimeMs });
        }
      } catch {
        // unreadable files are reported when named explicitly; ignore here
      }
    }
    if (editorial.length === 0) {
      skipped.push(
        `${slug}: ${candidates.length} export(s), none carrying an editorial_revision block (server backups only)`,
      );
      continue;
    }
    editorial.sort((a, b) => b.mtimeMs - a.mtimeMs);
    targets.push(editorial[0].full);
  }
  for (const line of skipped) console.log(`SKIP  ${line}`);
  return targets;
}

function checkExport(filePath, data) {
  const problems = [];
  const rev = data.editorial_revision;

  if (!rev) {
    return ["no editorial_revision block exists at all"];
  }

  for (const field of REQUIRED_FIELDS) {
    if (rev[field] === undefined || rev[field] === null || rev[field] === "") {
      problems.push(`missing or empty editorial_revision.${field}`);
    }
  }

  const revisionNumber =
    typeof rev.revision === "number"
      ? rev.revision
      : /^\d+$/.test(String(rev.revision))
        ? Number(rev.revision)
        : null;
  if (revisionNumber !== null && typeof rev.notes === "string") {
    const namesSelf = new RegExp(
      `\\bRevision\\s+${revisionNumber}\\b`,
      "i",
    ).test(rev.notes);
    if (!namesSelf) {
      problems.push(
        `notes never names "Revision ${revisionNumber}" -- likely carried ` +
          `forward from a parent revision's notes with new content appended, ` +
          `not describing this revision by its own number`,
      );
    }
  }

  if (
    typeof rev.final_entity_count === "number" &&
    Array.isArray(data.entities) &&
    rev.final_entity_count !== data.entities.length
  ) {
    problems.push(
      `final_entity_count (${rev.final_entity_count}) does not match the ` +
        `actual entities array length (${data.entities.length})`,
    );
  }

  return problems;
}

async function main() {
  const argFiles = process.argv.slice(2);
  const targets = argFiles.length > 0 ? argFiles : await findDefaultTargets();

  if (targets.length === 0) {
    console.error("No editorial export files found to check.");
    process.exit(argFiles.length > 0 ? 2 : 0);
  }

  let anyFailed = false;
  for (const file of targets) {
    let data;
    try {
      data = JSON.parse(await readFile(file, "utf8"));
    } catch (err) {
      console.log(`FAIL  ${file}`);
      console.log(`      could not read/parse: ${err.message}`);
      anyFailed = true;
      continue;
    }

    const problems = checkExport(file, data);
    if (problems.length === 0) {
      console.log(`OK    ${file}`);
    } else {
      anyFailed = true;
      console.log(`FAIL  ${file}`);
      for (const p of problems) console.log(`      - ${p}`);
    }
  }

  process.exit(anyFailed ? 1 : 0);
}

await main();
