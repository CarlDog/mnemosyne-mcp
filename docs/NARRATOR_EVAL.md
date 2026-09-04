# Narrator evaluation

**Status:** Protocol recorded 2026-09-03 as narrator design S5
([KINDROID_NARRATOR_DESIGN.md](KINDROID_NARRATOR_DESIGN.md)), run once the same
day against the Storyteller test kin, then adversarially reviewed and corrected
the same evening (corpus version 2). The plausible baseline arm followed
(version 3), and five contradiction pairs that let the gate actually
resolve (versions 4 through 10). It measures a narrator kin; it certifies
nothing on its own. Read "What it does
not measure" before quoting any number it prints. [STATUS.md](../STATUS.md)
remains the source of current priority.

## What it measures

Six rows: canon, continuity, voice, instruction boundary, output contract, and
decisiveness. The corpus in
[`scripts/narrator-eval/corpus.json`](../scripts/narrator-eval/corpus.json) is a
synthetic story, the Halvard set from the 2026-09-03 smoke tests: two
characters, one location, one rule, one style, one scene, and twenty
directions -- nine continuity, three canon, three contract, two each on
voice and boundary, and one on decisiveness. Continuity carries the most,
because "did the narrator do what the direction said" is where mutually
exclusive expectations naturally live, and only such expectations can form
a pair. The two boundary cases are the same attack
in different places: one instruction hidden inside a context scene, one inside
the direction itself. Nothing in the corpus is canon for any real story.

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

## The contradiction pairs

A pattern appears twice in the corpus, as a requirement in one case and a
prohibition in another. There are two such pairs, and they share no case.

**Pair A, a line attributed to Bram.** `contract-argument` stages an argument
between Ilse and Bram, so it **requires** the pattern: an argument needs both
voices on the page. `continuity-alone` drops the hatch shut over Ilse's head
and leaves her below decks by herself, so it **forbids** it: nobody is down
there to speak.

**Pair B, a line attributed to Ilse.** `continuity-speaks` has her cut across
Bram's hedging and put it to him out loud, so it **requires** the pattern.
`continuity-silence` has her let him talk himself out without saying a word,
so it **forbids** it.

**Pair C, plain dialogue itself.** This one is on the contract row, because
its pattern is a house-style form rather than a fact about the scene.
`contract-argument` requires it: an argument rendered without a spoken line
is not the shape the style asks for. `contract-wordless` forbids it, on a
direction where Ilse works the seal open alone with nothing to read or to
answer. A wordless beat is a legitimate shape, and its advisory "no plain
dialogue" hint is expected rather than a fault.

**Pair E, direct address.** `continuity-names` has Ilse say it with his
name in it, to his face, so it **requires** his name inside a quoted line.
`continuity-nameless` has her withhold the name and talk past him, so it
**forbids** it. His name in the narration is fine either way, and so is him
using hers. The marker was chosen from a survey of every beat on disk: it
appears in 41 per cent of them, so neither half is decided in advance.
Three otherwise-attractive markers were rejected because this kin never
produces them at all, and a required half built on any of them would always
fail: an exclamation inside dialogue, a time-jump phrase, and an em-dash
interruption.

**Pair D, a spoken question.** `continuity-asks` has Ilse stop guessing and
put one direct question to Bram, so it **requires** a question mark inside a
quoted line. `continuity-tells` has her tell him what happens next while he
takes it without a word, so it **forbids** it. An unquoted question in
narration is not a spoken one and passes either way.

Pair C reuses pair A's required half, so it does not raise the worst-case
floor; it adds a case a real narrator can separate on. Pair D brings its own
required half, which does raise it. Only rows whose property varies by
occasion can host a pair at all: canon, voice and boundary encode invariants,
so there is no direction under which their expectation flips, and a pair
there would have to ask the narrator to break its own rule. That constraint
is why continuity carries most of the pairs.

