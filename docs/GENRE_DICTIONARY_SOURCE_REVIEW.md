# Adversarial source review: `src/genre-dictionary.json`

**Date:** 2026-09-19. **Under review:** the 39-term, 20-root dictionary shipped in
c851d3c, against external reputable sources. **Reviewer standard:** no finding
without a verbatim source quotation and a URL.

## Disposition

**Every finding below was accepted and applied the same day.** The dictionary is
now 40 terms and 27 roots at version 2. The operator raised one further
finding the review had missed, recorded as P1 below.

| | Count |
|---|---|
| Terms reparented | 7 |
| Entries rewritten | 13 |
| Terms merged away | 2 (into `action-adventure`) |
| Terms added | 3 |

No story carried a declaration yet, so nothing needed migrating, and only one
changed term (`action`) appeared anywhere in the tracked tests.

### P1 — content-policy language stated as genre convention (raised by the operator)

Two entries, `erotica` and `romance`, carried a content boundary in fields meant
to describe the genre. The review had noticed the wording and wrongly excused it
as a deliberate house rule rather than reporting it. It is a category error on
three counts. It is **misplaced**: a term's `avoid` says what makes a story stop
being that genre, and such a boundary does not vary by genre, so naming it in one
term implies the other thirty-nine are exempt. It is **descriptively wrong**:
requiring consent and consequence excludes dubcon, dark romance and plotless
erotica, all openly published parts of the category, which is the same error as
`fantasy` requiring ruled and costly magic. And it is **ineffective**: dictionary
text travels into prompts as genre guidance, so it reaches a model as style
advice, whereas the boundary that is actually enforced is the story-level
`content_rating` checked fail-closed at the single `dispatchGenerate()` call site
(`docs/CONTENT_ROUTING_DESIGN.md`). Both entries are now purely descriptive. The
genuine genre boundary for erotica is the fade to black, and that is what its
`avoid` line now says. The enforced boundary is unchanged.

## What the dictionary was checked against

| Source | What it is | How it was read |
|---|---|---|
| BISAC Subject Headings, FICTION list | The book trade's controlled vocabulary (Book Industry Study Group), used by every US retailer and distributor | Live page downloaded and parsed locally; 414 headings extracted |
| LCGFT (Library of Congress Genre/Form Terms) | The cataloguing authority: authorized labels, broader/narrower terms, scope notes | All 39 terms plus 31 coverage candidates resolved through the public authority service |
| The Encyclopedia of Science Fiction (Clute/Langford) | The standing scholarly reference for the speculative genres | Entries fetched for space opera, cyberpunk, dystopias, definitions of SF |
| Romance Writers of America | The romance genre body's own definition | Definition confirmed through Britannica's summary of it and corroborating sources |
| Historical Novel Society | The historical-fiction body's own definition | Definition confirmed through the society's own guide pages |
| Horror Writers Association / Douglas Winter | The horror field's standing definitional statement | Confirmed through multiple corroborating sources |
| Otto Penzler | The most-cited working distinction between noir and hardboiled | Essay and interviews |
| Farah Mendlesohn, *Rhetorics of Fantasy* (Wesleyan UP) | The standard academic taxonomy of fantasy by reader/protagonist relationship | Publisher and encyclopedia summaries |

### Coverage of the dictionary by the cataloguing authority

| Result | Count | Terms |
|---|---|---|
| Exact LCGFT authorized term exists | 30 | — |
| Resolves only through a variant or umbrella label | 4 | crime, coming-of-age, post-apocalyptic, space-opera |
| No LCGFT fiction term at all | 5 | heist, urban-fantasy, cosmic-horror, literary, slice-of-life |

Of the five with no cataloguing term, three are backed by BISAC anyway
(`FICTION / Literary`, `FICTION / Fantasy / Urban`, `FICTION / Horror / Cosmic &
Eldritch`). Only `heist` and `slice-of-life` are unsupported by both.

## The standard this review applies

This dictionary exists to steer generation, not to catalogue books, so
divergence from a cataloguing authority is not automatically a defect. A finding
is only reported when the divergence does one of three things:

1. **Breaks a declaration.** The no-ancestor rule means a wrong parent forbids a
   pairing a real story needs, or permits a redundant one.
2. **Contradicts the dictionary itself.** A child that cannot satisfy its own
   parent's definition.
3. **Misstates what the genre promises**, so a story guided by the entry would
   miss the convention that defines it.

Findings that survive only as "the authorities word it differently" are reported
as minor and flagged as arguably intentional.

