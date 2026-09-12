#!/usr/bin/env node
/**
 * Whole-tree privacy audit over every TRACKED file.
 *
 * The pre-commit hook scans staged content only, so it protects new commits and
 * is structurally blind to what is already committed. That gap is not
 * hypothetical: on 2026-09-04 a commit added the hook's personal-name guard and
 * redacted a real name in the same change, 32 uppercase occurrences across 8
 * files survived it, and nothing re-examined them until 2026-09-12 because the
 * files were never staged again.
 *
 * This script closes that gap. Run it on demand and at phase-end audits.
 *
 *   node scripts/audit-tracked-content.mjs          # report, exit 1 on findings
 *   node scripts/audit-tracked-content.mjs --quiet  # exit code only
 *
 * Patterns come from git config, never from this file, because this file is
 * committed and naming the strings here would publish exactly what the audit
 * exists to keep out:
 *
 *   git config fleet.personalNames  'Surname,Given Surname'
 *   git config fleet.internalHosts  'my-nas,my-router'
 *   git config fleet.privateNames   'Story One,Some Character'
 *
 * `fleet.privateNames` is this repo's addition: storyline, character and place
 * names that belong in gitignored `data/`, never in committed paths.
 *
 * Nothing here runs in CI: CI has no access to that local config, so a clean CI
 * run proves nothing about these patterns. This is a local tool by design.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const quiet = process.argv.includes("--quiet");

function git(args) {
  try {
    return execFileSync("git", args, { encoding: "utf8" });
  } catch {
    return "";
  }
}

function configList(key) {
  return git(["config", "--get", key])
    .trim()
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

const SOURCES = [
  { key: "fleet.personalNames", label: "personal name" },
  { key: "fleet.internalHosts", label: "internal host" },
  { key: "fleet.privateNames", label: "private story name" },
];

const rules = SOURCES.flatMap(({ key, label }) =>
  configList(key).map((value) => ({
    label,
    key,
    // Case-insensitive: a name inside a SCREAMING_SNAKE constant must match.
    re: new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
    value,
  })),
);

if (rules.length === 0) {
  console.error(
    "No patterns configured. Set at least one of:\n" +
      SOURCES.map((s) => `  git config ${s.key} '<comma,separated>'`).join(
        "\n",
      ),
  );
  process.exit(2);
}

const BINARY =
  /\.(png|jpe?g|gif|ico|webp|woff2?|ttf|eot|pdf|zip|gz|mp4|wasm)$/i;
const files = git(["ls-files", "-z"]).split("\0").filter(Boolean);

let findings = 0;
const byFile = new Map();

for (const file of files) {
  if (BINARY.test(file)) continue;
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    continue; // unreadable or genuinely binary
  }
  const lines = text.split(/\r?\n/);
  for (const rule of rules) {
    lines.forEach((line, i) => {
      if (!rule.re.test(line)) return;
      findings += 1;
      if (!byFile.has(file)) byFile.set(file, []);
      // Never print the matched value itself — that would defeat the purpose.
      byFile.get(file).push(`    line ${i + 1}: ${rule.label} (${rule.key})`);
    });
  }
}

if (findings === 0) {
  if (!quiet) console.log(`Clean: ${files.length} tracked files, 0 findings.`);
  process.exit(0);
}

if (!quiet) {
  console.error(
    `\n${findings} finding(s) in ${byFile.size} tracked file(s):\n`,
  );
  for (const [file, hits] of byFile) {
    console.error(`  ${file}`);
    for (const hit of hits.slice(0, 5)) console.error(hit);
    if (hits.length > 5) console.error(`    ... and ${hits.length - 5} more`);
  }
  console.error(
    "\nThese are already committed, so removing them now does not remove them" +
      "\nfrom git history. Scrub the working tree first, then decide separately" +
      "\nwhether the history needs rewriting.\n",
  );
}
process.exit(1);
