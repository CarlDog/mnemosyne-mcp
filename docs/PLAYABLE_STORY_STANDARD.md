# Playable Story Standard

**Status:** Proposed; pending operator acceptance  
**Version:** Draft 2  
**Applies to:** Storylines intended for interactive play  
**Revised:** 2026-09-18, Draft 2 after adversarial review (see revision notes)

## Purpose

This standard defines the layer between a story bible and played scenes. Its
goal is a **stateful story spine**: enough authored structure to create
recognizable places, pressures, discoveries, and dramatic movement, while
leaving dialogue, choices, relationships, routes, and outcomes to play.

It supplements the [Living Canon Standard](LIVING_CANON_STANDARD.md). That
standard governs the quality and authority of story references; this one
governs how those references become an interactive scenario.

It requests no implementation: every record it names is authored evidence,
and it reopens none of the v0 exclusions in [ARCHITECTURE.md](ARCHITECTURE.md)
section 8.

The governing principle is:

> Author situations that demand responses, then let character decisions and
> accumulated state determine what becomes possible next.

## Non-goals

This standard does **not** require:

- a scene-by-scene screenplay;
- exhaustive branching trees or a catalog of fixed endings;
- guaranteed participation in every prepared encounter;
- dialogue menus, response scripts, or personality macros;
- characters who know future beats, hidden truths, or their intended arcs;
- automatic adoption of one run's events into shared story canon.

## 1. Authority and mutability

Every playable story should distinguish these layers:

1. **Ratified story authority** — operator decisions, established canon, and
   explicit revisions. These bind every run unless deliberately revised.
2. **Run authority** — events accepted in play and the current state derived
   from them. These bind the active run but do not automatically alter the
   shared story bible.
3. **Scenario authority** — opening conditions, hidden facts, active pressures,
   and rules the director uses to adjudicate the run. Established hidden facts
   remain true; proposed beats and routes remain possibilities.
4. **In-world belief** — what a character, faction, or document believes.
   Belief may be true, partial, mistaken, manipulated, or obsolete.
5. **Open possibility** — unused hooks, candidate motives, optional set pieces,
   and possible outcomes. Preparation alone does not make them true.

When layers conflict, explicit operator rulings and deliberate revisions take
priority. Otherwise, ratified canon constrains run state, and accepted run
state constrains future play. A proposed beat never overrides what has already
happened.

"Established" carries the meaning the
[Living Canon Standard](LIVING_CANON_STANDARD.md) section 1.1 gives it: events
played on-page, facts the operator has ratified, and current authoritative
records. A hidden fact in the scenario layer is established by the director's
record of it, not by appearing on the page; when an accepted scene contradicts
it, layer 2 wins and the hidden fact is retired or revised under section 11's
correction rule.

> **Status: the run/canon separation this section assumes is not built.** The
> runtime keeps one canonical project per story and saves every complete beat
> into it with no run identifier; a run registry or snapshot store was
> considered and rejected at triage, and [ARCHITECTURE.md](ARCHITECTURE.md)
> defers per-turn state until real use demands it. Until that changes, a
> played beat is the story's beat, and a second run of the same bible needs a
> separate story project.

Each scenario element should also state how mutable it is:

- **fixed:** a world rule, protected truth, or opening condition;
- **committed pressure:** it will continue unless something changes it, but its
  manifestation and outcome remain open;
- **conditional:** eligible only while stated prerequisites remain true;
- **optional:** available material with no promise that it will appear;
- **play-determined:** dialogue, decisions, relationships, solutions,
  casualties, departures, and endings not otherwise established.

## 2. Actor and director knowledge

Future structure must remain outside ordinary character-facing context.
Maintain three context partitions:

- **shared world context:** established facts any present actor could reasonably
  know;
- **actor context:** that character's observations, memories, beliefs,
  misunderstandings, and information learned during play;
- **director context:** hidden facts, separate NPC knowledge, private agendas,
  clocks, eligible beats, and unresolved possibilities.

> **Status: the runtime does not enforce these partitions.** One flattened
> context reaches one model that performs every present character; the
> profile template's "audit, never sent" class and a partitioned memory body
> are designed but deferred. Until they exist, director-only material lives in
> records that never enter retrieval (`drafts/_control/`, section 12), and a
> character record is written knowing that the model performing the character
> sees all of it, including what the character does not know.

The narrator may use director context to portray the world, but must not leak it
through a character's thoughts, dialogue, deductions, or convenient behavior.
Every consequential piece of character knowledge should have provenance: direct
observation, a named source, prior experience, inference, or an accepted scene.

Characters do not know the scenario spine, outcome axes, beat triggers, or
their likely dramatic role. NPCs receive only the knowledge and evidence
available to them, including when the director knows more.

