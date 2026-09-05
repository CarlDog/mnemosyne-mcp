# Canon Rulings

Operator rulings that govern more than one story. A ruling here is **ratified**:
a drafting pass may not reverse it, and a story's own control record cites it
rather than restating it.

This register exists because the 2026-09-02 gap audits asked the same policy
question in six local dresses. Seventy-five numbered decides across six stories
collapse into eleven rulings; answering them per story would set contradictory
fleet precedents without anyone being told they were the same question. One
answer, recorded once, is the point.

Per-story control records under `drafts/_control/DECISIONS.md` name which ruling
applies and what it classified in that story. They do not re-argue it.

---

## Ruling 1 — the informed-retirement test

**Ratified 2026-09-04.** Sheet seat 09.

> Play governs if the ledger didn't read the scenes.

That names the two-sided informed-retirement test:

- Where a ledger and a played scene **conflict**, and the ledger was written
  **without having read the scenes**, the **played scene governs**.
- Where canon **deliberately retired** what the scenes play — the ledger was
  informed and retired it anyway — **canon governs**.

The test is a tie-break between two existing records. It does not license new
invention on either side, and it does not by itself move any file.

### Scope

Fleet-wide. It absorbs eleven decides across five of the six non-flagship
stories: `BN-1`, `BN-2`, `SF-1`, `SF-3`, `BL-4`, `AP-3`, `AP-4`, `AP-5`, `AP-8`,
`NV-1`, `NV-4`. Each audit's existing per-story classification stands under it.

**Midnight Is a Suggestion is classified without an absorbed decide, and that is
deliberate.** It has zero scene files, so the tie-break has no played scene to
weigh in its own tree; it appears in the table below because its r1 retirement is
one of the three cases that established the deliberate side of the test. Its own
`MIS-2` is a source-era disposition question and belongs to a different ruling,
not to this one. Do not read the table as an absorption list.

### What it classified

The determination in every case comes from the audits' own verdict text, not
from a fresh judgement:

| Story | Verdict | Why, in the audit's words |
|---|---|---|
| Shadowflame | **Play governs** | Ledgers written from authored Botify blocks and bot summaries, "not from the transcript" |
| Star Wars: The Black Ledger | **Play governs** | "Every ledger was written before the cut, cites no scene" |
| The Adjustment Protocol | **Play governs** | Scenes cut 2026-09-02 beside ledgers written 2026-08-30; no ledger "cites, absorbs, or rules on" any of them |
| The Noctis Veil | **Canon governs** | "The ledgers were written to retire what the scenes play" |
| Brass & Nerve | **Canon governs** | The readiness record had already read the chat and retired the patient's identity |
| Midnight Is a Suggestion | **Canon governs** | "r1 retired it" |

Three toward the play, three toward canon. Before this ruling the audits reached
those same six answers with no stated test, which is why they had to be ratified
together or not at all.

### What this ruling does not settle

Three things remain open, and none of them may be assumed from the sentence
above.

1. **The recording requirement.** The proposal that accompanied this test also
   asked that a deliberate retirement be recorded as revised canon with an
   in-file marker rather than left silent. That is a separate obligation about
   how a retirement is *documented*, not about which record wins, and it was not
   addressed. Work that depends on the marker stays parked.
2. **Substitution — sheet seat 10.** The operator's given or surname appears in
   105 of the 174 draft scene files. Three independent sources say no scene
   leaves `drafts/` before that ruling. **Nothing promotes.** Seat 09 unblocks
   canon-side reconciliation, not promotion.
3. **The Noctis Veil's SL and KM threads.** Its four extracted threads are
   GC (16 scenes), MT (24), SL (4) and KM (6). `NV-1` rules on GC and `NV-2` on
   MT; SL and KM — ten scenes — carry no tier decide at all, while `NV-4`
   prescribes a per-thread flag across all fifty. This ruling does not reach
   them, and letting `NV-4`'s flag resolve them by default would classify ten
   played scenes that nobody ruled on.

### Interim control while the recording requirement is open

Until the marker obligation above is ruled on: **write the corrected prose now,
and do not invent a marker form.** A missing marker is cheaply enumerable later
from this register and each story's `PASS.md`; a marker form invented in one
story and propagated through six is silent drift that nothing will surface.

