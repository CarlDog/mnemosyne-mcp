# Data Directory Layout

Ratified 2026-08-23. The organization and naming standard for everything
under `<data dir>` (default `<repo>/data`, gitignored, `MNEMO_DATA_DIR`
override — see `src/config.ts`). Two guiding principles:

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
    ├── exports/                      # story backups (server-written)
    │   └── <slug>-<stamp>.json       #   stamp = UTC to the second, colons stripped
    ├── references/                   # canonical likeness INPUTS (operator-curated)
    │   ├── characters/
    │   │   ├── riley-quinn.jpg       #   primary reference = slugged entity name
    │   │   └── riley-quinn.face.jpg  #   variant = ".<variant>" before the ext
    │   └── locations/
    │       └── the-warehouse-grill-pub.jpg
    └── art/                          # external generation OUTPUTS (OpenArt etc.)
        ├── 2026-08-23T0512-warehouse-confrontation-nano-banana-2-01.jpg
        └── 2026-08-23T0512-warehouse-confrontation-nano-banana-2-01.json
```

## References — curated inputs

- **Filename = slugged entity name** (the same `storySlug()` transform
  applied to the entity's name): `references/characters/riley-quinn.jpg`
  resolves from `(character, "Riley Quinn")` deterministically, and the
  type subfolder disambiguates a character and a location sharing a
  name. The entity's own REFERENCE APPEARANCE pointer remains the
  authoritative join; the slug just makes it derivable in both
  directions. (Slug collisions between distinct same-type entity names
  are theoretically possible and accepted — the pointer disambiguates.)
- **Variants** insert `.<variant>` before the extension (e.g.
  `riley-quinn.face.jpg`, `riley-quinn.outfit-casual.jpg`) so the
  primary keeps the bare slug and the variant token can't be confused
  with name-internal dashes.
- **Entity pointers are repo-relative** (`data/stories/<slug>/...`) so
  they survive machine moves and container mounts. When a reference
  exists, the entity's REFERENCE APPEARANCE section cites it.
- **Master copies:** the operator's curation archive (currently the
  OneDrive ChatGPT Projects folders — provisional, expected to move) is
  the master; `data/` holds the operational copy that tooling and a
  Docker deployment consume. Pointers always cite the `data/` copy.

## Art — generated outputs

- **Filename:** `<stamp>-<subject-slug>-<model>-<seq>.<ext>` — the UTC
  stamp sorts, the model records what made it, the sequence disambiguates
  multi-image jobs. Don't parse art filenames — the sidecar is the
  authoritative metadata; the name is for humans browsing a directory.
- **Every generated image gets a JSON sidecar** with the same basename.
  Generation on these platforms is unseeded and unreproducible; the
  prompt is the only reproducibility handle and evaporates unless
  captured at generation time. Sidecar fields:

  ```json
  {
    "prompt": "verbatim prompt as submitted",
    "model": "nano-banana-2",
    "params": { "resolution": "2K", "aspectRatio": "2:3" },
    "references": ["data/stories/chaos-saga/references/characters/riley-quinn.jpg"],
    "cost_credits": 20,
    "created_at": "2026-08-23T05:12:00Z",
    "subject": { "type": "scene", "name": "Do I Smell Trouble?" }
  }
  ```

  `subject` uses the entity key when the piece depicts a canon entity or
  scene; omit for freeform pieces. Flat folder until volume demands
  otherwise.

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
  `exports/`. `references/` and `art/` are operator/tooling territory —
  the server reads them (future) but never mutates them.
