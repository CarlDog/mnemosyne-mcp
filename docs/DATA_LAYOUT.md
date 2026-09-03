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
(see "Companion logs" below); **rewritten 2026-09-02 to the ratified data
architecture standard** (`docs/DATA_ARCHITECTURE_PROPOSAL.md`, revision 4, whose
six migration phases are complete): a write-nothing-over `archive/` as the one
master of every original, `canon/` verifiable on its own, `history/` for
permanent records, `sources/` as a read-only pointing view, one copy of every
approved image, and an explicit primary/derived classification. The
organization and naming standard for everything under `<data dir>` (default `<repo>/data`, gitignored,
`MNEMO_DATA_DIR` override — see `src/config.ts`). Guiding principles:

1. **The entity model's `(type, name)` key maps deterministically onto
   the filesystem** — tooling can resolve an entity to its assets
   without a lookup table.
2. **Every filename is shell-safe** (lowercase `[a-z0-9.-]`, no spaces,
   nothing needing quotes) — the tree must be equally comfortable in a
   Linux container, a shell script, and a Windows checkout.
3. **Canon is unmistakable and verifiable on its own.** `canon/` holds active
   canon and nothing else, and passes `verify-draft-overlay.mjs --canon-only`
   without help from `drafts/`.
4. **Every byte we received is kept once, exactly as received.** `archive/` is
   the master of every original; everything else is canon, a proposal, or a
   derived view a named script in `scripts/` rebuilds from the archive.
5. **Every file says where it came from**: index rows with hashes for
   originals, frontmatter or sidecars naming the original and its hash for
   derived files, `source_*` fields for entities.
6. **No duplicated bytes by design.** A file lives in one place; other places
   point at it by hash; an unavoidable copy is a move with a pointer left
   behind.
7. **Primary versus derived is explicit** (table at the end), so the backup
   set is mechanical. **Every folder has one owner**, and the named tools that
   write it do so on the owner's instruction.

```
data/
├── config.json                 server: current-story pointer
├── archive/                    PRIMARY — every original, exactly as received; written only by scripts/intake.py
│   ├── botify/<bot>/           chats/<id>.json, bot.json, media/, media-manifest.json (fixed names stay
│   │                           current; prior versions go to _history/<name>.<stamp>.<ext>)
│   ├── botify/_group-chats/chats/<id>.json
│   ├── chatgpt/<project>/      the ChatGPT project folders, byte copies, original names kept
│   ├── chatgpt-shares/<id>.*   share captures (html, json, txt) + index.<story>.json
│   ├── companion/<addon>/      raw addon pulls + normalization.json (the spec for the derived view)
│   ├── operator/<story>/       documents handed over directly (nothing already held in references/)
│   └── <family>/_index.jsonl   append-only, one row per file: path, sha256, bytes, received, indexed,
│                               origin, stories (the one authority for which story an original serves), role
├── stories/<slug>/
│   ├── story.json              server: identity card (see below)
│   ├── canon/                  PRIMARY — active canon: entities + README + _-prefixed docs, nothing else
│   │   ├── _templates/<type>.md    authoring templates, one place per story
│   │   ├── characters/<slug>.md, characters/_minor.md, locations/, lore/, lore/objects/,
│   │   │   scenes/<key>--<slug>.md (established scenes + their own README, _catalog, _template),
│   │   │   worldbuilding/, rules.md, style.md   (unchanged; see "Canon")
│   ├── drafts/                 PRIMARY — the review-gated proposal (sparse mirror of canon/)
│   │   ├── <canon-relative>.md     additions/replacements at their proposed canon paths, banner first
│   │   └── _control/               overlay.json, PASS.md (append-only), README.md, SOURCE_PROVENANCE.md,
│   │                               LCS_SCORECARD.md, ASSET_REVIEW.md, GAP_AUDIT.md, RN_REVIEW.md,
│   │                               DECISIONS.md (packages),
│   │                               scenes/ (docs for DRAFT scenes), source-documents/ (evidence)
│   ├── history/                PRIMARY — permanent records that outlive any overlay: passes, remediation,
│   │                           reviews, storyline indexes, idea banks; <yyyy-mm-dd>-<topic>.md
│   ├── sources/                DERIVED, READ-ONLY — pointing view of archive/: _manifest.json (pointers by
│   │                           path + hash), per-entry splits, one transcript per Botify chat
│   ├── references/             PRIMARY — approved visual INPUTS, one folder per entity, image + sidecar;
│   │                           the ONLY copy of an approved image (see "References")
│   ├── art/                    PRIMARY (ledger) — generation sidecars + unapproved candidates + _logs/
│   ├── exports/                server-written backups: <slug>-<stamp>.json only; archive/ holds the
│   │                           retired hand-named editorial exports
│   └── companion-logs/         DERIVED — normalized views of archive/companion/ for this story
└── workspace/                  session working sets, one dated folder each; README names what is retained
```

