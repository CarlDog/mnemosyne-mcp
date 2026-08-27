# Data Directory Layout

Ratified 2026-08-23; amended 2026-08-27 to add `canon/` and narrow
`exports/` back to its original documented scope (see "Canon" and
"Exports" below — `exports/` had drifted into holding hand-authored
editorial-pass files under undocumented descriptive-suffix names, e.g.
`<slug>-mature-<stamp>.json`, none of them actually produced by
`mnemo_export_story`). The organization and naming standard for
everything under `<data dir>` (default `<repo>/data`, gitignored,
`MNEMO_DATA_DIR` override — see `src/config.ts`). Two guiding principles:

1. **The entity model's `(type, name)` key maps deterministically onto
   the filesystem** — tooling can resolve an entity to its assets
   without a lookup table.
2. **Every filename is shell-safe** (lowercase `[a-z0-9.-]`, no spaces,
   nothing needing quotes) — the tree must be equally comfortable in a
   Linux container, a shell script, and a Windows checkout.

```
data/
├── config.json                       # current-story pointer (global; server-written)
└── stories/<slug>/                   # one subtree per storyline; slug = storySlug()
    ├── story.json                    # identity card (server-written; see below)
    ├── canon/                        # human-editable authoring surface (operator/tooling-owned)
    │   ├── characters/<slug>.md      #   one file per core/recurring character
    │   ├── characters/_minor.md      #   batched compact tier, one heading per NPC
    │   ├── locations/<slug>.md       #   one file per location
    │   ├── lore/<slug>.md            #   one file per lore entity
    │   ├── lore/objects/<slug>.md    #   material objects (still type: lore) -- a
    │   │                             #   navigation folder, not a distinct schema type
    │   ├── worldbuilding/<slug>.md   #   one file per topic
    │   ├── rules.md                  #   ONE file, one `##` heading per rule entity
    │   └── style.md                  #   ONE file, one `##` heading per style entity
    ├── exports/                      # story backups (server-written)
    │   ├── <slug>-<stamp>.json       #   stamp = UTC to the second, colons stripped --
    │   │                             #   no descriptive suffixes; a plain timestamp only
    │   └── archive/                  #   pre-2026-08-27 hand-authored editorial-pass
    │                                 #   files, retired once their content is scaffolded
    │                                 #   into canon/ -- historical record, not a live
    │                                 #   naming pattern to continue
    ├── references/                   # approved visual INPUTS (operator-curated)
    │   ├── characters/
    │   │   └── riley-quinn/          #   one folder per canonical entity
    │   │       ├── portrait.png      #   3:4 environmental/personality portrait
    │   │       ├── portrait.json     #   required image sidecar
    │   │       ├── body.png          #   3:4 full-body design plate
    │   │       ├── body.json
    │   │       ├── face.png          #   1:1 identity close-up
    │   │       └── face.json
    │   ├── locations/
    │   │   └── the-warehouse-grill-pub/
    │   │       ├── exterior.png      #   16:9 establishing view
    │   │       ├── exterior.json
    │   │       ├── interior.png      #   16:9 playable interior
    │   │       └── interior.json
    │   └── objects/
    │       └── maddox-1942-indian-scout-741b/
    │           ├── reference.png     #   16:9 primary object plate
    │           └── reference.json
    └── art/                          # external generation OUTPUTS (OpenArt etc.)
        ├── 2026-08-23T0512-warehouse-confrontation-nano-banana-2-01.jpg
        └── 2026-08-23T0512-warehouse-confrontation-nano-banana-2-01.json
```

## Canon — the human-editable authoring surface

`canon/` is the permanent working layer for a story's narrative content —
not a one-time pre-ratification staging area. New characters get added,
existing canon gets revised, a story goes through this cycle repeatedly
over its whole life, not once. `canon/` is the human-editable *source* of
a story's canon; OpenChronicle is the *runtime* copy `mnemo_continue`
actually reads from — the same relationship source code has to a running
deployment. Edits happen here; a compile step (not yet built) renders
`canon/` into the same entity shape already live in OC today and imports
it, the same way a deploy pushes source to production.

- **One file per character, location, or lore/worldbuilding entity.**
  Confirmed against live per-story entity counts (roughly 10-65 named
  characters, 10-30 locations depending on the story) — genuinely
  browsable at one file each. `characters/_minor.md` batches the compact
  minor/encounter tier (Living Canon Standard §3.3) into one file, one
  `##` heading per NPC, rather than one file per two-sentence bit player.
