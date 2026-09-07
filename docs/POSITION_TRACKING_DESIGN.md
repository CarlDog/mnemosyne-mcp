# Position Tracking Design

**Status:** **Ratified 2026-09-07** (operator: "ratify it, go ahead and
implement") with the five decisions below the original ratification
questions, plus four refinements an adversarial pre-implementation pass
surfaced the same day (see "Refinements added at implementation time"):
the parser-level atomic-invariant requirement, the `set_date`-predates-epoch
refusal (resolving a contradiction in the original draft), the
validation-context gating rule, and the accepted position-advance-before-
generation-failure semantics. [STATUS.md](../STATUS.md) remains the source
of current priority.

## Problem

Mnemosyne has no notion of "where and when the story currently is." Nothing
tracks in-story elapsed time or location between beats, so a timed event (a
deadline, an anniversary, "three days later") or a seasonal one (a winter
festival, a harvest scene) can't trigger reliably, and there's no way to say
"the story is currently at X" the way `mnemo_story_use` says which story is
active. Surfaced 2026-08-24; developed into a fuller shape 2026-08-25 via
the operator's own framing — an origin-anchored coordinate, deliberately not
three continuous spatial axes, since Mnemosyne's "space" is a discrete graph
of named places, not free 3D space.

A concrete check against live data changed the shape before this doc was
written: Chaos Saga's "Master Suite," "Garage," and "Backyard" — the exact
sub-locations the original sketch cited as the model for "two-level"
location — are **not** separate `type:location` entities at all. They're
prose sub-headings inside "Chaos House"'s own body text; no formal
parent/child relationship between locations exists anywhere in the current
data. Formalizing that just to support this feature would be a much larger,
unrequested change to the entity system. The design below treats "spot" as
free text the operator types, not a second entity pointer.

## Design

### Storage: one optional block on the story marker

Position tracking is **opt-in per story**, exactly like the Kindroid target
binding and narrator profile — most of the five live stories haven't asked
for this, and adding it must not change behavior for a story that never
sets it. The marker (`src/stories.ts`, currently schema 4) gains six new
optional lines, schema 5:

```
[Mnemosyne Story] <name>
Created: <iso-datetime>
Schema: 5
Kindroid-Target: ai:<id>            (optional, unchanged)
Narrator-Profile: <label>           (optional, unchanged)
Epoch-Date: <iso-datetime>          (optional; position tracking's on/off switch)
Epoch-Location: <memory_id>
Epoch-Spot: <free text>             (optional)
Elapsed-Hours: <integer>
Current-Location: <memory_id>
Current-Spot: <free text>           (optional)
```

Each line is single-purpose (no delimiter-packing of `type:id`-style
compound values the way `Kindroid-Target` does) specifically to avoid a
`|`-collision risk: unlike a Kindroid `ai_id`, a location's free-text
`spot` is operator prose and could plausibly contain almost any character.
**Location `name` is never stored in the marker** — only the `memory_id`.
Both `Epoch-Location` and `Current-Location` resolve their display name
fresh via `getEntityByMemoryId` on every read, so a later rename of the
location entity can't leave the marker's cached copy stale. Unknown/missing
lines are ignored on parse, same as every other optional marker field.

**The block is atomic**: a marker either has no `Epoch-*` lines at all
(position tracking not started for this story) or has `Epoch-Date` +
`Epoch-Location` together (the minimum to be "started" — `Elapsed-Hours`
defaults to `0` and `Current-Location`/`Current-Spot` default to the epoch's
own values when first initialized). There is no valid state with elapsed
time tracked but no epoch. **This invariant is enforced in the *parser*,
not only at write time** — `parseMarkerContent` treats any marker missing
either `Epoch-Date` or `Epoch-Location` as "position tracking not started"
regardless of what other position lines are present, rather than
constructing a half-initialized `position` object or throwing. Every write
path in this codebase goes through `setPosition`/`mnemo_position_set`, so a
malformed block can only arise from a hand-edited marker — and the parser
degrading it to "not started" (the same state as never having set it) is
the safe, honest reading: better than crashing, and better than trusting
partial data.

`current_story_datetime` is **always derived**, never stored:
`epoch_date + elapsed_hours`. `Elapsed-Hours` is the one field that changes
as the story advances — storing the *offset* rather than an absolute
current datetime means correcting the epoch later (if that ever proves
necessary) automatically reflows the current date by the same delta, for
free, with no separate recomputation step.

### Granularity: fixed storage, flexible interface

The operator's own read on this: needed granularity depends on the
storyline — sometimes hours matter, sometimes only whole days, sometimes a
jump of a whole season. Rather than model multiple stored units, `Elapsed-
Hours` is a single integer, fine enough to cover every case raised (a
same-day time-of-day shift isn't lost) and coarse enough that no one is
asking for sub-hour precision as *persistent* state (a "twenty minutes
later" beat is narrated directly in the scene, not tracked as global
state). The **tool layer** then offers whatever unit is natural to reach
for in the moment, all converging on the same stored number:

- `advance: { hours?, days?, weeks? }` — additive. "Three months later" is
  `{ days: 90 }`. Deliberately no `months`/`seasons` unit: calendar months
  have ambiguous length, and the operator can always express a coarse jump
  as a day count without the system needing to understand what a "month"
  is.
- `set_date: <iso-datetime>` — jump straight to a known target instead of
  counting forward (`elapsed_hours` becomes `(set_date - epoch_date)`
  computed once). For "this scene happens on Halloween" style cases.
  **`set_date` before the current `epoch_date` is refused with a thrown
  error and nothing written** — it would compute a negative
  `elapsed_hours`, and per "Explicitly out of scope" below, negative
  elapsed (flashback framing) is deliberately not designed for in v1. This
  resolves what was a contradiction in an earlier draft of this doc (which
  said elapsed "can decrease" while also citing negative elapsed as
  unsupported); refuse-with-no-write is the one behavior consistent with
  both statements, and matches every other pre-mutation refusal already in
  this codebase (`mnemo_session_break`'s validation chain, `RunOutcomeError`
  `rejected_before_dispatch`). A target **after** the epoch but **before**
  the current derived date is fine — that's an ordinary correction, not a
  flashback, and `elapsed_hours` simply decreases.

`advance`, `set_elapsed_hours` (an absolute jump in the stored unit), and
`set_date` are mutually exclusive on any one call — same
pick-at-most-one-of-N convention `kindroid_kin`/`kindroid_group_id` already
uses.

### Epoch correction: left open, not locked

The operator was explicit: unsure yet whether there's a real use case for
correcting the epoch after a story has already advanced. Rather than add a
restriction nobody has asked for, `mnemo_position_set` can rewrite
`Epoch-Date`/`Epoch-Location`/`Epoch-Spot` at any time — the offset-storage
design above makes this cheap (elapsed reflows automatically). If a real
problem shows up later ("someone corrected epoch mid-story and broke
continuity"), locking it after first use is a small, easy addition then;
removing a restriction operators have already built workflows around would
be the harder direction to walk back.

### Tool surface

**`mnemo_position_get(story?)`** — read-only. Returns:

```ts
interface PositionReport {
  epoch_date: string;
  epoch_location: { memory_id: string; name: string; spot?: string };
  elapsed_hours: number;
  current_story_datetime: string;   // derived, epoch_date + elapsed_hours
  current_location: { memory_id: string; name: string; spot?: string };
}
```

Throws a clear "position tracking isn't started for this story" error
(mirroring `mnemo_session_break`'s refusal style) if no `Epoch-Date` line
exists yet — same shape as that tool's existing "no Kindroid target bound"
refusal.

**`mnemo_position_set(...)`** — explicit, mirrors `mnemo_session_break`'s
"never something prose can trigger" principle:

```ts
{
  epoch_date?: string;
  epoch_location?: string;    // memory_id of a type:location entity
  epoch_spot?: string;
  advance?: { hours?: number; days?: number; weeks?: number };
  set_elapsed_hours?: number;
  set_date?: string;
  current_location?: string;  // memory_id; moves location without touching time
  current_spot?: string;
  story?: string;
}
```

First call on a story **must** supply `epoch_date` + `epoch_location`
together (this is what "starts" tracking). Every later call may touch any
subset — a pure time advance, a pure location move, or both at once — and
untouched fields keep their stored value, matching the partial-update
convention `PATCH /entities/:memoryId` already established. Setting only
`current_location`/`current_spot` never changes `elapsed_hours`, and vice
versa.

**`mnemo_continue` gains optional `advance`, `set_date`, `move_to`** (same
shapes as above, `move_to: { location, spot? }`), applied to the marker
**before** `gatherContext` runs — so the beat is generated already knowing
the new date/place, not stale by one call. These params **do not**
implicitly initialize tracking: calling them on a story with no epoch set
yet is a pre-dispatch refusal (`RunOutcomeError("rejected_before_dispatch",
...)`, the same class this repo already uses for this kind of preflight
failure), directing the caller to `mnemo_position_set` first. This keeps
the same "you must deliberately configure this before it activates"
boundary already used for Kindroid target binding — a convenience param
buried in a generation call must not be the thing that silently turns a
feature on for the first time.

**If the marker write succeeds but generation subsequently fails** (a
provider timeout, `provider_dispatch_unknown`, `completed_but_readback_
failed`, or any other post-dispatch failure), **the position advance is
not rolled back.** This is a deliberate choice, not an oversight: `advance`/
`set_date`/`move_to` are explicit operator directives, not inferred from
prose, and the same "the first mutation stands even if a later step fails"
principle already governs `mnemo_session_break` (its chat-break is real
and not undone just because the follow-up save fails; the documented
recovery is to re-save the greeting). Position tracking follows the same
shape: the operator declared the scene moves forward in time/place, and
that declaration is a fact about the story regardless of whether a beat
describing it was successfully written. Recovery, same as session-break's,
is manual — `mnemo_position_set` to correct it back if the failure meant
the scene truly didn't happen. The alternative (deferring the write until
a successful save, rendering a *prospective* position into context without
committing it) was considered and rejected as unwarranted complexity for a
case with a cheap manual fix.

### Rendering into generation context

The operator's call: **always included**, not gated behind mode or
provider — the entire point of tracking this is so a beat can correctly
reference "it's been three days since the incident." This is a genuinely
new integration point, not just a new tool. **"Always included" scopes to
generation, not validation**: `gatherContext` is shared by `mnemo_continue`
(generation) and `mnemo_validate`/`mnemo_revalidate_scenes`
(`validationOnly`, which deliberately skips scene-gathering too). A
validator is checking an existing beat against rules/style/continuity, not
producing new prose that needs to know "how long has it been" — and
`mnemo_revalidate_scenes` already runs `gatherContext` once per scene in a
loop, a path STATUS.md's Known Gaps already flags as rate-limit-sensitive.
The marker's position lines are read only when `!validationOnly`, so a
revalidate pass over N scenes costs zero extra OC reads for this feature,
and the field is simply absent from validation's `ContextBundle` — the
validator was never going to be told the current position, mirroring how
it was never given scene context to begin with:

- `ContextBundle` (`src/prompt.ts`) gains an optional `position` field —
  `{ current_story_datetime, current_location: { name, spot? } }` — populated
  by `gatherContext` reading the story marker directly (a different read
  path than the existing entity-type `recall()` calls; position isn't an
  entity). Absent entirely when the story has no epoch set, so a story that
  never opts in sees zero behavior change and zero extra cost.
- `buildSystemPrompt` (direct providers) renders it as its own labeled
  section, structurally separate from rules/style (it's declarative story
  state, not a constraint) — exact placement TBD at implementation, but
  never merged into the rules block.
- `buildCompanionMessage` (Kindroid/Botify, `src/companion-message.ts`)
  folds it into the `ALWAYS_INCLUDED_TYPES` treatment scenes/locations
  already get — present in every message when set, never keyphrase-gated.
- Cost: one additional light `getEntityByMemoryId` read per `mnemo_continue`
  call (to resolve `current_location`'s display name), only when the story
  has position tracking on. `gatherContext` already does seven sequential
  OC reads per call (STATUS.md's Known Gaps already flags this as a real
  rate-limit pressure point) — this adds one more, bounded, not per-entity.

## Explicitly out of scope (decisions, not omissions)

- **Travel/duration between locations.** The sketch's own instinct — a
  discrete graph of named places, not free 3D space — already argues
  against modeling distance, and nothing has demonstrated a need for it.
  Real prose doesn't calculate travel time either; the operator just
  declares the jump.
- **Sub-hour precision.** Nothing raised a need for it as *persistent*
  state; a same-scene time-of-day beat doesn't need to survive past the
  scene it's narrated in.
- **Formal sub-location entities / parent-child location graph.** The live
  data check above confirms this isn't how locations are modeled today;
  building it just for this feature would be new scope well beyond
  position tracking.
- **Negative elapsed / flashback framing.** Position tracking here is "where
  the ongoing narrative currently stands," not a flashback-authoring tool.
  A `set_date` that would produce negative elapsed (predating the epoch) is
  refused outright (see "Granularity" above) — the one place this gets an
  explicit forbid, because leaving it unvalidated would silently corrupt
  `current_story_datetime`. Flashback framing as a *feature* remains parked,
  not decided.
- **Multiple concurrent positions per story** (parallel timelines/threads).
  All five live stories are single-timeline; no evidence of a need.
- **Web UI display.** MCP tool surface + backend only, per the operator's
  own scoping call. A "story clock" widget is a natural follow-on once this
  shape is proven out, not part of this pass.
- **Epoch-locked-after-first-use.** Deliberately not added now (see "Epoch
  correction" above) — revisit only if a real problem surfaces.

## Acceptance tests

- A story with no `Epoch-Date` line: `mnemo_position_get` throws the clear
  "not started" error; `gatherContext`'s `position` field is entirely
  absent; `mnemo_continue` with `advance`/`set_date`/`move_to` is a
  pre-dispatch refusal naming `mnemo_position_set`.
- `mnemo_position_set(epoch_date, epoch_location)` on a fresh story
  initializes with `elapsed_hours: 0` and `current_location` defaulted to
  the epoch location; a subsequent `mnemo_position_get` reflects both.
- `advance: { days: 3 }` then `advance: { hours: 6 }` accumulates correctly
  (`elapsed_hours` increases by `78`, not overwritten).
- `set_date` computes the correct `elapsed_hours` delta against the current
  `epoch_date`, including a case where the target date is *before* the
  current derived date but *after* the epoch (elapsed decreases, nothing
  refused), and a separate case where the target date is *before* the
  epoch itself (throws, nothing written, `elapsed_hours` unchanged).
- Correcting `epoch_date` after `elapsed_hours` is already non-zero shifts
  `current_story_datetime` by exactly the epoch delta, with `elapsed_hours`
  unchanged.
- Setting only `current_location` leaves `elapsed_hours` untouched, and vice
  versa.
- `mnemo_continue`'s `move_to`/`advance` apply before `gatherContext`, so
  the generated beat's context reflects the *new* position, not the one
  before the call.
- A story with position tracking on renders it into both the direct-provider
  system prompt and the Kindroid/Botify companion message, unconditionally
  (not keyphrase-gated); a story without it renders neither, with no extra
  OC read attempted.
- Location `name` resolves fresh from the entity on every read — renaming a
  `type:location` entity is reflected in the very next `mnemo_position_get`
  without needing to re-set position.
- `gatherContext` called with `validationOnly: true` on a story with
  position tracking on produces a `ContextBundle` with `position` absent,
  and makes zero marker reads for it — `mnemo_validate`/
  `mnemo_revalidate_scenes` never see or pay for this field.
- A hand-edited marker with `Elapsed-Hours` but no `Epoch-Date` (or vice
  versa) parses as "position tracking not started," not a crash and not a
  half-populated `position` object.
- If `mnemo_continue`'s `advance`/`move_to` marker write succeeds and the
  subsequent generation then fails, a following `mnemo_position_get`
  reflects the already-applied advance — it is not rolled back.

## Slices (dependency order; 1+2 ship as one commit, then 3, then 4)

1. **Marker schema 5** — `Epoch-*`/`Elapsed-Hours`/`Current-*` lines,
   parse/build in `src/stories.ts`, the atomic-block invariant enforced in
   both the parser and at write time.
2. **`mnemo_position_get`/`mnemo_position_set`** — the standalone tools.
   Bundled with slice 1 in the same commit: a schema bump with no tool to
   exercise it is an invisible, unverifiable change (nothing observable
   happens, and the parser's new branches can only be tested against
   hand-built strings). Together, slices 1+2 give the smallest independently
   verifiable unit — set then get and see the round-trip.
3. **`gatherContext` + rendering** — the `ContextBundle.position` field
   (generation-only, gated on `!validationOnly`), `buildSystemPrompt` and
   `buildCompanionMessage` changes.
4. **`mnemo_continue` integration** — `advance`/`set_date`/`move_to` params,
   applied pre-`gatherContext`, with the not-yet-initialized refusal and the
   accepted advance-survives-generation-failure semantics.

## Decisions ratified 2026-09-07

1. The schema-5 marker line set and the single-purpose-line (no
   delimiter-packing) choice for `spot`.
2. `Elapsed-Hours` as the sole stored unit, with `advance`'s
   `{hours, days, weeks}` as the only tool-layer convenience shape (no
   `months`/`seasons` unit).
3. Epoch stays correctable indefinitely in v1 (no lock-after-first-use).
4. `mnemo_continue`'s position params refuse pre-dispatch on an
   uninitialized story rather than implicitly bootstrapping tracking.
5. Position renders as its own labeled context section, not folded into the
   rules/style block, in both the direct-provider system prompt and the
   companion-message builder.

## Refinements added at implementation time

A scoped pre-implementation adversarial pass (2026-09-07, before any code
was written) found the original ratified draft under-specified in four
places. Each is folded into the sections above; listed here as the record
of what changed and why, per this repo's own practice of citing rationale
rather than re-deriving it later:

1. **The atomic-block invariant must be enforced in the parser, not only at
   write time.** Every write path goes through `setPosition`, but a
   hand-edited marker could still violate it; the parser now degrades any
   incomplete `Epoch-*`/`Elapsed-Hours` combination to "not started" rather
   than risking a crash or a half-populated result. Matters because slice
   1 bumps every story's marker to schema 5 on its *next* write for any
   reason (`setKindroidTarget`, `setNarratorProfile`, `mnemo_story_use`),
   not just when position tracking is actually used — so schema-5-with-no-
   position-block must be provably identical in meaning to schema-4, for
   all seven live stories, not just the ones that opt in.
2. **`set_date` predating the epoch is refused, not clamped.** The original
   draft was self-contradictory (see the "Granularity" and "Explicitly out
   of scope" sections above) — resolved in favor of refuse-with-no-write,
   consistent with the codebase's existing pre-mutation refusal pattern and
   with parking (not attempting) flashback framing.
3. **Position renders in generation context only, gated on
   `!validationOnly`.** `gatherContext` is shared with the validator path,
   which was never in scope for "always included" — that phrase described
   generation. Gating also avoids adding an OC read to
   `mnemo_revalidate_scenes`'s per-scene loop, an existing rate-limit
   pressure point.
4. **A successful position write is not rolled back if generation
   subsequently fails.** Matches `mnemo_session_break`'s existing
   break-then-save precedent rather than introducing a new
   pending-position-until-save concept.
