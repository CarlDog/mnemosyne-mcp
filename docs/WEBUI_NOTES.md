# Web UI — Design Notes

**Status: input, not specification.** Captured 2026-08-23 from a review of
Botify AI and Kindroid, plus what the first real import campaign taught us
about where mnemosyne actually hurts. Nothing here is ratified. It exists so
the thinking survives until the web UI phase starts.

The web UI is on the roadmap for a hard reason (ARCHITECTURE.md): Claude
Desktop's host LLM sits in the response path and refuses on content it doesn't
like, so uncensored storytelling needs a surface where no host model reads the
output. But refusal-avoidance is the *reason we need one*, not a design. This
document is about what it should be.

---

## 1. Anti-goals

Both reference apps are consumer products. We are not.

- **No discovery.** No feed, no category chips, no recommendation carousel.
  One operator, five stories, ~369 entities. Discovery is a solved problem
  when the whole corpus fits on one screen.
- **No monetization surface.** No energy meters, no upsell, no app-install
  nag. Cost still gets *shown* (§6) — as information, never as a paywall.
- **No social.** No sharing, likes, or public profiles.
- **Not a chat client with a memory feature bolted on.** The canon is the
  product. Generation is something you do *to* it.

---

## 2. The organizing idea: three modes, three postures

`mnemo_continue` already takes a `mode`, and the three are not cosmetic —
each places the operator in a different relationship to the scene. The UI
should follow, and chrome density should follow with it.

| Mode | Where you stand | What the model does | Chrome |
|---|---|---|---|
| **participant** | *In* the scene | Plays your scene partner; performs others as supporting cast | Conversational, light |
| **director** | *Above* the scene | Performs **all** characters; you give staging and direction | Dense — a control desk |
| **audience** | *Outside* the scene | Narrates to you; you offer light guidance | Almost none — a reading surface |

This is the spine. Same story, same canon, three postures — and switching
mode should visibly re-arrange the room, not just change a dropdown value.

### participant

Closest to a messaging app. The operator is a character, so **who they are
must be explicit** — Kindroid's "Chatting as ___" affordance, which matters
more for us than for them: the operator is a character in four of five
stories under four different names (Carl Maddox, Carl Ashcombe, Karl von
Jäger, Carl Yeager). Persona is a first-class selection bound to the story,
not an assumption. The composer is the primary control; everything else
recedes.

### director

The dense one, and the mode neither reference app really has. This is a
staging desk: cast presence, turn order, location, pacing, and direction —
see §3.

### audience

We have already built this once. The Chaos Saga reader artifact *is* audience
mode: prose-forward, chapter headers, drop caps, no controls but "keep
going." Audience mode should be that reader with a Continue button.

---

## 3. Two control planes, not one

The reference apps only have character controls, because a conversation only
ever has one bot (or a group treated as a bag of bots). We have stories, and
a story is not a character. **Both planes need to exist, and the mode decides
which one is foreground.**

### Character plane (per entity)

Reachable from any character named in a scene.

- Full profile, editable in place
- Its distilled essence / voice notes
- Reference images (`references/characters/<slug>.jpg`, per DATA_LAYOUT.md)
- How strongly it reaches the prompt — see §5
- Kindroid or Botify target binding, where the story uses a companion provider

### Storyline plane (per story)

The plane with no equivalent in either reference app.

- **Cast presence** — who is in *this* scene. Not who exists; who is here.
- **Turn order** — Botify's group triad is the right shape: auto-advance /
  random next / nominate a specific character. Today `advanceGroup` hardcodes
  `allowUser: false` and `maxTurns: 4`, with no way to say "Riley next."
- **Location** — set the scene from the story's own locations. BattleChasers
  has 28. Shadowflame's style guide even encodes *which* spaces are for
  performance and which are for truth — the UI can honor that.
- **Pacing** — beat length; stay in the burn or cut.
- **Open threads as one-click directions.** Ours alone, and the best idea in
  this document. The canon already records its own unfired guns: BattleChasers'
  "open threads, deliberately unfired"; the **Open Questions** entities in
  Wonderland and Shadowflame; GhostHunters' unmatched mirror, unlocated circle
  centre, and Gloria's never-found book. Surface them as direction chips. No
  other tool can do this, because no other tool has a curated canon to read
  them from.

---

## 4. Show the assembly

The best single thing in either reference app is Kindroid's per-message
**"Recalled journals & memories"**: for that specific message it lists which
journal entries fired and which long-term memories surfaced, states plainly
that some may be irrelevant, and gives each one a **Deprioritize** button.

We should do this, and we are better positioned to, because our retrieval is
typed and deterministic rather than a vector black box.

For any generated beat, show:

- Which entities `gatherContext` pulled, grouped by type
- Which keyphrases matched, for companion providers —
  `companion-message.ts` already computes exactly this
- Token count of the assembled prompt, and the window it went into
- What the validator flagged, if it ran
- A lever per entity: pin, deprioritize, or exclude from this story

**Why this earns its place.** On 2026-08-22 a generation produced confident
word salad and the cause was invisible; it took a bisection to prove the
prompt was fine and the local Ollama install was broken. A panel reading
"47 entities · 59KB · 14.2k tokens · window 131072" would have made that a
ten-second diagnosis. Botify hides its machinery because it is a toy. This is
an instrument, and instruments have gauges.

