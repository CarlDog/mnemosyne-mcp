# Living Canon Standard

**Status:** Ratified 2026-08-24  
**Version:** 1  
**Applies to:** Curated story references, editorial derivatives of Mnemosyne
exports, and future story-polish passes

## Purpose

The Living Canon Standard defines what makes a story reference useful after
the initial spark of invention. A good reference is:

- **scene-ready** — it gives a storyteller concrete material to use;
- **canon-safe** — it distinguishes established fact from possibility;
- **proportionate** — its depth matches its narrative importance;
- **stateful** — it can change without losing the history of that change;
- **retrievable** — its name, type, links, and provenance remain dependable.

The governing principle is:

> Every reference should help the story bloom without deciding in advance
> exactly how it must bloom.

This is an editorial standard, not a replacement for the Mnemosyne export
schema in [IMPORT_EXPORT_DESIGN.md](IMPORT_EXPORT_DESIGN.md). It governs the
quality and authority of story content; the export schema governs interchange.

## Non-goals

This standard does **not**:

- require every character to read like a protagonist;
- impose uniform word counts;
- flatten different stories into one voice, genre, or cosmology;
- turn every image, object, coincidence, or supporting figure into a clue;
- force unrelated hooks to connect to a central mystery;
- canonize a possibility merely because an editorial record mentions it;
- replace played scenes, operator decisions, or story-specific rules.

## 1. Canon authority

Every material claim should occupy one of four truth tiers.

### 1.1 Established canon

Events played on-page, facts explicitly ratified by the operator, and current
authoritative records. These may be extended but should not be contradicted
without a deliberate retcon.

### 1.2 Revised canon

An explicit replacement for an earlier established detail. A revision should
name what changed and preserve enough provenance to prevent the retired version
from quietly returning.

### 1.3 Open possibility

A hook, rumor, theory, proposed motive, unknown identity, or future option. It
may seed evidence but must not be narrated as fact before it is established.

### 1.4 In-world belief

Something a character, institution, document, or culture believes. In-world
belief may be true, incomplete, mistaken, manipulated, or obsolete. Attribute
it to its source.

When two records overlap, the story should identify which record is
authoritative for the disputed dimension. Recency alone does not make a claim
canon.

## 2. Revision and provenance

Never overwrite the source export during an editorial pass. Write a derivative
alongside it and preserve, at minimum:

- source filename;
- source export timestamp or other stable source identity;
- editorial revision number and date;
- concise revision purpose;
- records added, expanded, renamed, retired, or corrected;
- deliberate retcons;
- protected open questions and current-state guardrails;
- final entity counts by type;
- visual-reference manifest when references are used;
- validation results relevant to import or retrieval.

This provenance may live in a clearly named editorial metadata block on a
curated derivative. That block is an editorial convention, not a silent change
to `mnemosyne_export: 1`.

## 3. Proportional character depth

Length is not the measure of life. The test is whether a character can enter a
scene, make a recognizable choice, and leave an impression appropriate to the
character's importance.

### 3.1 Core character

A core character should establish:

- physical and sensory presence;
- voice and habitual manner;
- immediate and long-term wants;
- fear, vulnerability, or meaningful limitation;
- a contradiction that prevents a one-note portrayal;
- capabilities and boundaries;
- important relationships and power asymmetries;
- knowledge, beliefs, and consequential misunderstandings;
- current physical, emotional, and social state;
- scene behavior and live hooks.

### 3.2 Recurring supporting character

A recurring character should establish:

- a memorable visual anchor;
- role and practical competence;
- voice, manner, or encounter behavior;
- an immediate want or pressure;
- a specific relationship to a character, institution, place, or community when
  one is established—or a clear independent context when none is;
- one complication, contradiction, boundary, or private stake;
- a hook that creates possibility without promising a destiny.

### 3.3 Minor or encounter character

A minor figure may remain compact. The minimum useful shape is:

- a distinctive silhouette, object, gesture, or sensory detail;
- a recognizable action or manner of speech;
- an immediate want, decision rule, or pressure.

Add a secret only when it improves play. Do not manufacture hidden importance
to justify a minor character's existence.

## 4. Playable locations

A location is more than an establishing shot. Detail should scale with expected
reuse, but a recurring location should address:

- exterior, approach, and first impression where applicable;
- interior zones or other usable scene areas;
- entrances, exits, sightlines, and meaningful thresholds;
- sensory palette;
- ordinary purpose and the labor that keeps the place functioning;
- inhabitants, traffic, or social rules;
- current condition and accumulated residue;
- evidence, hazards, resources, or interruptions;
- ways the space changes scene behavior;
- dormant hooks that do not dictate an outcome.

Interior and exterior are separate opportunities. Do not assume a vivid facade
makes the rooms playable, or that a furnished room explains how the building
sits in its street, landscape, or community.

