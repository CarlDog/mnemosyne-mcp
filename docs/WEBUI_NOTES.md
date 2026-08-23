# Web UI — Design Notes

**Status: input, not specification.** Captured 2026-08-23 from a review of
Botify AI and Kindroid, plus what the first real import campaign taught us
about where mnemosyne actually hurts. Nothing here is ratified. It exists so
the thinking survives until the web UI phase starts. **Updated same day** with
findings from a live browser pass on both reference apps' actual screens (not
just feature descriptions), plus a paired senior-ui-ux-designer critique and a
senior-sde pre-build feasibility review — see §0 for the headline change: this
design has no buildable starting point yet without the prerequisites there.

The web UI is on the roadmap for a hard reason (ARCHITECTURE.md): Claude
Desktop's host LLM sits in the response path and refuses on content it doesn't
like, so uncensored storytelling needs a surface where no host model reads the
output. But refusal-avoidance is the *reason we need one*, not a design. This
document is about what it should be.

---

## 0. Prerequisites — what has to exist before any slice in §9

A pre-build review (senior-sde, 2026-08-23) found that §9's slices all assume
a foundation that doesn't exist yet. None of this is a slice-9 problem to
discover later — it blocks slice 1.

- **Mnemosyne has no way for a browser to reach it.** `src/index.ts` connects
  over stdio only — mnemosyne is an MCP *client* to OC/Kindroid/Botify, all
  over Streamable HTTP, but exposes nothing a browser can talk to itself.
  stdio is a parent-process pipe; only a co-located host (Claude Desktop,
  Claude Code) can spawn and talk to it. Adding Streamable HTTP transport is
  real, scoped work — and even once added, MCP tool-call semantics (blocking
  request/response, one JSON text block per call, no server push) are a poor
  fit for what this document proposes: a `kindroid_advance_group` beat blocks
  up to `KINDROID_MCP_TIMEOUT_MS` (180s) with zero intermediate signal, so
  "watch a scene run" (§2) means staring at one long spinner unless a real API
  layer adds streaming or turn-by-turn polling. ARCHITECTURE.md already
  anticipates a second surface ("thin adapters over the same core") — that
  adapter is the missing slice 0, not an assumed given.