---

## Findings

### Blockers

**B1 — `procedural` under `crime` contradicts the dictionary's own definition of `crime`.**
`crime` is defined as "The commission and consequence of a crime **from inside
it**"; `procedural` is "The work is the plot: cases, shifts, protocols and the
people who keep them." A procedural is told from the investigators' side, which
is the opposite of "from inside" the crime, so no procedural can satisfy its own
parent. The trade authority agrees on where it belongs: BISAC files it as
`FICTION / Mystery & Detective / Police Procedural` (FIC022020), under Mystery,
not under `FICTION / Crime` (FIC050000). Fix: reparent `procedural` to `mystery`.

**B2 — `western` under `historical` makes a contemporary western undeclarable.**
Both authorities make the western a root: LCGFT's "Western fiction" has the
broader term "Fiction" and the scope note "Fiction that features the American
West during the period of westward expansion"; BISAC has `FICTION / Westerns`
(FIC033000) as a top-level heading beside `FICTION / Historical / General`
(FIC014000). Because of the no-ancestor rule, `["historical", "western"]` is
currently forbidden, and a modern-day western cannot be declared without
asserting a historical frame that is false. Fix: make `western` a root.

**B3 — `romance` omits the one promise that defines the genre.**
The entry promises "An emotionally earned resolution of the central relationship
between adults," which a tragic ending satisfies. Romance Writers of America
define the genre by two elements: "a central love story and an emotionally
satisfying and optimistic ending." The optimistic ending is the line between
romance and a love story, and it is the single most actionable convention in the
whole dictionary for guiding a story. Fix: put the optimistic, emotionally
satisfying ending into `promises`, and make its absence the `avoid`.
(The "between adults" clause is this repository's own house rule, not part of the
genre definition; that reads as deliberate and is not a finding.)

### Major

**M1 — `dystopian` under `political` is unsupported and inverts the consensus.**
LCGFT gives "Dystopian fiction" the broader term **Science fiction**; BISAC makes
`FICTION / Dystopian` (FIC055000) top-level, separate from `FICTION / Political`
(FIC037000); the Encyclopedia of Science Fiction defines dystopia as "that class
of hypothetical societies containing images of worlds worse than our own" and
notes the term "has in the twenty-first century frequently been used as close to
synonymous with Science Fiction." The current parent forbids
`["political", "dystopian"]`, which is the pairing the consensus would most
expect to allow. Fix: make `dystopian` a root, since it genuinely spans the
political and science-fiction frames.

**M2 — `psychological` is parented wrongly and defined as the psychological thriller.**
The entry reads "Interior states drive events and **perception cannot be fully
trusted**," with the avoid line "A twist that invalidates everything the reader
felt." LCGFT's "Psychological fiction" is a root whose scope note is "Fiction in
which the thoughts, feelings, and motivations of the characters are of equal or
greater interest than the external action of the narrative" — interiority, with
no claim about unreliable perception. The untrustworthy-perception form is a
separate BISAC heading, `FICTION / Thrillers / Psychological` (FIC031080),
distinct from `FICTION / Psychological` (FIC025000). Fix: make it a root, define
it by interiority, and let a story that wants unreliable perception say so in its
own `lean`.

**M3 — `paranormal`'s exclusion clause contradicts the standard scope of the term.**
The entry defines paranormal as the supernatural intruding "**without a hidden
society or a rulebook**." LCGFT's "Paranormal fiction" says the opposite is
typical: "human characters that are often involved in the occult, witchcraft,
spiritualism, psychic phenomena, vodou, etc., interacting with supernatural
beings," and its narrower terms are Ghost stories, Vampire fiction, Zombie
fiction, Werewolf fiction, Witch fiction and Paranormal romance fiction. Vampire
covens and witch circles are hidden societies with rules, and they are the core
of the category. The exclusion is really Mendlesohn's *intrusion fantasy*, one of
her four categories ("portal-quest, immersive, intrusion, and liminal") which
classify a story's rhetoric, not its market genre. Fix: drop the exclusion; let
`paranormal` and `urban-fantasy` differ by whether the world is otherwise
ordinary.

**M4 — `fantasy` requires magic to be "ruled and costly", which excludes much of the genre.**
The entry defines fantasy as "A world where magic is real, **ruled and costly**"
and avoids "Magic as a free solution." LCGFT: "Fiction in which magic and
extraordinary characters are integral to the story." Fairy-tale, mythic and much
portal fantasy have unruled, uncosted magic; under the current entry every such
story is declared against a promise it will break. Fix: define by magic being
integral; move "ruled and costly" to the story's own `conventions`, which is
exactly what that free-text field exists for.