## 3. Agency contract

Every run should identify which character or characters the player controls.
Unless the player delegates control, the player owns their:

- meaningful choices and commitments;
- spoken dialogue;
- deliberate physical actions;
- private thoughts, interpretations, and desired emotional response.

The director owns the environment, passage of time, consequences, NPC choices,
and involuntary effects that follow from established world rules. The director
may frame immediate sensory experience and ask for a response, but should not
supply consent, agreement, intent, or a decisive action for a player-controlled
character.

Refusal, delay, withdrawal, negotiation, investigation, and an unexpected plan
must all be playable responses. They may carry consequences; they must not be
silently converted into compliance. Scene transitions should follow an action,
a consequence, or a genuine change in circumstances rather than an outline's
need to reach the next scene.

## 4. Opening state

The opening state is a recoverable snapshot, not an opening script. Record:

- current time, place, environmental condition, and relevant access;
- each active character's position and physical, emotional, and social state;
- actor-specific knowledge, beliefs, suspicions, and meaningful unknowns;
- established relationships, debts, promises, permissions, and boundaries;
- object ownership, custody, condition, and availability;
- active factions, pressures, and clocks;
- the immediate disturbance or opportunity;
- several visible affordances, including the ability to ignore or leave when
  the fiction permits it.

An opening state may create urgency without deciding what the player says,
believes, or does.

## 5. Characters as decision engines

A scene-ready character profile should support decisions under changing
conditions. At a depth proportionate to the character's role, establish:

- external goal and underlying need;
- values, loyalties, fears, vulnerabilities, and red lines;
- contradiction, blind spot, or consequential misunderstanding;
- capabilities, limitations, resources, and preferred methods;
- current knowledge and beliefs, with sources where consequential;
- secrets and the conditions under which they might disclose them;
- relationship geometry, including asymmetric power and competing wants;
- escalation, retreat, trust, and change thresholds;
- likely offscreen actions if nobody intervenes;
- voice, manner, and sensory presence.

Portrayal should arise from the character's beliefs, values, relationships,
current state, and immediate pressure. Voice is evidence of character, not a
substitute for choice. A useful profile lets the same character cooperate,
resist, lie, reconsider, withdraw, or act alone without becoming arbitrary.

No profile should prescribe a destined arc. State what evidence, cost, or
experience could change the character's mind; do not assert that the change
will occur.

For a profile in the character/3 shape these bullets already have homes:
goal and need in `wants`; values, fears and red lines in `wants` and
`guardrails`; contradiction in `wants.contradiction`; capabilities in
`capabilities`; knowledge and beliefs in `knowledge`; relationship geometry in
`relationships`; escalation and retreat in `guardrails`; offscreen action in
`guardrails.offscreen` and the last `decision_rules` entry; voice in `voice`
and the card. Secrets, their disclosure conditions, per-item knowledge sources
and trust or change thresholds go in the budgeted `story.*` fields as flat
values; a nested form needs a budget entry first; an open question belongs in
`undecided` with its decider. Depth follows the profile tier rule (a minor
character is card only), not this list.

## 6. Pressures and clocks

A pressure is an actor, condition, need, or threat that changes the world if
left alone. A clock makes its progression legible. For each one, record:

- source and present condition;
- what is visible and what remains hidden;
- what advances, slows, redirects, or resolves it;
- escalation stages and their concrete effects;
- what relevant NPCs do at each stage;
- what happens offscreen if nobody intervenes;
- expiry, failure, or transformation conditions.

Advance pressures because time passes, actors act, resources change, or an
established trigger occurs. Never advance one merely to force a prepared beat.
A clock should create consequences and new circumstances, not remove agency.

## 7. The scenario spine

The spine is a set of dramatic functions connected by state, not a numbered
sequence of mandatory scenes.

### 7.1 Landmarks

A landmark is a recognizable place, problem, revelation opportunity, or change
in pressure that gives the story shape. Define its dramatic function and
eligibility window. Its location, participants, timing, and result may change
unless established constraints make one of them fixed.

A landmark may be missed. If it is indispensable because of a fixed world
event, preserve the event while leaving the player's presence, interpretation,
response, and consequences open.

### 7.2 Conditional beats

A conditional beat becomes eligible only when its state predicates are true.
It should define a pressure or question, not an intended answer. If its
prerequisites cease to be true, revise, relocate, defer, or retire it.

### 7.3 Optional set pieces

An optional set piece is prepared material that may reward a particular route
or circumstance. It can add spectacle, intimacy, danger, humor, or thematic
weight, but play must remain coherent if it never occurs.

### 7.4 Consequences

