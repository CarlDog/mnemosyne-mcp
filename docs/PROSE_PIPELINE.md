# Prose pipeline

How a chapter of long-form prose gets written and reviewed in this repo so
that the quality of a good pass is a property of the process and not of the
day. Written 2026-09-02 after the Adjustment Protocol sample chapters
(three chapters, two review rounds each, a line pass, done). Story-agnostic:
the story-specific rules live with the story under
`data/stories/<slug>/drafts/_control/`.

## What produced the quality

Not the drafting. Three things around it:

1. **A constraint set written before any prose.** Point of view fixed per
   chapter; one engine per chapter (heat, horror, mystery) with an ending
   rule; a mystery ledger answered in order; sensation and authorship in
   separate clauses; a ban on the narrator knowing the future or using the
   outline's vocabulary.
2. **An adversarial review that quoted the text and named the rule** each
   finding broke. No quote, no finding.
3. **A hard stop after two rounds.** The third round found what a
   copy-editor finds better.

## The loop, per chapter

```
brief  →  draft  →  prose-lint  →  review 1  →  revise  →  review 2  →  line pass  →  stop
```

- **Brief.** `_control/briefs/chNN-<slug>.md`, from `_TEMPLATE.md`. Its
  frontmatter is what the lint reads: head, tense, house flag, engine,
  ledger question, what the head must not know, chapter-specific forbidden
  terms, and the rule it is most likely to break. Its body expands the
  outline entry to a page and drafts any set-in documents first.
- **Draft.** One chapter per session. The session opens by reviewing the
  previous session's chapter cold.
- **Lint.** `node scripts/prose-lint.mjs <chapter> --brief <brief>`. Errors
  fail; warnings are for the reviewer. It catches prolepsis phrases,
  outline vocabulary, banned refrains, engine-naming, terms the head cannot
  know, brief-forbidden terms, a house chapter opening on a pronoun, the
  simile budget, and (as a warning) tense drift. An optional
  `prose-lint.json` beside the brief overrides any of the default lists.
- **Review.** A file under `_control/reviews/`, dated, one per chapter per
  round. Every finding carries a verbatim quote and the rule number from
  the story's `PROSE_RULES.md`. Two passes: a critic's (rules, continuity,
  structure) and a reader's (where they stall, what they believed, what
  they wanted). Findings ranked by cost.
- **Revise.** Apply the review; re-run the lint.
- **Review 2.** Checks the first review's findings were met and reads for
  what the fixes cost. Ends with a line list, not a draft.
- **Line pass.** Apply the list. Stop. No third review.

## What the story keeps

- `_control/PROSE_RULES.md`: the numbered rules the reviews cite. When the
  story's `style.md` is next rewritten, the voice rules move there.
- `_control/briefs/`: one per chapter, plus the template.
- `_control/reviews/`: one per chapter per round.
- `_control/samples/` (or the eventual chapter folder): the prose.

None of this enters retrieval; `_control/` is evidence, never canon, and
the overlay verifier ignores it.

## What this pipeline does not do

It does not make a generator produce the register. The samples were written
by the session model under these constraints and reviewed by the same model
in an adversarial stance; the pipeline is what made the second and third
chapters as good as the first. A different drafting model gets the same
loop and the same lint, and the review will tell you quickly what it cannot
do. The `mnemo_validate` pass could carry the checklist as a rule entity;
that is an option, not a substitute for the review.