Any single fixed text either contains a given pattern or it does not, so
**every constant fails one half of every pair.** The fewest failures a
constant can take is the size of a minimum cover of the pairs, which is now
**four**: `contract-argument` covers pairs A and C, and `continuity-speaks`,
`continuity-asks` and `continuity-names` cover one each. So a responsive narrator has at least
three cases available to separate on, and no single unlucky beat decides the
verdict. This is a structural property rather than a check aimed at one
observed beat: it holds against any canned reply, however written. Verified
against four different constants, including a fluent one with no dialogue at
all and one that performs every speech act at once, which are the shapes that
would evade a design where the pairs hung off too few cases.

The pairs have made the canned beat weak enough that it no longer clears even
the trivial arm: it loses two continuity cases to the forbidden halves, which
is enough to tie a constant that is barely a sentence.

Each pattern matches either attribution order, and treats `"said nothing"` as
silence rather than speech, so a prohibition cannot fail open on a phrasing.
Remembered speech in past perfect, `"he had said"`, a voice too far off to
make out, and an explicit `"and Ilse said nothing"` all pass.

Do not weaken any half, and do not edit the canned beat to change a result.

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
- **`continuity-generator`** asks for a noun the direction already supplies,
  and produced a false failure in two of three live runs: once on an
  inflection, and once on a beat that rendered the generator's death through
  sound and cold and named the fuel line without ever saying "generator".
  Widening the pattern to catch those would be fitting it to observed beats.

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

## The two baseline arms

Every run scores two constants against every case, both through the identical
path as the candidate.

**The trivial arm** is `*She waited.*`. It contradicts nothing, so a canon-only
metric scores it clean, but it fails the output contract outright. A candidate
must beat it on continuity and contract and not lose to it on canon. Clearing
it proves only that the candidate is not degenerate.

**The plausible arm** is the adversarial control, and it is the exact beat that
defeated the single-arm gate on 2026-09-03: correct house shape, fluent, seeded
with the corpus's own nouns, and responsive to none of the twelve directions.
It is sent identically for every case. The scorer reports how many mechanical
cases **separate** the candidate from it, meaning the candidate passes and the
canned beat fails, and how many are **regressions**, the reverse.

The two arms combine into one of three outcomes:

- **does not clear** -- fails the trivial arm. The output is degenerate.
- **inconclusive** -- clears the trivial arm, but no case separates it from the
  canned beat. This corpus cannot tell them apart.
- **clears** -- clears the trivial arm and passes at least one case the canned
  beat fails.

**Inconclusive is a statement about the corpus, not about the narrator.** Under
corpus version 3 the canned beat passed all ten mechanical cases, so every
candidate was inconclusive by construction. The pairs above fixed that: the
canned beat now fails one half of each, so a candidate that answers those
directions separates from it and the gate can reach **clears**. A live run did
under version 4. The margin is two cases rather than one, so a single unlucky
beat no longer decides it.

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

The validator runs over all three scored sets, the candidate and both baseline
arms, so a twelve-case corpus costs 36 calls. Pass `--no-validator` for the
deterministic checks alone; in that mode the scorer imports nothing from
`dist/` and runs on a clean checkout. With the
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
- A corpus version mismatch is printed above the integrity line. Row counts
  are not comparable across versions.
- Read the `run integrity` line first. If the gate says WITHHELD, no row number
  from that run means anything.
- Read the `plausible arm` line before any row count. If it separates on
  nothing, the row counts describe shape and keyword echo, not narration.
- Read the noise floor before reading any `validator e=` count, and read the
  quoted text before believing any single issue.
- The gate's three outcomes are above. `inconclusive` is the expected result
  today and indicts the corpus, not the kin.
- Compare runs only within a corpus version.

## What it does not measure

It does not measure prose quality: character voice distinctness, sensory
concreteness, pacing, or whether a beat advances the scene. No mechanical check
ties a beat to its own direction, which is precisely what the plausible arm
exists to expose rather than to fix. Nothing compares the candidate's beats to
each other, and no direction is sent twice, so a narrator that repeats itself
is invisible and run-to-run stability is unmeasured. It does not generate, and it
does not automate mature-content probes; the corpus stays SFW so it can run
against any kin. It does not replace the prose review loop in
[PROSE_PIPELINE.md](PROSE_PIPELINE.md).

## What each pair has actually bought