A consequence is a state transition produced by action, inaction, time, or
pressure. Record what changes rather than prescribing the next scene.
Consequences may open and close routes, move objects, alter relationships,
damage locations, change beliefs, or advance other pressures.

No beat should prescribe exact dialogue, emotion, player choice, victor, or
exit unless one of those facts has already been established through play.

## 8. State-based routes

Represent routes with eligibility predicates over live state. Useful inputs
include knowledge, trust, access, object custody, injuries, promises, faction
standing, location condition, elapsed time, and clock stage.

Do not enumerate every possible choice tree. Author a small set of durable
situations and state transitions that can combine in unplanned ways. When a
player creates a valid route that was not anticipated, adjudicate it from world
rules, character motives, and current state.

Routes may converge when the world gives them a credible reason to converge.
Convergence must retain the consequences of how each route arrived: altered
trust, lost time, spent resources, injuries, witnesses, knowledge, or changed
control. Do not use convergence to restore a preferred status quo or deliver
the same revelation regardless of prior choices.

## 9. Live state ledger

After each consequential scene, update one compact authoritative ledger for the
active run. Track as applicable:

- story time as the story marker records it (position tracking is the
  authority for time and place; the ledger points to it rather than restating
  it), and each character's position;
- health, fatigue, clothing, exposure, and other physical conditions;
- character-specific knowledge, evidence, beliefs, and provenance;
- relationships, trust, leverage, attraction, resentment, and power;
- promises, lies, refusals, debts, permissions, and boundaries;
- object ownership, custody, use, damage, loss, and repair;
- location condition, control, hazards, and access;
- faction posture, active pressures, and clock stages;
- hooks opened, transformed, answered, expired, or disproved;
- beats and routes currently eligible, blocked, or retired;
- pointers to the played scenes that established important changes.

The ledger stores current state and concise provenance. It should point to
full histories rather than duplicate them. Before continuing a run, current
state should be recovered from this ledger and authoritative scene records,
not reconstructed from the original outline.

For a player-controlled character, record private belief, emotion, attraction,
trust, or intent only when the player establishes it. Observable behavior and
an NPC's interpretation of that behavior may be recorded separately without
turning the interpretation into the player's internal state.

## 10. Outcome axes

Define several independent dimensions whose combined state can shape a
resolution. An axis might concern a person, community, relationship, truth,
resource, institution, or unresolved threat. For each axis, record:

- opening state;
- meaningful directions or thresholds;
- which kinds of events may move it;
- observable signs of its current condition;
- what remains unresolved.

Axes diagnose the accumulated result of play; they are not scores the story
must maximize or endings the director must steer toward. Keep hidden axes out
of actor context until evidence makes them observable. A conclusion should
follow the final state across axes and remaining pressures rather than select a
prewritten ending label.

## 11. Run history and adoption into the bible

Accepted played events establish continuity for that run. Preserve an ordered
run history and update the live ledger without rewriting earlier scenes.
Corrections and retcons should name what changed and why.

Run continuity does not automatically become shared story canon. Adoption
into the bible requires an explicit operator decision that identifies:

- the fact or change being adopted;
- its source run and scene;
- its scope across future runs or derivatives;
- any canon record it revises;
- unresolved alternatives that remain open.

Separate runs may produce incompatible outcomes while sharing the same opening
bible. Neither run invalidates the other, and generated possibilities that
were never played remain non-canon.

Adoption is a different act from the drafts-to-canon overlay promotion that
the repository's tooling performs and that the operator has set aside; this
section proposes no promotion and opens no path around that instruction. An
adopted event would enter the bible as a draft revision and travel the same
review as any other revision of the bible.

## 12. Authoring templates

Beat cards, launch briefs, the live ledger, run history and validation results
are authoring evidence, not entities. They live under the story's
`drafts/_control/play/`: the overlay verifier ignores `_control/`, nothing there
is compiled, promoted or retrieved, and that is what keeps director-only
context out of the generator.

### 12.1 Beat card

```markdown
# Beat: <stable name>

- Type: landmark | conditional | optional set piece | consequence
- Authority/mutability: <fixed, committed pressure, conditional, optional>
- Dramatic function: <question or pressure this beat brings into play>
- Eligibility: <state predicates>
- Window/expiry: <when it can appear or cease to apply>
- Actor-visible signals: <what can be observed>
- Director-only context: <hidden fact, clock, or constraint>
- Participant pool: <eligible actors; do not require all>
- Location constraints: <fixed, portable, or candidate locations>
- NPC agendas: <what each relevant NPC wants now>
- Stakes/resources: <what can change>
- Affordances: <several plausible approaches, including refusal when valid>
- If ignored: <offscreen action or pressure change>
- State writes: <ledger fields this beat may change>
- Exit conditions: <what ends or transforms the situation>
- Invariants: <world rules or facts that remain true>
- Must remain open: <dialogue, decisions, interpretation, outcome>
```

