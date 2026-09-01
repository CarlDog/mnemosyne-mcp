# Data Directory Layout

Ratified 2026-08-23; amended 2026-08-27 to add `canon/` and narrow
`exports/` back to its original documented scope (see "Canon" and
"Exports" below — `exports/` had drifted into holding hand-authored
editorial-pass files under undocumented descriptive-suffix names, e.g.
`<slug>-mature-<stamp>.json`, none of them actually produced by
`mnemo_export_story`); amended 2026-08-29 to add selectively promoted,
finished scenes to `canon/scenes/` and review-gated `drafts/` overlays;
amended 2026-08-31 to add `companion-logs/` for provenance-carrying
captures pulled from an external addon/plugin, including the raw-vs-normalized
split for a source-side identity/persona field that varies within one capture
(see "Companion logs" below). The
organization and naming standard for everything under `<data dir>` (default `<repo>/data`, gitignored,
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
    │   ├── scenes/<catalog-key>--<slug>.md
    │   │                             #   one file per established/locked scene
    │   ├── worldbuilding/<slug>.md   #   one file per topic
    │   ├── rules.md                  #   ONE file, one `##` heading per rule entity
    │   └── style.md                  #   ONE file, one `##` heading per style entity
    ├── drafts/                       # sparse, canon-shaped proposal overlay (never runtime canon)
    │   ├── <canon-relative>.md       #   additions/replacements at their proposed canon paths
    │   └── _control/                 #   retained review evidence; never promoted as entities
    │       ├── overlay.json          #   exact add/replace/remove operations + SHA-256 hashes
    │       ├── PASS.md               #   completion, validation, and approval state
    │       ├── LCS_SCORECARD.md       #   Living Canon compliance/adversarial findings
    │       └── ASSET_REVIEW.md       #   reference coverage and provenance findings
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
    ├── art/                          # external generation OUTPUTS (OpenArt etc.)
    │   ├── 2026-08-23T0512-warehouse-confrontation-nano-banana-2-01.jpg
    │   └── 2026-08-23T0512-warehouse-confrontation-nano-banana-2-01.json
    └── companion-logs/               # raw pulls from an external addon/plugin (read-only capture)
        ├── watch-companion-watchalong-transcript-2026-08-31.json
        ├── watch-companion-watchalong-transcript-2026-08-31.md
        ├── watch-companion-watchalong-transcript-normalized-2026-08-31.json  # optional: see below
        └── watch-companion-watchalong-transcript-normalized-2026-08-31.md
```

## Draft-only story packages

An exploratory storyline may begin as a package containing only a drafts/
directory. This is a deliberate pre-canon shape: it may hold control metadata
and thin category scaffolds for characters, locations, lore, worldbuilding,
rules, and style, but it has no canon/ directory, story.json identity card,
runtime export, or live OpenChronicle story record. It is not an active story
and must not be compiled or imported until an operator separately selects and
develops it.

The Miskatonic Archives historical prequels use this shape:

- data/stories/miskatonic-archives-the-black-salt-compact/drafts/
- data/stories/miskatonic-archives-the-last-eastbound-run/drafts/

Their source seed notes remain in The Blackwood Case's draft control folder.
The package boundary is editorial, not a continuity assertion.

## Canon — the human-editable authoring surface

`canon/` is the permanent working layer for a story's narrative content —
not a one-time pre-ratification staging area. New characters get added,
existing canon gets revised, a story goes through this cycle repeatedly
over its whole life, not once. `canon/` is the human-editable *source* of
a story's canon; OpenChronicle is the *runtime* copy `mnemo_continue`
actually reads from — the same relationship source code has to a running
deployment. Edits happen here; `scripts/compile-story.mjs` deterministically
renders `canon/` into the same entity shape already live in OC and checks it
against the versioned import contract offline. Promotion into OC remains a
separate, operator-approved import, the same way a deploy is separate from a
build.

- **One file per character, location, or lore/worldbuilding entity.**
  Confirmed against live per-story entity counts (roughly 10-65 named
  characters, 10-30 locations depending on the story) — genuinely
  browsable at one file each. `characters/_minor.md` batches the compact
  minor/encounter tier (Living Canon Standard §3.3) into one file, one
  `##` heading per NPC, rather than one file per two-sentence bit player.
- **One file per selectively promoted scene.**
  `scenes/<catalog-key>--<slug>.md` is for
  finished, locked, or otherwise explicitly established prose that should
  remain a human-editable canon source and durable scene reference. It is not
  a mirror of every generated beat: incidental output remains in OC and export
  history until an operator deliberately promotes it. This is the filesystem
  equivalent of IMPORT_PLAYBOOK's "finished/locked scenes only" rule.
  `scaffold-story.mjs` therefore continues to skip scenes by default rather
  than silently promoting every generated beat.
- **Scene metadata stays in frontmatter; scene prose stays verbatim.** Preserve
  `catalog_key`, `name`, the source `created_at`, explicit pin state, and only
  tags beyond the base `mnemosyne`/`story`/`scene` set. `catalog_key` is a
  compact human chronology/order/location shelf mark, not a content hash; its
  lowercase value must prefix the filename and remains stable across prose
  edits. A full `source_content_sha256`, when present, remains the separate
  integrity field and changes with the source content. The Markdown body is the
  entity's exact scene content, including any bracketed
  chapter/participants/continuity header. A source-provenance note may
  accompany the scene, but it must not rewrite the played prose. Backdating is
  load-bearing: a legacy scene must not masquerade as the newest beat and
  dominate RECENT SCENES.
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
  compiler renders frontmatter fields back into the same flat-line
  shape already live in OC, so nothing downstream (recall, the validator,
  prompt assembly) changes.
- **Owned by the operator/tooling, like `references/` and `art/`** — the
  server never writes here directly. `compile-story.mjs` reads `canon/` and
  produces or checks an importable export document; it does not connect to or
  mutate OC. `scaffold-story.mjs` seeds `canon/` from a story's current
  OC/export state the first time this layout is adopted for that story.

### Compile and import-contract check

Run `npm run build:server` first so the check can load the same compiled import
schema and `planImport` preflight used by the server. Then run:

```bash
node scripts/compile-story.mjs <story-slug> --check
```

`--check` is also the default when neither `--check` nor `--out` is present. It
compiles records in memory, serializes a `mnemosyne_export:1` document, and
submits that document to the existing import parser and preflight against an
empty destination set. It performs no filesystem or OC writes. The compiler
handles frontmatter-backed character, location, lore, worldbuilding, and
selectively promoted scene files; batched `characters/_minor.md`; and the
heading-delimited rule/style files. Scene `created_at`, pin state, and tags are
preserved. A meaningful batch-wide preamble in `_minor.md` is copied into each
independent minor-character record so its retrieval qualification is not lost.

Individual sections in `rules.md` and `style.md`, plus individual character
sections in `characters/_minor.md`, may preserve record-specific import
metadata with one directive immediately after the corresponding `##` heading:

```markdown
## Horror Ecology & Misdirection

<!-- mnemosyne-meta: {"pinned":true,"tags":["horror-ecology","pinned-guidance"]} -->
```

The directive must be a single-line JSON object and may contain only `pinned`
(boolean), `tags` (an array of non-empty one-line strings), and `created_at` (an
ISO timestamp with `Z` or an explicit UTC offset). It is compiler metadata, not
entity content, and is removed from the compiled record. Unknown keys, invalid
JSON or values, duplicate directives, a directive before the first heading, or
a directive placed anywhere except the start of that section's body fail
compilation. Sections without a directive retain the existing defaults: rules
are pinned, while style and minor-character entries are unpinned; no synthetic
record timestamp is added.

Use `--dir <canon-shaped-directory>` to check a staged tree. `--out <file>`
performs the same schema/preflight proof and then creates one export document;
its parent must already exist, the destination may not be inside the source
tree, and an existing file is never overwritten. Neither mode performs a live
import or grants promotion approval. README/control files and
underscore-prefixed Markdown templates are ignored by compilation; draft
markers, malformed metadata, duplicate `(type, name)` identities, and records
beyond the OC content limit are hard failures.

Ignored underscore templates are not import records, but the overlay verifier
still validates their frontmatter before reporting them as safe: keys must be
unique and every populated scalar must use the compiler's strict scalar subset.
The verifier deliberately permits blank and HTML-comment placeholders in these
templates. That is an authoring convention, not a completeness proof: authors
must fill or remove each placeholder when creating a real canon entity, because
a populated HTML comment otherwise parses as literal scalar text.

`verify-draft-overlay.mjs` applies the overlay in a temporary staged tree and
runs this check after its active, isolated, and merged structural validators.
The verifier's before/after hash proof also covers this step, so a successful
draft review demonstrates import compatibility with zero authoring-tree writes;
it still does not promote or import the overlay.

## Drafts — review-gated canon overlays

`drafts/` is the only approved place for an unaccepted rewrite of existing
canon. It is a sparse direct overlay: every proposed addition or replacement
uses the same relative path it would have under `canon/`; unchanged canon need
not be copied. Editorial evidence lives under `drafts/_control/`, outside the
entity-shaped overlay, and is never compiled or promoted as story content.

- **Drafts are inert.** Runtime retrieval, export, and import continue to read
  active state, not `drafts/`. Creating or validating an overlay grants no
  promotion or runtime-import approval.
- **Every proposed Markdown entity is visibly marked.** Place
  `> **DRAFT — NOT ACTIVE CANON**` immediately after valid YAML frontmatter, or
  at byte zero for a batched file without frontmatter. Promotion strips only
  that complete leading notice; a later blockquote is content and must not be
  stripped.
- **The manifest is the exact change set.** `_control/overlay.json` lists every
  non-control proposal once as `add` or `replace`, plus any `remove` operation.
  An addition has no baseline hash; a replacement or removal records the
  active file's SHA-256. Additions and replacements record the draft SHA-256.
  A removal has no tombstone file and its draft hash is `null`. The manifest
  and non-control draft inventory must match exactly.
- **Removal never means lost provenance.** Move editorial/source history into a
  control record before proposing removal from story retrieval. A type or path
  migration is one manifest removal plus one addition, with the identity and
  reason recorded in the control ledger.
- **Validate the real proposal, not only its fragments.** Tooling must validate
  active canon, the isolated proposal entity set, and a temporary merged tree
  produced by applying the manifest and stripping draft notices. It must also
  verify ignored underscore batches, reference-pointer containment and
  sidecars, image templates when references exist, exact hashes, and that active
  canon did not change during review. A zero-reference story is valid only when
  its asset review explicitly records the missing coverage.
- **Promotion uses verified bytes.** Keep the verified staged tree through the
  promotion decision, or rebuild and fully revalidate it. Inside the atomic
  apply step, recheck baseline, draft, staged, and referenced-asset hashes.
  Never validate one tree and later copy fresh authoring bytes into canon.
- **Control evidence survives the decision.** Record final counts, deliberate
  retcons, remaining unknowns, validation commands/results, adversarial verdict,
  and operator approval or rejection. A completed authoring pass is not an
  approval. `_control/` may be retained or archived as review history, but may
  not enter `canon/` or runtime entities.

`scripts/verify-draft-overlay.mjs <story-slug>` is the repository verifier for
this contract. Its manifest schema version 2 supports additions, replacements,
and removals; schema version 1 remains readable for earlier add/replace-only
overlays.

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
  Location and room establishing plates normally use **16:9** because a scene
  can extend naturally through foreground, middle distance, and horizon.
- **Object and in-use plates use a geometry-aware ratio rather than a blanket
  16:9 default.** Use **16:9** for intrinsically long horizontal subjects such
  as vehicles, rifles, deployed weapons, and broad machinery; **4:3** or
  **1:1** for compact or roughly square equipment; and **3:4** for tall objects
  such as mirrors, staffs, standing reliquaries, and upright machines. A
  complete human figure in a landscape action plate normally uses **4:3** or
  **3:2**. Reserve **16:9** for genuinely wide staging or a deliberate
  knee-up/waist-up crop, not a complete person plus a complete oversized prop.
- Aspect ratio follows the visual question answered by the variant. Different
  variants in one entity folder may therefore use different deliberate ratios;
  family consistency means stable identity, materials, scale, and composition
  roles, not forcing every image onto the same canvas shape.
- For every bounded subject, preserve its native height-to-width ratio and
  natural anatomical or mechanical proportions. Never scale the subject
  differently along the horizontal and vertical axes, broaden it, flatten it,
  shorten it, compress it, or stretch it to fill the canvas. Fit it by moving
  the camera, choosing a more suitable ratio, or extending the background.
  Unused width is acceptable negative space.
- Do not combine all three constraints—complete bounded subject, complete
  oversized prop, and generous margins—inside a shallow 16:9 frame. Relax the
  crop, change the ratio, or create separate object and in-use variants.
- When an edit input uses a different ratio from the intended output, state
  that the source controls both design and native proportions. Recompose or
  outpaint by adding background around the unchanged subject; never treat
  “recompose; do not crop” as permission to reshape the source to the new
  canvas.
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

## Companion logs — external addon/plugin captures

`companion-logs/` holds raw data pulled from an external addon/plugin for
operator review — a Kindroid or Botify chat history, a watch-companion
watch-along transcript, or any future sibling app's output that a session
captures into a story's tree. It exists because that data lives on someone
else's server (Kindroid's, Plex's) with its own retention and pagination
behavior; capturing it here is the only way to keep a durable, reviewable
copy. Two rules make every capture identifiable without opening it — one
external, one internal:

- **Filename carries source and content, not just a timestamp:**
  `<source-slug>-<content-descriptor>-<stamp>.<ext>`, e.g.
  `watch-companion-watchalong-transcript-2026-08-31.md`. `source-slug` is the
  addon/plugin the data came from (`watch-companion`, `kindroid`, `botify`),
  never the underlying transport (`kindroid-mcp` is how it was pulled, not
  what it's data *of* — see the provenance block below for that
  distinction). `content-descriptor` says what kind of capture it is
  (`watchalong-transcript`, `chat-history`). `stamp` follows the shared UTC
  convention. This lets a directory listing alone answer "what is this and
  where did it come from" — the same motivation as `art/`'s filename
  convention, extended to captures instead of generations.
- **Every file carries a provenance block internally, not just externally.**
  A filename can be renamed or copied; the data must still self-identify
  once opened. A JSON capture puts a top-level `provenance` object beside
  its payload:

  ```json
  {
    "provenance": {
      "source": "watch-companion",
      "pulled_via": "kindroid-mcp kindroid_get_chat_messages",
      "source_ref": { "kind": "kindroid_group_id", "value": "chaos-house" },
      "captured_at": "2026-08-31T07:40:00Z",
      "range": {
        "earliest": "2026-08-02T18:24:12.917Z",
        "latest": "2026-08-31T06:09:28.901Z"
      },
      "complete": true
    },
    "messages": [ ... ]
  }
  ```

  A Markdown capture opens with the same facts in prose — source, how it was
  pulled, the source-side identifier, capture date, covered range, and
  whether the source confirmed there was nothing older/newer left to page
  through (`complete`) or the pull stopped early (rate limit, cap, error —
  state the reason). `complete: false` is not a defect; an honest partial
  capture beats a silent one that reads as full.
- **Read-only capture, never canon.** Like `drafts/_control/`, this is
  evidence for the operator's own review — not an entity, not something
  `compile-story.mjs` reads, and not something any tool imports. If a
  reviewed transcript surfaces something worth keeping (a voice
  inconsistency, a line worth preserving), that goes through the normal
  authoring path into `canon/` as its own deliberate step; the raw capture
  stays exactly as pulled, since editing it after the fact would defeat the
  point of a provenance record.
- **Owned by the operator/tooling, like `references/` and `art/`** — the
  server never writes here. A session populates it ad hoc, on request, not
  on any schedule.

### A source-side identity/persona field is captured raw, never edited in place

Some sources let the operator's displayed name vary within one capture —
Kindroid's per-chat/group persona toggle is the confirmed case (2026-08-31,
Chaos Saga): the operator's `display_name` on each message reflects whatever
persona was active in Kindroid *at send time*, not a fixed account name, and
it can and did change mid-conversation (a deliberate rename, plus brief
accidental activations while the operator was adding new personas to the
account). Kindroid exposes no read-back for the current persona setting
(`kindroid_update_info`'s `user_name` is write-only, and it's scoped to a
single AI, not a group) — the per-message `display_name` returned by
`kindroid_get_chat_messages` is therefore the *only* faithful record of which
persona was in effect when, and losing it loses real information.