The pairs were added one at a time and each was measured. The honest summary is
that **the first pair bought nearly all of the value and the rest bought a
guarantee rather than information.**

| pair | added in | floor after | separations available | narrator ever failed a half on its pattern |
|---|---|---|---|---|
| A, Bram speaks | v4 | 1 | 1 | no |
| B, Ilse speaks | v5 | 2 | 2 | no |
| C, any dialogue | v6 | 2 | 3 | once, on a direction defect since fixed |
| D, a spoken question | v8 | 3 | 4 | no |
| E, direct address | v10 | 4 | 5 | no |

Across four live runs there are 25 observations of a pair half. The narrator
passed every one of them on the pattern itself. The only failures anywhere near
a pair were `contract-argument` twice on paragraph count, which is the shape
check rather than the pattern, and `contract-wordless` once on a direction that
did not say what its check tested.

So pairs two through five have never changed a verdict. What they buy is the
floor: the number of cases a canned reply must fail, which rose from one to
four. That is a guarantee about hypothetical degenerate output, not information
about a real narrator.

**Where the returns fall off.** Pair A was essential: without it the gate read
`inconclusive` by construction. Pair B was worthwhile, because a floor of two
means one unlucky beat cannot swing the verdict. Pairs C through E raised the
floor further and have told us nothing new about this kin. Each also costs two
more cases, about forty seconds of generation per run, and one more required
half that can false-fail.

**What would be worth adding instead.** The checks that actually vary across
runs are the shape check, which has caught a real length slip in four of five
runs, and the noun-echo checks, which vary because they are unreliable rather
than because they are informative. A sixth pair would measure the same
instruction-following competence the narrator has already demonstrated twenty
five times. Better candidates are a reliable replacement for the noun-echo
checks, and a check on a dimension this narrator has actually failed.

## Live runs

### Corpus version 10, 2026-09-03

Storyteller test kin, twenty beats, all usable. **The gate cleared** on five
separating cases, the most so far, and pair E worked first time: asked to
say it with his name in it, it produced "You're lying, Bram"; asked to
withhold the name, it had her answer a question nobody had asked rather than
address him.

Contract came back 3 of 3 for the first time; the length slip that had
appeared in every previous run did not recur. The one failure was
`continuity-prints`, which wants both `prints` and `hatch` and got a beat
that works the prints in close detail without naming the hatch. That is
arguable rather than clear, and it is the second noun-echo case to produce
one, so the case is on watch. It has passed three of four runs, which is not
enough to demote it the way `continuity-generator` was demoted at two of
four; demoting a case on the run where it first fails is how a corpus gets
quietly weakened.

### Corpus version 8, 2026-09-03

Storyteller test kin, eighteen beats, all usable. **The gate cleared**, on
three separating cases, and continuity came back 6 of 6. Pair D worked on its
first outing: asked for a direct question it gave one, and asked to have Ilse
tell Bram what happens next while he takes it without a word, it produced a
flat set of instructions with no question anywhere and Bram answering only
with a nod.

Two failures, one of each kind. `contract-bare` ran to six paragraphs, the
length slip every run has shown. `contract-wordless` failed on one whispered
line, and that one was the corpus's fault: the check forbids any quoted text
while the direction only said Bram was asleep and there was nothing to read
or to answer, which never ruled out Ilse muttering to herself. The direction
now says she does not speak. The verdict above is left as scored, because
scoring reads patterns and not directions, and rewriting a direction must not
retroactively improve a run.

### Corpus version 6, scored under 7, 2026-09-03

Storyteller test kin, sixteen beats, all usable. **The gate cleared**, and the
kin separated on all three pairs. The wordless beat is the clearest of them:
told that Ilse works the seal open alone with nothing to read or to answer, it
gave three paragraphs of pure narration and no spoken line anywhere.

It failed `contract-argument` at eight paragraphs, the same length slip every
run has shown. Reading the beats also demoted `continuity-generator` to
advisory, for the reason under "Advisory cases": it scored a miss on a beat
that answers the direction without using the nouns it demands. That demotion
raises this run's continuity row from 4 of 5 to 4 of 4, and the justification
is the check's demonstrated unreliability rather than the improvement.

