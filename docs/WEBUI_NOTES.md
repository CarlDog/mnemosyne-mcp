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

**Mode is a live control, not a commitment made at the top of a session.** You
should be able to sit back in audience mode, watch a scene run, and step into
it the moment you have something to say — without ending anything or starting
a new session. The whole point of one canon behind three postures is that the
posture is the cheap thing to change. See §3's turn order for the mechanic
that makes stepping in real rather than cosmetic.

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
- **Turn order, and when you interject.** Botify's group triad is the right
  shape for who speaks — auto-advance / random next / nominate a specific
  character — and today `advanceGroup` has no way to say "Riley next."
  The deeper control is whether the floor ever comes back to *you*.
  `kindroid-provider.ts` hardcodes `allowUser: false`, and its comment is
  honest about why: mnemosyne is generating a beat "for a caller with no way
  to take that turn." A web UI is precisely a caller that has one, so the
  hardcode stops being right the day this ships. Two things make the fix
  small: `KindroidClient.advanceGroup` already accepts `allowUser` as an
  option (only the provider pins it), and `AdvanceGroupResult` already
  reports `ended: "user_turn" | "max_turns"` — a first-class signal for
  "they've said their piece, you're up" that we currently can never receive,
  because a forced `allowUser: false` can only ever end in `max_turns`.
  So: **let the loop hand the floor back, and let the operator decide
  whether to take it.** Interjecting, staying quiet, and letting it run are
  all one control, not three modes.
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

## 7. Watch parties — mnemosyne as plex-companion's passthrough

