# Vague-Direction Enrichment Benchmark — Candidate Fixtures

**Status: candidate, unreviewed.** Generated 2026-09-08 as Phase 4a of the
`docs/RESEARCH_DECISION_QUEUE.md` recorded plan — a starting point for the
operator to correct, not a ratified corpus. Every entity name, scene, and
plot fact below was read from real story content (see "Sourcing," below);
the `Expected entities` / `Excluded entities` / rationale on each fixture
is this session's best-effort guess, explicitly meant to be crossed out and
corrected rather than trusted.

This is the fixture set `docs/RETRIEVAL_CONTROLS_DESIGN.md` (ratified
2026-08-28) needs before `MNEMO_QUERY_ENRICHMENT` can flip on: "the vague
fixture set MUST include short-but-rich negatives... Metrics: (a) recall of
the entities a human marks as expected for the scene, (b) unwanted
persistence of characters/locations that have exited." Nothing here runs
yet — no benchmark script exists (that's a separate, not-yet-scoped piece
of engineering work); this document is purely the labeled-fixture input
that script will eventually need.

## How to review this

For each fixture:

1. Read the direction and the scene context.
2. Cross out / rewrite `Expected entities` to match what YOU think a human
   continuing this story would actually want retrieved.
3. Cross out / rewrite `Excluded entities` similarly — name anything that
   should NOT surface just because it's thematically nearby.
4. Where a rationale says "judgment call" or "ambiguous," that's a flag
   this session genuinely couldn't resolve alone — look closely there.
5. Delete any fixture that doesn't feel like a fair test; add more if a
   story needs a case this session missed.

Once corrected, this feeds a benchmark script (not yet built) that runs
`gatherContext` with `MNEMO_QUERY_ENRICHMENT` on and off against each
fixture's direction, scored against the corrected expected/excluded lists.

## Sourcing

Read directly from `data/stories/<slug>/canon/` and `.../drafts/scenes/`
(gitignored, not in git) by a research pass on 2026-09-08. Every entity
name below is quoted verbatim from that story's own character/location/lore
frontmatter or header. Every scene excerpt is quoted verbatim from the
actual scene file. Nothing here is invented. Where a story's data has a
real wrinkle (stale `Current Status` fields, contradictory scene numbering,
a draft scene superseded by later canon), it's noted rather than smoothed
over, since the benchmark should be honest about what it's testing against.