- **The raw capture keeps every value exactly as returned**, including a
  since-corrected typo, an old name, or a one-off accidental value. Do not
  patch it in place even when the operator confirms it was a mistake —
  that mistake, and exactly when it happened, is what the raw file is for.
- **Record the transitions explicitly in the raw file's provenance**, as a
  `persona_history` entry (`field`, a plain-language `note` explaining *why*
  the value varies for this source, and a `segments` array of
  `{persona, count, from, to}` runs) — so a reader doesn't have to scan
  every message to find where the identity changed.
- **A single-identity reading copy is a separate, clearly named derivative**
  — `<source-slug>-<content-descriptor>-normalized-<stamp>.<ext>` — never a
  destructive edit to the raw file. Its own provenance names `derived_from`
  (the raw file), the exact `normalization` applied (`field`, `target_value`,
  `reason`, and `substituted_values` with counts), and when it was produced.
  Regenerate it from the raw file rather than hand-editing if the target
  identity changes.

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
  export filenames, and art subject slugs. In a setting-qualified display
  title such as *The Miskatonic Archives: The Blackwood Case*, the setting's
  leading **The** is display-only and drops from the slug
  (`miskatonic-archives-the-blackwood-case`); internal articles remain.
- **Timestamps:** UTC, ISO to the second, colons stripped for Windows
  (`2026-08-23T051200` or the shorter `T0512` prefix form for art, where
  the seq suffix already disambiguates).
- **The server only ever writes** `config.json`, `story.json`, and
  `exports/`. `canon/`, `drafts/`, `references/`, `art/`, and
  `companion-logs/` are operator/tooling territory. `compile-story.mjs`
  reads `canon/` (or an explicitly selected canon-shaped tree) but never
  mutates it; the server does not read or write these authoring directories
  directly.
- **`exports/` filenames are a plain `<slug>-<stamp>.json` timestamp,
  never a descriptive suffix.** An editorial pass's working content
  belongs in `drafts/` until accepted and then in `canon/`, never in a
  hand-named `exports/` file — that drift
  (`-mature-`, `-living-canon-`, `-remediation-`, etc.) is exactly what
  the 2026-08-27 amendment retired into `exports/archive/`.
