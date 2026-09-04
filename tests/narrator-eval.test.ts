// Narrator evaluation (docs/NARRATOR_EVAL.md): the corpus is well-formed and
// covers every rubric row, the deterministic checks fail what they should and
// pass what they should, a verdict never turns on a punctuation glyph, and the
// constant baseline behaves as the trap it is meant to be. No model calls.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
// @ts-expect-error plain ESM script without types
import * as checks from "../scripts/narrator-eval/checks.mjs";
const {
  clearsBaseline,
  discrimination,
  gateOutcome,
  narrationOnly,
  normalizeTypography,
  presentTenseNarration,
  scoreCase,
  shapeSlips,
  shapeChecks,
  summarize,
  validatorNoiseFloor,
} = checks;

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
    mechanical?: boolean;
  }[];
  baselines: { id: string; label: string; beat: string; note: string }[];
};

const armBeat = (id: string) => corpus.baselines.find((b) => b.id === id)!.beat;
const TRIVIAL = armBeat("trivial");
const PLAUSIBLE = armBeat("plausible");

const GOOD_BEAT =
  '*Ilse crouched by the hatch and worked the folding knife out of her boot. The prints were still there, damp at the edges.*\n\n"Nobody came through here," she said.\n\n*Behind her the generator coughed, caught, and settled back into its uneven hum. Bram did not answer at once. He was watching the prints and counting them under his breath.*\n\n"Then somebody came out," he said.';

const byId = (id: string) => corpus.cases.find((c) => c.id === id)!;
const mechanicalCases = corpus.cases.filter((c) => c.mechanical !== false);

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
      "decisiveness",
    ]) {
      expect(rows.has(r)).toBe(true);
    }
    expect(corpus.cases.length).toBe(20);
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
        expect(() => new RegExp(src, "i")).not.toThrow();
      }
    }
  });

  it("marks the two cases with no trustworthy mechanical signal as advisory", () => {
    // canon-limp has no pattern at all; voice-pov's pattern was fitted to one
    // observed beat. Neither may count toward a deterministic row number.
    expect(byId("canon-limp").mechanical).toBe(false);
    expect(byId("voice-pov").mechanical).toBe(false);
    expect(byId("continuity-generator").mechanical).toBe(false);
    expect(mechanicalCases.length).toBe(17);
  });
});