This is not hypothetical. Deriving the ruling's consequences immediately produced
two stories assuming it in opposite directions inside a single pass — one writing
`(r3: ...)` markers at each changed claim, the other explicitly withholding them
and saying so — and both had a live in-tree marker form to point at. Two stories
with a form diverged, which is exactly why the rule has to be stated rather than
left to each pass's judgement.

### Consequence for sequencing

Canon-side records — ledgers, timelines, profiles, consequence and evidence
records — are writable under this ruling now, because seat 10 does not touch
them. That list is exhaustive, not illustrative. **Worldbuilding system records
are not on it**, and a pass that wants to write them is reaching for the scope
answer in sheet seat 07, not for this ruling. The distinction matters because
this ruling settles which of two *existing* records wins; work that invents a
record neither of them contains is unblocked by something else or by nothing. Anything that edits a file under `drafts/scenes/` should wait, because
substitution will touch those files again and every touched file rehashes and
re-seals its overlay. Answer wide, then build once.

---

## Ruling 2 — substitution happens before promotion

**Ratified 2026-09-04.** Sheet seat 10.

> Substitute the canon name before promotion, never at promotion.

Where a played role carried the operator's own name and its thread is promotable,
the canon name is substituted **in `drafts/`, as an editorial edit**: the scene
body and frontmatter are changed, the affected `add` entries rehash, and the
overlay re-seals. Only then can the thread be promoted.

**This overrules `BL-9`'s recommended wording**, which proposed substituting "on
promotion, catalog-flagged". That is not a preference the ruling declined; it is
mechanically impossible, and `SF-6` had already established why:
`scripts/draft-notice.mjs` exists so that staged bytes equal promoted bytes, and
the promotion tool strips the draft banner and nothing else. A pass that
ratified `BL-9` as written would have discovered this at promotion time.

### Where it bites

Ruling 1 decided this before Ruling 2 could: a source-era thread never promotes,
so it is never substituted. That leaves three of the six stories untouched.

| Story | State under both rulings |
|---|---|
| Brass & Nerve | **Moot.** `BN-1(a)` is absorbed by Ruling 1: the twelve scenes are source-era, stay out of every ledger, and never promote. |
| Midnight Is a Suggestion | **Moot.** Zero scene files. |
| The Noctis Veil | **Moot for GC and MT** — `NV-1(a)` and `NV-2` make both threads retired-premise play. SL and KM remain unruled (Ruling 1, open item 3). |
| Shadowflame | **Actionable.** Two lines in two named scene files; the canon name exists. |
| Star Wars: The Black Ledger | **Actionable.** The played role's source name was retconned to a canon name, so a counterpart exists; two further slips are the bot's own use of the operator's platform name and first name. |
| The Adjustment Protocol | **Blocked on one name.** See below. |

**Do not run the two actionable stories in isolation.** Each substitution
rehashes and re-seals, and each story's Ruling-1 ledger corrections rehash the
same overlay again. Bundle the substitution with that story's other revision work
and seal once.

### What this ruling does not settle

1. **A role canon does not hold.** The Adjustment Protocol's lead scientist of
   the ER and AN threads is played under the operator's own name and **canon
   holds neither role**, so there is no canon name to substitute in. It reaches
   42 of that story's 43 scene files. `AP-1` records the one hard constraint —
   the substituted name must **not** be Renshaw, because the AN thread already
   plays a Renshaw beside the scientist — and states that inventing a name is
   the operator's call. Nothing in that story moves until a name is supplied.
2. **The departure-from-verbatim record.** `SF-6` asks that a substitution be
   recorded in `PASS.md` as a departure from verbatim with the original hash
   kept. That is a recording convention, structurally identical to Ruling 1's
   open marker obligation, and it is parked the same way: **make the
   substitution, do not invent a record format.** Two independently invented
   conventions across six stories is the drift both parks exist to prevent.
3. **The archive is not in scope, and never was.** `data/archive/` staying
   verbatim is governed by [DATA_LAYOUT.md](DATA_LAYOUT.md)'s archive-as-master-of-originals
   rule, whose only writer is `scripts/intake.py`. This ruling concerns
   `drafts/` alone. Cite the standard, not this ruling.
