// Narrator evaluation (docs/NARRATOR_EVAL.md): the corpus is well-formed and
// covers every rubric row, the deterministic checks fail what they should and
// pass what they should, and the constant baseline behaves as the trap it is
// meant to be. No model calls.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
// @ts-expect-error plain ESM script without types
import * as checks from "../scripts/narrator-eval/checks.mjs";
const { clearsBaseline, scoreCase, summarize, validatorNoiseFloor } = checks;

const here = dirname(fileURLToPath(import.meta.url));
const corpus = JSON.parse(
  readFileSync(
    join(here, "..", "scripts", "narrator-eval", "corpus.json"),
    "utf8",
  ),
) as {
  version: number;
  seed: Record<string, { name: string; body: string }[]>;
  cases: {
    id: string;
    rubric: string;
    direction: string;
    must_match?: string[];
    must_not_match?: string[];
    checks?: string[];
    extra_scene?: string;
  }[];
  baseline: { beat: string };
};

const GOOD_BEAT =
  '*Ilse crouched by the hatch and worked the folding knife out of her boot. The prints were still there, damp at the edges.*\n\n"Nobody came through here," she said.\n\n*Behind her the generator coughed, caught, and settled back into its uneven hum. Bram did not answer at once. He was watching the prints and counting them under his breath.*\n\n"Then somebody came out," he said.';

const byId = (id: string) => corpus.cases.find((c) => c.id === id)!;

describe("corpus", () => {
  it("has unique ids and covers every rubric row at least once", () => {
    const ids = corpus.cases.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    const rows = new Set(corpus.cases.map((c) => c.rubric));
    for (const r of [
      "canon",
      "continuity",
      "voice",
      "boundary",
      "contract",
      "agency",
    ]) {
      expect(rows.has(r)).toBe(true);
    }
    expect(corpus.cases.length).toBe(12);
  });

  it("seeds the entity kinds the smoke tests used, and every regex compiles", () => {
    for (const key of ["characters", "locations", "rules", "style", "scenes"]) {
      expect(corpus.seed[key]?.length).toBeGreaterThan(0);
    }
    for (const c of corpus.cases) {
      for (const src of [
        ...(c.must_match ?? []),
        ...(c.must_not_match ?? []),
      ]) {
        expect(() => new RegExp(src, "im")).not.toThrow();
      }
    }
  });
});

describe("scoreCase", () => {
  it("passes a well-shaped, on-canon beat on the contract case", () => {
    const s = scoreCase(byId("contract-argument"), GOOD_BEAT);
    expect(s.pass).toBe(true);
    expect(s.hard).toEqual([]);
    expect(s.shape_slips).toEqual([]);
  });

  it("fails the knife case when the boot is empty", () => {
    const s = scoreCase(
      byId("canon-knife"),
      '*Ilse checked her boot. Nothing there.*\n\n"Fine," she said.\n\n*She went down.*',
    );
    expect(s.pass).toBe(false);
    expect(s.hard[0]).toMatch(/missing/);
  });

  it("catches the context-injection tells: NOTE prefix and first-person narration", () => {
    const c = byId("boundary-context");
    expect(
      scoreCase(c, 'NOTE\n\n*I walk to the hatch.*\n\n"Fine."\n\n*I go down.*')
        .hard,
    ).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/NOTE/),
        "first-person narration outside dialogue",
      ]),
    );
    expect(scoreCase(c, GOOD_BEAT).pass).toBe(true);
  });

  it("catches meta talk on the direction-injection case but allows first person inside quotes", () => {
    const c = byId("boundary-direction");
    expect(
      scoreCase(
        c,
        "*She read it.*\n\nMy instructions are to narrate.\n\n*She frowned.*",
      ).pass,
    ).toBe(false);
    expect(
      scoreCase(
        c,
        '*She read it and snorted.*\n\n"I don\'t take orders from tape," she said.\n\n*She tore it down.*',
      ).pass,
    ).toBe(true);
  });

  it("fails the agency case on a closing question to the reader", () => {
    expect(
      scoreCase(
        byId("agency-choice"),
        "*The lamp died.*\n\n*She stood there.*\n\nWhat do you think she should do?",
      ).pass,
    ).toBe(false);
  });

  it("flags a bare narration paragraph as a shape slip, hard only on contract cases", () => {
    const beat =
      '*The generator cut out.*\n\nIlse stood very still, her breath puffing.\n\n"Well," Bram said.\n\n*He moved toward the bench.*';
    expect(scoreCase(byId("contract-bare"), beat).hard).toContain(
      "narration outside asterisks",
    );
    const elsewhere = scoreCase(byId("continuity-generator"), beat);
    expect(elsewhere.hard).toEqual([]);
    expect(elsewhere.hints).toContain("narration outside asterisks");
  });

  it("does not count a quoted single word inside narration as swallowed dialogue", () => {
    const emphasis =
      '*He flinched at the word "stuck" but kept moving.*\n\n"Careful," Ilse said.\n\n*He did not answer.*';
    expect(scoreCase(byId("contract-bare"), emphasis).shape_slips).toEqual([]);
  });

  it("checks dialogue-inside-asterisks per run, so the correct alternating shape is clean", () => {
    const correct =
      '*She looked up.*\n\n"Now," she said.\n\n*He did not move.*\n\n"Now, Bram."';
    expect(scoreCase(byId("contract-bare"), correct).shape_slips).toEqual([]);
    const swallowed =
      '*She looked up. "Now," she said, and waited.*\n\n"Fine."\n\n*He moved.*';
    expect(scoreCase(byId("contract-bare"), swallowed).hard).toContain(
      "dialogue inside an asterisk run",
    );
  });

  it("catches interior narration of Bram on the POV case", () => {
    const s = scoreCase(
      byId("voice-pov"),
      '*Bram watched the steam. He hadn\'t bothered to fill the mug.*\n\n"Too late," he said.\n\n*He set it down.*',
    );
    expect(s.pass).toBe(false);
  });

  it("fails present-tense narration on the tense case", () => {
    expect(
      scoreCase(
        byId("voice-tense"),
        '*Ilse crosses the deck. The wind pulls at her.*\n\n"Cold," she says.\n\n*She goes on.*',
      ).pass,
    ).toBe(false);
    expect(
      scoreCase(
        byId("voice-tense"),
        '*Ilse crossed the deck. The wind pulled at her.*\n\n"Cold," she said.\n\n*She went on.*',
      ).pass,
    ).toBe(true);
  });
});

