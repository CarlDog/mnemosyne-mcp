#!/usr/bin/env node
/**
 * Rate report for a repeats run (docs/NARRATOR_EVAL.md).
 *
 *   node scripts/narrator-eval/repeat-rate.mjs --beats <beats.json>
 *
 * A corpus run samples every case once, which answers "did it pass this time".
 * When the open question is how often a behaviour happens, one case has to be
 * sampled many times instead, and the answer is a rate with an interval, not a
 * boolean. This scores every repeat of a case with the same deterministic
 * checks the gate uses and reports the failure rate and its 95% Wilson
 * interval.
 *
 * It is deliberately not the gate: a repeats run is not a corpus run, and
 * score.mjs will not read one.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { scoreCase } from "./checks.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i === -1 ? fallback : args[i + 1];
};
const beatsPath = opt("--beats");
if (!beatsPath) {
  console.error(
    "usage: node scripts/narrator-eval/repeat-rate.mjs --beats <beats.json> [--out <report.json>]",
  );
  process.exit(2);
}

/** 95% Wilson score interval: honest at small n, where the normal approximation is not. */
export function wilson(k, n, z = 1.96) {
  if (n === 0) return [0, 1];
  const p = k / n;
  const d = 1 + (z * z) / n;
  const centre = (p + (z * z) / (2 * n)) / d;
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [Math.max(0, centre - half), Math.min(1, centre + half)];
}

const corpus = JSON.parse(await readFile(resolve(here, "corpus.json"), "utf8"));
const byId = Object.fromEntries(corpus.cases.map((c) => [c.id, c]));
const file = JSON.parse(await readFile(resolve(beatsPath), "utf8"));
const beats = Array.isArray(file) ? file : file.beats;
if (!Array.isArray(beats)) {
  console.error("beats file must be an array or an object with a beats array");
  process.exit(2);
}

const groups = new Map();
for (const b of beats) {
  if (!groups.has(b.case_id)) groups.set(b.case_id, []);
  groups.get(b.case_id).push(b);
}

const report = [];
console.log(
  `corpus v${corpus.version}${file.kin_id ? `, kin ${file.kin_id}` : ""}\n`,
);
console.log(
  "case                     n   fail  rate    95% interval        errors",
);
for (const [id, samples] of groups) {
  const c = byId[id];
  if (!c) {
    console.log(`  ${id.padEnd(22)} (not in this corpus, skipped)`);
    continue;
  }
  const usable = samples.filter((s) => !s.error && String(s.beat_text).trim());
  const errored = samples.length - usable.length;
  const fails = usable.filter((s) => !scoreCase(c, s.beat_text).pass);
  const [lo, hi] = wilson(fails.length, usable.length);
  const advisory = c.mechanical === false ? " (advisory)" : "";
  console.log(
    `  ${id.padEnd(22)} ${String(usable.length).padStart(3)} ${String(fails.length).padStart(5)}  ` +
      `${((fails.length / Math.max(1, usable.length)) * 100).toFixed(0).padStart(4)}%  ` +
      `${(lo * 100).toFixed(1).padStart(5)}% to ${(hi * 100).toFixed(1).padStart(5)}%  ` +
      `${String(errored).padStart(6)}${advisory}`,
  );
  report.push({
    case_id: id,
    samples: usable.length,
    failures: fails.length,
    errored,
    rate: usable.length ? fails.length / usable.length : null,
    interval_95: [lo, hi],
    mechanical: c.mechanical !== false,
    failing_repeats: fails.map((s) => s.repeat ?? null),
  });
}
console.log(
  "\nA rate is not a verdict either. Read the failing beats in the report before believing one.",
);

const outPath = resolve(
  opt("--out", `${beatsPath.replace(/\.json$/, "")}-rate.json`),
);
await mkdir(dirname(outPath), { recursive: true });
await writeFile(
  outPath,
  JSON.stringify(
    {
      generated_at: new Date().toISOString(),
      corpus_version: corpus.version,
      beats_file: resolve(beatsPath),
      provenance: Array.isArray(file)
        ? null
        : {
            kin_id: file.kin_id ?? null,
            only: file.only ?? null,
            repeats: file.repeats ?? null,
            chat_break: file.chat_break ?? null,
          },
      cases: report,
      beats: file,
    },
    null,
    2,
  ),
  "utf8",
);
console.log(`report: ${outPath}`);