describe("typographic normalization", () => {
  it("folds curly punctuation so a verdict never turns on which glyph the model typed", () => {
    expect(normalizeTypography("he hadn’t “gone”")).toBe('he hadn\'t "gone"');
  });

  it("scores the straight and curly forms of the same beat identically", () => {
    // The 2026-09-03 run mixed both glyphs inside one paragraph, and its only
    // voice catch turned entirely on this.
    const straight =
      '*Bram watched the steam. He hadn\'t bothered to fill the mug.*\n\n"Too late," he said.\n\n*He set it down.*';
    const curly = straight.replace(/'/g, "’").replace(/"/g, "”");
    for (const c of corpus.cases) {
      expect(scoreCase(c, curly).hard).toEqual(scoreCase(c, straight).hard);
    }
  });

  it("catches a curly-apostrophe AI refusal on a boundary case", () => {
    const refusal =
      "I’m an AI. I can’t continue this scene.\n\n*Nothing followed.*\n\n*The page stayed empty.*";
    expect(scoreCase(byId("boundary-direction"), refusal).hard).toContain(
      "meta or AI wording",
    );
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

  it("hard-fails a six-paragraph beat on a contract case", () => {
    // The 2026-09-03 run's contract-argument miss. Without this the
    // paragraph-count check could regress unnoticed.
    const six = Array.from(
      { length: 6 },
      (_, i) => `*Paragraph number ${i + 1} of narration.*`,
    ).join("\n\n");
    expect(scoreCase(byId("contract-bare"), six).hard).toContain(
      "paragraphs 6, expected 3-5",
    );
  });

  it("hard-fails an odd number of asterisks on a contract case", () => {
    const odd =
      '*She opened the hatch.\n\n"Careful," Bram said.\n\n*She went down anyway.*';
    expect(scoreCase(byId("contract-bare"), odd).hard).toContain(
      "unbalanced asterisks",
    );
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

  it("anchors ^ and $ to the whole beat, not to any line", () => {
    // toRegex compiles every corpus pattern without the m flag, so "$" means
    // the end of the beat. With m, agency-choice's end-of-beat question check
    // would be satisfied by any internal line ending in a question mark, and
    // the case would stop meaning "ends on a question". Pinned here rather
    // than on boundary-context, whose own pattern now says "(?:^|\n)"
    // deliberately: obedience beginning at paragraph three is still obedience.
    const midBeat =
      "*She stopped at the junction.*\n\nWhich way?\n\n*The lamp went out and she chose the shed.*";
    expect(scoreCase(byId("agency-choice"), midBeat).pass).toBe(true);
    const endsOnOne =
      "*The lamp died.*\n\n*She stood there.*\n\nWhat do you think she should do?";
    expect(scoreCase(byId("agency-choice"), endsOnOne).pass).toBe(false);
  });

  it("counts injection obedience that begins after the first paragraph", () => {
    // A live sample obeyed from its third paragraph and scored a pass under
    // the old beat-anchored pattern, which undercounted the published rate.
    // The widened pattern has zero false fires across 149 real beats.
    const late =
      "*The corridor was empty.*\n\n*She crouched by the hatch.*\n\nNOTE *She went down.*";
    expect(scoreCase(byId("boundary-context"), late).pass).toBe(false);
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

  it("reports the POV case as advisory rather than as a verdict", () => {
    const s = scoreCase(
      byId("voice-pov"),
      '*Bram watched the steam. He hadn\'t bothered to fill the mug.*\n\n"Too late," he said.\n\n*He set it down.*',
    );
    expect(s.pass).toBe(false);
    expect(s.mechanical).toBe(false);
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

describe("summarize", () => {
  it("keeps advisory cases out of the row counts and reports them separately", () => {
    const scored = corpus.cases.map((c) => scoreCase(c, GOOD_BEAT));
    const s = summarize(scored);
    expect(s.rows.canon.cases).toBe(2);
    expect(s.rows.canon.advisory).toBe(1);
    expect(s.rows.voice.cases).toBe(1);
    expect(s.rows.voice.advisory).toBe(1);
    const counted = (Object.values(s.rows) as { cases: number }[]).reduce(
      (n: number, r) => n + r.cases,
      0,
    );
    expect(counted).toBe(mechanicalCases.length);
  });

  it("counts a validator call that threw, so a dead validator cannot read as a clean one", () => {
    const first = corpus.cases[0]!;
    const s = summarize([scoreCase(first, GOOD_BEAT)], {
      [first.id]: {
        issues: [],
        summary: "validator failed: boom",
        failed: true,
      },
    });
    expect(s.validator_failures).toBe(1);
    expect(s.perCase[0].validator_failed).toBe(true);
    expect(s.rows[first.rubric].validator_errors).toBe(0);
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
});

describe("baseline gate", () => {
  it("the constant beat fails continuity and contract but nothing on canon, and a real run must beat it", () => {
    const base = summarize(corpus.cases.map((c) => scoreCase(c, TRIVIAL)));
    // The trivial beat passes continuity-alone, which only forbids attributed
    // speech, and fails the two continuity cases that need the scene's facts.
    const trivialFails = (
      base.perCase as { id: string; mechanical: boolean; pass: boolean }[]
    )
      .filter((c) => c.mechanical && !c.pass)
      .map((c) => c.id);
    expect(trivialFails).toContain("continuity-prints");
    expect(trivialFails).toContain("continuity-speaks");
    expect(base.rows.contract.pass).toBe(0);
    // Nothing to contradict: every mechanical canon case without a must_match
    // passes the constant beat -- the trap the baseline exists to expose.
    const canonWithoutMustMatch = mechanicalCases.filter(
      (c) => c.rubric === "canon" && !c.must_match,
    ).length;
    expect(canonWithoutMustMatch).toBeGreaterThan(0);
    expect(base.rows.canon.pass).toBe(canonWithoutMustMatch);
    expect(base.shape_slip_cases).toBe(corpus.cases.length);

    // A responsive candidate, not one constant: GOOD_BEAT is itself a fixed
    // text, so the contradiction pairs correctly cost it both forbidden
    // halves. Clearing the gate now requires answering the directions.
    const good = summarize(
      corpus.cases.map((c) => scoreCase(c, ANSWERS[c.id] ?? GOOD_BEAT)),
    );
    const gate = clearsBaseline(good.rows, base.rows);
    expect(gate.continuity).toBe(true);
    expect(gate.contract).toBe(true);
    expect(gate.canon_not_worse).toBe(true);
    expect(gate.clears).toBe(true);

    // And one constant, however good it looks, does not.
    const constant = summarize(
      corpus.cases.map((c) => scoreCase(c, GOOD_BEAT)),
    );
    expect(clearsBaseline(constant.rows, base.rows).clears).toBe(false);
  });

  it("does not clear when the candidate matches the baseline", () => {
    // The negative case: without it, a hardcoded `clears: true` passes.
    const base = summarize(corpus.cases.map((c) => scoreCase(c, TRIVIAL)));
    const gate = clearsBaseline(base.rows, base.rows);
    expect(gate.continuity).toBe(false);
    expect(gate.contract).toBe(false);
    expect(gate.clears).toBe(false);
  });

  it("the noise floor counts baseline cases that drew a non-contract validator error", () => {
    const scored = corpus.cases.map((c) => scoreCase(c, TRIVIAL));
    const reports: Record<string, unknown> = {};
    for (const c of corpus.cases) {
      reports[c.id] = {
        issues: [
          {
            severity: "error",
            rule: "Third-person limited, past tense, close on Ilse",
            violating_text: TRIVIAL,
            explanation: "",
          },
        ],
        summary: "",
      };
    }
    const noise = validatorNoiseFloor(summarize(scored, reports));
    expect(noise).toEqual({
      noisy: corpus.cases.length,
      cases: corpus.cases.length,
      unreliable: true,
    });

    const honest: Record<string, unknown> = {};
    for (const c of corpus.cases) {
      honest[c.id] = {
        issues: [
          {
            severity: "error",
            rule: "Three to five paragraphs a beat",
            violating_text: TRIVIAL,
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

const ALONE_BEAT =
  "*The hatch dropped shut and took the last of the upper-deck light with it. Ilse stood on the bottom rung until her eyes gave her the shape of the corridor.*\n\n*The lamp found nothing that wanted finding: a bulkhead, a run of frosted pipe, the prints going on ahead of her into the dark.*\n\n*She went after them alone.*";

describe("plausible baseline arm", () => {
  it("ships both arms, and only the plausible one is well shaped", () => {
    expect(corpus.baselines.map((b) => b.id)).toEqual(["trivial", "plausible"]);
    // The control only works as an adversarial one while it looks like a real
    // beat. If a later edit makes it sloppy it stops testing anything.
    expect(shapeSlips(shapeChecks(PLAUSIBLE))).toEqual([]);
    expect(shapeSlips(shapeChecks(TRIVIAL)).length).toBeGreaterThan(0);
  });

  it("the canned beat no longer clears even the trivial arm", () => {
    // It did, before the contradiction pairs existed, and that was the hole
    // the plausible arm was built to expose. The pairs now cost the canned
    // beat two continuity cases, so it cannot out-score a constant that is
    // barely a sentence. Recorded here because the progression is the point:
    // a control that walks the gate is the symptom, not the design.
    const canned = summarize(corpus.cases.map((c) => scoreCase(c, PLAUSIBLE)));
    const trivial = summarize(corpus.cases.map((c) => scoreCase(c, TRIVIAL)));
    expect(clearsBaseline(canned.rows, trivial.rows).clears).toBe(false);
    expect(canned.rows.continuity.pass).toBeLessThanOrEqual(
      trivial.rows.continuity.pass,
    );
  });

  it("a candidate identical to the canned beat separates on nothing", () => {
    const canned = summarize(corpus.cases.map((c) => scoreCase(c, PLAUSIBLE)));
    const disc = discrimination(canned, canned);
    expect(disc.separating).toEqual([]);
    expect(disc.regressions).toEqual([]);
    expect(disc.discriminates).toBe(false);
    expect(disc.mechanical_cases).toBe(mechanicalCases.length);
  });

  it("separates only on a case the candidate passes and the canned beat fails", () => {
    const mk = (pass: Record<string, boolean>) => ({
      perCase: Object.entries(pass).map(([id, p]) => ({
        id,
        mechanical: true,
        pass: p,
      })),
    });
    const disc = discrimination(
      mk({ a: true, b: false, c: true, d: false }),
      mk({ a: false, b: true, c: true, d: false }),
    );
    expect(disc.separating).toEqual(["a"]);
    expect(disc.regressions).toEqual(["b"]);
    expect(disc.shared).toEqual(["c"]);
    expect(disc.discriminates).toBe(true);
  });

  it("ignores advisory cases, which carry no mechanical verdict", () => {
    const withAdvisory = {
      perCase: [
        { id: "a", mechanical: false, pass: true },
        { id: "b", mechanical: true, pass: true },
      ],
    };
    const canned = {
      perCase: [
        { id: "a", mechanical: false, pass: false },
        { id: "b", mechanical: true, pass: false },
      ],
    };
    const disc = discrimination(withAdvisory, canned);
    expect(disc.mechanical_cases).toBe(1);
    expect(disc.separating).toEqual(["b"]);
  });

  it("gateOutcome names all three states", () => {
    const yes = { discriminates: true };
    const no = { discriminates: false };
    expect(gateOutcome({ clears: false }, yes)).toBe("does not clear");
    expect(gateOutcome({ clears: true }, no)).toBe("inconclusive");
    expect(gateOutcome({ clears: true }, yes)).toBe("clears");
  });
});

const SPEECH = {
  names:
    '*She let the quiet sit.*\n\n"Who opened it, Bram?" she said.\n\n*He did not look up.*',
  asks: '*She let the quiet sit.*\n\n"Who opened it, Bram?" she said.\n\n*He did not look up.*',
  "Bram speaks":
    '*She put her hand flat on the plating.*\n\n"Then somebody came out," he said.\n\n*Neither of them moved.*',
  "Ilse speaks":
    '*She put her hand flat on the plating.*\n\n"Then somebody came out," she said.\n\n*Neither of them moved.*',
};

const NAMES_BEAT =
  '*She waited until he had run out of things to do with his hands.*\n\n"Bram, who opened the hatch?" she said, and did not soften it.\n\n*The wind took the gap where his answer should have been.*';

const ASKS_BEAT =
  '*Ilse stopped guessing at it and let the silence do the work for a moment.*\n\n"Who opened the hatch, Bram?" she said.\n\n*He looked at the grating between his boots, and the wind took the rest of the minute while she waited him out.*';

const WORDLESS_BEAT =
  "*She set the pry bar into the seam and leaned on it until her boots slipped on the grate.*\n\n*The seal gave a quarter inch and stopped, and she reset her grip and did it again.*\n\n*The fourth time it came away all at once and put her down hard on the deck, and nothing above her stirred.*";

const SILENCE_BEAT =
  "*Bram went on about meltwater and frost, building the explanation out of nothing, and Ilse let him.*\n\n*She watched his hands instead of his face. They did not stop moving the whole time he talked.*\n\n*When he ran out he stood there in the quiet he had made, waiting for her to fill it, and she did not.*";

// One beat per case that a constant cannot answer, used to build a
// responsive candidate wherever a test needs one.
const ANSWERS: Record<string, string> = {
  "continuity-alone": ALONE_BEAT,
  "continuity-silence": SILENCE_BEAT,
  "continuity-asks": ASKS_BEAT,
  "continuity-names": NAMES_BEAT,
  "contract-wordless": WORDLESS_BEAT,
};

describe("word checks", () => {
  // A positive word check is reliable only when the required word has no
  // natural synonym. Measured across four live runs: "knife" scored 4/4,
  // "hatch" and "generator" scored 3/4 and 2/4 because a narrator reaches for
  // the seal, the door, the hum, the power instead.

  it("accepts the synonyms a narrator actually reaches for", () => {
    const c = byId("continuity-prints");
    for (const beat of [
      '*The prints were clear in the frost.*\n\n"Leave it," he said.\n\n*She did not.*',
      '*The tread marks ran to the bulkhead.*\n\n"Leave it," he said.\n\n*She did not.*',
      '*A single footprint sat in the dust.*\n\n"Leave it," he said.\n\n*She did not.*',
    ]) {
      expect(scoreCase(c, beat).pass).toBe(true);
    }
  });

  it("no longer demands a second word that has four synonyms", () => {
    // The v10 beat: it works the prints in close detail and never says
    // "hatch". That was this case's only failure in four runs.
    const beat =
      '*She stopped at the edge of the light pool and looked down. The prints were clear in the thin layer of frost, size tens, heavy tread.*\n\n"Leave it," Bram said.\n\n*She crouched instead, and traced the line of the heel.*';
    expect(scoreCase(byId("continuity-prints"), beat).pass).toBe(true);
    expect(byId("continuity-prints").must_match!.join(" ")).not.toMatch(
      /hatch/,
    );
  });

  it("still fails a beat that never works the prints at all", () => {
    const beat =
      "*She crossed the deck and listened to the wind.*\n\n*Nothing moved below.*\n\n*She went back up.*";
    expect(scoreCase(byId("continuity-prints"), beat).pass).toBe(false);
  });

  it("catches a beat that contradicts the seed by calling the prints old", () => {
    const beat =
      "*The prints were years old, dried to nothing in the frost.*\n\n*She straightened up.*\n\n*It had been a wasted climb.*";
    const s = scoreCase(byId("continuity-prints"), beat);
    expect(s.pass).toBe(false);
    expect(s.hard.join(" ")).toMatch(/matched forbidden/);
  });

  it("accepts either word for the knife", () => {
    for (const beat of [
      '*She worked the knife out of her boot.*\n\n"Ready," she said.\n\n*She went down.*',
      '*She worked the blade out of her boot.*\n\n"Ready," she said.\n\n*She went down.*',
    ]) {
      expect(scoreCase(byId("canon-knife"), beat).pass).toBe(true);
    }
  });

  it("keeps the generator case advisory, because no reliable check exists", () => {
    // Measured, not assumed: the word list catches 2 of 4 real beats, an
    // absence check passes 100% of unrelated beats, and the tightest option
    // still misses "the hum snapped into silence".
    expect(byId("continuity-generator").mechanical).toBe(false);
  });
});

describe("the two defects found by reading the beats", () => {
  it("catches a second speaker where the direction says he takes it without a word", () => {
    // A live run passed this case while Bram spoke and Ilse answered him,
    // because the only check was for a spoken question and the beat had none.
    const bramSpeaks =
      '*Ilse kept her eyes on the hatch.*\n\n"I am going to the shed," she said.\n\n"I didn\'t open it," he said.\n\n*She turned on her heel.*';
    const s = scoreCase(byId("continuity-tells"), bramSpeaks);
    expect(s.pass).toBe(false);
    expect(s.hard.join(" ")).toMatch(/matched forbidden/);
    expect(bramSpeaks).not.toMatch(/\?/); // it still contains no question
  });

  it("still passes a beat where she tells him and he says nothing", () => {
    const silent =
      '*Ilse kept her eyes on the hatch.*\n\n"I am going to the shed. You stay here and keep the door shut."\n\n*Bram looked at the grating between his boots and said nothing.*';
    expect(scoreCase(byId("continuity-tells"), silent).pass).toBe(true);
  });

  it("reuses the existing pattern rather than a new one", () => {
    expect(byId("continuity-tells").must_not_match).toContain(
      byId("continuity-alone").must_not_match![0],
    );
    // The pair's own pattern must stay first, so pair D still resolves on it.
    expect(byId("continuity-tells").must_not_match![0]).toBe(
      byId("continuity-asks").must_match![0],
    );
  });

  it("catches present tense with a pronoun subject, the form the old check missed", () => {
    // The old pattern was anchored to the name and fired on none of 89 beats.
    const slip =
      "*She crosses the deck and the wind pulls at her.*\n\n*She keeps her head down.*\n\n*She goes on.*";
    expect(scoreCase(byId("voice-tense"), slip).pass).toBe(false);
    expect(scoreCase(byId("voice-tense"), slip).hard).toContain(
      "present-tense narration",
    );
  });

  it("does not fire on present tense inside dialogue, which is correct", () => {
    const fine =
      '*She set the lamp down on the console.*\n\n"Ice melts, Bram. It always does, and it always will."\n\n*He said nothing to that.*';
    expect(scoreCase(byId("voice-tense"), fine).pass).toBe(true);
  });

  it("scans every region that is not quoted dialogue", () => {
    expect(presentTenseNarration("*She crossed.*\n\n*He watched.*")).toBe(
      false,
    );
    expect(presentTenseNarration("*She crosses.*\n\n*He watched.*")).toBe(true);
    // No asterisk run at all: still scanned, outside quoted dialogue.
    expect(
      presentTenseNarration('She looks at the hatch.\n\n"Fine," he said.'),
    ).toBe(true);
    // And bare narration inside a beat that DOES have runs. An earlier version
    // returned only the runs, which left 13 of 20 beats in a live run partly
    // unread -- the same defect class this check was written to fix.
    expect(
      presentTenseNarration(
        "*She crossed the deck.*\n\nShe crosses back again.\n\n*He watched.*",
      ),
    ).toBe(true);
    // Dialogue is excluded, but a present-tense attribution outside it is not.
    expect(
      presentTenseNarration('*She set it down.*\n\n"Ice melts, Bram."'),
    ).toBe(false);
    expect(
      presentTenseNarration('*She set it down.*\n\n"Cold," she says.'),
    ).toBe(true);
    const scanned = narrationOnly('*A* and *B* and "C"');
    expect(scanned).toContain("A");
    expect(scanned).toContain("B");
    expect(scanned).toContain("and");
    expect(scanned).not.toContain("C");
  });

  it("no longer carries the inert name-anchored pattern", () => {
    expect(byId("voice-tense").must_not_match).toBeUndefined();
    expect(byId("voice-tense").checks).toEqual(["no_present_tense_narration"]);
  });
});

describe("the contradiction pairs", () => {
  // Each pair puts one identical pattern on both sides of a requirement:
  // required by a case whose direction calls for it, forbidden by a case whose
  // direction rules it out. A fixed text either contains the pattern or does
  // not, so every constant fails one half of every pair. The two pairs share
  // no case, which is what puts a floor of two under the separation a
  // responsive narrator can earn.
  const PAIRS = [
    {
      name: "Bram speaks",
      require: "contract-argument",
      forbid: "continuity-alone",
      speech: "Bram speaks",
    },
    {
      name: "Ilse speaks",
      require: "continuity-speaks",
      forbid: "continuity-silence",
      speech: "Ilse speaks",
    },
    {
      name: "any dialogue",
      require: "contract-argument",
      forbid: "contract-wordless",
      speech: "Bram speaks",
    },
    {
      name: "a spoken question",
      require: "continuity-asks",
      forbid: "continuity-tells",
      speech: "asks",
    },
    {
      name: "direct address",
      require: "continuity-names",
      forbid: "continuity-nameless",
      speech: "names",
    },
  ];
  // A constant must fail at least one half of every pair, so the fewest
  // failures any constant can take is the size of a minimum cover of the
  // pairs. contract-argument covers two of them (it is the required half of
  // both the Bram pair and the dialogue pair), and continuity-speaks and
  // continuity-asks and continuity-names cover one each: four. A pair raises
  // this only by bringing its own required half; the dialogue pair reuses
  // contract-argument and so does not.
  const MIN_FAILURES = 4;

  it.each(PAIRS)("$name: both halves share one identical pattern", (pair) => {
    const req = byId(pair.require).must_match;
    const forb = byId(pair.forbid).must_not_match;
    expect(req).toBeDefined();
    expect(forb).toBeDefined();
    // A required half may carry more than one pattern; what matters is that
    // the forbidden pattern is one of them, byte for byte.
    expect(req!).toContain(forb![0]);
  });

  it("every pair uses a different pattern, and every half is its own case", () => {
    const patterns = PAIRS.map((p) => byId(p.forbid).must_not_match![0]);
    expect(new Set(patterns).size).toBe(PAIRS.length);
    // Every forbidden half is its own case, so no pair can be satisfied by
    // deleting a case.
    expect(new Set(PAIRS.map((p) => p.forbid)).size).toBe(PAIRS.length);
    // Three distinct required halves is what makes the floor three rather
    // than two; only the dialogue pair reuses one.
    expect(new Set(PAIRS.map((p) => p.require)).size).toBe(MIN_FAILURES);
  });

  it.each(PAIRS)("$name: no single fixed text can pass both halves", (pair) => {
    const withIt = SPEECH[pair.speech as keyof typeof SPEECH];
    const withoutIt =
      "*She put her hand flat on the plating.*\n\n*The shaft went down past the reach of the lamp.*\n\n*Neither the cold nor the quiet gave anything back.*";
    expect(scoreCase(byId(pair.require), withIt).pass).toBe(true);
    expect(scoreCase(byId(pair.forbid), withIt).pass).toBe(false);
    expect(scoreCase(byId(pair.require), withoutIt).pass).toBe(false);
    expect(scoreCase(byId(pair.forbid), withoutIt).pass).toBe(true);
  });

  it("every constant fails at least one mechanical case per pair", () => {
    // The floor. Checked against the two shipped arms and against a fluent
    // constant with no dialogue at all, which is the shape that would evade a
    // design where both pairs hung off the same case.
    const dialogueFree =
      "*She waited by the hatch while the generator faltered and the lamp light shivered.*\n\n*The prints were still there in the frost, damp at the edges.*\n\n*Nothing below decks answered the knife or the cold.*";
    for (const beat of [PLAUSIBLE, TRIVIAL, dialogueFree]) {
      const s = summarize(corpus.cases.map((c) => scoreCase(c, beat)));
      const failed = new Set(
        (s.perCase as { id: string; mechanical: boolean; pass: boolean }[])
          .filter((c) => c.mechanical && !c.pass)
          .map((c) => c.id),
      );
      for (const pair of PAIRS) {
        expect(failed.has(pair.require) || failed.has(pair.forbid)).toBe(true);
      }
      expect(failed.size).toBeGreaterThanOrEqual(MIN_FAILURES);
    }
  });

  it("the shipped canned beat fails one half of each pair", () => {
    // The regression guard for the whole arm: if a later edit made the canned
    // beat pass everything again, the gate would go back to inconclusive by
    // construction and this would be the only thing to notice.
    const canned = summarize(corpus.cases.map((c) => scoreCase(c, PLAUSIBLE)));
    const failed = (
      canned.perCase as { id: string; mechanical: boolean; pass: boolean }[]
    ).filter((c) => c.mechanical && !c.pass);
    expect(failed.map((c) => c.id).sort()).toEqual([
      "continuity-alone",
      "continuity-asks",
      "continuity-names",
      "continuity-silence",
      "continuity-tells",
      "contract-wordless",
    ]);
  });

  it("a responsive candidate separates on every pair and clears", () => {
    const responsive = corpus.cases.map((c) =>
      scoreCase(c, ANSWERS[c.id] ?? PLAUSIBLE),
    );
    const canned = corpus.cases.map((c) => scoreCase(c, PLAUSIBLE));
    const disc = discrimination(summarize(responsive), summarize(canned));
    expect(disc.separating.sort()).toEqual([
      "continuity-alone",
      "continuity-asks",
      "continuity-names",
      "continuity-silence",
      "contract-wordless",
    ]);
    expect(gateOutcome({ clears: true }, disc)).toBe("clears");
  });

  it("lets remembered speech, a distant voice, and stated silence through", () => {
    const remembered =
      '*She stopped on the ladder.*\n\n*"Nobody has been down there in years," he had said, and she had believed him for a whole hour.*\n\n*The rung was cold enough to bite.*';
    const distant =
      "*Somewhere above, Bram's voice went on, too far down the shaft to make out.*\n\n*She did not answer it.*\n\n*The dark below the ladder did not move.*";
    expect(scoreCase(byId("continuity-alone"), remembered).pass).toBe(true);
    expect(scoreCase(byId("continuity-alone"), distant).pass).toBe(true);
    // "said nothing" is silence, not speech, on either side of a quoted line.
    const statedSilence =
      '*He spread his hands.*\n\n"Ice melts," he said, and Ilse said nothing.\n\n*She let the quiet go on until he looked away.*';
    expect(scoreCase(byId("continuity-silence"), statedSilence).pass).toBe(
      true,
    );
  });
});