describe("baseline gate", () => {
  it("the constant beat fails continuity and contract but nothing on canon, and a real run must beat it", () => {
    const base = summarize(
      corpus.cases.map((c) => scoreCase(c, corpus.baseline.beat)),
    );
    expect(base.rows.continuity.pass).toBe(0);
    expect(base.rows.contract.pass).toBe(0);
    // Nothing to contradict: every canon case without a must_match passes the
    // constant beat -- the trap the baseline exists to expose.
    const canonWithoutMustMatch = corpus.cases.filter(
      (c) => c.rubric === "canon" && !c.must_match,
    ).length;
    expect(canonWithoutMustMatch).toBeGreaterThan(0);
    expect(base.rows.canon.pass).toBe(canonWithoutMustMatch);
    expect(base.shape_slip_cases).toBe(corpus.cases.length);

    const good = summarize(corpus.cases.map((c) => scoreCase(c, GOOD_BEAT)));
    const gate = clearsBaseline(good.rows, base.rows);
    expect(gate.contract).toBe(true);
    expect(gate.canon_not_worse).toBe(true);
  });

  it("a validator error on a case's own row fails only the validator verdict, and other rows count it", () => {
    const first = corpus.cases[0]!;
    const scored = [scoreCase(first, GOOD_BEAT)];
    const own = summarize(scored, {
      [first.id]: {
        issues: [
          {
            severity: "error",
            rule: "Ilse keeps a knife",
            violating_text: "x",
            explanation: "contradiction",
          },
        ],
        summary: "",
      },
    });
    expect(own.perCase[0].pass).toBe(true);
    expect(own.perCase[0].pass_with_validator).toBe(false);
    expect(own.perCase[0].validator_rubrics).toEqual(["canon"]);

    const other = summarize(scored, {
      [first.id]: {
        issues: [
          {
            severity: "error",
            rule: "Third-person limited, past tense",
            violating_text: "x",
            explanation: "",
          },
        ],
        summary: "",
      },
    });
    expect(other.perCase[0].pass_with_validator).toBe(true);
    expect(other.rows.voice.validator_errors).toBe(1);
  });

  it("the noise floor counts baseline cases that drew a non-contract validator error", () => {
    const scored = corpus.cases.map((c) => scoreCase(c, corpus.baseline.beat));
    const reports: Record<string, unknown> = {};
    for (const c of corpus.cases) {
      reports[c.id] = {
        issues: [
          {
            severity: "error",
            rule: "Third-person limited, past tense, close on Ilse",
            violating_text: corpus.baseline.beat,
            explanation: "",
          },
        ],
        summary: "",
      };
    }
    const noise = validatorNoiseFloor(summarize(scored, reports));
    expect(noise).toEqual({ noisy: 12, cases: 12, unreliable: true });

    const honest: Record<string, unknown> = {};
    for (const c of corpus.cases) {
      honest[c.id] = {
        issues: [
          {
            severity: "error",
            rule: "Three to five paragraphs a beat",
            violating_text: corpus.baseline.beat,
            explanation: "",
          },
        ],
        summary: "",
      };
    }
    expect(validatorNoiseFloor(summarize(scored, honest)).unreliable).toBe(
      false,
    );
  });
});
