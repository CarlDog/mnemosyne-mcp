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
  simile budget, and (as warnings) tense drift and the thought-verb budget.
  An optional `prose-lint.json` beside the brief overrides any of the
  default lists.
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

## Craft appendix: adopted guidance

Surveyed 2026-09-02 against the pipeline's first three books of samples and
reviews. Most of the canonical rule-lists (Leonard, Vonnegut, King's adverbs,
Browne and King's show-don't-tell) were already implicit in the story rules
and the lint; the six below were not, and each names a failure our reviews
had been finding by instinct. Every story's `PROSE_RULES.md` inherits this
appendix; a story may tighten any item and must say so where it loosens one.

### 1. Psychic distance (Gardner, via Emma Darwin)

Narration sits somewhere on a five-step ladder from the historian's distance
to the unmediated inside of a head:

1. "It was winter of the year 1853. A large man stepped out of a doorway."
2. "Henry J. Warburton had never much cared for snowstorms."
3. "Henry hated snowstorms."
4. "God how he hated these damn snowstorms."
5. "Snow. Under your collar, down inside your shoes, freezing and plugging
   up your miserable soul."

Every head has a **home level**, named in `PROSE_RULES.md` and in the brief
(ledger lines and set-in documents sit at 1; a close-third head usually at 3
to 4; a rendered inner voice at 5). Movement off the home level is by steps
and for a reason. The reviewable fault is the **jagged jump**: inside a
character in one sentence, explaining them from outside in the next. Our
"telling the reader what the scene already showed" finding is this jump from
4 to 2.

### 2. Thought verbs (Palahniuk)

*Knew, realised, understood, believed, remembered, wanted, felt that,
wondered* tell the reader what to conclude. Unpack each into the physical
fact that would let the reader conclude it (show the warm combination lock
and the lingering perfume, not "Adam knew Gwen liked him"). The lint warns
past a budget; a thought verb kept is kept on purpose, and Sabine's "she had
decided" is the model of one worth keeping. Corollary: a character alone
starts thinking; keep people in rooms together.

### 3. The heat register (Almond, Benedict, and the Bad Sex Award's lesson)

A sex scene is always about sex and something else (Benedict). The failure
mode the award catalogues is a passage that sounds like a different,
embarrassed author. Defaults, each overridable by a house that says why:

- No clinical anatomy unless the house has licensed the clinical register
  (Brass & Nerve's clinic has; a bedroom has not). No slang euphemism either.
  Name the act in the head's own words; one figure per physical fact at most.
- Desire is sexier than the act. Give the approach its room.
- Senses beyond sound: smell, taste, temperature, texture. Fluids exist.
- Look away from the genitals; the detail that carries a scene is elsewhere.
- The mind keeps thinking during sex; the interior voice does not switch off.
- Consent dramatised, never paperwork: who asks, who waits, who names the
  worst case, who says the time.

### 4. Crowding and leaping (Le Guin)

Crowd the moments that matter with exact sensation; leap over everything
else. "What you leave out is infinitely more important than what you leave
in." Read the whole chapter aloud before handing it over; the ear catches
the rhythm faults the eye forgives. The critic's reader pass asks, for each
stall, whether the prose crowded what did not matter or leapt over what did.

### 5. Two revision rules (King)

*Write with the door closed, rewrite with the door open.* The draft is for
the writer and one ideal reader; the revision is for the world. The critic's
reader pass is that ideal reader, named. *Second draft equals first draft
minus ten percent*: the line pass has a target, cut from the soft middle and
never from the ending.

### 6. Every character wants something (Vonnegut)

"Even if it is only a glass of water." The brief carries one line per person
in the room, speaking or not; a person with no want has no place in the
scene.

Sources: Gardner, *The Art of Fiction* (Darwin's summaries at
emmadarwin.substack.com); Palahniuk, "Nuts and Bolts: Thought Verbs"
(LitReactor); Almond, "How to Write a Sex Scene" (Utne); Benedict, *The Joy
of Writing Sex*; Le Guin, *Steering the Craft*; King, *On Writing*; Vonnegut,
introduction to *Bagombo Snuff Box*; Leonard, "Ten Rules of Writing".

## What this pipeline does not do

It does not make a generator produce the register. The samples were written
by the session model under these constraints and reviewed by the same model
in an adversarial stance; the pipeline is what made the second and third
chapters as good as the first. A different drafting model gets the same
loop and the same lint, and the review will tell you quickly what it cannot
do. The `mnemo_validate` pass could carry the checklist as a rule entity;
that is an option, not a substitute for the review.