**Coverage gap, not filled in:** `midnight-is-a-suggestion` has zero played
scenes anywhere in its tree (confirmed: no `canon/scenes/`, no
`drafts/scenes/`, and the story's own `drafts/README.md` states "No
Mnemosyne scene has been played"). Vague-direction enrichment depends on
there being a most-recent scene to append, so **no vague/enrichment fixture
is possible for this story until it has at least one played scene.** Its
two fixtures below are explicit-direction-only (recall baseline, no
enrichment path exercised).

---

## battlechasers

**Scene anchor:** `drafts/scenes/btc-c01-09-wnm--the-wane-marches.md` ("The
Wane Marches," closes Chapter One). Lilith alone at an overlook above the
Reach Below, in dialogue with an unidentified "Voice" about something
moving in the stone. Ends: *"Then they should have built shorter walls."
And with that, she stepped into the dark.*

Entities in this scene: **Lilith**, an unnamed "Voice," **The Reach
Below**. None of Karl's or Hodrek's parties appear. No character in this
story is flagged as narratively exited.

### BTC-1 (vague — pure)

- **Direction:** `continue`
- **Category:** vague (normalized-set match; enrichment should fire,
  appending "The Wane Marches" + its tail to the reference queries)
- **Expected entities:** Lilith; The Reach Below
- **Excluded entities:** Karl Jager, Hodrek Sootbraid, Wisp, Nira Vale
  (older twin) — none are in the anchor scene, and nothing suggests the
  next beat is a POV switch
- **Rationale:** A bare continuation right after a POV scene should stay
  with that POV's cast and setting, not resurface the other party just
  because they exist in the story.

### BTC-2 (short-but-rich negative)

- **Direction:** `Karl finds her`
- **Category:** vague-length (16 chars, under the 20-char floor) but
  contains a known entity-name token ("Karl") — `isVagueDirection` should
  classify this **false** (not vague), so enrichment must NOT fire
- **Expected entities:** Karl Jager; Lilith
- **Excluded entities:** Hodrek Sootbraid, Wisp — the direction names its
  own subject and object; nothing calls for the second party
- **Rationale:** This is the exact shape RETRIEVAL_CONTROLS_DESIGN calls
  out by name ("Aria dies" — 9 chars, maximally information-rich). A
  classifier bug that enriches this anyway would bury "Karl" and "her"
  under the Wane Marches excerpt's vocabulary (Lilith, the Voice, the
  stone) instead of surfacing Karl himself.

### BTC-3 (explicit — control)

- **Direction:** `Hodrek and Lyra argue with Fenna about whether to follow the tremors toward the Reach Below`
- **Category:** explicit/rich (well over the length floor; enrichment
  never applies to explicit directions regardless of length)
- **Expected entities:** Hodrek Sootbraid; The Reach Below (Lyra Vance,
  Fenna "Spark" Darrin weren't in the research pass's read list — confirm
  their exact canon names before using this fixture)
- **Excluded entities:** Lilith, Karl Jager, Wisp — a control case; if
  enrichment somehow changed this fixture's results at all, that's a bug
  (explicit directions must be untouched)
- **Rationale:** Control group per the design's own acceptance-test
  language ("vague and explicit direction sets scored separately").

---

## brass-and-nerve

**Scene anchor:** `drafts/scenes/bn-d01-12-bed--good-morning-doctor-thorne.md`
("Good Morning, Doctor Thorne," confirmed last of 12 via the story's own
catalog, flagged `STORY_ENDS_HERE_UNANSWERED`). Full scene, three lines:
Evelyn wakes beside Eliza at Briar House, the morning after; the story
stops there, unresolved.

Entities in this scene: **Evelyn Starling**, **Dr. Eliza Thorne**. No one
else. Six canon entities (Brass Guild Hall, Inspector Sabine Rook,
Guildmaster Hester Crane, Ada Pell, Moira Brindle, Dr. Leda Winn) exist in
lore for the not-yet-played Guild-pressure plot and appear in **zero** of
the 12 played scenes — the cleanest exited-entity set of the five stories.

### BN-1 (vague — pure)

- **Direction:** `continue`
- **Category:** vague (normalized set)
- **Expected entities:** Evelyn Starling; Dr. Eliza Thorne; Briar House
- **Excluded entities:** Gideon Vale (off-page since scene 10, not in the
  anchor scene); Inspector Sabine Rook, Guildmaster Hester Crane, Ada Pell,
  Moira Brindle, Dr. Leda Winn, The Brass Guild Hall — none has ever
  appeared on-page
- **Rationale:** This is the strongest unwanted-persistence test of the
  five stories: six real canon entities exist, are richly documented, and
  have simply never entered the played story. If enrichment (or any
  retrieval path) surfaces the Guild Hall cast here, that's exactly the
  failure mode metric (b) exists to catch.

### BN-2 (short-but-rich negative)

- **Direction:** `Gideon returns`
- **Category:** vague-length (14 chars) but names a known entity ("Gideon")
  — should classify as NOT vague
- **Expected entities:** Gideon Vale; Evelyn Starling; Dr. Eliza Thorne
- **Excluded entities:** the six Guild-plot entities, same reasoning as
  BN-1
- **Rationale:** Gideon has been off-page since scene 10 but is not
  narratively exited (no death/departure stated) — a direction naming him
  should surface him even though the anchor scene doesn't mention him.
  Tests that the entity-name condition correctly reads a name the recent
  scene omits.

### BN-3 (explicit — control)

- **Direction:** `Evelyn shows Eliza the completed rune-work on the arm brace before the Guild inspection`
- **Category:** explicit/rich
- **Expected entities:** Evelyn Starling; Dr. Eliza Thorne
- **Excluded entities:** the six Guild-plot entities — mentioning "the
  Guild inspection" generically should not pull in specific never-appeared
  Guild characters
- **Rationale:** Judgment call flagged for the operator: does naming "the
  Guild inspection" in a direction justify surfacing Guildmaster Hester
  Crane by name, even though she's never appeared on-page? This session's
  guess is no (the direction doesn't name her), but that's a real edge the
  operator should decide deliberately.

---

## chaos-saga

**Scene anchor:** `drafts/scenes/cs-034-08-hlr--soft-coda.md` ("Soft Coda").
**Data wrinkle, noted rather than smoothed over:** this story's scene
catalog has a numbering/date contradiction (scenes numbered 034/035 are
chronologically swapped relative their labels); CS-034 was confirmed most
recent by its actual `story_time` field (2025-05-10), not by number alone.
Full scene: Carl, Riley, and Jenna arrive home exhausted after a long day,
share a quiet moment on the couch — no dialogue beyond a few short lines,
no conflict, the day just ending.

Entities in this scene: **Carl Maddox**, **Riley Quinn**, **Jenna Maren**,
**Chaos House**.

### CS-1 (vague — pure)

- **Direction:** `continue`
- **Category:** vague (normalized set)
- **Expected entities:** Carl Maddox; Riley Quinn; Jenna Maren; Chaos House
- **Excluded entities:** Lacey Summers ("has not appeared on-page in the
  current story," per canon lore directly) — the cleanest single-sentence
  exited-entity statement of any story researched
- **Rationale:** Same shape as BN-1 but with one, not six, excluded
  entities — a narrower-blast-radius version of the same unwanted-
  persistence test.

### CS-2 (short-but-rich negative)

- **Direction:** `Kira calls Riley`
- **Category:** vague-length (16 chars) but names a known entity ("Kira",
  "Riley") — should classify as NOT vague
- **Expected entities:** Kira Graves; Riley Quinn
- **Excluded entities:** Lacey Summers, Vanessa Maddox — neither is named
  or implied by this direction
- **Rationale:** Kira is a genuine middle case the operator should weigh
  in on: she left Chaos House on Day 26 and is "currently nomadic," which
  is real narrative distance without being a clean exit like Lacey's. This
  fixture assumes Kira SHOULD still be retrievable (she's not narratively
  closed off, just physically elsewhere) — flagged as a judgment call, not
  a confident answer.

### CS-3 (explicit — control)

- **Direction:** `Carl and Riley talk quietly on the porch about whether to invite Cassie over again`
- **Category:** explicit/rich
- **Expected entities:** Carl Maddox; Riley Quinn; Cassie Delaney
- **Excluded entities:** Lacey Summers, Kira Graves, Vanessa Maddox
- **Rationale:** Control group; Cassie is confirmed "recently active
  on-page, not exited" so her inclusion here is a straightforward name
  match, not a judgment call.

---

## miskatonic-archives-the-blackwood-case

**Scene anchor:** `drafts/scenes/bc-d03-07-hcl--three-hours-later.md`
("Three Hours Later," the 50th and last of 50 scenes). **Data wrinkle:**
this scene's status is `review`, not `established`, and is flagged
`SUPERSEDED_BY_CANON_LORE_SISTERS_ARE_SEPARATE_FAMILIES` — its own content
about the historical sisters may not match ratified canon. Scene: Karen,
Michelle, and Heather reconvene at the Hawthorn College library; Michelle
reveals birth records naming Constance, Persephone, and Elizabeth
Blackwood, born the same night the manor was completed, and ties the woods
to where Lyla's ghost said she wanders.

Entities in this scene: **Karen Sullivan**, **Michelle Nagy**, **Heather
Vanderhout** (present), **Constance**, **Persephone**, **Elizabeth
Blackwood** (named via an in-scene document), **Lyla** (referenced, not
on-page).

### BC-1 (vague — pure, the ambiguous one)

- **Direction:** `continue`
- **Category:** vague (normalized set)
- **Expected entities:** Karen Sullivan; Michelle Nagy; Heather Vanderhout;
  Blackwood Manor — **and, genuinely unresolved: Elizabeth Blackwood /
  Constance / Persephone?**
- **Excluded entities:** Carl Ashcombe (hospitalized, off-page but not
  exited — arguably should NOT be excluded; flagged, not decided)
- **Rationale — this is the fixture most worth the operator's direct
  attention.** The historical Trinity (Elizabeth/Constance/Persephone) are
  dead-since-1888, so by one reading they're exited exactly like Lacey
  Summers or the Guild Hall cast. But the anchor scene's own text is the
  team actively investigating them THIS session — they're the live thread
  of the current scene, not background lore incidentally nearby. Whether
  enrichment retrieving them counts as correct recall (metric a) or
  unwanted persistence (metric b) depends on a distinction the design
  doc's two metrics don't fully separate on their own: "exited" (left the
  story) vs. "dead-but-currently-the-investigation's-subject." This
  session did not resolve it and is flagging it rather than guessing.

### BC-2 (short-but-rich negative)

- **Direction:** `Carl wakes up`
- **Category:** vague-length (12 chars) but names a known entity ("Carl")
  — should classify as NOT vague
- **Expected entities:** Carl Ashcombe
- **Excluded entities:** the historical Trinity — this direction has
  nothing to do with the 1888 investigation thread
- **Rationale:** Tests the entity-name condition against a character who's
  physically absent from the anchor scene (hospitalized) but directly
  named by the direction.

### BC-3 (explicit — control)

- **Direction:** `Karen drives Michelle and Heather back to Blackwood Manor to search the nursery Lyla haunts`
- **Category:** explicit/rich
- **Expected entities:** Karen Sullivan; Michelle Nagy; Heather Vanderhout;
  Blackwood Manor; Lyla Blackwood
- **Excluded entities:** Carl Ashcombe, the historical Trinity, the three
  missing modern girls (Ciri Navarro, Susie Donnelly, Gloria Keene) — none
  named or implied
- **Rationale:** Control group; every expected entity is named or directly
  implied ("the nursery Lyla haunts") by the direction itself.

---

## midnight-is-a-suggestion

**No scene anchor exists** (see "Coverage gap" above) — both fixtures
below test baseline recall against character/lore entities only, with no
enrichment path exercised. **Do not use these two to evaluate the
enrichment feature itself** — they're recall-only checks on the retrieval
layer underneath it.

### MID-1 (explicit — recall baseline)

- **Direction:** `Belle tells Cinderella what she found in the Commission's Editor index`
- **Category:** explicit/rich (enrichment is moot — no scene exists to
  enrich with)
- **Expected entities:** Belle; Cinderella; The Happily Ever After
  Commission
- **Excluded entities:** The Beast — "has not appeared publicly in eleven
  months" per canon, the cleanest single-line exit statement after Lacey
  Summers's
- **Rationale:** Even without a scene to anchor enrichment, this story
  still has a real exited-entity case worth checking against plain
  (non-enriched) retrieval.

### MID-2 (explicit — recall baseline)

- **Direction:** `Snow White briefs Tinkerbell on the Seven Hearths network before the archive run`
- **Category:** explicit/rich
- **Expected entities:** Snow White; Tinkerbell; The Seven Hearths
- **Excluded entities:** The Beast, The Evil Queen — neither named or
  implied
- **Rationale:** Second baseline case, different entity pair, to avoid
  drawing a recall conclusion from a single fixture.

---

## Summary table

| ID | Story | Category | Tests |
|---|---|---|---|
| BTC-1 | battlechasers | vague | recall + no spurious second-party pull-in |
| BTC-2 | battlechasers | short-rich negative | entity-name condition |
| BTC-3 | battlechasers | explicit control | enrichment stays off |
| BN-1 | brass-and-nerve | vague | unwanted persistence (6 never-appeared entities) |
| BN-2 | brass-and-nerve | short-rich negative | entity-name condition, off-page-not-exited |
| BN-3 | brass-and-nerve | explicit control | judgment call flagged (Guild inspection) |
| CS-1 | chaos-saga | vague | unwanted persistence (1 clean exit) |
| CS-2 | chaos-saga | short-rich negative | judgment call flagged (Kira, nomadic not exited) |
| CS-3 | chaos-saga | explicit control | — |
| BC-1 | blackwood-case | vague | **judgment call flagged** (dead-vs-exited distinction) |
| BC-2 | blackwood-case | short-rich negative | entity-name condition, off-page-not-exited |
| BC-3 | blackwood-case | explicit control | — |
| MID-1 | midnight | explicit (no enrichment) | recall baseline, 1 clean exit |
| MID-2 | midnight | explicit (no enrichment) | recall baseline |

14 candidate fixtures across 5 stories: 4 vague (enrichment-exercising), 4
short-but-rich negatives, 4 explicit controls, 2 recall-only baselines
(midnight). Three fixtures carry an explicit judgment-call flag (BN-3,
CS-2, BC-1) where this session could not confidently resolve the expected
answer alone — those are exactly the ones worth the operator's closest
attention.