**M5 — `science-fiction`'s "rigour" contradicts its own child `space-opera`.**
Science fiction is "A change in what is possible, followed through with **rigour**"
and avoids "The premise as scenery"; its child `space-opera` promises
"Interstellar scale, factions and spectacle." The Encyclopedia of Science Fiction
records that space opera was coined as a pejorative for "the 'hacky, grinding,
stinking, outworn, spaceship yarn'" and came to mean "colourful action-adventure
stories of interplanetary or interstellar conflict" — that is, the form is
defined by *not* being rigorous. The same encyclopedia says of the genre at large
that "No one has yet emerged with a prescription sufficiently inclusive to satisfy
all or even most readers." Every space opera declaration therefore inherits an
avoid line it structurally violates. Fix: soften the parent's avoid line, and put
rigour on a `hard-sf` term or in a story's own conventions.

**M6 — `magical-realism` under `literary` is unsupported and forbids the natural declaration.**
LCGFT's "Magic realist fiction" is a root ("Modern fiction in which fantastic or
mythical elements are included in a narrative that is otherwise realistic");
BISAC has `FICTION / Magical Realism` (FIC061000) top-level, separate from
`FICTION / Literary` (FIC019000). The current parent forbids
`["literary", "magical-realism"]`, which is how the canonical works would be
declared. Fix: make it a root.

**M7 — `mystery` defines the whole genre by one historical school.**
The entry promises "Fair clues and a solution a reader could have reasoned to"
and avoids "A solution delivered by confession alone." Fair play is the
Golden-Age convention codified by Ronald Knox's Decalogue (1929) and S. S. Van
Dine's "Twenty Rules for Writing Detective Stories" (1928) — one school of the
1920s and 30s, not the genre. BISAC's Mystery & Detective family has eighteen
sub-headings including Hard-Boiled, Police Procedural and Private Investigators,
none of which promise fair play. Fix: define by the investigation of an unknown
fact; leave fair play to a story's conventions or a `fair-play` subgenre.

**M8 — `gothic` under `horror` is unsupported by both authorities.**
LCGFT's "Gothic fiction" is a root, with the scope note "Fiction that depicts
gloomy and antiquated settings, characters that are haunted by secrets and
unresolved conflicts, psychological and physical terror, and elements of the
supernatural." BISAC lists it top-level as `FICTION / Gothic` — and, tellingly,
under the code FIC027040 in the Romance family, a trace of the gothic romance
lineage. The current parent forbids `["horror", "gothic"]` and forces a gothic
romance to carry a horror frame. Fix: make `gothic` a root.

**M9 — `action` and `adventure` are one category in both authorities, and are not distinguishable as written.**
LCGFT has a single term, "Action and adventure fiction"; BISAC has a single
heading, `FICTION / Action & Adventure` (FIC002000). The two entries' avoid lines
are near-duplicates: "Fights without stakes or consequence" against "Stakes that
reset between set pieces." A declarer has no reliable basis for choosing, and
declaring both burns two of the three genre slots on one idea. Fix: merge into a
single root.

**M10 — the `avoid` lines encode craft opinions as genre boundaries (systemic).**
This is one finding about a pattern, not ten. `horror` avoids "Explaining the
threat early" — but the Horror Writers Association's standing definitional
statement is that "Horror is not a genre... Horror is an emotion," and LCGFT
defines it by intent: "Fiction that is intended to shock or frighten by inducing
feelings of revulsion, terror, or loathing." Neither says anything about when the
threat is explained, and canonical horror routinely explains it early. The same
shape appears in `gothic` ("Modern irony about its own dread", which rules out
the entire modern gothic revival) and `retelling` (below). Because the design
sends `avoid` into every prompt for every story in that genre, these opinions
become unopt-outable house style. Fix: keep the field but scope it to genre
violations, and let contested craft preferences live in each story's own
free-text `avoid`, where the operator can dissent per story.

**M11 — `coming-of-age` under `drama` makes it inherit "no genre machinery".**
LCGFT's "Coming-of-age fiction" is a root (with "Bildungsromans" as a variant),
scope note "Fiction depicting the development of a character from youth to
adulthood"; BISAC has `FICTION / Coming of Age` (FIC043000) top-level. The
dictionary's `drama` is defined as "Character conflict with serious stakes and
**no genre machinery**; the frame only when no other root is true" — so the
current parent asserts that every coming-of-age story is machinery-free, which
most are not. Fix: make it a root.

