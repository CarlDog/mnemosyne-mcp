# Kindroid Narrator: the Mnemosyne-side design

**Status: Decisions ratified 2026-09-03; slices scheduled one at a time.**
This document schedules no implementation by itself; [STATUS.md](../STATUS.md) remains the
source of project priority. It is the Mnemosyne half of the operator's
narrator-kin proposal, whose kindroid-mcp half, the boundary statement, the
adversarial review record, and the smoke tests, lives at
`kindroid-mcp/docs/narrator-kin-design.md`. That file stays the record of what
kindroid-mcp will and will not own; this one holds what would change here.

**Ratified 2026-09-03:** the operator accepted every recommendation in §5.
S1, S2, and S3 shipped the same day; S4 and S5 remain unscheduled; S4's
share check (decision 12) is answered: a share is a snapshot.

## 1. The shape, in one paragraph

A reusable narrator is a **Kindroid identity**, not a code path: a dedicated
kin whose persona carries the narration contract and the house voice, bound to
a story through the existing per-story Kindroid target. Mnemosyne already owns
everything around that identity: story state in OpenChronicle, context
selection, the message shape, save-first validation, and now retry-safe sends.
What is missing is small: a way to name which narrator a story uses, an
explicit session-break action that prose can never trigger, and a fix to the
context selector that today drops a location the direction does not name.

## 2. What already works, verified 2026-09-03

- The persona-carried protocol holds over the message-text channel: with the
  automated-note header and the bracketed context block explained in the kin's
  pinned Key Memories, beats came back as prose only, narration in asterisks,
  dialogue plain, nothing quoted from the block, no meta.
- An instruction embedded in a character's dialogue inside the context block
  was folded into the story and not obeyed, once.
- With the kin's Memory formation, Memory recall, Learned Context, and Time
  awareness switched off, a chat break isolated memory: a post-break probe
  could not reproduce a pre-break invented fact.
- `mnemo_continue` with the Kindroid generator bound to the kin, against a
  seeded OC story, generated in about 39 s, saved the beat, and ran the Ollama
  validator against rules the kin never saw. The provider-level integration
  suite passed three real exchanges through a local kindroid-mcp.
- `kindroid_send_message` is retry-safe: every send carries an idempotency
  token, a timeout re-sends under the same token, and Kindroid replays the
  original reply rather than posting twice.

## 3. Findings that shape the design

1. **The persona is the style for every story bound to the kin.** Rules and
   style never travel through the companion channel, by the ratified
   2026-08-01 decision in [companion-message.ts](../src/companion-message.ts).
   The validator still judges each beat against the story's rule and style
   entities, so a story whose style differs from the kin's persona is flagged
   on every beat.
2. **`mode` never reaches a Kindroid narrator.** The mode directive lives in
   the system prompt, which the Kindroid provider does not send. The persona
   fixes the stance instead, and the player-agency rubric row belongs to a
   participant-shaped kin, not this one.
3. **Keyphrase gating matches the full entity name.** A direction that says
   "Ilse" never folds in "Ilse Varga", and a location is included only when
   the direction names it verbatim. In the end-to-end run the arctic station
   was dropped, the kin invented a space station, and the next beat inherited
   the invention through recent scenes.
4. **Proper nouns in the kin's Example Message leak into narration.** A name
   that existed only in the example passage surfaced after a chat break.
   Example passages use unnamed figures.
5. **Versions are invisible to the API.** Regenerate, Suggest, and Tweak in
   the app add retained versions; `get-chat-messages` returns only the chosen
   one. Any app-side correction must be re-saved to OC by hand or the two
   stores drift.
6. **Truncation is undetectable on the stateful path.** `send-message` carries
   no completeness signal, so a cut-off Kindroid beat saves as canon today.

## 4. Proposed slices, all in Mnemosyne

None of these is scheduled. Each is independently testable without a live kin
except where noted.

### S1. Context selector: match names the way directions write them

**Shipped 2026-09-03.** `nameMentioned` matches the whole name or any
distinctive token of it (four or more letters, not a stopword;
`MIN_DISTINCTIVE_TOKEN` and the stopword list live in
[companion-message.ts](../src/companion-message.ts)); locations join scenes
in `ALWAYS_INCLUDED_TYPES`, and the selector that feeds
`context_plan.companion_selection` shares both rules with the builder.

Two changes to `selectCompanionMemoryIds` and the builder that share its
matching, keeping one implementation:

- **Any distinctive word of a multi-word name matches.** For "Ilse Varga",
  either "Ilse" or "Varga" mentioned with word boundaries folds the entry in.
  "Distinctive" means a token of four or more letters that is not a stopword,
  so "The Storyteller" does not match on "The".
- **Locations are always included, bounded.** Recent scenes are already always
  included because they carry continuity; a story's locations carry the
  setting the kin cannot otherwise know, and there are few of them. Cap at the
  existing per-type limit and report them in `context_plan.companion_selection`
  like everything else.