### 12.2 Launch brief

```markdown
# Launch brief: <run or scene name>

- Player-controlled character(s): <agency ownership>
- Time and place: <current position and conditions>
- Immediate frame: <sensory situation before the next meaningful choice>
- Player state: <physical, social, emotional, and material facts>
- Player knowledge: <known facts, beliefs, and sources>
- Present NPCs: <entry state, knowledge, agenda, and limits for each>
- Active pressures/clocks: <current stage and visible signs>
- Objects and location state: <custody, access, hazards, damage>
- Open hooks/affordances: <what can presently be pursued, refused, or left>
- Director guardrails: <protected truths, prohibited foreknowledge, tone>
- First handoff: <the circumstance or NPC action awaiting player response>
```

A launch brief frames play and then hands control over. It should contain no
scripted player dialogue, intended solution, mandatory emotional response, or
assumed acceptance of the hook.

## 13. Playability validation

Before calling a scenario playable, test it against its actual records:

1. **Refusal test:** Refuse the apparent opening hook. The world responds, the
   pressure continues or changes, and viable play remains without converting
   refusal into acceptance.
2. **Counterfactual test:** Take two materially opposed choices. Within one or
   two consequential beats, they produce durable differences in state.
3. **Idle/autonomy test:** Wait, observe, or pursue an unrelated action. NPCs
   and pressures act according to their motives instead of freezing.
4. **Knowledge-provenance test:** Trace each important statement or reaction to
   something that actor observed, learned, believed, or inferred. Future beats
   and inaccessible truths do not leak.
5. **Portability/convergence test:** Move a portable beat or approach a
   landmark by different routes. The dramatic function survives, while fixed
   spatial constraints and prior consequences remain intact.
6. **Consequence-recall test:** Continue after an injury, promise, lie, object
   transfer, or location change. Later narration and behavior preserve it.
7. **Character-swap test:** Put two developed characters under the same
   pressure. Their values, knowledge, methods, and relationships produce
   meaningfully different behavior.
8. **Mystery-resilience test:** Miss a clue, trust a false theory, or decline an
   investigator. The mystery remains fair and playable through independent
   evidence paths, consequences, and uncertainty rather than an unavoidable
   exposition scene.

Today these tests run against records: no story's canon is imported to the
runtime and drafts are inert, so nothing can be played through it. When play
becomes possible, a trial beat is saved like any other beat, so run the
play-dependent tests (1, 2, 3, 6, 7 and 8) in a disposable story project,
never in the one whose continuity matters. Grade each test on the Living Canon
Standard's section 12 scale (0 to 3) and record the scores with the validation
results.

A failed test should change the relevant profile, pressure, beat, or ledger
contract. Adding a forced transition is not a repair.

## 14. Authoring workflow

1. Preserve source material and mark the new scenario layer as a derivative.
2. Audit the story bible against the Living Canon Standard; resolve authority
   conflicts without closing intentional questions.
3. State the agency contract and separate actor-facing from director-only
   knowledge.
4. Build the opening state and initial live ledger.
5. Bring core characters, recurring locations, and consequential objects to
   scene-ready depth.
6. Define independent pressures, clocks, NPC autonomy, and offscreen behavior.
7. Choose outcome axes that can register meaningful change without prescribing
   an ideal ending.
8. Author landmarks, conditional beats, optional set pieces, and consequences
   as state-sensitive cards.
9. Express route eligibility through live state and identify which beats are
   portable, fixed, expiring, or replaceable.
10. Write a launch brief that ends at the first meaningful player handoff.
11. Run the eight playability tests and revise the underlying records where
    they fail.
12. Record provenance, unresolved questions, validation results, and proposal
    status under `drafts/_control/play/`. Do not adopt the scenario or its
    possible outcomes into the bible without explicit operator acceptance.

## Revision notes

- Draft 2 (2026-09-18), after an adversarial review of Draft 1: the purpose
  states that the standard requests no implementation; section 1 defines
  "established" by reference to the Living Canon Standard and names the
  run/canon separation as unbuilt; section 2 names the context partitions as
  unenforced by the runtime; section 5 maps its bullets onto the character/3
  profile keys and the `story.*` extension point; section 9 defers story time to
  the position marker; section 11 renames promotion to adoption, to stay clear
  of the overlay promotion the operator has set aside; section 12 gives the
  templates, the ledger and run history a home under `drafts/_control/play/`;
  section 13 states that the tests run against records today and how to grade
  them; section 14.12 names where validation results go.