[plex-companion](https://github.com/CarlDog/plex-companion) is already
deployed: a Plex webhook wakes it when you finish something, it pulls the
item's metadata and optionally a spoiler-aware lore brief, and a Kindroid kin —
or a whole group, which is already a watch party — reacts in the app in its own
voice. It has an MCP surface: `companion_status`, `companion_history`,
`companion_pause`, `companion_resume`, `companion_engage`, `companion_suggest`.

**Operator intent, stated 2026-08-23 and load-bearing for everything below:
mnemosyne is the passthrough.** plex-companion should not deliver to Kindroid
itself — it hands the engagement to mnemosyne, and mnemosyne delivers. Two
reasons, and the second is the one that's easy to under-read.

### Recall runs both directions

The obvious half is **watch → canon**: what happens during a watch party is a
beat, and it shouldn't evaporate into chat scrollback.

The half that actually motivates the architecture is **canon → watch**. A kin
reacting to a film through mnemosyne reacts *as that character in that story* —
carrying its history, its voice, its relationships, everything `gatherContext`
pulls — instead of as a bare companion persona that remembers none of it.
plex-companion structurally cannot do this: it has no story, no entities, and
no OC connection at all. Passthrough isn't plumbing convenience. It's the only
way the reaction is in character.

### The seam

plex-companion **keeps** everything about Plex and about knowing what you
watched: the webhook and its parser, the account/library filter, the per-item
and global cooldowns and the `ENGAGEMENT_CHANCE` roll, the plex-mcp metadata
pull, the lore brief with its subtitle grounding, old-content awareness, the
engagement log, `companion_pause` / `companion_resume`.

It **sheds** everything about talking to a companion: the Kindroid backends,
the message templates, the target binding. That is mnemosyne's whole job.

Clean seam, and it falls out of what each service already is.

### What passthrough buys

| | Direct delivery (today) | Through mnemosyne |
|---|---|---|
| Keeping the exchange | **Lost.** `EngagementRecord` stores `at`/`kind`/`stage`/`ratingKey`/`title`/`ok`/`detail` — **no reply text**. `companion_history` can say a reaction to *Alien* happened at 21:14; it can't say what was said | **Free** — mnemosyne holds the reply and auto-saves it as a validated scene |
| Reacting in character | Impossible — no story, no entities | **Free** — the same context gathering every beat gets |
| Switching kin or group | **New API** — env var plus a redeploy; `companion_engage` takes no target argument | **Exists** — `mnemo_continue`'s per-call `kindroid_kin` / `kindroid_group_id` |
| Setting the scene | **New API** — the templates carry no place | **Free** — text in `direction`, from the story's own locations (§3) |
| Botify instead of Kindroid | **New API** — plex-companion is Kindroid-only | **Free** — seven generators already sit behind `GENERATOR_PROVIDER` |

That last row is why the operator said "kins *(or botify bots)*." Under
passthrough plex-companion never learns what Botify is — it never needs a
backend abstraction at all.

The first row is worth dwelling on: the capture problem doesn't get *solved* by
passthrough, it **dissolves**. Direct delivery would need either a chat
read-back keyed on the record's timestamp (possible, unverified) or a new field
on plex-companion's record. Neither is necessary if mnemosyne is holding the
reply already.

### The interface, and the one thing that's actually new

plex-companion calls us, not the reverse — it is already an MCP client to
plex-mcp, kindroid-mcp and filesystem-mcp, so a mnemosyne backend is a shape it
already has, while mnemosyne is a passive server with no scheduler and couldn't
poll if it wanted to. The call is `mnemo_continue` with a direction built from
the Plex item.

**The gap:** `mnemo_continue` operates on the *active* story, and that pointer
is machine-local config that `mnemo_story_use` mutates globally. A
webhook-driven caller must not stomp a pointer some concurrent Claude session
is also using. So `mnemo_continue` needs an optional per-call story selector.
As far as I can tell that is the only genuinely new API the whole integration
requires on our side.

**Mode is adjustable, and that resolves the question of which one a watch party
"is."** It isn't any of them by default — you pick, and you can change your
mind while it runs. Sit in audience while the kins argue about the third act;
drop into participant when you want to answer one of them; take director if
the party needs staging. This is the same live-mode control as §2 and the
same floor-handback mechanic as §3 — a watch party is just the case that
makes the need obvious, because you are demonstrably sitting right there.

### Canon is a target and a save, not a checkbox

Canon-ness should control **the save and the target — never the context.**
Story context always goes in; that was the point.

- **In canon** — the story's bound target, saved as a scene entity.
- **Out of canon** — a separate companion target, not saved.

It has to be a different *target* rather than a flag on an otherwise identical
send, because a Kindroid chat **is** the kins' short-term memory: a watch-along
note posted into the group your story runs in is in that conversation's context
whether or not you also write it to OC. Fencing one off inside the story's own
target is possible — `kindroid_chat_break` exists — but it costs you the
story's short-term continuity, and the single-AI form takes a mandatory
greeting, so it isn't even a silent fence.

### Eligibility is per story, and most stories say no

Three of the five live stories are fantasy — BattleChasers, Wonderland,
Shadowflame — and an in-canon watch party drags real-world film titles into
them. Only Chaos Saga and GhostHunters are contemporary enough for it to land.
So canon-eligibility is a per-story opt-in defaulting to off; a story that opts
out never shows the control at all.

### In the UI

A companion lane in the storyline plane (§3): what you last watched, whether
reactions are live or paused and until when, which target they are going to,
and — only for an eligible story — an offer to fold the exchange in as a beat.
Same tiering as media (§6): Off / Manual / Suggested / Auto.

---

## 8. Borrowed patterns

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

## 9. If we build it in slices

1. **Entity library** — browse, search, edit, delete across all stories.
   Highest value, zero generation risk, and it retires the patch-script
   workflow the imports ran on.
2. **Audience mode** — the reader we already have, plus Continue.
3. **The assembly panel** (§4) — pure instrumentation, no new writes.
4. **Director mode** — cast, turn order, location, open-thread chips.
5. **Participant mode** — persona binding, conversational composer.
6. **Media in flow** (§6) — late, because it spends money and wants the
   art/sidecar plumbing exercised first.
7. **Watch parties** (§7) — last, and the only slice with another service in
   the path. Needs the per-call story selector first; wants director mode and
   media already working, since a watch party is a `mnemo_continue` someone
   else triggered.

---

## 10. Parked for research — the graphic-novel format

Operator idea, 2026-08-23, filed not scoped: **read a story as a comic.** Not
prose with illustrations dropped in, but real sequential art — a page of
panels laid out across a grid, each panel a generated cell, revealed with the
pacing of a page turn rather than a scroll.

It sits on top of §6 rather than beside it: the same beat-anchored generation,
the same `references/` identity conditioning, the same `art/` sidecars — what
changes is that the output is *composed* into a page instead of dropped inline.

What makes it plausible rather than fantasy, and what to actually research:

- **Panel sequences are a real generator capability, not a stitching hack.**
  Kling 3 Omni's image mode takes `resultType: "series"` with `seriesAmount`
  2–9 for consistent sequential panels, and it is also the cheapest image
  model on the OpenArt surface. That is the closest thing to a native comic
  primitive we have access to.
- **Face consistency across panels is the hard part**, and it is the same
  problem the parked likeness pipeline already exists to solve — reference
  conditioning, not text description. A cast that drifts between panels reads
  as broken in a way it never does in a single hero image.
- **Beat-to-panel decomposition is unsolved and is the actual research.** How
  many panels does one generated beat become? Who decides — a model pass over
  the beat text, or the operator? Dialogue has to land as lettering, and our
  style guides already mandate an asterisk convention for narration vs speech
  that a panel layout would need to honor (§8).
- **Cost is the gate.** A single page could be 6–9 generations. Against
  §6's spend ceilings, a graphic-novel run is a different order of commitment
  than illustrating a beat, and probably wants to be an explicit "render this
  chapter" action rather than anything automatic.
- **Audience mode is the natural host** (§2). The Chaos Saga reader artifact
  already proved the reading surface; a comic page is that surface with a
  different renderer, which is an argument for building it as a *view* over
  existing beats rather than a fourth mode.

Nothing here is committed. It is written down so it survives.

---

## Related

- [ARCHITECTURE.md](ARCHITECTURE.md) — why a web UI exists at all
- [DATA_LAYOUT.md](DATA_LAYOUT.md) — `references/` and `art/` conventions, and
  the generation sidecar this design assumes
- [IMPORT_PLAYBOOK.md](IMPORT_PLAYBOOK.md) — the curation discipline the
  entity library has to preserve
- [plex-companion](https://github.com/CarlDog/plex-companion) — the watch-along
  service §7 integrates with; its README documents the kin/group delivery modes
  and the full MCP surface
