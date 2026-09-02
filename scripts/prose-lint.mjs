#!/usr/bin/env node
// Mechanical checks for a prose chapter against its brief and the story's
// prose rules. Catches what a grep can catch so the adversarial review can
// spend itself on what only a reader sees. Story-agnostic: every list it
// checks comes from the brief's frontmatter or from an optional
// `prose-lint.json` beside the brief (see docs/PROSE_PIPELINE.md).
//
// Usage:
//   node scripts/prose-lint.mjs <chapter.md> [--brief <brief.md>] [--json]
//
// Exit 1 on any error-level finding; warnings never fail the run.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULTS = {
  // Narrator looking forward in time (rule 5).
  prolepsis: [
    "would later",
    "later, she would",
    "later she would",
    "for the rest of her life",
    "for the rest of his life",
    "she would decide",
    "she would think about",
    "she would remember",
    "she would not use",
    "she would come to",
    "in the months that followed",
    "in the years that followed",
    "for the next fourteen months",
    "it belongs to the next chapter",
  ],
  // Vocabulary that belongs to the outline, not the book (rule 6).
  editorial: [
    "cutoff",
    "ledger question",
    "engine",
    "canon",
    "point of view",
    "the outline",
  ],
  // Refrains the rules ban outright (rule 17).
  refrains: [
    "that was the thing",
    "that is the thing",
    "the thing she would remember",
    "the thing she noted",
  ],
  // Simile constructions counted against a budget (rule 18).
  similes: ["the way ", "as one ", "as a woman ", "as a man "],
  simileBudget: 3,
  // Words the narrator may not use to name the engines (rule 7).
  engineNaming: ["the horror of it", "the heat of it", "the mystery of it"],
};

function parseArgs(argv) {
  const o = { chapter: null, brief: null, json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--brief") o.brief = argv[++i];
    else if (a === "--json") o.json = true;
    else if (!o.chapter) o.chapter = a;
    else throw new Error(`unexpected argument: ${a}`);
  }
  if (!o.chapter)
    throw new Error(
      "usage: prose-lint <chapter.md> [--brief <brief.md>] [--json]",
    );
  return o;
}

// Minimal YAML frontmatter reader: scalars, inline lists, and block lists of
// scalars. Enough for the brief template; anything else is an error.
export function parseFrontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
  if (!m) return {};
  const out = {};
  const lines = m[1].split(/\r?\n/);
  let key = null;
  for (const raw of lines) {
    const line = raw.replace(/\s+#.*$/, "");
    if (!line.trim()) continue;
    const item = /^\s+-\s+(.*)$/.exec(line);
    if (item && key) {
      out[key].push(unquote(item[1]));
      continue;
    }
    const kv = /^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/.exec(line);
    if (!kv) throw new Error(`brief frontmatter: cannot parse line: ${raw}`);
    key = kv[1];
    const v = kv[2].trim();
    if (v === "" || v === "[]") out[key] = [];
    else if (v.startsWith("["))
      out[key] = v
        .slice(1, -1)
        .split(",")
        .map((s) => unquote(s.trim()))
        .filter(Boolean);
    else out[key] = unquote(v);
  }
  return out;
}

function unquote(s) {
  const t = s.trim();
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  )
    return t.slice(1, -1);
  return t;
}

function stripHeaderNote(text) {
  // Drop the leading DRAFT CONTROL RECORD blockquote and any frontmatter so
  // the header's own words (which name rules, chapters, and outline terms)
  // are not linted as prose.
  let t = text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "");
  t = t.replace(/^(>.*\r?\n)+\r?\n?/, "");
  return t;
}

function lineOf(text, index) {
  return text.slice(0, index).split(/\r?\n/).length;
}

function findAll(text, needle) {
  const hits = [];
  const hay = text.toLowerCase();
  const n = needle.toLowerCase();
  let i = hay.indexOf(n);
  while (i !== -1) {
    hits.push({
      line: lineOf(text, i),
      quote: text
        .slice(Math.max(0, i - 40), i + n.length + 40)
        .replace(/\s+/g, " "),
    });
    i = hay.indexOf(n, i + n.length);
  }
  return hits;
}

function wordRegex(term) {
  return new RegExp(
    `(?<![\\p{L}\\p{N}])${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\p{N}])`,
    "giu",
  );
}

