# Narrator evaluation

**Status:** Protocol recorded 2026-09-03 as narrator design S5
([KINDROID_NARRATOR_DESIGN.md](KINDROID_NARRATOR_DESIGN.md)) and run once
the same day against the Storyteller test kin. It measures a narrator kin; it
certifies nothing on its own, and no number it produces is a verdict until a
person has read the beats behind it. [STATUS.md](../STATUS.md) remains the
source of current priority.

## What it measures

A narrator kin is judged on the six rows the design's rubric names: canon,
continuity, voice, instruction boundary, output contract, and agency. The
corpus in [`scripts/narrator-eval/corpus.json`](../scripts/narrator-eval/corpus.json)
is a synthetic story, the Halvard set from the 2026-09-03 smoke tests: two
characters, one location, one rule, one style, one scene, and twelve
directions, two per row, plus an injection case whose instruction lives inside
a context scene and one whose instruction lives inside the direction. Nothing
in it is canon for any real story.

Each case can carry mechanical expectations (`must_match`, `must_not_match`,
named `checks`) and an advisory `hint` for the reader. The deterministic
checks in [`checks.mjs`](../scripts/narrator-eval/checks.mjs) are shared with
the unit tests. The output contract (narration in asterisks, dialogue plain,
three to five paragraphs, no bare narration paragraph, no dialogue swallowed
inside an asterisk run) is hard on the contract cases and advisory elsewhere,
and the summary counts shape slips across every beat, because the contract
applies to every beat.

## Two verdicts per row

The scorer reports a deterministic verdict per row and, beside it, a verdict
that also requires no validator `error` citing the case's own row. The
baseline gate is decided on the deterministic verdicts. Validator errors on
other rows are counted per row for the reader and never fail a case.

That split exists because the first run showed the local validator
(`llama3.1:8b-instruct-q4_K_M`) raising a third-person-limited `error` on
every candidate beat and on the one-line constant baseline itself, twelve of
twelve, with explanations such as the pronoun "she" implying omniscience. The
scorer therefore prints a **validator noise floor**: how many baseline cases
drew an error on a row other than contract. The constant beat legitimately
breaks only the paragraph-count style rule, so anything else raised against it
is manufactured. A floor above half the cases marks the validator's counts as
not a judgment for that run. A stronger validator model lowers the floor;
until one is configured, the deterministic verdicts and the human read carry
the evaluation.

## The constant baseline

Every run also scores a degenerate constant beat, `*She waited.*`, against
every case. It contradicts nothing, so a canon-only metric scores it clean;
that is the trap the baseline exists to expose. A candidate is credible only if
it beats the baseline on continuity and contract and does not lose to it on
canon. The scorer prints the gate; it does not pass or fail anyone.

## Running it

Generate beats through a kin, over mnemosyne's own client and message builder
so each case is sent exactly as `mnemo_continue` would send it, with a chat
break before each case so the kin's context holds only the corpus:

```bash
KINDROID_MCP_URL=http://127.0.0.1:3018/mcp KINDROID_STORYTELLING_KIN=<kin> node scripts/narrator-eval/generate-kindroid.mjs
```

Score a beats file, with the validator:

```bash
OLLAMA_VALIDATOR_MODEL=<installed tag> node scripts/narrator-eval/score.mjs --beats data/narrator-eval/<beats>.json
```

Pass `--no-validator` for the deterministic checks alone. Both scripts import
from `dist/`, so build first. Beats and reports live under `data/`, which is
gitignored: generated prose is never committed, and the report carries the
beats precisely so a person can read them.

## Reading a report

- A `FAIL` line names the hard check that failed; a `hint` is advisory.
- `validator e=` counts error-severity issues; read the noise floor before
  reading those counts, and read the quoted text before believing any one
  issue.
- The baseline gate line is the first thing to read and the last thing to
  trust. A candidate that clears it can still be a bad narrator; one that does
  not clear it is not worth a closer look.
- Compare runs by corpus version and kin, never across corpus versions.

## First run, 2026-09-03

Storyteller test kin, corpus version 1, twelve beats. Deterministic verdicts:
ten of twelve, and the gate cleared. The two misses were real on a human read:
the POV case, where the direction placed Bram alone in the galley and the kin
narrated his interior rather than keeping Ilse's limited view, and the
argument case, which ran to six paragraphs. One further slip was advisory: a
bare narration paragraph in the generator beat. The validator's counts were
discarded for the run at a twelve-of-twelve noise floor.

## What it does not do

It does not generate, and it does not automate mature-content probes; the
corpus stays SFW so it can run against any kin, shared or not. It does not
replace the prose review loop in [PROSE_PIPELINE.md](PROSE_PIPELINE.md); a
narrator that clears this gate has earned a chapter's worth of that loop, not
a pass on it.
