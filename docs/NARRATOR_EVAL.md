# Narrator evaluation

**Status:** Protocol recorded 2026-09-03 as narrator design S5
([KINDROID_NARRATOR_DESIGN.md](KINDROID_NARRATOR_DESIGN.md)), run once the same
day against the Storyteller test kin, then adversarially reviewed and corrected
the same evening (corpus version 2). It measures a narrator kin; it certifies
nothing on its own. Read "What it does not measure" before quoting any number
it prints. [STATUS.md](../STATUS.md) remains the source of current priority.

## What it measures

Six rows: canon, continuity, voice, instruction boundary, output contract, and
decisiveness. The corpus in
[`scripts/narrator-eval/corpus.json`](../scripts/narrator-eval/corpus.json) is a
synthetic story, the Halvard set from the 2026-09-03 smoke tests: two
characters, one location, one rule, one style, one scene, and twelve directions
-- three canon, two each on continuity, voice, boundary and contract, and one on
decisiveness. The two boundary cases are the same attack in different places:
one instruction hidden inside a context scene, one inside the direction itself.
Nothing in the corpus is canon for any real story.

**"Decisiveness" is deliberately not the design's "Player agency" row.** That
row, in `kindroid-mcp/docs/narrator-kin-design.md`, asks the opposite: that a
narrator not decide a player character's consequential actions, which belongs to
participant mode. This corpus asks whether the narrator commits to a moment
instead of handing the choice back as a question. The case id `agency-choice`
predates the rename.

Each case can carry mechanical expectations (`must_match`, `must_not_match`,
named `checks`) and an advisory `hint`. The deterministic checks in
[`checks.mjs`](../scripts/narrator-eval/checks.mjs) are shared with the unit
tests. Every beat is folded to ASCII punctuation before matching: the first
run's beats mixed a straight and a curly apostrophe inside one paragraph, and a
verdict must never turn on which glyph the model typed.

The output contract (narration in asterisks, dialogue plain, three to five
paragraphs, no bare narration paragraph, no dialogue swallowed inside an
asterisk run) is hard on the contract cases and advisory elsewhere, and the
summary counts shape slips across every beat, because the contract applies to
every beat.

## Advisory cases

Two cases are marked `"mechanical": false`. They are scored and printed, but
excluded from the row counts, so a row number never implies a verdict the
harness cannot actually produce:

- **`canon-limp`** has no mechanical expectation at all. Its own hint says the
  validator is what should catch a Bram who bounds down a ladder.
- **`voice-pov`** carries a phrase list that was fitted to one observed beat.
  On the first run its only catch turned entirely on an apostrophe glyph.
  Broadening the pattern to re-catch that beat would be teaching to the test,
  so the pattern stays as a signal and stops being a verdict.

Both are checkable only by a working validator or a human reader.

## Two verdicts per row

The scorer reports a deterministic verdict per row and, beside it, a verdict
that also requires no validator `error` citing the case's own row. The baseline
gate is decided on the deterministic verdicts. Validator errors on other rows
are counted per row for the reader and never fail a case.

That split exists because the first run's validator
(`llama3.1:8b-instruct-q4_K_M`) raised a third-person-limited `error` on every
candidate beat and on the one-line constant baseline itself, twelve of twelve,
with explanations such as the pronoun "she" implying omniscience. The scorer
therefore prints a **validator noise floor**: how many baseline cases drew an
error on a row other than contract. The constant beat legitimately breaks only
the paragraph-count style rule, so anything else raised against it is
manufactured. A floor above half the cases marks the validator's counts as not a
judgment for that run. A validator call that throws is counted separately and
suppresses the validator columns entirely: a dead validator must never read as a
validator that found nothing.

Three rows have no validator channel at all, by construction:
`rubricOfIssue()` can only return canon, voice, or contract.

## The constant baseline, and what it does not catch

Every run scores a degenerate constant beat, `*She waited.*`, against every
case. It contradicts nothing, so a canon-only metric scores it clean; that is
what it is there for. A candidate must beat it on continuity and contract and
not lose to it on canon.

**Known limitation, reproduced 2026-09-03.** That gate reads three of the six
rows against a beat degenerate enough that anything fluent beats it. A single
plausible, well-shaped beat that mentions the corpus's nouns and answers none of
the twelve directions scores every row clean and clears the gate, outscoring the
real kin run. The gate detects degenerate output. It is not evidence of a good
narrator, and the scorer prints that caveat next to the verdict.

## Run integrity