- **`rules.md` and `style.md` are each ONE file, one `##` heading per
  entity.** The one deliberate exception to one-file-per-entity: a
  story's rule/style entities run 15-21 per story at 200-1400 characters
  apiece — too fine-grained for separate files, and it matches how the
  original source material for these stories was itself organized (a
  single style guide document with many named clauses).
- **`lore/objects/` is a human-navigation folder, not a distinct schema
  type.** Mnemosyne's entity model has no `object` type (Living Canon
  Standard §5 settled that a material object is a `lore` entity); the
  subfolder exists purely so an author browsing the tree finds "the
  motorcycle" under Objects instead of mixed in with unrelated lore.
- **Format: YAML frontmatter for flat identity/physical fields, Markdown
  body for prose sections** — an editor-agnostic pattern (Obsidian, Hugo,
  Jekyll all use it), and it resolves a real parsing ambiguity the prior
  flat `Label: value` convention had (a colon inside a bulleted
  relationship line is indistinguishable from a real field without a
  frontmatter delimiter). This changes only the *authoring* format — the
  compile step renders frontmatter fields back into the same flat-line
  shape already live in OC, so nothing downstream (recall, the validator,
  prompt assembly) changes.
- **Owned by the operator/tooling, like `references/` and `art/`** — the
  server never writes here directly. A (not yet built) `compile-story.mjs`
  reads `canon/` and imports it to OC; a (not yet built) one-time
  `scaffold-story.mjs` seeds `canon/` from a story's current OC/export
  state the first time this layout is adopted for that story.

## References — curated inputs

- **Folder = slugged entity name** (the same `storySlug()` transform applied
  to the entity's name). For example,
  `references/characters/riley-quinn/portrait.png` resolves from
  `(character, "Riley Quinn")` deterministically. The type folder
  disambiguates a character, location, and object that share a name. The
  entity's own REFERENCE APPEARANCE pointer remains the authoritative join;
  the slug makes it derivable in both directions.
- **One entity, one folder.** Characters, locations, and objects all use the
  same containment rule. Variants are filenames *inside* that folder rather
  than punctuation appended to the entity slug.
- **Character variants:** `portrait` is a story-bearing environmental image,
  usually framed waist-up to mid-thigh; `body` is a head-to-toe wardrobe and
  silhouette plate; `face` is an unobscured identity close-up. These are
  different compositions, not crops standing in for one another. Recurring
  supporting characters may have only `portrait`; full three-view coverage is
  reserved for characters whose reuse justifies it.
- **Location variants:** use `exterior`, `interior`, and meaningful room or
  zone names (`kitchen`, `stairwell`, `pool`, `cellar`) where applicable. Use
  `overview` only when the image genuinely represents the place as a whole.
  Buildings with both usable exteriors and interiors should carry both.
- **Object variants:** begin with `reference`; add functional names such as
  `detail`, `open`, `damaged`, or `in-use` only when they answer a distinct
  visual question.
- **Superseded references** move beneath the entity folder at
  `superseded/<date>/`. They remain recoverable and keep their sidecars, but
  canonical pointers must not target them.
- **Entity pointers are repo-relative** (`data/stories/<slug>/...`) so
  they survive machine moves and container mounts. When a reference
  exists, the entity's REFERENCE APPEARANCE section cites it.
- **Master copies:** the operator's curation archive (currently the
  OneDrive ChatGPT Projects folders — provisional, expected to move) is
  the master; `data/` holds the operational copy that tooling and a
  Docker deployment consume. Pointers always cite the `data/` copy.

### Reference composition and generation defaults

- Character portrait and body images use **3:4**. Face studies use **1:1**.
  Location, room, and primary object plates use **16:9** unless an established
  reference set gives the subject a different deliberate ratio.
- `openai/gpt-image-2` uses **medium quality by default**. Medium is the
  cost-conscious production baseline and has proved sufficient for reference
  faces, clothing, environments, and object detail. High quality is an
  exception for an approved hero image or a specific failed-detail rescue—not
  an automatic upgrade.
- Existing approved imagery takes precedence over reinvention. When an object,
  garment, or likeness already appears clearly in canon art, use that image as
  an edit/reference input and name it in the new sidecar.
