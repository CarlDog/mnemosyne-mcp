# Import Playbook

How to get existing story material — a ChatGPT-era project folder, old
notes, a prior conversation — into a mnemosyne story. This document is
the classification half of the import/export design
([IMPORT_EXPORT_DESIGN.md](IMPORT_EXPORT_DESIGN.md)): **the host LLM
reading this does the classifying, the human approves, and
`mnemo_import_story` writes.** The server never guesses; every rule
below is judgment guidance for the conversation, not code.

The rules here were derived from the material this feature exists to
import: the operator's four original ChatGPT storytelling projects
(Chaos Saga, The Miskatonic Archives: The Blackwood Case (then GhostHunters),
BattleChasers, Wonderland), cross-checked
against OpenChronicle v1's template research and v2's import-pipeline
post-mortem. Every "don't" below is a mistake one of those systems
actually made.

## The workflow

1. **Read the source material.** All of it, before proposing anything —
   classification mistakes come from trusting labels over content.
2. **Propose a classified entity list** in conversation: for each
   candidate, its `type`, `name`, and verbatim `content`. Group by type;
   flag anything you're unsure about as a question, not a guess.
3. **The human hand-picks.** Curated import is the standing decision
   (operator, 2026-08-21) — never propose "import everything." The
   omissions are as deliberate as the inclusions.
4. **One `mnemo_story_use(create_if_missing: true)` + one
   `mnemo_import_story(entities: [...])` call** with the approved list.
   The tool's preflight aborts whole-batch on conflicts or duplicates —
   that's a feature; fix and re-invoke rather than working around it.
   Expect roughly a second per entity on large batches.

## Classification rules

### Folder and file names lie — classify by content

The single most important rule. Observed in the real corpus:

- BattleChasers' `Profiles/Location` files ("Region Config – Aelreth"
  etc.) are **worldbuilding**, not locations — each is a regional
  compendium with faction rosters, named NPC leadership, and
  cross-references, wearing a location folder label.
- Chaos Saga's top-level `Project Instructions` file is a **misfiled
  stray** — it's actually an early The Blackwood Case draft from the source
  project then called GhostHunters.
- The Blackwood Case's source Project Instructions file, from the project then
  called GhostHunters, is **two drafts concatenated** — a rewrite pasted in
  without deleting the original.
  Import the newer version only.

An importer that trusted names over content (v2's filename-substring
classifier) mis-tagged all of these. Read the text; decide from the
text.

### Composite files split into multiple entities

Every "Project Instructions" file in the corpus mixes four concerns:
style prose, worldbuilding context, character stubs, and hard rules.
Split them — one entity per concern, each under its natural type. More
generally: one file frequently yields N entities (a "Primary
Characters" file becomes one `character` entity per character). The
grain of an entity is one coherent thing, not one source file.

**Exception:** a character's per-relationship subsections (how they
relate to each other named character) stay **inside** that character's
entity. They're profile content, not separate entities.

### Type mapping

| Source material | mnemosyne type | Notes |
|---|---|---|
| Character profiles (any tier: primary/secondary/minor) | `character` | One entity per character. Keep relationship subsections inline. |
| Key-locations lists, individual place descriptions | `location` | Only when the content is actually about a place. |
| Region compendia, faction rosters, calendars, bestiaries, races, orders, loot/encounter tables | `worldbuilding` | Systems and structures of the world. |
| In-world history, legends, myths, backstory-of-the-world | `lore` | The distinction from worldbuilding: lore is what characters could *tell* each other; worldbuilding is how the world *works*. When genuinely ambiguous, ask. |
| Style guides, voice/tone/pacing prose | `style` | Named clause structure is worth preserving (see SEED_TEMPLATES.md). |
| Hard constraints: POV/tense mandates, content boundaries, presence/continuity rules | `rule` | One constraint per entity, pinned (the default for rules). A rule buried in a style guide gets extracted into its own `rule` entity. |
| Finished/locked scene logs | `scene` | See the scene caution below. |

For anyone holding OC-v2-era material: v2's `instructions` type maps to
`rule`, its `style-guide` to `style`, and its WORLDBUILDING bucket needs
re-review — v2 used it as a silent fallback for everything
unclassifiable, so it conflates real worldbuilding with misc.

### Scenes: import sparingly, and backdate

Scenes feed `mnemo_continue`'s RECENT SCENES context, so imported
legacy scenes shape future generation directly.

- Import **finished/locked** scene logs only, not working drafts (the
  corpus distinguishes these: `Scenes/Draft/` = in-progress working
  copy, the tracking log = finalized canon).
- Set `created_at` from the source material's real date whenever it's
  knowable (file dates, in-file date headers). Backdating keeps a
  legacy scene from masquerading as recent and dominating context.
- Leave validation tags off — untagged scenes participate normally in
  context assembly; `mnemo_revalidate_scenes` can tag them later.

## Do not import

- **Canon Tracking Directives** — logging protocols, file-naming rules,
  checksum/lock schemes. These solved a stateless chatbot's lack of
  memory by hand; OC's tagged, searchable, project-scoped storage solves
  it structurally. v1's own design analysis reached this verdict
  ("administrative theater") and it stands.
- **Group Chat Log Configurations** — ChatGPT-host formatting plumbing.
  One salvageable nugget: per-character availability schedules (online
  hours, reply-latency persona) are a candidate *field inside a
  character entity* if that character's story needs it — never a
  standalone entity.
- **Raw chat transcripts** (`Chat/Archived/Raw` and kin) — unvetted,
  unapproved material. The operator's own Memory Governance rule across
  every source project: nothing enters canon without explicit approval.
  Distilling a transcript into scenes/lore is legitimate *work*, done
  in conversation with the human choosing what survives — never a bulk
  import.
- **Host-plumbing clauses** — canvas governance, cut/paste output
  formatting, anything about how ChatGPT should render replies.

## Content hygiene

- **Verbatim, not paraphrased.** Entity content is the source text,
  trimmed only of host plumbing (e.g. leading `[CORE FILE – DO NOT
  MODIFY]` banners). Summarizing loses the texture that makes the
  material worth importing.
- **No `[Type] Name` headers in content** — the storage layer adds
  those. `content` is the body only.
- **Names**: use the thing's actual name ("Aria Voss", "The Dovecoast
  Tavern"), never the source filename. No line breaks in names
  (schema-enforced — a newline would make the entity permanently
  invisible).
- **Same name, different types is fine** (`character` "Mercury" and
  `lore` "Mercury" coexist); same name *and* type overwrites — which is
  what the conflict preflight exists to catch.