function findWord(text, term) {
  const hits = [];
  const re = wordRegex(term);
  let m;
  while ((m = re.exec(text))) {
    hits.push({
      line: lineOf(text, m.index),
      quote: text
        .slice(Math.max(0, m.index - 40), m.index + term.length + 40)
        .replace(/\s+/g, " "),
    });
  }
  return hits;
}

export function lint(chapterText, brief = {}, config = {}) {
  const rules = { ...DEFAULTS, ...config };
  const body = stripHeaderNote(chapterText);
  const findings = [];
  const add = (level, rule, message, hits) => {
    for (const h of hits)
      findings.push({ level, rule, message, line: h.line, quote: h.quote });
  };

  for (const p of rules.prolepsis)
    add("error", "5 prolepsis", `forward glance: "${p}"`, findAll(body, p));
  for (const w of rules.editorial)
    add(
      "error",
      "6 editorial vocabulary",
      `outline word in the book: "${w}"`,
      findWord(body, w),
    );
  for (const r of rules.refrains)
    add("error", "17 banned refrain", `"${r}"`, findAll(body, r));
  for (const e of rules.engineNaming)
    add("error", "7 engine named", `"${e}"`, findAll(body, e));

  const simileHits = rules.similes.flatMap((s) => findAll(body, s));
  if (simileHits.length > rules.simileBudget) {
    add(
      "warning",
      "18 simile budget",
      `${simileHits.length} simile constructions (budget ${rules.simileBudget})`,
      simileHits,
    );
  }

  for (const t of brief.must_not_know ?? [])
    add(
      "error",
      "3 head cannot know",
      `"${t}" appears in a chapter whose head cannot know it`,
      findWord(body, t),
    );
  for (const t of brief.forbidden_terms ?? [])
    add("error", "brief forbidden term", `"${t}"`, findWord(body, t));

  if (String(brief.house) === "true") {
    const firstProse = body
      .split(/\r?\n/)
      .find(
        (l) =>
          l.trim() &&
          !l.startsWith("#") &&
          !l.startsWith(">") &&
          !l.startsWith("---"),
      );
    if (firstProse && /^\s*(she|her)\b/i.test(firstProse)) {
      findings.push({
        level: "error",
        rule: "4 anchoring",
        message: "house chapter opens on a pronoun, not the designation",
        line: lineOf(body, body.indexOf(firstProse)),
        quote: firstProse.slice(0, 80),
      });
    }
  }
  if (String(brief.tense) === "present") {
    // Cheap tense drift check: common past-tense narrative verbs outside
    // dialogue and journal blocks. Warning only; the reviewer confirms.
    const drift = [
      "she walked",
      "she looked",
      "she said",
      "she went",
      "she took",
      "she was ",
    ];
    const hits = drift.flatMap((d) => findAll(body.replace(/"[^"]*"/g, ""), d));
    if (hits.length)
      add(
        "warning",
        "tense",
        "past-tense narration in a present-tense chapter (check each)",
        hits,
      );
  }

  const errors = findings.filter((f) => f.level === "error").length;
  return { findings, errors, warnings: findings.length - errors };
}

async function main() {
  const o = parseArgs(process.argv.slice(2));
  const chapterText = await readFile(o.chapter, "utf8");
  let brief = {};
  let config = {};
  if (o.brief) {
    brief = parseFrontmatter(await readFile(o.brief, "utf8"));
    const cfgPath = path.join(path.dirname(o.brief), "prose-lint.json");
    try {
      config = JSON.parse(await readFile(cfgPath, "utf8"));
    } catch {
      /* optional */
    }
  }
  const result = lint(chapterText, brief, config);
  if (o.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(
      `prose-lint ${path.basename(o.chapter)}${o.brief ? ` (brief ${path.basename(o.brief)})` : ""}`,
    );
    for (const f of result.findings) {
      console.log(
        `  ${f.level.padEnd(7)} L${String(f.line).padStart(4)}  [${f.rule}] ${f.message}\n          …${f.quote}…`,
      );
    }
    console.log(`  ${result.errors} error(s), ${result.warnings} warning(s)`);
  }
  process.exitCode = result.errors > 0 ? 1 : 0;
}

if (
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
) {
  main().catch((e) => {
    console.error(`prose-lint: ${e.message}`);
    process.exitCode = 1;
  });
}