- Visual continuity follows controlling written canon first and approved images
  second. A beautiful result that contradicts identity, age, role, era, or
  story ontology is not canonical reference art.

### Flat-layout migration

The legacy flat location/object layout was retired on 2026-08-25. Do not keep
duplicate images or sidecars directly beneath `references/locations/` or
`references/objects/`; each asset belongs inside its entity folder. Historical
exports remain preserved as provenance, while current derivative manifests and
all new tooling must emit foldered paths.

## Art — generated outputs

- **Filename:** `<stamp>-<subject-slug>-<model>-<seq>.<ext>` — the UTC
  stamp sorts, the model records what made it, the sequence disambiguates
  multi-image jobs. Don't parse art filenames — the sidecar is the
  authoritative metadata; the name is for humans browsing a directory.
- **Every image gets a JSON sidecar** with the same basename. This includes
  generated candidates, canonical references, curated/user-supplied sources,
  superseded references, and rejected generations. Rejection is provenance,
  not a reason to discard the record.
  Generation on these platforms is unseeded and unreproducible; the
  prompt is the only reproducibility handle and evaporates unless
  captured at generation time. Sidecar fields:

  ```json
  {
    "subject": { "type": "character", "name": "Riley Quinn" },
    "variant": "portrait",
    "asset_role": "generation_candidate",
    "review_status": "accepted",
    "prompt": "verbatim prompt as submitted",
    "prompt_capture": "at-generation",
    "model": "openai/gpt-image-2/text-to-image",
    "provider": "atlascloud",
    "prediction_id": "provider-job-id",
    "params": {
      "width": 2160,
      "height": 2880,
      "aspect_ratio": "3:4",
      "quality": "medium",
      "output_format": "png"
    },
    "references": ["data/stories/chaos-saga/references/characters/riley-quinn/source.jpg"],
    "cost_usd": 0.05,
    "created_at": "2026-08-23T05:12:00Z",
    "story": "Chaos Saga",
    "provenance_status": "complete"
  }
  ```

  `subject` uses the entity key when the image depicts a canon entity or scene.
  `asset_role` distinguishes `generation_candidate`, `canonical_reference`,
  `source_reference`, and `superseded_reference`. `review_status` records
  `accepted`, `rejected`, or `pending`; rejected sidecars should explain why.

  If a legacy image predates sidecar capture, add a retrospective sidecar with
  unknown fields set to `null`, `provenance_status: "legacy-incomplete"`, and a
  plain explanation. Never invent a seed, prompt, provider, or cost. If a
  prompt must be reconstructed during a migration, label it explicitly with
  `prompt_capture: "reconstructed-after-generation"`.

## story.json — the identity card

Holds **only what is not derivable** from the filesystem or OC — chiefly
the slug↔story join, since `storySlug()` is lossy (which OC project is
`chaos-saga`?). Deliberately NOT a file index: an enumeration would
drift the moment anyone adds a photo; `readdir` is the index.

```json
{
  "mnemosyne_story": 1,
  "story": { "id": "<OC project uuid>", "name": "Chaos Saga", "created_at": "..." },
  "slug": "chaos-saga",
  "updated_at": "<last refresh>"
}
```

**Server-owned:** `mnemo_export_story` writes/refreshes it whenever it
writes a default-path export (an explicit `out_path` export stays
side-effect-free). Don't hand-edit it — operator notes belong in OC
entities or the curation archive, not here, because the server rewrites
this file wholesale.

## Shared conventions

- **Slugs:** always `storySlug()` (`src/export.ts`) — lowercase
  `[a-z0-9-]`, id-prefix fallback. One definition names story folders,
  export filenames, and art subject slugs.
- **Timestamps:** UTC, ISO to the second, colons stripped for Windows
  (`2026-08-23T051200` or the shorter `T0512` prefix form for art, where
  the seq suffix already disambiguates).
- **The server only ever writes** `config.json`, `story.json`, and
  `exports/`. `canon/`, `references/`, and `art/` are operator/tooling
  territory — the server (a future compile step, for `canon/`) reads
  them but never mutates them directly.
- **`exports/` filenames are a plain `<slug>-<stamp>.json` timestamp,
  never a descriptive suffix.** An editorial pass's working content
  belongs in `canon/`, not in a hand-named `exports/` file — that drift
  (`-mature-`, `-living-canon-`, `-remediation-`, etc.) is exactly what
  the 2026-08-27 amendment retired into `exports/archive/`.