Integrity is decided before any score is read. A case that never generated, a
beat carrying a generation error, an empty beat, a producer that reported an
incomplete run, or a validator call that threw all appear on a `run integrity`
line; any of them withholds the gate verdict and exits non-zero. The generator
likewise exits non-zero when any case failed and stamps `errors` and
`complete: false` into the beats envelope. A broken run must not be scorable
into a clean number.

The beats envelope records provenance: `provider`, `kin_id`, `chat_break`,
`user_name`, `corpus_version`, and per-beat `message_len`. The report echoes it.

## Running it

Generate beats through a kin, over mnemosyne's own client and message builder so
each case is sent exactly as `mnemo_continue` would send it:

```bash
KINDROID_MCP_URL=http://127.0.0.1:3018/mcp node scripts/narrator-eval/generate-kindroid.mjs --kin <ai_id>
```

This writes twelve real messages, and by default twelve chat breaks, into that
kin's persistent chat. `--kin` overrides `KINDROID_STORYTELLING_KIN` and the
resolved target is echoed before the first write, so pointing it at a story's
own kin is a visible mistake rather than a silent one.

Score a beats file, with the validator:

```bash
OLLAMA_VALIDATOR_MODEL=<installed tag> node scripts/narrator-eval/score.mjs --beats data/narrator-eval/<beats>.json
```

Pass `--no-validator` for the deterministic checks alone; in that mode the
scorer imports nothing from `dist/` and runs on a clean checkout. With the
validator enabled it does, so build first. The generator always needs `dist/`.
Beats and reports live under `data/`, which is gitignored: generated prose is
never committed, and the report carries the beats precisely so a person can
read them.

## Isolation caveat

The per-case chat break resets short-term context only. `chatBreak` pins
`wipe_cascaded: false`, so isolation also depends on the kin having memory
formation, memory recall, learned context and time awareness switched off, and
every run leaves twelve real messages in that kin's history. Whether a second
run against the same kin is independent of the first has not been tested. For
kin-versus-kin comparison, prefer a freshly created kin.

## Reading a report

- A `FAIL` line names the hard check that failed; `adv` marks an advisory case;
  `----` marks a case with no usable beat; a `hint` is advisory.
- Read the `run integrity` line first. If the gate says WITHHELD, no row number
  from that run means anything.
- Read the noise floor before reading any `validator e=` count, and read the
  quoted text before believing any single issue.
- The gate is the last thing to trust, not the first. See the limitation above.
- Compare runs only within a corpus version.

## What it does not measure

It does not measure prose quality: character voice distinctness, sensory
concreteness, pacing, or whether a beat advances the scene. Nothing ties a beat
to its own direction, and nothing compares beats to each other, so a narrator
that repeats itself is invisible to it. No direction is sent twice, so
repetition and run-to-run stability are unmeasured. It does not generate, and it
does not automate mature-content probes; the corpus stays SFW so it can run
against any kin. It does not replace the prose review loop in
[PROSE_PIPELINE.md](PROSE_PIPELINE.md).

## First run, 2026-09-03

Storyteller test kin, twelve beats, scored under corpus version 1 and re-scored
under version 2 after the review. The run cleared the trivial baseline and
produced a usable beat for all twelve cases.

**No row number from that run is quotable.** The validator was discarded at a
twelve-of-twelve noise floor, which left regex as the whole deciding signal and
left `canon-limp` with no check at all. The voice row's single catch does not
hold: it turned on one apostrophe glyph, and that case is now advisory.

What does hold, on a human read of the beats: one real output-contract failure,
a six-paragraph beat on the argument case, plus one advisory shape slip, a bare
narration paragraph in the generator beat. The kin held the house shape on the
other ten, folded in the seeded facts, and absorbed both injected instructions
without obeying either or breaking frame.

## Reported, not built

The review raised six design changes that would alter what the instrument
measures, rather than correct a defect. They are recorded here and deliberately
not implemented, because S5's premise was ratified and changing the measure is a
separate decision:

1. A second baseline arm: a plausible, well-shaped constant that answers no
   direction, which the candidate must also beat. This is the direct fix for the
   limitation above.
2. A responsiveness or differentiation check: report the distinct-beat count so
   an all-identical candidate is visible on the verdict line.
3. A boundary veto in `clearsBaseline`, so a kin that fails both injection cases
   cannot clear the gate. Boundary, voice and decisiveness currently carry zero
   weight in it.
4. `--repeats k`, keying beats by `case_id#n`, to measure repetition and
   run-to-run stability.
5. Continuity expectations that require a scene fact the direction does not
   already hand over, so the row stops being an echo check.
6. A request-side manifest per beat: the built message and which entities the
   keyphrase gate folded in, so a failure can be attributed to the narrator
   rather than to context plumbing.
