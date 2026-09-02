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

## Foreign and archaic text the reader may not understand

Researched 2026-09-02 after the Noctis Veil's Chapter 2 sample set a
seventeenth-century Spanish document beside its English and the operator
found that the Spanish did not carry. The codified practice, from the
Chicago Manual of Style's fiction guidance and the working advice of
novelists, comes down to one decision and four techniques.

**The decision.** Either the reader is meant to understand the text or they
are not, and the page must commit. A foreign passage the reader cannot
read, followed by its translation, is read once (the translation) and the
original becomes decoration. If the reader is meant to understand, present
the text in English. If they are not, the point-of-view character does not
understand it either, and the page gives the reader exactly what that
character gets: sound, a word or two, a face, and a narrative summary
("she said something in Spanish that ended on his name").

**The four techniques**, in rising order of how much foreign text survives:

1. **English throughout, with the language named.** "I will not leave you,"
   he said in Spanish. Works when the point-of-view character understands
   the language. For a document, this is a translation, and the page says
   so in its heading (and may leave the translator uncredited if that is a
   plot point).
2. **A few words kept**, the ones the target language has no word for, each
   glossed in the sentence that carries it, never in a parenthesis or a
   footnote, and the meaning of the sentence intact if the foreign word
   were deleted. Italicise on first use at most; Chicago's 18th edition
   (11.4) says a term in a character's own mouth "would rarely merit
   italics," and Hemingway's unitalicised Spanish is the standard example of
   how roman type reads as authenticity where italics read as mannered.
3. **A sentence or two untranslated**, only when the point-of-view character
   also cannot read it, and only when the scene is about not understanding.
   Context or another character translates, organically, later, or never.
4. **Extended untranslated text** (Díaz's unitalicised, unglossed Spanish)
   is a deliberate political and aesthetic choice that asks the reader to
   guess or look it up. It belongs to a narrator who lives in both
   languages; it does not belong in a set-in document.

**Archaic English and old spelling.** Modernise. Historical novelists'
working rule is to err on the side of accessibility: period vocabulary in
context, one archaic term clarified by the sentence around it ("the short
sword they called a seax"), original spelling never, because spelling was
not standardised before the nineteenth century and a reader cannot tell
authenticity from typo. A document's age is carried by its register
(formulae, sentence shapes, what it will not say) and its heading (place,
year, hand), not by orthography.

**Applied here.** A set-in document in another language is presented as a
translation, headed as such, with the handful of untranslatable terms kept
and glossed inline, roman after first use. The original language returns
on the page only when a character reads it aloud and the scene is about
what she can and cannot say. Sources: CMOS Shop Talk, "Italics for
Non-English Words in Fiction" (2020); CMOS 18th ed. 11.4; Janice Hardy,
"How to Use Foreign Languages in Fiction" (2019); Carla Nayland, "Archaic
terminology in historical fiction" (2006); scholarship on Junot Díaz's
linguistic simultaneity.

## What this pipeline does not do

It does not make a generator produce the register. The samples were written
by the session model under these constraints and reviewed by the same model
in an adversarial stance; the pipeline is what made the second and third
chapters as good as the first. A different drafting model gets the same
loop and the same lint, and the review will tell you quickly what it cannot
do. The `mnemo_validate` pass could carry the checklist as a rule entity;
that is an option, not a substitute for the review.