**M12 — `retelling`'s promise forbids the commonest kind of retelling.**
It promises "Recognisable beats **knowingly subverted**" and avoids "Retelling the
source beat for beat", which excludes the faithful retelling. Neither authority
recognises "retelling" as a genre at all: LCGFT's nearest term is "Adaptations",
whose broader term is **Derivative works** and whose note is "Paraphrases,
rewritings, etc., that are intended for a different audience or purpose, or are
in a different form, from the original" — nothing about subversion. BISAC's
nearest heading is `FICTION / Fairy Tales, Folk Tales, Legends & Mythology`
(FIC010000). Fix: keep the term if wanted, but let the promise cover faithful
retellings; consider `fairy-tale` and `mythological` as the real source families.

### Minor

**m1 — `drama`, `comedy` and `tragedy` are theatrical forms in both authorities.**
LCGFT's "Drama" sits under Literature with narrower terms that are all play
forms (Comedy plays, Detective and mystery plays, Domestic drama), and
"Tragedies (Drama)" sits under it. The fiction-side equivalents are "Humorous
fiction" (whose variant labels include "Comedy fiction") and "Satirical fiction".
BISAC's FICTION list has no Drama, Comedy or Tragedy heading at all — it has
`FICTION / Humorous / General` (FIC016000) and `FICTION / Satire` (FIC052000).
The labels are nonetheless standard in screen and streaming usage, so this is
probably intentional; worth noting that `tragedy` in particular names a
play form in every catalogue. Separately, `drama`'s definition embeds a
procedural instruction ("the frame only when no other root is true") inside a
definition field, where the dictionary's own `rule` field belongs.

**m2 — `historical` has no time threshold.**
The Historical Novel Society requires a novel "written at least fifty years after
the events described, or by an individual who was not alive at the time of those
events, and thus approaches them from a research perspective." The entry's "A
real period rendered with fidelity to its material life" would admit a novel set
three years ago. Fix: add the threshold to the definition.

**m3 — `heist` and `slice-of-life` are supported by neither authority.**
LCGFT has "Caper films" and "Caper television programs" but no caper *fiction*,
and "Slice-of-life comics" but no slice-of-life *fiction*; BISAC has no heading
containing "Heist" or "Slice". Both are real in trade and critical usage, but the
dictionary's own rule says "anything narrower than a dictionary term goes in
subgenres", which is where a strict reading would put them. `literary` is in the
same position at LCGFT but is backed by BISAC (FIC019000), so it stands.

**m4 — `noir` under `crime` is contestable.**
LCGFT puts "Noir fiction" under Detective and mystery fiction; BISAC makes
`FICTION / Noir` (FIC062000) top-level. Either way it is not obviously a child of
`crime`. The *definition* is the strongest in the dictionary and needs no change:
Otto Penzler's standard distinction is that noir is about "losers... so morally
challenged that they cannot help but bring about their own ruin," where in
hardboiled "the detective is the moral center... he doesn't fall" — which is
almost exactly the entry's "a compromised protagonist and an ending that costs."

---

## What the sources confirm as correct

Worth stating, because it is most of the dictionary:

- **Parents confirmed by LCGFT:** `cyberpunk`, `steampunk`, `post-apocalyptic`
  and `portal-fantasy` all sit under Science fiction / Fantasy fiction exactly as
  the dictionary has them. `satire` under `comedy` matches LCGFT's placement of
  "Satirical fiction" under "Humorous fiction".
- **Parents confirmed by BISAC:** `cosmic-horror` under horror
  (`FICTION / Horror / Cosmic & Eldritch`), `urban-fantasy` under fantasy
  (`FICTION / Fantasy / Urban`), `espionage` under thriller
  (`FICTION / Thrillers / Espionage`).
- **Roots confirmed by both:** fantasy, science-fiction, horror, romance,
  erotica, historical, political, thriller, war, mystery.
- **The crime/mystery split is defensible.** LCGFT collapses them — "Crime
  fiction" is merely a variant label of "Detective and mystery fiction" — but
  BISAC keeps both (`FICTION / Crime`, `FICTION / Mystery & Detective`), which is
  the usage this dictionary follows.
- **`superhero` as a root is better than the authority's own choice.** LCGFT gives
  it two broader terms, Fantasy fiction *and* Science fiction. Because the
  no-ancestor rule would then forbid one of those pairings, making it a root is
  the right call for this vocabulary, and BISAC agrees (`FICTION / Superheroes`).
