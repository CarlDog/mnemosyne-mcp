# Story Tree Organization — proposed guidelines and migration punch list

**Status: superseded 2026-09-02 by `docs/DATA_ARCHITECTURE_PROPOSAL.md` (ratified); kept for its inventory and the first adversarial review.** Written on operator
instruction after the `sources/` mirror landed, to apply the same
organization standard to every storyline tree and its subfolders while
keeping a clean line between canon and drafts. Nothing described here has
been moved yet. When ratified, the rules fold into `docs/DATA_LAYOUT.md`
(which remains the normative layout doc) and the punch list is executed in
one pass, one commit per finding category.

## 1. Principles

1. **One tree shape for every story.** A reader who knows one story's
   folders knows them all. Optional folders may be absent; nothing may be
   present that the shape does not name.
2. **Canon and drafts never mix.** `canon/` holds active, hash-stable
   entities and nothing that is not canon. `drafts/` holds the review-gated
   proposal and every piece of review evidence. A file's folder says what it
   is; a banner says it a second time.
3. **Every folder has one owner.** The server writes `story.json` and
   `exports/`. Tooling writes `sources/` and `drafts/_control/scenes/`. The
   operator writes `canon/`, `drafts/` proposals, `references/`, `art/`, and
   `companion-logs/`. Nothing is written by two owners.
4. **Documentation sits beside what it documents, under a `_` prefix.**
   `README.md` and `_`-prefixed Markdown are the only non-entity files
   allowed inside an entity folder; the validator and compiler already skip
   exactly those names. Anything else in `canon/` is an entity.
5. **Provenance and evidence are never entities.** `sources/`,
   `drafts/_control/`, `companion-logs/`, and `art/` sidecars are read by
   people and by verification tooling, never by story retrieval.
6. **Names are slugs and dates are ISO.** Folder and file names are
   lowercase `[a-z0-9-]`, dates are `YYYY-MM-DD`, timestamps are UTC to the
   second with colons stripped. No spaces, no capitals, no hand-written
   descriptive suffixes on machine-named files.
7. **Root stays empty.** A story root holds only `story.json` and the
   named folders. Review records, status notes, and scratch output have
   folders; the root is not one of them.

## 2. The canonical tree

```
data/stories/<slug>/
├── story.json                 server-written identity card (never hand-edited)
├── canon/                     ACTIVE CANON — entities only, plus README/_docs
│   ├── README.md              what this canon is, how it is edited
│   ├── _templates/            authoring templates, one per entity type
│   ├── characters/<slug>.md   one file per core/recurring character
│   ├── characters/_minor.md   compact tier, one heading per NPC
│   ├── locations/<slug>.md
│   ├── lore/<slug>.md, lore/objects/<slug>.md
│   ├── scenes/<key>--<slug>.md    established scenes only
│   ├── scenes/README.md, scenes/_catalog.md, scenes/_source-inventory.md
│   ├── worldbuilding/<slug>.md
│   ├── rules.md               one file, one ## per rule entity
│   └── style.md               one file, one ## per style entity
├── drafts/                    REVIEW-GATED PROPOSAL — never runtime canon
│   ├── <canon-relative>.md    sparse mirror of canon/ (adds and replacements, banner first)
│   └── _control/              review evidence, manifest-exempt, never promoted
│       ├── overlay.json       the exact add/replace/remove operations + hashes
│       ├── README.md          pass identity and acceptance bar
│       ├── PASS.md            verification and re-seal record (append-only log)
│       ├── SOURCE_PROVENANCE.md, LCS_SCORECARD.md, ASSET_REVIEW.md
│       ├── DECISIONS.md       (draft-only packages) ratified vs pending choices
│       ├── reviews/           dated review, remediation, and status records
│       ├── scenes/            docs, catalog, indexes, media index, _alternates/
│       │                      for the DRAFT scenes in drafts/scenes/
│       └── source-documents/  verbatim documents recovered from chats, kept as evidence
├── sources/                   PROVENANCE MIRROR — byte copies of every original (built, never hand-edited)
├── references/                approved visual INPUTS, one folder per entity, image + sidecar
│   └── <type>/<entity-slug>/{portrait,face,body,exterior,interior,reference}.{png,json}
├── art/                       generated OUTPUTS, machine-named, image + sidecar
│   └── _logs/                 generation failure and pending-prediction logs
├── exports/                   server-written story backups
│   ├── <slug>-<stamp>.json    plain timestamp names only
│   ├── archive/               retired hand-named editorial exports
│   └── raw-chatgpt-shares/    grandfathered share captures (mirrored in sources/chat/shares/)
└── companion-logs/            raw pulls from an external addon/plugin
```