---

## 5. Budgets and influence, on every field

Kindroid's Backstory editor states three things per field at once: a live
character budget, **how much influence the field actually has** ("Strong",
"Very strong", "Moderate"), and how to write it ("3rd person, proper nouns,
clear and concise").

We give none of this today, and its absence cost real time during the
imports — counting characters by hand against Kindroid's 1000-char persona
cap, and guessing which entity types reach a prompt at all.

Our version is a per-type honesty note in the entity editor:

- **rule** — pinned, always included, *very strong*. One constraint per entity.
- **style** — always included, *strong*. Named clauses; keep them short.
- **character / location / lore / worldbuilding** — relevance-filtered per
  call, keyphrase-gated for companion providers, *moderate*.
- **scene** — recent and validation-clean only, *moderate*; shapes voice more
  than facts.

Plus the real ceilings where they exist: OC's 100k content cap, the companion
persona limits, and the auto-sized `num_ctx`.

---

## 6. Media in the flow, not in a scrapbook

The requirement: image and video generation should feel *part of the beat*,
not a gallery you visit afterwards — **subject to preference**, because
sometimes you just want prose.

Botify does the flow part well: generated media sits inline in the message
stream, the "Animate this image" panel arrives pre-prompted from scene
context, and the cost is printed on the button.

What makes ours different is that **we can generate in character.** The
groundwork already exists:

- `references/characters/<slug>.jpg` — identity-conditioning inputs, already
  populated for Riley and Jenna
- `art/` with a mandatory JSON sidecar recording prompt, model, params,
  references used, cost, and subject — already ratified in DATA_LAYOUT.md,
  precisely because generation is unseeded and otherwise unreproducible

The flow:

1. A beat completes.
2. The UI proposes an illustration prompt built from the beat's own text plus
   the entities that were in scope — the location's description, the
   characters present, the story's visual register.
3. Reference images for those characters attach automatically, for identity
   consistency.
4. Estimated cost is shown *before* the click.
5. The result lands inline in the scene, and on disk in `art/` with its
   sidecar. The scene entity gets a pointer, never the bytes.

**Preference tiers**, because this must never be compulsory:

- **Off** — prose only.
- **Manual** — an illustrate affordance per beat, nothing automatic.
- **Suggested** — the UI drafts a prompt and waits. *(Suggested default.)*
- **Auto** — illustrate on beat completion, under a spend ceiling.

Known constraint from the operator's own experience: in-app companion
generators handle dense profiles badly — they compress a 4KB profile down to
a few tokens and cannot pin a face from text at all. So generate **outside**
the companion apps with reference conditioning, and treat those apps as
consumers of the resulting likeness. See the parked image-pipeline note in OC.

---

## 7. Borrowed patterns

| Source | Problem it solves | Our version |
|---|---|---|
| Kindroid — recalled memories + Deprioritize | Retrieval is invisible | §4, typed and deterministic |
| Kindroid — budgeted fields with influence weights | Authors can't tell what matters | §5, per entity type |
| Kindroid — message variants ("11 of 11") | Regeneration destroys the previous take | Beat variants — `mnemo_continue` auto-saves today, and bad beats had to be hand-deleted twice |
| Kindroid — "Chatting as ___" | Who is the operator in this scene | Persona bound per story |
| Kindroid — Backstory at top-level nav | Authoring is the product | Entity library gets equal billing with the story |
| Kindroid — instructional empty states | Mechanics are undiscoverable | Empty states teach the retrieval model |
| Botify — searchable, date-grouped memory list; hover edit/duplicate/delete; `+` to write one by hand | ~369 entities reachable only by tool call | The entity library |
| Botify — group turn triad (auto / random / nominate) | Who speaks next | §3, storyline plane |
| Botify — cost printed on the button | Spend is a surprise | §6, and provider/token estimates generally |
| Botify — contextual action chips | The blank-page problem | §3, driven by the canon's own open threads |
| Botify — narration vs dialogue styled differently in one bubble | Prose is a wall | Render the asterisk convention our style guides already mandate |
| Ours — the Chaos Saga reader artifact | — | Already audience mode; adopt it wholesale |

---

## 8. If we build it in slices

1. **Entity library** — browse, search, edit, delete across all stories.
   Highest value, zero generation risk, and it retires the patch-script
   workflow the imports ran on.
2. **Audience mode** — the reader we already have, plus Continue.
3. **The assembly panel** (§4) — pure instrumentation, no new writes.
4. **Director mode** — cast, turn order, location, open-thread chips.
5. **Participant mode** — persona binding, conversational composer.
6. **Media in flow** (§6) — last, because it spends money and wants the
   art/sidecar plumbing exercised first.

---

## Related

- [ARCHITECTURE.md](ARCHITECTURE.md) — why a web UI exists at all
- [DATA_LAYOUT.md](DATA_LAYOUT.md) — `references/` and `art/` conventions, and
  the generation sidecar this design assumes
- [IMPORT_PLAYBOOK.md](IMPORT_PLAYBOOK.md) — the curation discipline the
  entity library has to preserve
