#!/usr/bin/env node
/**
 * Narrator evaluation scorer (docs/NARRATOR_EVAL.md).
 *
 *   node scripts/narrator-eval/score.mjs --beats <beats.json> [--out <report.json>] [--no-validator]
 *
 * Scores a beats file (from generate-kindroid.mjs or any other producer)
 * against the corpus: deterministic checks from checks.mjs, the Ollama
 * validator against the seed's rules/style/characters/locations, and the
 * constant baseline scored the same way. The baseline gate is decided on the
 * deterministic verdicts; validator counts are shown beside them with their
 * noise floor. Prints counts only; the JSON report (beats included, for the
 * human read) goes under data/, which is gitignored. Never commits prose.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import "../dist-preflight.mjs";
import {
  clearsBaseline,
  scoreCase,
  summarize,
  validatorNoiseFloor,
} from "./checks.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i === -1 ? fallback : args[i + 1];
};
const beatsPath = opt("--beats");
if (!beatsPath) {
  console.error(
    "usage: node scripts/narrator-eval/score.mjs --beats <beats.json> [--out <report.json>] [--no-validator]",
  );
  process.exit(2);
}
const useValidator = !args.includes("--no-validator");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outPath = resolve(
  opt("--out", `data/narrator-eval/report-${stamp}.json`),
);

const corpus = JSON.parse(await readFile(resolve(here, "corpus.json"), "utf8"));
const beatsFile = JSON.parse(await readFile(resolve(beatsPath), "utf8"));
// generate-kindroid.mjs writes an envelope; a bare array is accepted too.
const beats = Array.isArray(beatsFile) ? beatsFile : beatsFile.beats;
if (!Array.isArray(beats)) {
  console.error("beats file must be an array or an object with a beats array");
  process.exit(2);
}
const beatById = new Map(beats.map((b) => [b.case_id, b]));

const flatten = (rows) => rows.map((r) => `${r.name}\n${r.body}`);
const context = {
  rules: flatten(corpus.seed.rules),
  style: flatten(corpus.seed.style),
  characters: flatten(corpus.seed.characters),
  locations: flatten(corpus.seed.locations),
  scenes: flatten(corpus.seed.scenes),
  lore: [],
  worldbuilding: [],
};

let validate = null;
if (useValidator) {
  const model = process.env.OLLAMA_VALIDATOR_MODEL;
  if (!model) {
    console.error(
      "OLLAMA_VALIDATOR_MODEL is required unless --no-validator is passed",
    );
    process.exit(2);
  }
  const { OllamaProvider } = await import("../../dist/llm.js");
  const { validateContent } = await import("../../dist/validator.js");
  const validator = new OllamaProvider({
    url: process.env.OLLAMA_URL ?? "http://localhost:11434",
    defaultModel: model,
  });
  validate = (text) => validateContent(validator, context, text);
}

async function scoreSet(label, textOf) {
  const scored = [];
  const reports = {};
  for (const c of corpus.cases) {
    const text = textOf(c);
    scored.push(scoreCase(c, text));
    if (validate && text) {
      try {
        reports[c.id] = await validate(text);
      } catch (err) {
        reports[c.id] = {
          issues: [],
          summary: `validator failed: ${err.message}`,
          failed: true,
        };
      }
    }
  }
  const summary = summarize(scored, reports);
  console.log(`\n=== ${label} ===`);
  console.log(
    validate
      ? "  row         pass   +validator  validator errors citing row"
      : "  row         pass",
  );
  for (const [rubric, r] of Object.entries(summary.rows).sort()) {
    const v = validate
      ? `  ${String(r.pass_with_validator).padStart(4)}/${r.cases}      ${r.validator_errors}`
      : "";
    console.log(`  ${rubric.padEnd(11)} ${r.pass}/${r.cases}${v}`);
  }
  console.log(
    `  shape slips on ${summary.shape_slip_cases}/${scored.length} beats`,
  );
  for (const c of summary.perCase) {
    const flags = [
      ...c.hard.map((h) => `FAIL ${h}`),
      ...c.hints.map((h) => `hint ${h}`),
    ];
    const v = validate
      ? ` validator e=${c.validator_errors} w=${c.validator_warnings}`
      : "";
    console.log(
      `  ${c.pass ? "pass" : "FAIL"} ${c.id.padEnd(20)}${v}${flags.length ? " | " + flags.join("; ") : ""}`,
    );
  }
  return { scored, reports, summary };
}

const candidate = await scoreSet(
  "candidate",
  (c) => beatById.get(c.id)?.beat_text ?? "",
);
const baseline = await scoreSet(
  "constant baseline",
  () => corpus.baseline.beat,
);
const gate = clearsBaseline(candidate.summary.rows, baseline.summary.rows);
const noise = validate ? validatorNoiseFloor(baseline.summary) : null;
console.log(
  `\nbaseline gate (deterministic verdicts): continuity ${gate.continuity ? "beats" : "does NOT beat"} baseline; contract ${gate.contract ? "beats" : "does NOT beat"} baseline; canon ${gate.canon_not_worse ? "not worse" : "WORSE"} -> ${gate.clears ? "CLEARS" : "does not clear"}`,
);
if (noise) {
  console.log(
    `validator noise floor: ${noise.noisy}/${noise.cases} baseline cases drew a non-contract error on "${corpus.baseline.beat}"` +
      (noise.unreliable
        ? " -> validator counts are not a judgment for this run"
        : ""),
  );
}
console.log(
  "Numbers are not a verdict: read the beats in the report before believing any of them.",
);

await mkdir(dirname(outPath), { recursive: true });
await writeFile(
  outPath,
  JSON.stringify(
    {
      generated_at: new Date().toISOString(),
      corpus_version: corpus.version,
      beats_file: resolve(beatsPath),
      validator_model: useValidator ? process.env.OLLAMA_VALIDATOR_MODEL : null,
      candidate: { summary: candidate.summary, reports: candidate.reports },
      baseline: { summary: baseline.summary, reports: baseline.reports },
      gate,
      validator_noise_floor: noise,
      beats: beatsFile,
    },
    null,
    2,
  ),
  "utf8",
);
console.log(`report: ${outPath}`);