- **The active-story pointer is global, single-writer, file-backed state.**
  `src/config.ts`'s `current_story_id` is one JSON file read by every entity
  and generation tool, with no scoping by session or caller —
  `requireCurrentStoryId()` throws if it's unset, and nothing distinguishes
  one caller's active story from another's. §7 already half-diagnoses this for
  the plex-companion case ("a webhook-driven caller must not stomp a pointer
  some concurrent Claude session is also using") but frames it as narrow. It
  isn't: slice 1's own "browse... across all stories" (§1: "one operator, five
  stories... discovery is a solved problem when the whole corpus fits on one
  screen") is impossible against a single global pointer without either racy
  repeated `mnemo_story_use` calls or new per-call story-id parameters. Solve
  this once, generically, before slice 1 — not piecemeal in §7.
- **Once the HTTP layer exists, it needs a real access-control story.**
  ARCHITECTURE.md is explicit that this UI's entire reason to exist is
  serving unmoderated NSFW output with no host LLM in the path — the
  highest-stakes surface in this whole system. Binding to loopback is not
  access control once something's reachable from a browser (DNS rebinding);
  the fleet's own `docker-deployments.md` guidance calls for a Host/Origin
  allowlist. Scope this into slice 0, not as a retrofit after the fact.

Everything below this line is still the design target. It's just not
buildable until the three things above are.

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
mode should be legible at a glance, not just change a dropdown value.

**Design review caught a real tension here (2026-08-23):** "visibly
re-arrange the room" and "a live control you flip mid-scene without losing
your place" pull against each other — rearranging a room while someone is
actively reading it destroys the spatial memory that makes a live-switchable
control usable at all. The fix is **stable landmarks, variable density**: the
story header, the canon/cast rail, and the primary content column stay in the
same screen positions across all three modes; what changes is which of them is
expanded, which collapses to a sliver, and what controls appear inside them.
Same room, different lighting — not a different room. This also serves "step
in the moment you have something to say" directly: if the composer's position
never moves, stepping from audience into participant is "this panel gets an
input field," not "the screen reflows."

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

The dense one, and the mode neither reference app has *as a first-class mode*
— though Kindroid has a precedent worth citing directly rather than treating
this as unprecedented: a single kin can narrate multiple named characters
within one reply (observed live 2026-08-23, in a real Kindroid where one AI
voices several named cast members in the same message) — closer to what
director mode wants than either app's stated feature list suggests. This is a
staging desk: cast presence, turn order, location, pacing, and direction —
see §3.

### audience

We have already built this once. The Chaos Saga reader artifact *is* audience
mode: prose-forward, chapter headers, drop caps, no controls but "keep
going." Audience mode should be that reader with a Continue button.

**What "built" actually means, concretely** (re-examined 2026-08-23): a serif
pairing (Fraunces for display/chapter heads, Literata for body prose — regular
weight throughout, no italic-wall; selective `<em>` only for in-line
emphasis, which happens to already be the fix the design review's
accessibility finding above asks for), a warm near-black palette with one
amber accent and a **distinct cooler palette reserved for scene shifts** (a
cross-cut section runs a visibly colder temperature than the surrounding
chapter — a real, already-validated technique for signaling a POV/location
jump without breaking the reading flow, worth reusing anywhere a story cuts
between threads), a per-chapter meta row naming location, cast present, and a
provenance tag (original canon vs. continued-by-Claude) — a lightweight,
already-working precedent for the kind of provenance §4's assembly panel
wants to generalize — and a "Dramatis Personae" cast grid (photo, name,
epithet, one italicized signature line) worth reusing directly as the entity
library's character-card pattern (§9 slice 1). This artifact has no
interactive elements at all — no Continue button exists yet — so it's the
reading surface to build audience mode *from*, not audience mode itself.

### Empty and first-run states

**Gap flagged by design review (2026-08-23): nothing above describes day
one.** Every section — director's cast rail, the open-thread chips, the
assembly panel, the budget/influence editor — assumes a mature canon already
exists. A brand-new sixth story, or a second operator's first five minutes,
has none of it: no cast to stage, no keyphrases to match, no threads to
surface as chips. §9's slice 1 doesn't fix this either — "browse... across
all stories" is a view over existing data, not a first-run flow for creating
the first entity in a new one.

This needs an explicit design pass before slice 1 ships, not an assumption
that it falls out of the rest: what does director mode's cast rail show with
zero characters, what does the open-thread row show with zero threads, what's
the first thing a brand-new story's screen invites the operator to do. Botify's
own "All memories" panel is the cautionary example — a bare `Search` box and
"No memories found," no explanation, no worked example, despite §8 crediting
Kindroid elsewhere for "instructional empty states." Don't repeat the
functional-but-not-instructive version.

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
  character — and `advanceGroup` still has no way to say "Riley next." The
  deeper control, whether the floor ever comes back to *you*, **shipped
  2026-08-23** — `allowUser` is settable per call via `mnemo_continue`'s
  `allow_user`, and `AdvanceGroupResult.ended: "user_turn" | "max_turns"` is a
  real, receivable signal today. Interjecting, staying quiet, and letting it
  run are one control, not three modes, as designed.

  **Two gaps survived the ship (design + code review, 2026-08-23), both
  load-bearing for the UI:**
  - **The provenance header now fights the mechanic it sits next to.**
    `buildCompanionMessage` unconditionally opens every outgoing message with
    `[Mnemosyne — automated scene direction, not ${userName} typing]` —
    correct for an automated direction, backwards for the one case this
    turn-handback mechanic exists to enable: when the loop yields `user_turn`
    and the operator actually takes the floor, their own in-character line
    still gets branded "not Carl typing." Needs a per-call "this is really the
    operator" flag threaded to `buildCompanionMessage`, or routing true
    operator turns through `kindroid_groupchats_user_message` instead of the
    automated-direction path.
  - **Mode never reaches Kindroid or Botify generation.** Neither provider
    reads `systemPrompt`; `buildCompanionMessage`/`buildKindroidMessage` take
    no mode parameter at all. The three-postures table in §2 ("what the model
    does" changes per mode) is real only for the five direct-LLM providers —
    against a companion-chat target, switching participant/director/audience
    changes zero generation behavior today. Mode is pure UI chrome there
    unless this gets deliberate design attention: how do you "direct all
    characters" through a service that only has one send-message channel and
    a server-side persona? §7's watch-party framing leans on mode doing
    something in exactly the case where, right now, it does nothing.
  - **No affordance is specified for the live mode switch itself.** It needs
    to be a small, persistent, always-visible control (a three-state
    segmented toggle is the obvious shape), placed away from the composer's
    send action — the risk of an accidental mid-scene flip is highest when
    mode and send sit close enough for a mis-click. Apply a flip on the next
    beat, never mid-generation. And the turn-handback signal above is the
    natural hook for exactly this moment: surface "the floor is offered to
    you" as an *event* the UI reacts to (a highlighted composer, a quiet
    prompt) independent of whichever mode is currently selected, rather than
    requiring the operator to have pre-flipped to participant before the loop
    happens to pause.
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

**Scoped as collapsed-by-default instrumentation, not permanent display (UX
review, 2026-08-23).** The 2026-08-22 incident below argues for the data being
*available*, not for showing entity lists, keyphrase matches, token counts,
and validator flags next to every beat by default — an instrument you check
when something looks wrong stays valuable; one that's always expanded becomes
wallpaper within a session or two, and works against audience mode's own
"almost no chrome" premise (§2). One collapsed line per beat —
`47 entities · 14.2k/131k tok · validator: clean` — expanding on click into
the full breakdown gives the same ten-second diagnosis without competing with
the prose permanently.

For any generated beat, the expanded view shows:

- Which entities `gatherContext` pulled, grouped by type
- Which keyphrases matched, for companion providers
- Token count of the assembled prompt, and the window it went into
- What the validator flagged, if it ran
- A lever per entity: pin, deprioritize, or exclude from this story

**Reality check on what's actually free (code review, 2026-08-23).** Of the
four data points above, two need real backend work, not just surfacing:
`pullByType` flattens each recalled entity down to a bare `"name\nbody"`
string before `ContextBundle` exists, discarding the `memory_id`/`tags`/
`pinned` the per-entity lever needs — a reshape through `prompt.ts`,
`companion-message.ts`, and `validator.ts`, not a UI wiring task. And token/
window accounting barely exists: `computeNumCtx`/`estPromptTokens` are
computed inside `OllamaProvider` and logged, never returned, and none of the
four cloud providers or either companion provider parse or expose a usage
field — "the window it went into" is an Ollama-only concept, not something 6
of 7 providers can report. The keyphrase-match list and the validator report
*are* close to free (computed today, just need to survive the trip back out
of the provider call). Budget the panel's build accordingly — it is not a
pure-instrumentation slice, whatever §9 assumes.

**A gap the panel's own model doesn't obviously cover:** Kindroid's "Recalled
journals & memories" pattern was checked live inside a real group chat (design
review, 2026-08-23) and wasn't in the per-message menu there at all — only
confirmed in single-AI chats. Director mode is inherently multi-character (§2:
"the mode neither reference app has as a first-class mode"), so don't assume
the single-entity recall UI this section is modeled on generalizes to "which
of 12 entities in this scene's cast fired" without designing that case
explicitly. Whichever slice builds this panel first should prove it out
against a single-character audience-mode beat before it's asked to summarize
a multi-character director-mode one.

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

**A failure mode observed in the live Kindroid editor, not just theorized (UX
review, 2026-08-23).** The pattern is real and does what's described above —
each field header shows a live count plus a static influence/style note — but
watching it in use surfaces two problems worth designing around rather than
copying wholesale: the instructional prose is *permanent*, not progressive
(three lines of guidance repeat above every field, every time, consuming
roughly 40% of visible vertical space before the actual textarea, so by field
five you've lost sight of field one — works against the exact goal of holding
the whole character in view); and the counter never changes visual weight
approaching the cap — same color at 99% full as at 10% full, so "budget" isn't
doing any early-warning work, just displaying a number you have to read. Our
version should collapse the guidance text after first exposure per field
(tooltip/disclosure, not permanent body copy), and give the counter a real
warning state past ~90% — that's the one moment it's actually actionable. Also
worth deciding on purpose: one field observed live (Kindroid's "Additional
context") carried no stated influence tier at all, inconsistent with every
other field — if a field has no meaningful influence weight, say so explicitly
rather than silently omitting the line.

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
| Botify — narration vs dialogue styled differently in one bubble, and (operator preference, 2026-08-23) split-level italics within a single reply — the *first* asterisk-action gets a spotlighted accent color, later ones in the same reply fall back to a quieter muted tone | Prose is a wall; every action beat competing equally for attention is still a wall | Render the asterisk convention our style guides already mandate, **and** carry the same two-tier hierarchy: the reply's first action beat gets the accent treatment, subsequent ones recede — confirmed as a real, named platform mechanism (`message__text_italic` / `message__text_magic-glow`) via DOM inspection, not a rendering coincidence (see STATUS.md's live Botify probe, 2026-08-23) |
| Botify — left rail pairs icon + text label on every nav item | Icon-only navigation is mystery-meat until clicked once to learn it | Primary nav follows Botify's labeled-icon model, not Kindroid's icon-only top bar |
| Ours — the Chaos Saga reader artifact | — | Not a finished audience mode — an example of how imported + generated content assembles into one reading surface with provenance intact; the concrete patterns worth carrying forward (serif pairing, cold-cut color shift, chapter-level provenance tags, cast cards) are itemized in §2's audience subsection |

### Anti-patterns — deliberately not borrowing

Live use of both apps (design review, 2026-08-23) surfaced patterns worth
naming explicitly as things to avoid, not just omit by silence:

- **Kindroid — destructive and safe actions share one undifferentiated menu.**
  A message's "..." menu lists Continue message, Autoselfie, Rewind messages,
  Chat break, and Tweak AI message at identical weight, no grouping, no
  confirmation observed before a destructive one fires. "Delete chat" in the
  Preferences drawer is the same problem — a plain red text link at the bottom
  of a long scrollable panel, easy to fat-finger after scrolling past several
  toggles. Any mnemosyne control that can discard generated beats (director
  mode's turn/rewind controls especially) needs a confirmation step *and*
  visual separation from safe actions in the same menu — a divider, distinct
  color, or a secondary "more" tier — from day one, not retrofitted later.
- **Botify — browsing a character commits you to a conversation.** Clicking a
  bot card in the discovery grid doesn't open a profile, it opens
  `/bot_X/chat` and fires the greeting immediately; the inert profile view is
  reachable only *from inside* the chat you've already started — backwards
  order for "look before you leap." For the entity library (§9 slice 1), given
  our entities are curated canon rather than disposable chat-bot avatars, a
  browse action that accidentally spends context or starts a beat is a
  materially worse failure than Botify's stray "hi" costs there. **Browsing an
  entity must be strictly inert** — state this as an explicit constraint on
  slice 1, not an implicit assumption.
- **Both apps — low-contrast italic body text for AI-generated prose.**
  Readable at full attention in a screenshot, a real strain across the
  long-form reading audience mode is built toward. If audience mode carries
  over Kindroid's *chat-bubble* typography wholesale it inherits this; the
  Chaos Saga reader artifact already avoids it (regular-weight serif body,
  `<em>` only for in-line emphasis) — carry that forward, not the chat
  bubble's.
- **Botify — cost transparency is a pattern, not a system.** The inline chat
  media button correctly prints cost on the button (credited above), but the
  dedicated Generate page's primary CTA for the same spend just says
  "Generate 2 images" with no price on it — same product, two entry points,
  inconsistent. §6's "cost shown as information, never a paywall" needs "at
  every action point that spends, not just some" as an explicit acceptance
  criterion, since Botify itself doesn't clear that bar consistently.

---

## 9. If we build it in slices

**Prerequisite to all of the below: §0.** None of these are buildable against
the current stdio-only, single-global-story-pointer server.

1. **Entity library** — browse, search, edit, delete across all stories.
   Highest value, and it retires the patch-script workflow the imports ran
   on — but "zero generation risk" undersells the real prerequisite work
   (code review, 2026-08-23): it needs §0's story-pointer fix before anything
   else, plus a genuinely complete, sortable listing — `listAllEntities()`
   already exists (built for export, to avoid `memory_search`'s ranked
   100-result cap silently truncating) but isn't a registered tool yet.
   **Browsing must be strictly inert** — no entity click may fire a beat or
   spend context (see §8's anti-patterns). Audience mode (next) needs this
   same complete/sortable listing for chronological scene order, so plan the
   two together rather than as independent slices.
2. **Audience mode** — the reader we already have, plus Continue. Shares
   slice 1's listing prerequisite (see above).
3. **The assembly panel** (§4) — not pure instrumentation as originally
   scoped; see §4's reality check for what's actually free versus what needs
   backend restructuring. Prove it out against a single-character
   audience-mode beat before director mode's multi-character case.
4. **Director mode** — cast, turn order, location, open-thread chips. §3's
   storyline-plane controls (cast presence, turn order, location, pacing) have
   zero existing backend today — `gatherContext` takes no such overrides, so
   this is new schema work, not just UI wiring on top of what §3's
   turn-handback mechanic already shipped.
5. **Participant mode** — persona binding, conversational composer.
6. **Media in flow** (§6) — late, because it spends money and wants the
   art/sidecar plumbing exercised first.
7. **Watch parties** (§7) — last, and the only slice with another service in
   the path. Needs the per-call story selector first (subsumed into §0's
   story-pointer fix); wants director mode and media already working, since a
   watch party is a `mnemo_continue` someone else triggered. Mode doing
   nothing against companion providers (§3) is most visible here — resolve
   that before this slice, or the mode control in a watch party is decorative.

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