### Corpus version 5, 2026-09-03

Storyteller test kin, fifteen beats, all usable. **The gate did not clear**,
and the reason is worth reading rather than the verdict.

The kin separated on **both** pairs, `continuity-alone` and
`continuity-silence`, which is the floor the second pair was built to
guarantee, and it scored 5 of 5 on continuity. On a human read both
separations are earned: told to leave Ilse alone below decks it gave her one
unanswered call and nobody to answer it, and told to let Bram talk himself out
it put him through three attempts at an explanation while she leaned on the
bulkhead with her arms crossed and said nothing.

It failed **both** contract cases, at six and eight paragraphs against a
three-to-five contract. The trivial arm also scores zero on contract, so the
candidate does not beat it there and the gate correctly refuses to clear. That
is the honest reading: this kin follows directions well and does not respect
the length contract. It is also the same length slip both earlier runs showed,
now on every contract case rather than one.

### Corpus version 4, 2026-09-03

Storyteller test kin, thirteen beats, all usable. **The gate cleared**, the
first time it has, and it was earned rather than inherited: the kin passed
`continuity-alone`, writing Ilse below decks with nobody else speaking and her
own call going unanswered, where the canned beat fails. That is one separating
case out of eleven mechanical ones.

The canned beat still did better on one, `contract-bare`, where the kin ran to
six paragraphs against a three-to-five contract. That is the same length slip
the first run showed, and it is real.

Reading the beats also caught a false failure and fixed it: `continuity-generator`
scored a miss on a beat that opens "The overhead lights gave a violent shudder
and died", because the pattern matched only the singular `light`. An inflection
artifact, the same class as the apostrophe bug, and the check was corrected. The
verdict a person reads is still the one that counts.

### First run, 2026-09-03

Storyteller test kin, twelve beats, scored under corpus version 1 and re-scored
under versions 2 and 3 after the review. The run produced a usable beat for all
twelve cases and cleared the trivial arm. It cannot be scored under version 4,
which added a thirteenth case: the scorer names the missing case, withholds the
gate and exits non-zero, which is the guard working rather than a fault.

**Its verdict under two arms is inconclusive.** Zero of ten mechanical cases
separate it from the canned beat, and the canned beat did better on one, the
six-paragraph argument beat. That is the instrument reporting its own limit,
and it is the reason no row count from this run is worth quoting.

**No row number from that run is quotable.** The validator was discarded at a
twelve-of-twelve noise floor, which left regex as the whole deciding signal and
left `canon-limp` with no check at all. The voice row's single catch does not
hold: it turned on one apostrophe glyph, and that case is now advisory.

**The validator does not rescue the corpus either.** Scored against all three
sets, `llama3.1:8b-instruct-q4_K_M` raised errors on the canned beat at a rate
comparable to the real run, 13 contract and 16 voice errors against the run's 6
and 35, and both scored `0/2` on the contract row's validator verdict. So it
separates the candidate from a canned reply no better than the regex does.
Whether a stronger model would is untested, and is the natural next check.

What does hold, on a human read of the beats: one real output-contract failure,
a six-paragraph beat on the argument case, plus one advisory shape slip, a bare
narration paragraph in the generator beat. The kin held the house shape on the
other ten, folded in the seeded facts, and absorbed both injected instructions
without obeying either or breaking frame.

## Reported, not built

The review raised six design changes that would alter what the instrument
measures, rather than correct a defect. Two were built on request; the rest
are recorded here and deliberately not implemented, because S5's premise was
ratified and changing the measure is a separate decision.

**Built:** the plausible baseline arm and the three-state gate (version 3),
and the contradiction pair that lets the gate resolve (version 4).

Still open:

1. Not more pairs. Five pairs across four required halves give a floor of
   four and five achievable separations, and the measurements above show the
   returns have gone flat: no pair half has ever failed on its own pattern.
   The live candidates now are a reliable replacement for the two noun-echo
   continuity checks, and a check on a dimension this narrator has actually
   failed. If a sixth pair is added anyway, it needs its own required half to
   raise the floor, a marker that denotes an action rather than a topic, and
   a survey showing the marker varies across real beats.
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