## 5. Material objects

An important object, relic, weapon, vehicle, document, garment, or tool should
feel handled rather than catalogued. Establish as appropriate:

- visual and material identity;
- legal ownership, practical custody, and contested claims;
- ordinary use;
- capability and limitation;
- cost, failure mode, maintenance, or damage;
- present condition and location;
- emotional, relational, or symbolic weight;
- scene behavior and unfired hooks.

An object need not symbolize something every time it appears. Ordinary use is
what allows deeper meaning to emerge naturally.

## 6. Relationship and knowledge geometry

Do not fill a relationship matrix merely because two characters exist in the
same story. Characters may begin as strangers, disconnected actors, distant
reputations, or people with no reason to care about one another. **No
established relationship** is valid canon, not an editorial omission.

For relationships that have actually been established, record the geometry
rather than only the mood:

- what each party wants from the other;
- affection, attraction, loyalty, resentment, debt, dependency, or fear;
- who holds practical, social, emotional, political, or supernatural power;
- what each person knows;
- what each person believes incorrectly;
- what remains unsaid or deliberately concealed;
- the current state of the relationship;
- what evidence or choice could change it.

Relationships may be asymmetric. Affection does not erase coercion, consent
does not erase consequence, and conflict does not erase care.

Relationships should be allowed to emerge, deepen, decay, recover, or end
through play. Before meaningful contact, record only established awareness,
prior evidence, or a plausible encounter condition when useful; do not invent
mutual wants, chemistry, hostility, loyalty, or destiny. After a consequential
interaction, update the present state while preserving how the relationship got
there.

## 7. Hook and mystery ecology

A hook should preserve discovery. Separate:

- what can be observed;
- what has been confirmed;
- what characters infer;
- what alternative explanation remains possible;
- what evidence would support or weaken each interpretation;
- what conditions allow the hook to bloom;
- what consequences remain even if the apparent explanation is wrong.

Healthy story ecology includes more than central-plot clues:

- dead ends that reveal character or place;
- red herrings with fair, material causes;
- unrelated dangers;
- local disputes and ordinary wrongdoing;
- jump scares or reversals that do not exhaust the main threat;
- humor and relief suited to the story's tone;
- mysteries that remain genuinely unresolved.

Do not make every road lead to the same antagonist. Coincidence may create a
scene without proving a conspiracy.

## 8. Scene consequence and current state

Played prose may establish canon, but it should not be the only place where
important state can be recovered. After a consequential scene, extract as
appropriate:

- injuries, exhaustion, clothing, and physical position;
- relationship changes;
- knowledge gained and beliefs changed;
- promises, permissions, refusals, lies, debts, and boundaries;
- object custody, damage, loss, or repair;
- location damage or altered access;
- mundane aftermath and administrative consequences;
- hooks fired, transformed, answered, or newly opened.

Keep a concise current-state record for dense or long-running stories. The
current-state record points to authoritative entities; it does not duplicate
their full histories.

## 9. Genre sovereignty

Shared quality does not mean shared aesthetics. Each story should maintain a
short set of non-negotiable genre and ontology rules. These govern what kinds
of explanations are permitted and how scenes should feel.

Examples from the current collection:

- **BattleChasers:** mythic adventure, regional breadth, dangerous wonder, and
  encounter momentum;
- **GhostHunters:** restrained investigative horror, fair evidence, incomplete
  explanations, and unrelated hauntings;
- **Chaos Saga:** grounded contemporary realism with no magic; heightened
  emotion must retain a physical or human cause;
- **Wonderland:** surreal transformation with intimate, traceable causes and
  lasting consequences—not arbitrary randomness;
- **Shadowflame:** gothic power, memory, desire, agency, and political danger
  with disciplined uncertainty.

Techniques may cross between stories. Facts, metaphysics, and implied
crossovers may not cross without explicit canon.

## 10. Mature content and routing responsibility

All current storylines have a **mature, hard-R baseline and may enter NC-17
territory**. Story content is not subject to a PG-13 ceiling. When warranted by
character, genre, and scene, prose or imagery may portray adult sexuality,
nudity, graphic violence, gore, body horror, coercion, profanity, and disturbing
aftermath directly.

Do not preserve or introduce story instructions that require:

- automatic self-censorship;
- euphemism or implication in place of direct description;
- an obligatory fade to black;
- avoidance of explicit sexual terminology;
- sanitization to unspecified platform limits;
- a claim that mature events must remain visually implicit.

Implication, restraint, and an interrupted scene remain valid craft choices.
They are selected for voice, pacing, dread, tenderness, or point of view—not
because the story is forbidden to become explicit. Likewise, a mature rating is
permission, not a demand that every scene maximize sex, violence, or gore.