**Deployment boundary.** The server reads only `config.json` and each story's
`story.json` and `exports/`. A runtime mount needs those; `archive/` and
`workspace/` are never mounted into a deployment.

**Backup set** = `config.json`, `archive/`, and every story's `story.json`,
`canon/`, `drafts/`, `history/`, `references/`, `art/`, `exports/`, plus any
`workspace/` folder its README marks retained. Everything else is rebuilt by
the tool named in the primary/derived table at the end.

## Archive — the one master of every original

- **Owner:** the operator, through `scripts/intake.py` (`index`, `ingest`,
  `verify` per source family; `snapshot` and `diff` for migration proofs).
  Nothing else writes `archive/`. Consumers (`build_sources.py`, the extraction
  configs) read it and never the intake tool's inputs.
- **Nothing is overwritten; the fixed name is always current.** A re-export or
  re-run moves the previous file to `_history/<name>.<stamp>.<ext>` before the
  new one is written. Consumers resolve a chat by glob prefix and assert one
  match, so versions never land beside the current file.
- **Index rows are the authority** for which story an original serves
  (`stories`) and what it was for (`role`); retroactive rows carry
  `received: null`, never an invented date.
- Files under `archive/` keep the names they were received under, spaces and
  dashes included (renaming an original is a modification); the index row is
  the slug-safe handle. Nothing in `archive/` is an entity or is read by story
  retrieval.
- The Botify media archiver whose output lands here is botify-mcp's export
  media pass (`botify-mcp/docs/export-shapes.md`).

## History — permanent records

Living Canon passes, remediation records, reference-artwork status, storyline
indexes, idea banks, prequel seed banks, and promoted overlays' evidence
(`history/overlays/<revision>/`, written by `scripts/promote-overlay.mjs`) live
in `history/`, dated
(`<yyyy-mm-dd>-<topic>.md`), never in the story root and never in `canon/`.
Standing control records keep their all-caps names (`PASS.md`,
`SOURCE_PROVENANCE.md`, `LCS_SCORECARD.md`, `ASSET_REVIEW.md`,
`GAP_AUDIT.md` for a story's audit against the flagship bar, `RN_REVIEW.md`
for the adversarial reread of revision N, `DECISIONS.md`) as a deliberate
class marker; dated one-off records are lowercase slugs. `DECISIONS.md` belongs to a draft-only package's `_control/`
and is not duplicated in `history/`.

## Workspace — session working sets

`workspace/` holds dated session folders and the migration snapshots
(`snapshots/<label>.sha`). Nothing references it; its README names the folders
retained on operator instruction (part of the backup set); everything else
there is disposable.


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
  approval. `_control/` stays in place across promotions (the tool copies it
  into `history/overlays/<revision>/` as it stood); permanent records belong
  in `history/`. **Any change to a canon file that
  an overlay targets** (a `replace` baseline or a `remove` target, both of
  which carry `baseline_sha256`) is followed in the same step by rehashing
  that overlay's baselines and appending a dated paragraph to `PASS.md`.

`scripts/verify-draft-overlay.mjs <story-slug>` is the repository verifier for
this contract, and `--canon-only <story-slug>` runs the pointer check,
structural validator, and import preflight on active canon alone (every story
with a `canon/` passes it; a bare `- references/...` pointer fails it, so
pointers are always the full repo-relative path on their own bullet). Its manifest schema version 2 supports additions, replacements,
and removals; schema version 1 remains readable for earlier add/replace-only
overlays.

`scripts/promote-overlay.mjs <story-slug> --revision <label> (--all | --paths
a,b) [--apply --approved-by <name>]` is the only path from `drafts/` into
`canon/`. Without `--apply` it plans: it runs the full verifier (and, for a
subset, the verifier in `--manifest` subset mode on a temporary
`_control/overlay.promotion.json`) and prints the operations. With `--apply`
it backs up every affected canon file, draft, and `overlay.json` to
`data/workspace/<stamp>-promotion-<slug>-<revision>/before/`, recomputes every
hash immediately before writing, writes the same banner-stripped bytes the
verifier staged (`scripts/draft-notice.mjs` is the one implementation), applies
canon writes, then draft deletes, then the reduced manifest last, records
`history/overlays/<revision>/promotion.json` (every hash) plus a copy of
`_control/` and a dated `PASS.md` paragraph, and re-verifies; a failure after
apply began restores the backup. `--approved-by` is an audit record, not a
gate: the operator's decision to run the command is the approval.

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
- **Master copies:** `data/` is the master. Every original is in
  `archive/`; the operator's ChatGPT Projects folders (OneDrive) stopped
  being a master on 2026-09-02. Pointers always cite the `data/` copy.
