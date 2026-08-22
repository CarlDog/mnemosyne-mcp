# Seed Templates

Fill-in skeletons for starting a **new** story with good structure.
There is deliberately no `mnemo_seed_from_template` tool
([IMPORT_EXPORT_DESIGN.md](IMPORT_EXPORT_DESIGN.md) retired it):
seeding is a conversation — the host LLM interviews the user against
these templates, then makes one `mnemo_story_use(create_if_missing:
true)` call and one `mnemo_import_story(entities: [...])` call with the
filled results.

Provenance: these carry forward the four seed-shaped schemas from
OpenChronicle v1's template system (meta, character, style guide,
instructions — the ones that had required-field floors) and the
character-profile shape that recurred across the operator's original
ChatGPT projects. v1's templates were never machine-rendered; they
worked as a human-and-LLM authoring contract, which is exactly what
this document is.

## Conventions

- **`{{PLACEHOLDER}}` means fill it or drop it.** A section left as a
  placeholder is *omitted* from the saved entity — never imported as
  literal template text. (v1's rule: "the application will ignore
  fields that contain only placeholder values"; here, the host applies
  it while assembling the import call.)
- **Required floors are minimal on purpose.** The source-project
  research showed elaborate specs decay unfilled — BattleChasers'
  directive mandated four log files that never existed. Each template
  below names the small set that must exist; everything else is
  optional expansion the story can grow into.
- **Templates are a floor, not a ceiling.** Add sections a story needs;
  repeat any per-item block as many times as wanted.

## 1. Story kickoff (not an entity — the checklist before importing)

Settle these in conversation before any entity is written:

- **Name** — becomes the story (OC project) name via `mnemo_story_use`.
- **Genre + one-line premise** — informs everything below; usually
  lands inside the style guide rather than as its own entity.
- **POV + tense** — the single most load-bearing decision. Ship it as a
  pinned `rule` entity (see §4), not buried in style prose: the
  Dovecoast diagnostic proved a tense rule stated only softly gets
  drowned out by example scenes.
- **Kindroid/Botify binding** (optional) — a dedicated kin or group
  chat for the story, bound via `mnemo_story_use`'s
  `kindroid_kin`/`kindroid_group_id`. Can wait until the story is
  seeded.

Required floor: name, POV/tense rule. Everything else can grow in.

## 2. Character template (`type: "character"`)

The shape that survived four real projects across opposite genres.
Required floor (v1's): **name, age, one physical anchor (hair/eyes),
core temperament**. Every other section is optional.

```
IDENTITY
Name: {{NAME}} — Aliases: {{ALIASES}} — Age: {{AGE}}
Pronouns: {{PRONOUNS}} — Orientation: {{ORIENTATION}}

PHYSICAL
Height/build: {{BUILD}} — Hair: {{HAIR}} — Eyes: {{EYES}}
Voice: {{VOICE}} — Distinguishing marks (scars/tattoos): {{MARKS}}
Wardrobe & signature item: {{WARDROBE}}

PSYCHOLOGY
Temperament: {{CORE_TRAITS}}
Strengths: {{STRENGTHS}} — Flaws: {{FLAWS}}
Overall vibe: {{VIBE}}

BACKSTORY
{{BACKSTORY_PROSE}}
Core wound: {{CORE_WOUND}}   <- the one unresolved thing driving them;
                                the source projects called this the
                                "Anchor Wound" and it earned its keep

LIFE
Occupation/skills: {{OCCUPATION}} — Living situation: {{LIVING}}
Hobbies: {{HOBBIES}} — Fears & soft spots: {{FEARS}}
Likes: {{LIKES}} — Dislikes: {{DISLIKES}}

RELATIONSHIPS               <- one subsection PER other named character,
With {{OTHER_CHARACTER}}:      kept inside this entity, never split out
{{DYNAMIC_PROSE}}

SECRETS
{{SECRETS}}                 <- what they hide, from whom, and the cost

STATUS
Current state & location: {{STATUS}}
```

## 3. Style guide template (`type: "style"`)

Required floor: **perspective, tense, tone**. The structural pattern
worth keeping from the source projects: **named, addressable clauses**
— bold a short handle on each rule-of-thumb so later conversation can
invoke "the Silence Clause" instead of restating it. (Real examples
from the corpus: Aftershock Clause, Banter Chain Attribution Rule, POV
Echo Rule.)

```
I. NARRATIVE VOICE
Perspective: {{POV}} — Tense: {{TENSE}} — Tone: {{TONE}}
{{VOICE_PROSE}}

II. DIALOGUE
Attribution style, banter pacing, how much unspoken subtext:
{{DIALOGUE_PROSE}}

III. SCENE RHYTHM
How scenes open, how they close, when to linger vs. cut:
{{RHYTHM_PROSE}}
**{{CLAUSE_NAME}}**: {{CLAUSE_TEXT}}   <- repeat for each named clause

IV. BOUNDARIES
Content the narration leans into / away from:
{{BOUNDARIES_PROSE}}
```

Note the split with §4: *style* is how prose should feel; anything
that must never be violated belongs in a pinned `rule` instead.

## 4. Rules (`type: "rule"`, pinned — the default for rules)

One constraint per entity, named like a clause, phrased as a testable
mandate — these feed both the generator prompt and the validator, so
vague rules validate vaguely. Seed at minimum the POV/tense rule:

```
name:    "POV & Tense"
content: All scenes are written in {{TENSE}} tense, from
         {{CHARACTER}}'s perspective only.
```

Other common seeds, one entity each:

```
name:    "Content Boundaries"
content: {{WHAT_IS_OUT_OF_BOUNDS_AND_WHAT_IS_EXPLICITLY_FINE}}

name:    "Presence & Continuity"
content: Characters only act in a scene they are established to be
         present in; entrances and exits are narrated, never implied.
```

## 5. Optional starter stubs

Only when the story already knows these; never invent to fill a slot.

```
type: "location"       name: {{PLACE_NAME}}
content: {{WHAT_IT_IS}}. {{ATMOSPHERE}}. {{WHO_FREQUENTS_IT}}.
{{ONE_DETAIL_A_SCENE_COULD_USE}}.

type: "worldbuilding"  name: {{SYSTEM_NAME}}
content: {{HOW_THIS_PART_OF_THE_WORLD_WORKS}} — scope it to what
scenes will actually touch; compendium-scale worldbuilding can be
imported later as it becomes real.
```

## Worked micro-example

A minimal viable seed — one story, four entities, one import call:

1. `mnemo_story_use(name_or_id: "Saltmarsh", create_if_missing: true)`
2. `mnemo_import_story(entities: [...])` with:
   - `rule` "POV & Tense" — *All scenes are written in third-person
     past tense, from Mira Vane's perspective only.* (pinned by
     default)
   - `style` "Saltmarsh Style Guide" — perspective/tense/tone header +
     two short sections; one named clause (**Undertow Clause**: every
     scene ends on an unresolved image, never a summary).
   - `character` "Mira Vane" — the §2 skeleton with the required floor
     + backstory + one relationship subsection.
   - `location` "The Brine Door" — three sentences.

That's a fully functioning story: `mnemo_continue` has a rule to obey,
a voice to write in, a protagonist, and somewhere to stand. Everything
else grows in play.