Optional folders (`sources/`, `references/`, `art/`, `exports/`,
`companion-logs/`, `canon/scenes/`) may be absent when a story has nothing
for them. A **draft-only package** (the two Miskatonic prequels) has only
`drafts/` and `sources/`, exactly as `DATA_LAYOUT.md` already allows.

## 3. The canon / drafts line

- **`canon/` is the only place active canon lives.** Every file in it is an
  entity except `README.md`, `_`-prefixed docs, and `_templates/`. No banner,
  no review note, no "pending" state ever appears inside `canon/`. If a file
  needs a banner, it is not canon and does not belong there.
- **`drafts/` is a sparse mirror, plus evidence.** Proposal files sit at the
  canon-relative path they would take on promotion and open with the
  `> **DRAFT — NOT ACTIVE CANON**` banner. Everything that is not a proposal
  file lives under `drafts/_control/` and opens with
  `> **DRAFT CONTROL RECORD — NOT ACTIVE CANON**`.
- **Scene documentation follows the scenes.** Docs for scenes in
  `canon/scenes/` live in `canon/scenes/`; docs for scenes in
  `drafts/scenes/` live in `drafts/_control/scenes/`. A canon scene README
  may point at the draft folder but must not describe draft scenes as if
  they were established.
- **Promotion is the only way across the line**, and it goes through
  `overlay.json` and the verifier. Nothing is copied from `drafts/` to
  `canon/` by hand.
- **Review records are evidence, so they are drafts-side** even when they
  are about active canon (a Living Canon pass, a remediation record, a
  reference-artwork status). They go under `drafts/_control/reviews/` with
  their date in the filename.
- **`sources/`, `references/`, `art/`, `exports/`, `companion-logs/` are
  neither canon nor drafts.** They carry no banner because they carry no
  canon claim; the folder name is the claim.

## 4. Per-folder rules

### `canon/`
- Entity files only, one per entity, slug-named; `_minor.md` is the one
  batched exception per type and stays one heading per NPC.
- Authoring templates live in `canon/_templates/<type>.md`, one place per
  story, not scattered `_template.md` files inside each type folder.
- `canon/scenes/` holds established scenes and their own docs: `README.md`,
  `_catalog.md`, `_source-inventory.md`, `_template.md`, and a recovery
  manifest if one exists. It never holds draft scenes or their indexes.
- `README.md` describes what the canon is and how it is edited; it is the
  one prose file the overlay may replace (`drafts/README.md`).

### `drafts/`
- Proposal files mirror `canon/` paths exactly; nothing else at the top
  level. `drafts/scenes/` is where recovered and extracted scenes wait.
- `_control/` has a fixed core (`overlay.json`, `README.md`, `PASS.md`) and
  the standard evidence set (`SOURCE_PROVENANCE.md`, `LCS_SCORECARD.md`,
  `ASSET_REVIEW.md`), each present whenever the pass that produces it has
  run and absent otherwise (an absent file means "not done", never an empty
  stub).
- `_control/reviews/` collects dated one-off records
  (`<yyyy-mm-dd>-<topic>.md`): validation runs, remediation records,
  storyline indexes, idea banks.
- `_control/scenes/` and `_control/source-documents/` are tooling-owned and
  regenerated; hand edits go in `README.md` files the tooling does not
  overwrite.
- `PASS.md` is append-only: a new pass adds a dated section, never rewrites
  an old one.

### `sources/`
- As built by `scripts/scene-extraction/build_sources.py`; never hand-edited.

### `references/`
- One folder per entity under `characters/`, `locations/`, `objects/`; image
  plates with JSON sidecars only. Generation logs, failure dumps, and pending
  lists are not references and go to `art/_logs/`.

### `art/`
- Machine-named outputs with sidecars, flat. Logs under `art/_logs/`.

### `exports/`
- Plain `<slug>-<stamp>.json` files only. Every hand-named export
  (`-living-canon-`, `-polished-`, `-mature-`, `-visual-references-`,
  `-remediation-`, `-expanded-`) is a retired editorial artifact and lives
  in `exports/archive/`, as `DATA_LAYOUT.md` already requires. ChatGPT share
  captures (`raw-chatgpt-shares/`) are provenance, now mirrored in
  `sources/chat/shares/`; the `exports/` copy moves to `exports/archive/`
  so `exports/` holds only what the server wrote.

