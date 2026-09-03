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
 * noise floor.
 *
 * Run integrity comes first: a case that never generated, a beat carrying a
 * generation error, and a validator call that threw are all reported, and any
 * of them withholds the gate verdict and exits non-zero. A broken run must
 * never be scorable into a clean number.
 *
 * Prints counts only; the JSON report (beats included, for the human read)
 * goes under data/, which is gitignored. Never commits prose.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  clearsBaseline,
  discrimination,
  gateOutcome,
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

const arm = (id) => {
  const found = (corpus.baselines ?? []).find((b) => b.id === id);
  if (!found) {
    console.error(`corpus is missing the "${id}" baseline arm`);
    process.exit(2);
  }
  return found;
};
const trivialArm = arm("trivial");
const plausibleArm = arm("plausible");

// Run integrity, computed before anything is scored.
const missing = corpus.cases
  .filter((c) => !beatById.has(c.id))
  .map((c) => c.id);
const errored = corpus.cases
  .filter((c) => beatById.get(c.id)?.error)
  .map((c) => c.id);
const empty = corpus.cases
  .filter((c) => beatById.has(c.id) && !beatById.get(c.id)?.error)
  .filter((c) => !String(beatById.get(c.id)?.beat_text ?? "").trim())
  .map((c) => c.id);
const unusable = new Set([...missing, ...errored, ...empty]);
const envelopeIncomplete =
  !Array.isArray(beatsFile) &&
  (beatsFile.complete === false || Number(beatsFile.errors ?? 0) > 0);

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
  // The preflight lives here, not at module scope: with --no-validator this
  // script imports nothing from dist/ and must run on a clean checkout.
  await import("../dist-preflight.mjs");
  const { OllamaProvider } = await import("../../dist/llm.js");
  const { validateContent } = await import("../../dist/validator.js");
  const validator = new OllamaProvider({
    url: process.env.OLLAMA_URL ?? "http://localhost:11434",
    defaultModel: model,
  });
  validate = (text) => validateContent(validator, context, text);
}

async function scoreSet(label, textOf, markUnusable = false) {
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
  const validatorUsable = validate && summary.validator_failures === 0;
  console.log(`\n=== ${label} ===`);
  console.log(
    validate
      ? "  row         pass   +validator  validator errors citing row"
      : "  row         pass",
  );
  for (const [rubric, r] of Object.entries(summary.rows).sort()) {
    const v = validate
      ? validatorUsable
        ? `  ${String(r.pass_with_validator).padStart(4)}/${r.cases}      ${r.validator_errors}`
        : "     n/a       n/a"
      : "";
    const adv = r.advisory ? ` (+${r.advisory} advisory)` : "";
    console.log(`  ${rubric.padEnd(11)} ${r.pass}/${r.cases}${v}${adv}`);
  }
  console.log(
    `  shape slips on ${summary.shape_slip_cases}/${scored.length} beats`,
  );
  if (validate && summary.validator_failures > 0)
    console.log(
      `  validator: ${summary.validator_failures}/${scored.length} calls FAILED -- validator columns are unusable for this run`,
    );
  for (const c of summary.perCase) {
    const flags = [
      ...c.hard.map((h) => `FAIL ${h}`),
      ...c.hints.map((h) => `hint ${h}`),
    ];
    const v = validate
      ? c.validator_failed
        ? " validator FAILED"
        : ` validator e=${c.validator_errors} w=${c.validator_warnings}`
      : "";
    // Only the candidate can have an unusable beat; the baseline always
    // supplies its own constant, so its verdict is real for every case.
    const verdict =
      markUnusable && unusable.has(c.id)
        ? "----"
        : c.mechanical
          ? c.pass
            ? "pass"
            : "FAIL"
          : "adv ";
    console.log(
      `  ${verdict} ${c.id.padEnd(20)}${v}${flags.length ? " | " + flags.join("; ") : ""}`,
    );
  }
  return { scored, reports, summary };
}