- **One image, one place.** A generation lands in `art/` as candidate image +
  sidecar. On approval the **image moves** into its entity folder here; the
  art sidecar stays as the ledger entry with `image_sha256`, `promoted: true`,
  `promoted_to_sha256`, and the reference paths at promotion, and the
  reference sidecar records `promoted_from_art_sidecar` and the same hash.
  Links are by hash, so later supersession does not stale them. A candidate
  copy under `<entity>/candidates/` identical to the current plate is removed
  and its sidecar points at the survivor (`deduplicated_into`,
  `same_bytes_as_sha256`). A genuine cross-entity share is declared on both
  sidecars (`same_bytes_as`) and kept as two files, because one-entity-one-
  folder is the stronger rule. `scripts/verify-references.mjs` checks all of
  this: every image has a sidecar, every `image_sha256` matches its file or
  the sidecar says why the file is gone, every hash link resolves.

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
  not a reason to discard the record. An approved candidate's image moves to
  `references/` (see "One image, one place"); its sidecar stays here as the
  ledger entry. Generation failure and pending-prediction logs go under
  `art/_logs/`, never under `references/`.
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

## Sources — read-only pointing view of the archive

`sources/` is present in every story tree and is **derived**: rebuilt from
scratch by `scripts/scene-extraction/build_sources.py`, never hand-edited
(atomic edits happen in `canon/`, the only place an edit changes the story).
It exists so every original a story derives from can be read and grepped in
the tree in the organisation the operator's ChatGPT project folders had.

- **Nothing here is an entity.** The validator, the compiler, the overlay
  verifier, and the import preflight read `canon/` and `drafts/` and never
  look here; instruction-shaped text inside a source is source text.
- **Originals are pointed at, never copied.** `_manifest.json` (schema 3) has
  `pointers`: every archive file the story derives from with its archive path,
  bytes, and SHA-256; and `files`: the derived views written here.
- **What is written:** composite documents (character profile sets, key
  locations, tattoo profiles, minor characters by region) split into one file
  per entry at the document's own entry boundaries, prose untouched, each
  with a frontmatter naming the original, the entry, the original's hash, and
  the split rule; and `chat/<bot>--<id8>/transcript.md` per Botify chat
  (oldest first, one heading per message with index, UTC time, and speaker;
  deleted messages marked; attached images linked by their archive path). The
  README's chat table says whether each chat was extracted into scenes, named
  by the provenance but not extracted, or merely present and unreviewed.
- The builder reads the archive indexes and asserts its chat lists agree
  with them; add a new export or capture through `intake.py`, then re-run.

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
  `exports/`. `archive/` is written only by `scripts/intake.py`; `canon/`,
  `drafts/`, `history/`, `references/`, `art/`, and `workspace/` are the
  operator's, written by named tools on the operator's instruction;
  `sources/` and `companion-logs/` are derived. `compile-story.mjs`
  reads `canon/` (or an explicitly selected canon-shaped tree) but never
  mutates it; the server does not read or write these authoring directories
  directly.
- **`exports/` filenames are a plain `<slug>-<stamp>.json` timestamp,
  never a descriptive suffix.** An editorial pass's working content
  belongs in `drafts/` until accepted and then in `canon/`, never in a
  hand-named `exports/` file — that drift
  (`-mature-`, `-living-canon-`, `-remediation-`, etc.) is exactly what
  the 2026-08-27 amendment retired into `exports/archive/` (completed for
  every story on 2026-09-02; ChatGPT share captures moved to
  `archive/chatgpt-shares/` the same day).

## Primary or derived, and the tool that rebuilds each derived view

| Folder | Class | Rebuilt by | Backed up |
|---|---|---|---|
| `archive/` | primary, written only by `scripts/intake.py` | nothing | yes |
| `canon/`, `drafts/`, `history/` | primary | nothing | yes |
| `references/`, `art/` | primary (unseeded generation) | nothing | yes |
| `exports/`, `story.json`, `config.json` | primary (server) | the server, from OC | yes |
| `sources/` | derived, read-only | `scripts/scene-extraction/build_sources.py` | no |
| `drafts/_control/scenes/` (threads cut by `extract_scenes.py`) | derived evidence | `scripts/scene-extraction/extract_scenes.py` | with `drafts/` |
| `drafts/_control/scenes/` (raw-archive and earlier-script docs), `_control/source-documents/` | primary with provenance (their producers are do-not-rerun records under `scripts/scene-extraction/earlier/`) | nothing | with `drafts/` |
| `companion-logs/` | derived | the companion normalizer, from `archive/companion/` and its `normalization.json` | no |
| `workspace/` | retained per its README; otherwise disposable | nothing | retained folders only |