### `companion-logs/`
- Unchanged from `DATA_LAYOUT.md`.

## 5. Migration punch list (what the current trees violate)

Findings from the 2026-09-02 inventory of all thirteen trees. Each line is a
move or a deletion; none edits the content of a canon entity, so active
canon hashes do not change and every overlay stays verifiable. Moves inside
`canon/` are limited to `_`-prefixed docs and templates, which the validator
and compiler skip, plus the four one-line export-path fixes in finding #4,
which are the only canon entity edits in the list and are called out as such.

| # | Story | Finding | Proposed action |
|---|---|---|---|
| 1 | star-wars-the-black-ledger | Three review records at the story root (`BLACK_LEDGER_LIVING_CANON_PASS_2026-08-26.md`, `REFERENCE_ARTWORK_STATUS_2026-08-26.md`, `VISUAL_REMEDIATION_2026-08-26.md`) | Move to `drafts/_control/reviews/2026-08-26-living-canon-pass.md`, `...-reference-artwork-status.md`, `...-visual-remediation.md`; repoint the two pointers in `drafts/_control/README.md` and `PASS.md` |
| 2 | star-wars-the-black-ledger | Three Atlas Cloud failure/pending JSON logs loose in `references/` | Move to `art/_logs/` (create `art/`) |
| 3 | shadowflame | Empty stray `data/stories/shadowflame/data/stories/shadowflame/drafts/_control/scenes/` (a mis-rooted mkdir) | Delete |
| 4 | six stories | 29 hand-named exports in `exports/` root (living-canon, polished, mature, visual-references, remediation, expanded, enhanced, partial) | Move each to `exports/archive/`. Citations to repoint: Chaos Saga's three established canon scenes name `exports/chaos-saga-visual-references-2026-08-25.json` in their `source_export` frontmatter and `canon/scenes/README.md` links it (a deliberate canon edit: four one-line path changes, then re-verify and re-seal), and The Blackwood Case's `PASS.md` and `SOURCE_PROVENANCE.md` cite three by path (evidence-side edits). No other file cites them |
| 5 | chaos-saga, battlechasers | `exports/raw-chatgpt-shares/` is provenance, not a server export; now mirrored byte-for-byte in `sources/chat/shares/` | **Leave in place, grandfathered.** About 90 files cite the path, most of them draft scene frontmatter (`source_export`) whose hashes sit in the overlay manifests; moving it would force a rehash of two overlays for no content gain. Document it in `DATA_LAYOUT.md` as the one non-server folder allowed under `exports/`, with `sources/chat/shares/` as its mirror |
| 6 | battlechasers | Six `_template*.md` files scattered through `canon/characters/`, `locations/`, `lore/`, `lore/objects/`, `worldbuilding/` | Move to `canon/_templates/<type>.md` (`character-core.md`, `character-recurring.md`, `location.md`, `lore.md`, `object.md`, `worldbuilding.md`); repoint `canon/README.md` |
| 7 | chaos-saga | `canon/scenes/README.md` describes the 256 draft scenes at length under a "Recovered raw-archive scenes" heading and links their draft index | Trim to established scenes plus one pointer line to `drafts/_control/scenes/`; the description already lives there |
| 8 | miskatonic-archives-the-blackwood-case | Setting-level docs in one story's control folder: `STORYLINES.md`, `PREQUEL_IDEAS.md`, `prequels/` (seed banks for the two draft-only packages) | Move under `drafts/_control/reviews/` as `storylines-index.md`, `prequel-ideas.md`, and `prequels/`; repoint the four citations, all inside this story's own `PASS.md`, `SOURCE_PROVENANCE.md`, and `STORYLINES.md` (the two packages' `DECISIONS.md` and `README.md` do not cite these paths) |
| 9 | chaos-saga | `drafts/_control/SOURCE_VALIDATION_2026-09-02.md` | Move to `drafts/_control/reviews/2026-09-02-source-validation.md`; repoint `PASS.md` |
| 10 | midnight-is-a-suggestion | `drafts/_control/LCS_DIMENSION_LEDGER.md` beside `LCS_SCORECARD.md` | Keep (it is part of that pass's scorecard set); document as an optional companion of `LCS_SCORECARD.md` |
| 11 | trigun-scarlet-mercy | Parked story with `art/` and `exports/archive/` both empty and no `story.json`, `drafts/` | Delete the two empty folders; leave the rest, since the backlog doc parks it deliberately |
| 12 | star-wars-the-black-ledger | `drafts/_control/` bootstrap has no `SOURCE_PROVENANCE.md` while the root review docs hold that story's provenance | After #1, add a two-line `SOURCE_PROVENANCE.md` pointing at the moved 2026-08-26 pass record and at `sources/` (no new claims) |
| 13 | all stories with `drafts/` | `drafts/_control/README.md` absent in battlechasers, brass-and-nerve, midnight, chaos-saga | Add the standard pass-identity README (story, revision, parent, standard, acceptance bar) from the existing `PASS.md`/`LCS_SCORECARD.md` headers; no new claims |
| 14 | all stories | `DATA_LAYOUT.md` tree and text | Fold sections 2 to 4 of this document into it on ratification; add `_templates/`, `art/_logs/`, `_control/reviews/`, and the "root stays empty" rule |

Not proposed: renaming any entity file, changing any catalog key, moving any
draft scene, touching `sources/` (already to standard), or restructuring
`references/` (already one folder per entity with sidecars).

## 6. Order of work and verification

1. Deletions of empty strays (#3, #11) and root moves (#1, #2): no tooling
   reads those paths.
2. Export archiving (#4, #5) with the pointer fixes in the same commit.
3. Canon-side doc moves (#6, #7): run `validate-canon.mjs` and
   `compile-story.mjs --check` for the two stories after.
4. Control-folder tidying (#8, #9, #10, #12, #13) with pointer fixes.
5. `verify-draft-overlay.mjs` for every story with an overlay; active canon
   hashes must read unchanged for all thirteen, because no entity file moved.
6. `DATA_LAYOUT.md` update (#14), STATUS entry, one commit per category.

`data/` is gitignored, so the commits carry only this document, the layout
doc, and STATUS; the moves themselves are recorded in each story's
`PASS.md` as a dated "tree reorganization" section.

## 7. Adversarial review (2026-09-02)

Reviewed by a second model over the full session transcript, each objection
then checked against the trees and scripts. Outcome: the drift findings
stand; the proposal is **not ready to ratify**. Logged here verbatim in
substance; the operator has since asked for a ground-up redesign of the whole
`data/` root (see `docs/DATA_ARCHITECTURE_PROPOSAL.md`), which supersedes the
punch list above.

Confirmed:

1. Finding #7 misdiagnoses the largest canon/drafts mix. Chaos Saga's
   `canon/scenes/` still holds `_source-inventory.md`,
   `_recovery-source-manifest.tsv`, and `_template.md` that document the 256
   draft scenes; only `_index.md` and `_alternates/` moved on 2026-09-02.
   The fix is a real move, with `_catalog.md`'s location registry (which
   serves canon and draft scenes alike) staying canon-side. One draft scene
   cites a canon scene doc by path.
2. Step 5's evidence is wrong: "active canon hashes unchanged" is a
   within-run verifier line (it printed after 31 canon files changed on the
   Black Ledger). Proof must be a before/after SHA snapshot of every `canon/`.
3. Five internal contradictions: §4 still moves share captures while #5
   grandfathers them; PASS.md is append-only yet #1/#9 "repoint" it; §4 says
   hand edits go in READMEs tooling does not overwrite, but the extraction
   engine regenerates `_control/scenes/README.md`; `sources/` is both
   mandatory and optional; principle 6 bans capitals that the control
   filenames keep.
4. Design gap: permanent canon evidence (Living Canon passes, remediation
   records) placed under `drafts/_control/reviews/` inherits an overlay's
   lifetime, and the doc never says what happens on promotion. Moving the
   2026-08-26 Black Ledger pass into its scenes-only overlay would make that
   overlay read as a sealed revision, contradicting its bootstrap README.
   Idea banks and storyline indexes are not reviews.
5. Scope gap: the `data/` root (`scratchpad/`, and `botify-exports/`, which
   `build_sources.py` treats as the true master of 871 MB) is outside the
   standard.
6. Smaller: "verify all thirteen overlays" is impossible (Trigun and the two
   packages have none); retroactive control READMEs (#13) would assert
   revision ids never sealed.

Refuted by inspection: the compiler skips `README.md` and `_`-prefixed
Markdown exactly as the validator does and names `characters/_minor.md` as a
deliberate exception, so the template move changes no entity count;
`scaffold-story.mjs` writes no `_template.md`; `verify-provenance.mjs` reads
export JSON, not `art/`; the Chaos overlay has no `replace` on the three canon
scenes or their README, so finding #4's frontmatter edits stale no baseline.