Every participant in sexual material must be an established adult. Explicitness
does not alter canon authority, consent, agency, or consequence: magical or
physical compulsion is not consent; a victim's involuntary response is not
permission; violence and intimacy retain physical, emotional, relational,
social, and logistical aftermath. Dark material may be depicted without being
misnamed, excused, or stripped of human consequence.

### Routing boundary

**Status: architecture committed, implementation in development.** This
section states the target contract mnemosyne is being built toward, not
something already running today. See
[docs/CONTENT_ROUTING_DESIGN.md](CONTENT_ROUTING_DESIGN.md) for the current
proposal and its open decisions. Until it ships, routing is a manual
operator responsibility (choosing an appropriate deployment/provider per
story), not something mnemosyne enforces in code.

Content capability belongs to Mnemosyne's operational routing layer, not to
story censorship rules. Text and image generation must be routed independently
to explicitly configured SFW or NSFW-capable models before generation begins.
Provider names, credentials, and deployment limits are operational data and do
not belong in story canon.

If an appropriate route is unavailable, the system should fail or request a
route change transparently. It must not silently soften, summarize, euphemize,
or rewrite an adult scene after sending it to an incapable route. The detailed
routing architecture remains a separate design and implementation concern; the
editorial contract here is that story records preserve intent.

## 11. Retrieval and asset integrity

Before accepting a curated derivative:

- every entity has a valid type and stable canonical name;
- no `(type, name)` pair is duplicated;
- renamed entities, folders, and visual pointers agree;
- repo-relative visual references follow
  [DATA_LAYOUT.md](DATA_LAYOUT.md);
- every referenced asset exists or is explicitly marked pending;
- retired names survive only as aliases or provenance where needed;
- empty, placeholder, and accidentally duplicated sections are removed;
- the document parses and the intended import path accepts it in dry-run;
- original exports and master references remain untouched.

### 11.1 Visual-reference integrity

Visual references follow the entity-folder, composition, aspect-ratio, and
sidecar rules in [DATA_LAYOUT.md](DATA_LAYOUT.md). In particular:

- every character, location, and object owns a folder named from its canonical
  entity slug;
- interiors and exteriors are separate location variants when both are useful;
- a character portrait establishes personality and environment, a body plate
  establishes head-to-toe design, and a face study establishes identity;
- every image has a same-basename JSON sidecar, including sources, rejected
  attempts, and superseded art;
- approved older imagery is reused as reference input when it already contains
  the controlling likeness or object design;
- aspect ratio and composition remain consistent across a reference family;
- medium generation quality is the cost-conscious default; high quality
  requires a specific visual need rather than prestige alone;
- rejected or retired imagery remains recoverable but cannot silently continue
  as a canonical pointer.

Image abundance is not a quality measure. A supporting character may need one
excellent portrait; a principal character may justify portrait, body, and face
coverage. Generate only images that answer a distinct scene, identity, spatial,
or continuity question.

## 12. Quality rubric

Evaluate each relevant dimension from 0 to 3:

- **0 — absent or contradictory:** unsafe to rely on;
- **1 — evocative but incomplete:** inspiring, yet not reliably scene-ready;
- **2 — scene-ready and canon-safe:** sufficient for its narrative tier;
- **3 — stateful and exemplary:** cross-linked, consequence-aware, and
  validated without closing future possibilities.

A finished pass should bring every entity to **2 for the dimensions appropriate
to its tier**. A minor character is not penalized for lacking a protagonist's
relationship map. Level 3 is reserved for high-leverage records; requiring it
everywhere creates bloat and obscures what matters.

## 13. Polish-pass workflow

1. Preserve the source and create a derivative.
2. Inventory entities by type, narrative tier, and current length.
3. Read the strongest and weakest examples; never classify thinness by length
   alone.
4. Identify canon conflicts, duplicated authority, missing current state, and
   broken names or asset pointers.
5. Expand core records first, then recurring supports and high-use locations.
6. Add objects, rooms, relationships, and hooks only where they improve scene
   use.
7. Check that open possibilities remain open and attributed beliefs remain
   attributed.
8. Critique the new work for repetition, over-connection, overwritten voice,
   accidental omniscience, and decorative excess.
9. Run structural, asset, and import validation.
10. Record provenance, counts, retcons, guardrails, and unresolved questions.

## Cross-story improvement rule

When comparing stories, transfer **craft patterns**, not canon:

- BattleChasers demonstrates scalable population and world breadth.
- GhostHunters demonstrates mystery ecology and misdirection.
- Chaos Saga demonstrates lived relationships, rooms, and mundane aftermath.
- Wonderland demonstrates stateful objects, locations, and transformation.
- Shadowflame demonstrates truth tiers, agency guardrails, and canon promotion.

Use whichever technique strengthens the receiving story while preserving its
genre sovereignty. A rising tide should raise all boats without tying them to
the same dock.