const candidate = await scoreSet(
  "candidate",
  (c) => beatById.get(c.id)?.beat_text ?? "",
  true,
);
const baseline = await scoreSet(
  `${trivialArm.label} baseline`,
  () => trivialArm.beat,
);
const plausible = await scoreSet(
  `${plausibleArm.label} baseline (canned, answers no direction)`,
  () => plausibleArm.beat,
);
const trivialGate = clearsBaseline(
  candidate.summary.rows,
  baseline.summary.rows,
);
const disc = discrimination(candidate.summary, plausible.summary);
const outcome = gateOutcome(trivialGate, disc);
const noise = validate ? validatorNoiseFloor(baseline.summary) : null;

const integrity = {
  cases: corpus.cases.length,
  usable: corpus.cases.length - unusable.size,
  missing,
  errored,
  empty,
  envelope_incomplete: envelopeIncomplete,
  validator_failures: candidate.summary.validator_failures,
  ok:
    unusable.size === 0 &&
    !envelopeIncomplete &&
    candidate.summary.validator_failures === 0,
};

console.log(
  `\nrun integrity: ${integrity.usable}/${integrity.cases} cases produced a usable beat` +
    (missing.length ? `; missing: ${missing.join(", ")}` : "") +
    (errored.length ? `; generation error: ${errored.join(", ")}` : "") +
    (empty.length ? `; empty: ${empty.join(", ")}` : "") +
    (envelopeIncomplete ? "; producer reported an incomplete run" : "") +
    (integrity.validator_failures
      ? `; ${integrity.validator_failures} validator calls failed`
      : ""),
);

if (integrity.ok) {
  console.log(
    `trivial arm: continuity ${trivialGate.continuity ? "beats" : "does NOT beat"}; contract ${trivialGate.contract ? "beats" : "does NOT beat"}; canon ${trivialGate.canon_not_worse ? "not worse" : "WORSE"} -> ${trivialGate.clears ? "clears" : "does not clear"}`,
  );
  console.log(
    `plausible arm: ${disc.separating.length} of ${disc.mechanical_cases} mechanical cases separate the candidate from a canned beat` +
      (disc.separating.length ? `: ${disc.separating.join(", ")}` : "") +
      (disc.regressions.length
        ? `; the canned beat did better on: ${disc.regressions.join(", ")}`
        : ""),
  );
  console.log(`baseline gate: ${outcome.toUpperCase()}`);
  if (outcome === "inconclusive")
    console.log(
      "  inconclusive is a statement about the corpus, not the narrator: no case here passes for the candidate and fails for a fluent beat that answers nothing. To reach CLEARS, the corpus needs a case the canned beat fails.",
    );
} else {
  console.log(
    "baseline gate: WITHHELD -- this run is incomplete, so no gate verdict is reported.",
  );
}
if (noise) {
  console.log(
    `validator noise floor: ${noise.noisy}/${noise.cases} trivial-baseline cases drew a non-contract error on "${trivialArm.beat}"` +
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
      beats_provenance: Array.isArray(beatsFile)
        ? null
        : {
            provider: beatsFile.provider ?? beatsFile.kin ?? null,
            kin_id: beatsFile.kin_id ?? null,
            chat_break: beatsFile.chat_break ?? null,
            corpus_version: beatsFile.corpus_version ?? null,
            generated_at: beatsFile.generated_at ?? null,
          },
      validator_model: useValidator ? process.env.OLLAMA_VALIDATOR_MODEL : null,
      integrity,
      candidate: { summary: candidate.summary, reports: candidate.reports },
      baseline: { summary: baseline.summary, reports: baseline.reports },
      plausible_baseline: {
        beat: plausibleArm.beat,
        summary: plausible.summary,
        reports: plausible.reports,
      },
      gate: integrity.ok
        ? { trivial: trivialGate, discrimination: disc, outcome }
        : null,
      gate_withheld_reason: integrity.ok ? null : "incomplete run",
      validator_noise_floor: noise,
      beats: beatsFile,
    },
    null,
    2,
  ),
  "utf8",
);
console.log(`report: ${outPath}`);
if (!integrity.ok) process.exit(1);