- **`war` correctly excludes peacetime military fiction**, matching LCGFT's own
  note distinguishing War fiction from Military fiction.

## Coverage gaps

Terms both authorities treat as major that the dictionary lacks and that are
**not** expressible as a blend of existing terms:

- **alternate-history** — BISAC `FICTION / Alternative History` (FIC040000);
  LCGFT "Alternative histories (Fiction)". Not a blend: `historical` promises
  period fidelity, which alternate history breaks by definition, and
  `science-fiction` does not capture it. The clearest gap in the set.
- **fairy-tale / mythological** — BISAC `FICTION / Fairy Tales, Folk Tales,
  Legends & Mythology` (FIC010000); LCGFT "Fairy tales" (under Folk tales) and
  "Mythological fiction". Only partly covered by `retelling` plus `fantasy`.
- **military** — LCGFT "Military fiction", explicitly distinguished from War
  fiction as "the military lifestyle... generally set during peacetime". The
  dictionary's `war` covers wartime only.

Expressible as blends, so **not** gaps: dark fantasy (`fantasy` + `horror`),
paranormal romance (`romance` + `paranormal`), romantic comedy (`romance` +
`comedy`), suspense (`thriller`), ghost and occult (`paranormal`, once M3 is
fixed), disaster (`post-apocalyptic` or `thriller`).

Borderline, probably subgenre text: time travel (BISAC gives it a top-level
heading, FIC028080), epic fantasy, absurdist, sagas, sea stories, sports.

One curiosity worth knowing given this project's interactive-fiction use: LCGFT
has an authorized term **"LitRPG (Fiction)"** under Fantasy fiction.

## What could not be verified

- **Encyclopaedia Britannica** blocks automated fetching entirely (HTTP 403 to
  both the fetch tool and a direct request). Its definitions of the Western,
  the detective story and the Gothic novel were read through search summaries
  rather than the pages themselves, so the Western quotation above is reported
  as a summary, not a verbatim Britannica sentence.
- **The Encyclopedia of Fantasy** entries (urban fantasy, magic realism, portals,
  twice-told) resolve to science-fiction-side stub pages that carry only a link
  to the fantasy text; the fantasy entries themselves were not retrievable.
  Mendlesohn's taxonomy was therefore taken from the publisher and encyclopedia
  summaries rather than from the Encyclopedia of Fantasy directly.
- **The Horror Writers Association's own "What is Horror Fiction?" page** returns
  404. The Douglas Winter statement the association is documented as endorsing
  was confirmed through corroborating sources instead.
- **Romance Writers of America's own site** returns 404 on the definition page;
  the two-element definition was confirmed through Britannica's summary of it and
  corroborating sources.

## Sources

- [BISAC Subject Headings — FICTION](https://www.bisg.org/fiction)
- [LCGFT — Library of Congress Genre/Form Terms](https://id.loc.gov/authorities/genreForms.html)
- [The Encyclopedia of Science Fiction: Space Opera](https://sf-encyclopedia.com/entry/space_opera)
- [The Encyclopedia of Science Fiction: Definitions of SF](https://sf-encyclopedia.com/entry/definitions_of_sf)
- [The Encyclopedia of Science Fiction: Cyberpunk](https://sf-encyclopedia.com/entry/cyberpunk)
- [The Encyclopedia of Science Fiction: Dystopias](https://sf-encyclopedia.com/entry/dystopias)
- [Britannica: What defines a romance novel according to the Romance Writers of America?](https://www.britannica.com/question/What-defines-a-romance-novel-according-to-the-Romance-Writers-of-America)
- [Historical Novel Society: our definition of historical fiction](https://historicalnovelsociety.org/guide-our-definition-of-historical-fiction/)
- [Otto Penzler: Noir Fiction Is About Losers, Not Private Eyes](https://www.huffpost.com/entry/noir-fiction-is-about-los_b_676200)
- [Wesleyan University Press: Rhetorics of Fantasy (Farah Mendlesohn)](https://www.weslpress.org/9780819568687/rhetorics-of-fantasy/)
- [Nightmare Magazine: Horror Is… Not What You Think or Probably Wish It Is](https://www.nightmare-magazine.com/nonfiction/horror-not-think-probably-wish/)
- [Agatha Christie Wiki: The "Rules" of Detective Fiction (Knox, Van Dine)](https://agathachristie.fandom.com/wiki/The_%E2%80%9CRules%E2%80%9D_of_Detective_Fiction)
- [Britannica: Western](https://www.britannica.com/art/western)
