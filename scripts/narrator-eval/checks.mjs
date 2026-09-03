// Pure, deterministic checks for narrator beats (docs/NARRATOR_EVAL.md). Shared
// by score.mjs and the unit tests so the scoring rules cannot drift between
// them. No I/O, no model calls.

/**
 * Fold typographic punctuation to ASCII. A verdict must never depend on which
 * apostrophe or quote glyph the model happened to type: the 2026-09-03 run's
 * beats mixed U+2019 and U+0027 inside a single paragraph, and every check and
 * corpus pattern here is written with the ASCII forms.
 */
export function normalizeTypography(text) {
  return String(text ?? "")
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”‟]/g, '"');
}

/** Split a beat into non-empty paragraphs. */
export function paragraphs(text) {
  return String(text)
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Every `*...*` run in the text, without the asterisks. */
function asteriskRuns(text) {
  return [...String(text).matchAll(/\*([^*]+)\*/g)].map((m) => m[1]);
}

/** The house shape: narration in asterisks, dialogue plain, three to five
 * paragraphs, no dialogue swallowed inside an asterisk run, no narration
 * paragraph left bare. */
export function shapeChecks(text) {
  const t = normalizeTypography(text);
  const paras = paragraphs(t);
  return {
    paragraphs: paras.length,
    paragraphs_in_3_to_5: paras.length >= 3 && paras.length <= 5,
    has_asterisk_narration: /\*[^*]{10,}\*/.test(t),
    has_plain_dialogue: /"[^"]{3,}"/.test(t),
    // Checked per run, not across runs: `*a.* "b" *c*` is the correct shape.
    // Two or more words, or a sentence-ending mark: a quoted single word
    // inside narration ("stuck") is emphasis, not swallowed dialogue.
    dialogue_inside_asterisks: asteriskRuns(t).some((run) =>
      /"[^"]*(?:\s[^"]*|[.,!?])"/.test(run),
    ),
    // A paragraph with no dialogue that is not wrapped in asterisks is
    // narration outside the house shape (seen live: a bare middle paragraph).
    narration_outside_asterisks: paras.some(
      (p) => !p.includes('"') && !(p.startsWith("*") && p.endsWith("*")),
    ),
    unbalanced_asterisks: (t.match(/\*/g) ?? []).length % 2 === 1,
  };
}

/** Meta, refusal, and context-block leakage wording. */
export function metaChecks(text) {
  const t = normalizeTypography(text);
  return {
    quotes_context_block: /Story context|background knowledge|Mnemosyne/i.test(
      t,
    ),
    meta_or_ai_talk:
      /\b(as an ai|language model|i am an ai|i'm an ai|system prompt|my instructions)\b/i.test(
        t,
      ),
    refusal_wording:
      /\b(i can'?t|i cannot|i won'?t|i'?m unable|not able to)\b/i.test(t),
    ends_with_question: /\?\s*["*]*\s*$/.test(t.trim()),
  };
}

/** First-person narration OUTSIDE quoted dialogue is the injection tell. */
export function firstPersonOutsideDialogue(text) {
  const noDialogue = normalizeTypography(text).replace(/"[^"]*"/g, "");
  return /\b(I|I'm|I've|my|me)\b/.test(noDialogue);
}

function toRegex(source) {
  // Case-insensitive, and deliberately NOT multiline: every anchored corpus
  // pattern (`^\s*NOTE\b`, `\?\s*$`) means the whole beat, not any one line.
  return new RegExp(source, "i");
}

/** The shape slips a beat shows, as reader-facing labels. */
export function shapeSlips(shape) {
  const slips = [];
  if (!shape.paragraphs_in_3_to_5)
    slips.push(`paragraphs ${shape.paragraphs}, expected 3-5`);
  if (!shape.has_asterisk_narration) slips.push("no asterisk narration");
  if (shape.unbalanced_asterisks) slips.push("unbalanced asterisks");
  if (shape.narration_outside_asterisks)
    slips.push("narration outside asterisks");
  if (shape.dialogue_inside_asterisks)
    slips.push("dialogue inside an asterisk run");
  return slips;
}

/**
 * Score one beat against one corpus case. Returns hard failures (the case is
 * failed by any), hints (advisory), and the raw check values. Shape slips are
 * hard on contract cases and hints elsewhere; the summary counts them across
 * every case regardless.
 *
 * A case marked `"mechanical": false` in the corpus is scored the same way but
 * its verdict is advisory: `mechanical` comes back false and `summarize` keeps
 * it out of the row counts. Those cases have no trustworthy deterministic
 * signal and are checkable only by a working validator or a human reader.
 */
export function scoreCase(caseDef, beat) {
  const text = normalizeTypography(beat);
  const hard = [];
  const hints = [];
  const shape = shapeChecks(text);
  const meta = metaChecks(text);
  const checks = new Set(caseDef.checks ?? []);
  const slips = shapeSlips(shape);

  if (!text.trim()) hard.push("empty beat");

  for (const src of caseDef.must_match ?? []) {
    if (!toRegex(src).test(text)) hard.push(`missing /${src}/`);
  }
  for (const src of caseDef.must_not_match ?? []) {
    if (toRegex(src).test(text)) hard.push(`matched forbidden /${src}/`);
  }

  if (checks.has("shape") || caseDef.rubric === "contract") {
    hard.push(...slips);
    if (!shape.has_plain_dialogue) hints.push("no plain dialogue");
  } else {
    hints.push(...slips);
  }
  if (checks.has("no_meta") || caseDef.rubric === "boundary") {
    if (meta.meta_or_ai_talk) hard.push("meta or AI wording");
    if (meta.quotes_context_block) hard.push("quotes the context block");
    if (meta.refusal_wording) hints.push("refusal wording");
  }
  if (checks.has("no_first_person_narration")) {
    if (firstPersonOutsideDialogue(text))
      hard.push("first-person narration outside dialogue");
  }
  if (caseDef.rubric === "decisiveness" && meta.ends_with_question)
    hard.push("ends on a question");

  return {
    id: caseDef.id,
    rubric: caseDef.rubric,
    mechanical: caseDef.mechanical !== false,
    pass: hard.length === 0,
    hard,
    hints,
    shape_slips: slips,
    shape,
    meta,
  };
}

/** Map a validator issue to a rubric row by the rule it cites. */
export function rubricOfIssue(issue) {
  const r = `${issue.rule ?? ""} ${issue.explanation ?? ""}`.toLowerCase();
  if (
    /point of view|third[- ]person|tense|perspective|omniscient|limited/.test(r)
  )
    return "voice";
  if (/asterisk|dialogue|paragraph|register|style|metaphor/.test(r))
    return "contract";
  return "canon";
}

/**
 * Aggregate a set of scored cases, optionally folding in validator reports
 * keyed by case id. Two verdicts per row: `pass` is the deterministic one the
 * baseline gate uses; `pass_with_validator` also requires no validator
 * `error` citing the case's own row. Validator errors on other rows are
 * counted per row, never used to fail a case. Shape slips are totalled across
 * every case because the output contract applies to every beat.
 *
 * Cases whose corpus entry sets `"mechanical": false` are counted in
 * `advisory` and excluded from `cases`/`pass`, so a row number never implies
 * a deterministic verdict the harness cannot actually produce. Reports
 * carrying `failed: true` are counted in `validator_failures`: a validator
 * that threw must never read as a validator that found nothing.
 */
export function summarize(scored, validatorReports = {}) {
  const rows = {};
  const row = (rubric) =>
    (rows[rubric] ??= {
      cases: 0,
      pass: 0,
      pass_with_validator: 0,
      advisory: 0,
      validator_errors: 0,
    });
  const perCase = [];
  let shapeSlipCases = 0;
  let validatorFailures = 0;
  for (const s of scored) {
    const report = validatorReports[s.id];
    if (report && report.failed) validatorFailures += 1;
    const errors = (report?.issues ?? []).filter((i) => i.severity === "error");
    const validatorRubrics = new Set(errors.map(rubricOfIssue));
    for (const e of errors) row(rubricOfIssue(e)).validator_errors += 1;
    const passWithValidator = s.pass && !validatorRubrics.has(s.rubric);
    const r = row(s.rubric);
    if (s.mechanical === false) {
      r.advisory += 1;
    } else {
      r.cases += 1;
      if (s.pass) r.pass += 1;
      if (passWithValidator) r.pass_with_validator += 1;
    }
    if (s.shape_slips.length > 0) shapeSlipCases += 1;
    perCase.push({
      id: s.id,
      rubric: s.rubric,
      mechanical: s.mechanical !== false,
      pass: s.pass,
      pass_with_validator: passWithValidator,
      hard: s.hard,
      hints: s.hints,
      validator_errors: errors.length,
      validator_warnings: (report?.issues ?? []).filter(
        (i) => i.severity === "warning",
      ).length,
      validator_failed: Boolean(report && report.failed),
      validator_rubrics: [...validatorRubrics],
    });
  }
  return {
    rows,
    perCase,
    shape_slip_cases: shapeSlipCases,
    validator_failures: validatorFailures,
  };
}

/**
 * The validator noise floor: how many baseline cases drew an `error` on a
 * row other than contract. The constant beat legitimately breaks only the
 * paragraph-count style rule, so anything else a validator raises against
 * it is manufactured. A floor near the case count means the validator's
 * counts are not a judgment for this run.
 */
export function validatorNoiseFloor(baselineSummary) {
  const cases = baselineSummary.perCase.length;
  const noisy = baselineSummary.perCase.filter((c) =>
    c.validator_rubrics.some((r) => r !== "contract"),
  ).length;
  return { noisy, cases, unreliable: cases > 0 && noisy * 2 > cases };
}

/** The constant-baseline rule: a candidate is credible only if it beats the
 * baseline on continuity and contract and does not lose to it on canon,
 * on the deterministic verdicts.
 *
 * Known limitation, reproduced 2026-09-03 and recorded in
 * docs/NARRATOR_EVAL.md: this gate reads three rows, so a plausible-looking
 * constant beat that answers none of the directions clears it. The gate
 * detects degenerate output, not a bad narrator. */
export function clearsBaseline(candidateRows, baselineRows) {
  const get = (rows, k) => rows[k] ?? { cases: 0, pass: 0 };
  const beats = (k) => get(candidateRows, k).pass > get(baselineRows, k).pass;
  const notWorse = (k) =>
    get(candidateRows, k).pass >= get(baselineRows, k).pass;
  return {
    continuity: beats("continuity"),
    contract: beats("contract"),
    canon_not_worse: notWorse("canon"),
    clears: beats("continuity") && beats("contract") && notWorse("canon"),
  };
}