Done when: unit tests pin both rules and the manifest still equals the real
payload; the end-to-end seed from 2026-09-03 folds in Ilse Varga and the
station from the direction "Ilse crouches at the hatch".

### S2. Name the narrator on the story

**Shipped 2026-09-03.** `mnemo_story_use(narrator_profile)` writes a
`Narrator-Profile:` line on the story marker (schema 4; `null` clears), the
story summary carries it, `mnemo_continue` echoes it as `narrator_profile`
whenever the story's Kindroid binding is consulted or prefetched, and the
saved scene carries a `narrator:<label>` tag. The label policy lives in
[narrator-policy.ts](../src/application/narrator-policy.ts) so the
continuation use case and the marker agree on one shape.

A `narrator_profile` label on the story marker, set through `mnemo_story_use`
alongside the Kindroid target, surfaced in `mnemo_continue`'s response and in
the scene's tags. A label, not a schema: the profile itself is the kin's
persona, written once by hand and journaled by kindroid-mcp's persona-write
log. This gives provenance ("which narrator wrote this beat") without a second
copy of the persona that would drift.

### S3. Session break as its own explicit call

**Shipped 2026-09-03** as `mnemo_session_break(greeting, story?,
kindroid_kin?)`: a use case of its own
([session-break.ts](../src/application/session-break.ts)) behind a narrow
port, refusing non-Kindroid generators, blank greetings, unbound stories,
and group targets before any mutation; the break runs first and the greeting
is then saved as a scene tagged `session-break` plus the narrator label, with
a failed save reported as recoverable. `KindroidClient.chatBreak` pins
`wipe_cascaded` off and keeps the no-retry timeout rule.
Live-verified the same evening against the test kin through a local
Mnemosyne and kindroid-mcp: the break applied in under two seconds, the
greeting landed as a `session-break`-tagged scene, and the next beat continued
from it with the narrator label echoed and tagged.

A new tool, not a parameter on `mnemo_continue`: `mnemo_session_break(story?,
greeting)` that calls `kindroid_chat_break` with `wipe_cascaded: false` fixed,
refuses when the bound target is a group, and saves the greeting as a scene so
OC's recent scenes and the kin's short-term context start the new session in
step. Composing the break into a continue call would put two non-idempotent
mutations behind one timeout; chat break has no idempotency key
(live-verified: the field is rejected), so it keeps the no-retry rule and its
own unknown-outcome error.

### S4. Stateless target type, gated

A third `KindroidTarget` type, `{type: "share", id: <share code>}`, routed to
`kindroid_discord_bot` with the compiled context rendered as a conversation
window. Decision 12 is answered: a share is a snapshot, so a share target's
persona is frozen at share time and re-profiling means a new share code from
the app. Still unscheduled, and gated by decision 11: shares only for
stories declared SFW. Two more observations from the same probe: the kin
narrated past a fact pinned in Key Memories in four of four tries, so a
persona *directive* is the reliable lever and a persona *fact* is not; and
identical consecutive directions produced byte-identical replies in the
1:1 chat, which a story author would notice as repetition.

### S5. Evaluation corpus

The existing validator and `mnemo_revalidate_scenes` are the harness. What is
missing is the synthetic corpus: the six seed entities from the end-to-end run,
a dozen directions covering the rubric rows, and the injection case. Scored by
the validator, with the constant-baseline check the LLM rules require, and
read by a person before any number is believed.

## 5. Decisions waiting on the operator

Numbered to match the kindroid-mcp document where they overlap.

| # | Question | Recommendation |
|---|---|---|
| 1 / 11 | Is stateless the default, and which content ratings may use a share at all? | Stateful is the default. A share path exists only for stories declared SFW under the content-rating field proposed in [CONTENT_ROUTING_DESIGN.md](CONTENT_ROUTING_DESIGN.md); mature stories never reach it. |
| 10 | Do rules and style ride in each beat, or stay persona-side? | Persona-side, unchanged. One kin per voice; a story's style entity mirrors the kin's persona so the validator and the generator agree. |
| 12 | Does a share track later `update-info` edits to its kin? | **Answered 2026-09-03: no, a share is a snapshot.** With a share code for the test kin, a rewritten Response Directive appeared in the kin's own chat at once (twice) and never through the share (twice). Re-profiling a share means re-sharing in the app, with moderation, for a new code. |
| 13 | Where does the Mnemosyne-side design live? | Here. The kindroid-mcp file keeps the boundary statement and the review record. |
| new | Entity naming in the context selector. | S1, both halves. |
| new | Groups. | Out of scope for the narrator until the single-kin path has run a real story. |

## 6. Non-goals

- No narrator profile schema, story packet schema, or prompt compiler as new
  artifacts; the persona, `ContextBundle`, and the existing message builder are
  those things.
- No private Kindroid routes from code. Regenerate, Suggest, Tweak, and version
  selection stay app-side; the recovery path is re-send or rewind through the
  supported API, then a hand re-save to OC.
- No automatic regeneration on validation failure, per ARCHITECTURE.md §8.
