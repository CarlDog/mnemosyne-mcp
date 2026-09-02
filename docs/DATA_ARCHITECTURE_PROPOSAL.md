# Data Architecture Proposal — reimagining `data/` from the root

**Status: RATIFIED 2026-09-02 (revision 4), all nine decisions taken per
recommendation.** Written on operator instruction to stop patching the
story trees and instead design, from the `data/` root down, a standard that
will hold for years: cleaner organization, no duplicated bytes, provenance
that cannot be lost, and a clear line between what is canon, what is
proposed, what is evidence, and what is merely kept. Revisions 2 to 4 folded
in four adversarial reviews (§7); the fourth found no further architectural
flaw. This document supersedes `docs/archive/STORY_TREE_ORGANIZATION.md` and, when
phase 6 lands, replaces `docs/DATA_LAYOUT.md`. Migration status lives in
`STATUS.md`; all six phases completed 2026-09-02. `docs/DATA_LAYOUT.md` is now the
normative layout document; this file is the design record and review log.

**Decisions (2026-09-02):** 1 rename `botify-exports/` to `archive/botify/`
in phase 1; 2 `sources/` stops holding byte copies in phase 5; 3 the saved
2026-09-02 scratchpad is retained under `workspace/`, everything else there
is disposable; 4 move, not copy, on art approval; 5 keep rejected
generations; 6 `history/` is a separate primary; 7 no content-addressed
store; 8 atomic edits happen in `canon/`, `sources/` is read-only; 9 the
share captures move into `archive/chatgpt-shares/` during the phase 0/1
re-seal.

## 1. What the tree is today (measured 2026-09-02)

| Root | Size | What it is |
|---|---|---|
| `data/stories/` (13 trees) | 3.6 GB | `references/` 2.3 GB, `art/` 1.2 GB, `sources/` 96 MB, `exports/` 39 MB, `drafts/` 11 MB, `companion-logs/` 4 MB, **`canon/` 2.4 MB** |
| `data/botify-exports/` (75 bots + groups) | 871 MB | Botify chat exports, bot definitions, media archives; the true master of every Botify byte, since `sources/` is rebuilt from it |
| `data/scratchpad/` | 6 MB | one session's working files, saved on operator instruction |
| `data/config.json` | 1 KB | the server's current-story pointer |

Three facts drive the redesign.

**Canon is 0.05% of the bytes.** Everything else is inputs, outputs, and
evidence around it.

**About 1.3 GB of the 4.5 GB is avoidable duplication**, measured pair by
pair: 1.21 GB where 199 of the 215 images in `art/` have a byte-identical
file under `references/` (approval was done by copy; one hash has two
reference copies); 75 MB inside `references/` where 20 superseded copies
are byte-identical to the current file of the same entity, plus one genuine
cross-entity share (Blackwood's `reaper` overview serves a location and an
object plate); 62 MB of Botify media and 29 MB of share captures copied into
`sources/` this morning. The 46 MB duplicated between Botify bots' own
archives is excluded: those are originals as received.

**Active canon in five stories has never been verified on its own.** 149
canon files in BattleChasers, Chaos Saga, Blackwood, Shadowflame, and
Wonderland carry bare `- references/...` pointers, the form the verifier's
pointer check rejects. Every one of the 149 is an overlay target (141
`replace`, 8 `remove`), so the merged tree the verifier checks never
contains a bare pointer. The verifier does run the structural validator on
the active baseline alone; what has never run on `canon/` alone is the
pointer check and the import preflight.
The organizational cause is the same throughout: folders were added as
needs arose, several hold the same kind of thing, and nothing says which
copy is the master or which tree is the one being verified.

## 2. Goals, in priority order

1. **Canon is unmistakable and verifiable on its own.** One folder per
   story holds active canon and nothing else, and it passes the verifier
   without help from `drafts/`.
2. **Every byte we received is kept once, exactly as received, forever.**
   A single intake archive is the master of every original; everything
   else is canon, a proposal, or a derived view a named script in
   `scripts/` can rebuild from the archive. Two named exceptions: an
   operator photo that is already an approved reference with a sidecar is
   held only in `references/`, and `exports/raw-chatgpt-shares/` stays
   where it is until decision 9.
3. **Every file says where it came from.** Originals carry an index row
   with a hash; derived files carry a frontmatter or sidecar naming the
   original and its hash; entities carry `source_*` fields.
4. **No duplicated bytes by design.** A file lives in one place; other
   places point at it by hash. Where a copy is unavoidable, it is a *move*
   with a pointer left behind.
5. **Primary versus derived is explicit**, and "derived" means a tool in
   `scripts/` rebuilds it; nothing is called derived on the strength of a
   script that lives in a workspace folder.
6. **Every folder has one owner**, and the named tools that write it do so
   on the owner's instruction. No rule depends on a tool that does not
   exist yet without saying so.
7. **The layout survives tooling changes.** Paths are repo-relative and
   slug-based; no folder name encodes a date, a pass, or a tool.

## 3. The proposed root

```
data/
├── config.json                 server: current-story pointer
├── archive/                    PRIMARY — every original, exactly as received (see 4.1 for what is write-once)
│   ├── botify/<bot>/           chats/<id>.json (write-once), bot.json + media-manifest.json (current),
│   │                           _history/<name>.<stamp>.json (every earlier version), media/
│   ├── botify/_group-chats/    (today's botify-exports/; decision 1 governs the rename)
│   ├── botify/_index.jsonl     one row per file: sha256, bytes, received, origin, stories
│   ├── chatgpt/<project>/      the ChatGPT project folders, byte copies, ORIGINAL names kept (4.7 exception)
│   ├── chatgpt/_index.jsonl
│   ├── companion/<addon>/      raw addon pulls + normalization.json (the spec) + _index.jsonl
│   └── operator/<story>/       documents handed over directly + _index.jsonl (nothing already in references/)
├── stories/<slug>/
│   ├── story.json              server: identity card
│   ├── canon/                  PRIMARY — active canon: entities + README + _docs, nothing else
│   ├── drafts/                 PRIMARY — the review-gated proposal (sparse mirror of canon/)
│   │   └── _control/           overlay.json, PASS.md, evidence for THIS overlay
│   ├── history/                PRIMARY — permanent story records that outlive any overlay
│   ├── sources/                DERIVED, READ-ONLY — story-scoped view of archive/: manifest,
│   │                           transcripts, per-entry splits (byte copies only until decision 2)
│   ├── references/             PRIMARY — approved visual inputs, one folder per entity; the only
│   │                           copy of an approved image
│   ├── art/                    PRIMARY (ledger) — generation sidecars + unapproved candidates + _logs/
│   ├── exports/                server-written backups; archive/ for retired hand-named ones;
│   │                           raw-chatgpt-shares/ stays pending decision 9
│   └── companion-logs/         DERIVED — normalized views of archive/companion/ for this story
└── workspace/                  session working sets; dated folders; README names what is retained
```

**Deployment boundary.** The server reads only `config.json` and each
story's `story.json` and `exports/` (checked in `src/config.ts` and
`src/export.ts`; `references/` appears in comments, not code). A runtime
mount therefore needs `config.json` and `stories/<slug>/{story.json,exports}`;
`archive/` and `workspace/` are never mounted into a deployment, and
`references/`, `art/`, `sources/`, `history/` ride along only when the
whole `data/` is bind-mounted for convenience.

Backup set = `config.json`, `archive/`, and every story's `story.json`,
`canon/`, `drafts/`, `history/`, `references/`, `art/`, `exports/`, plus any
`workspace/` folder its README marks retained. Everything else is rebuilt
from the backup set by a tool named in §4.8.

## 4. The rules that make it hold

### 4.1 Intake: `archive/` is the one master of originals

- **Owner:** the operator, through one intake tool, `scripts/intake.py`
  (phase 1). It copies a received file in under its original name and
  appends an index row. Consumers (`build_sources.py`, the extraction
  configs) read `archive/`, never the intake tool's inputs.
- **Nothing is overwritten; the fixed name is always current.** Every
  file a consumer reads by fixed name (`chats/<id>.json`, `bot.json`,
  `media-manifest.json`) stays at that name. When a re-export or a re-run
  produces a new version, the tool moves the previous file to
  `_history/<name>.<stamp>.json` first, then writes the new one. The two
  consumers (`extract_scenes.py`, `build_sources.py`) resolve a chat by
  glob prefix and assert exactly one match, so versions must never land
  beside the current file. Write-once therefore means "no version is ever
  lost", not "no file ever changes".
  The media archiver that writes `media-manifest.json` (schema
  `botify-media-archive:1`) is not in `scripts/` today; phase 1 locates or
  reimplements it inside the intake tool before write-once is promised
  over anything it touches.
- **Index:** one `_index.jsonl` per source family, one row per file
  (`path`, `sha256`, `bytes`, `received`, `origin`, `stories`), append-only.
  Retroactive rows for today's 871 MB carry `received: null` and
  `indexed: 2026-09-02`; the index never invents a date. The `stories`
  field is the **one authority** for which storylines an original serves:
  `build_sources.py` reads it and keeps no per-story source list of its
  own. The retroactive index is built **before** the `botify-exports/`
  rename and re-verified after it; that is the proof the 871 MB moved
  untouched.
- Nothing in `archive/` is an entity or is read by story retrieval.
- **What moves in:** the OneDrive ChatGPT folders (copied once; OneDrive
  stops being a master), the raw `companion-logs/` pulls with their
  normalization spec, and any operator document not already held as a
  reference with a sidecar (goal 2's first exception: the Jenna and Riley
  photos already are, as `references/.../source.jpg`). `archive/operator/`
  is a source family like the others (the source is the operator); it is
  subdivided by story because that is the only structure such documents
  arrive with. `botify-exports/` becomes `archive/botify/` **per
  decision 1**.
- **`exports/raw-chatgpt-shares/` (Chaos Saga, BattleChasers) is decision
  9.** About 90 draft files cite it inside hashed frontmatter, but both
  stories are re-sealed in phase 0 anyway, so the marginal cost of moving
  it to `archive/chatgpt-shares/` is a 90-file repoint folded into a
  re-seal that already happens. Until decided it stays, indexed at its
  current path, as the one non-server folder under `exports/`.
- `drafts/_control/source-documents/` and `_control/scenes/_source-documents/`
  are derived evidence views cut from archived chats for one overlay, not
  homes for originals; their READMEs say so and name the tool that cut them.

### 4.2 Canon: `canon/` holds canon and only canon, and verifies alone

- Entity files, one per entity, slug-named; `characters/_minor.md` is the
  one batched exception per type. `README.md` and `_`-prefixed Markdown are
  the only non-entity files, and `_templates/` the only non-entity folder.
- `canon/scenes/` holds established scenes and docs about *those* scenes
  (README, catalog with the location registry, template). Docs about draft
  scenes live with the drafts.
- **Every asset pointer is the full repo-relative path on its own bullet**
  (`- data/stories/<slug>/references/...`), the one form the verifier's
  pointer check accepts.
- **Verifying canon alone is a tool feature, added before it is relied
  on:** `verify-draft-overlay.mjs --canon-only <slug>` stages `canon/` with
  an empty operation list and runs the same structural, pointer, and
  preflight checks (the structural validator already runs on the baseline;
  the flag adds the pointer check and preflight). It is what phase 0 and
  every later phase report for goal 1, for the eleven stories that have a
  `canon/`; the two draft-only packages have none to verify.
- Every entity that came from a source carries `source_*` frontmatter
  naming the archive file and its hash. No banner ever appears in `canon/`.

### 4.3 Proposals: `drafts/` is a sparse mirror plus this overlay's evidence

- Proposal files sit at their canon-relative path with the draft banner.
  `_control/` holds `overlay.json`, `PASS.md` (append-only), and the
  evidence produced for this overlay.
- **Promotion is defined as what the promotion tool does, and that tool
  does not exist yet.** Until it does, `_control/` is never moved:
  overlays are living (Shadowflame r15, Wonderland r10) and their PASS logs
  span revisions. The target rule, implemented with the tool: on promotion
  of a revision, the tool copies the promoted files into `canon/`, removes
  them from the overlay, and writes the revision's evidence to
  `history/overlays/<revision>/` while `_control/` continues as the living
  overlay's log. Piecemeal promotion is the same operation on a smaller
  set.
- **Any change to a canon file that an overlay targets** (a `replace`
  baseline or a `remove` target) is followed in the same step by rehashing
  that overlay's baselines and appending a dated paragraph to its
  `PASS.md`. This is a standing rule, because phases 0 and 2 both trigger
  it.

### 4.4 Records: `history/` is the story's permanent memory

- Living Canon passes, remediation records, reference-artwork status,
  storyline indexes, idea banks, and prequel seed banks live here, dated (`<yyyy-mm-dd>-<topic>.md`), never in the root and never
  in canon. Setting-level material shared by several stories lives in the
  parent story's `history/` with the others pointing at it.
- Filenames keep the **all-caps convention for standing control records**
  (`PASS.md`, `SOURCE_PROVENANCE.md`, `LCS_SCORECARD.md`, `ASSET_REVIEW.md`,
  `DECISIONS.md`) as a deliberate class marker; dated one-off records are
  lowercase slugs. `DECISIONS.md` belongs to a draft-only package's
  `_control/` (it governs the proposal) and is not duplicated in `history/`.

### 4.5 Derived views: `sources/` reads well, is read-only, and in time stops copying

- `sources/` keeps its per-chat transcripts, per-entry splits of composite
  documents, READMEs, and manifest: the readable, greppable form of every
  original. Splits and transcripts carry the original's path and hash.
- **`sources/` is read-only.** `build_sources.py` recreates it from
  scratch, so an edit made there is destroyed on the next rebuild. The
  operator's stated purpose, "individual file extracts, for backup and
  easier atomic edits and maintenance", is served in two places: backup
  by `archive/` (and by the byte copies in `sources/` until decision 2), and
  atomic editing by `canon/`, which is already one file per entity and is
  the only place an edit changes the story. This split is **decision 8**.
- **Today `sources/` is also a byte mirror** (98 MB) by the operator's
  explicit instruction. Once `archive/` is in the backup set, the byte
  copies become manifest rows pointing at the archive path and hash
  (**decision 2**).

### 4.6 Visuals: one image, one place, cross-linked by hash

- A generation lands in `art/` as candidate image + sidecar. On approval
  the **image moves** to `references/<type>/<entity>/<variant>.<ext>`
  (decision 4); the art sidecar stays as the ledger entry with the image's
  SHA-256 and `promoted: true`; the reference sidecar records the same hash
  and the art sidecar's filename. Links are by hash, so they survive later
  supersession. Rejected candidates keep image + sidecar in `art/`
  (decision 5). Superseded references move to
  `references/<type>/<entity>/superseded/<date>/` as today.
- Migration applies this retroactively by hash match (199 pairs, 1.21 GB):
  keep the reference image, delete the art copy, cross-link both sidecars.
  None of the 199 reference sidecars is provenance-incomplete and no
  control record, doc, or status entry cites an `art/` path, so the delete
  breaks no citation and there is no provenance to carry across.
- The 20 within-entity superseded duplicates collapse to one file with the
  superseded sidecar recording the surviving file's hash. The `reaper`
  cross-entity pair stays as two files (one-entity-one-folder is the
  stronger rule); both sidecars record `same_bytes_as`.
- `scripts/verify-references.mjs` (phase 4) checks hash links both ways
  and every image's sidecar. `verify-provenance.mjs` reads export JSON, not
  `art/`, so it is unaffected by the move but **is** affected by phase 2
  (§5).
- `art/_logs/` holds generation failure and pending-prediction logs.

### 4.7 Naming and identity

- Slugs everywhere (`[a-z0-9-]`), dates `YYYY-MM-DD`, timestamps UTC to the
  second with colons stripped. Machine-named files carry no descriptive
  suffix. All-caps is reserved for the standing control records in §4.4.
- **Exception:** files under `archive/` keep the names they were received
  under, spaces and dashes included, because renaming an original is a
  modification; the index row is the slug-safe handle.
- `story.json` stays the only server-written file inside a story besides
  `exports/`.

### 4.8 Primary or derived, and the tool that rebuilds each derived view

| Folder | Class | Rebuilt by | Backed up |
|---|---|---|---|
| `archive/` | primary | nothing | yes |
| `canon/`, `drafts/`, `history/` | primary | nothing | yes |
| `references/`, `art/` | primary | nothing (unseeded generation) | yes |
| `exports/`, `story.json`, `config.json` | primary (server) | the server, from OC | yes |
| `sources/` | derived, read-only (primary-by-copy until decision 2) | `scripts/scene-extraction/build_sources.py` | until decision 2 |
| `drafts/_control/scenes/` (threads cut by the engine on 2026-09-02) | derived evidence | `scripts/scene-extraction/extract_scenes.py` | with `drafts/` |
| `drafts/_control/scenes/` (Chaos raw-archive index and alternates; Blackwood, Shadowflame, Brass & Nerve docs), `_control/source-documents/` | **primary with provenance**: produced by the do-not-rerun `earlier/` scripts and the share cutters; nothing rebuilds them | nothing | with `drafts/` |
| `companion-logs/` | derived | the companion normalizer, from `archive/companion/` and its `normalization.json` | no |
| `workspace/` | retained per its README; otherwise disposable | nothing | retained folders only |

The `scripts/scene-extraction/earlier/` scripts write into `canon/scenes/`
(where those scenes lived before the move) and are marked **do-not-rerun**
in their README; every repoint in the migration is a frontmatter rewrite
plus rehash, never a re-extraction.

## 5. Migration, in phases that each leave the tree verifiable

Each phase ends with a before/after SHA snapshot of every `canon/`,
`references/`, `art/`, and `archive/` tree (proof of exactly which bytes
moved), the
validator and compiler for every story with a canon, `--canon-only` for
every story with a canon, and the overlay verifier for the ten stories
with an `overlay.json`. One commit per phase for the repo side; `data/` is
gitignored, so each story's `history/` gets a dated record of the phase.
Any phase that rewrites files cited by hashed frontmatter or overlay
baselines includes the rehash and PASS paragraph in the same step (§4.3).
Phases 0 and 1 are executed back to back so each overlay is re-sealed
once for both; Chaos Saga's phase 2 and 3 edits are folded into that same
re-seal by ordering its file moves first.

0. **Verifier flag, then canon pointer normalization.** Add `--canon-only`
   to `verify-draft-overlay.mjs`. Normalize the 149 bare-pointer canon
   files in five stories; rehash all 149 baselines (`replace` and `remove`
   entries alike carry `baseline_sha256`, checked 2026-09-02); re-seal
   five PASS logs; run `--canon-only` for the eleven stories with a
   `canon/`. First time the pointer check and preflight run on active
   canon alone.
1. **Intake archive.** Write `scripts/intake.py`; locate or absorb the
   media archiver; create `archive/` with the ChatGPT folders, companion
   pulls and spec, and per-source indexes (the Botify index built in
   place first, re-verified after the move); then, per decision 1, move
   `botify-exports/` in and repoint the 350 citing files (all drafts, in
   eight stories; no canon file cites the path, checked 2026-09-02) by
   frontmatter
   rewrite, rehash and re-seal eight overlays (manifest-only), and update
   the repo-side citations (`docs/`, `STATUS.md`, `CLAUDE.md`, the memory
   files, `scripts/scene-extraction/`) in the same commit. Retarget
   `build_sources.py` and the extraction configs.
2. **Story roots and records.** Create `history/` per story; move the
   Black Ledger root records, Chaos Saga's validation record, Blackwood's
   storyline index, idea bank, and prequel seeds; delete the mis-rooted
   Shadowflame folder and Trigun's empty folders; archive the 29
   hand-named exports with four one-line canon frontmatter edits in Chaos
   Saga (an overlay-target change, so rehash and re-seal per §4.3).
   **Tooling touched:** `verify-provenance.mjs` selects its default input
   from the newest JSON in `exports/` root, so run it for Chaos Saga and
   Blackwood before and after and confirm its coverage did not drop;
   if it did, give it an explicit `--export` in the docs that call it.
3. **Canon-side docs.** BattleChasers templates to `canon/_templates/`;
   Chaos Saga's draft-scene inventory and recovery manifest to
   `drafts/_control/scenes/` with the catalog's location registry staying
   canon-side; the one draft scene that cites a canon doc repointed
   (rehash that overlay). Move the ChatGPT-share cutters from
   `workspace/` into `scripts/scene-extraction/earlier/` as records, marked
   do-not-rerun like the rest.
4. **Visual dedup.** Hash-match `art/` against `references/`; keep the
   reference image, delete the art copy, cross-link sidecars by hash;
   collapse the 20 within-entity duplicates; declare the `reaper` pair;
   write `verify-references.mjs`. About 1.28 GB reclaimed. Before any
   delete, the 199 art copies are staged aside in
   `workspace/<date>-art-dedup/` and kept until `verify-references.mjs`
   passes for every story; snapshots prove what changed, the staged copy
   restores it. Waits until phases 0 to 3 are verified.
5. **`sources/` becomes a pointing view** (decision 2), rebuilt by
   `build_sources.py` from `archive/`; 91 MB of copies removed.
6. **Normative doc.** Replace `DATA_LAYOUT.md` with §3, §4, §4.8; update
   `CLAUDE.md`'s layout notes and `config.ts`'s path comment; retire
   `STORY_TREE_ORGANIZATION.md` to `docs/archive/`.

## 6. Decisions only the operator can make

1. **Rename `botify-exports/` to `archive/botify/`, or keep the name.** The
   rename costs a frontmatter repoint of 350 files and a manifest-only
   re-seal of eight overlays; keeping the name leaves the archive split
   across two roots forever. Recommendation: rename, in phase 1, while
   every citing file is still a draft.
2. **`sources/` stops holding byte copies once `archive/` is the backup.**
   Reverses this morning's "copy for backup" instruction on purpose, because
   the guarantee moves somewhere stronger. Recommendation: yes, as phase 5.
3. **`workspace/` retention.** The saved 2026-09-02 scratchpad is retained
   by your instruction; everything else there is disposable. Recommendation:
   retain, with a one-line README per retained folder.
4. **Move, not copy, on art approval.** The proposal assumes move.
5. **Keep rejected generations** (about 10% of `art/`). The proposal keeps
   them.
6. **`history/` as a separate primary** versus keeping every record inside
   `drafts/_control/`. The proposal separates them.
7. **Content-addressed store.** Not proposed; hash cross-links get most of
   the benefit without an unreadable tree.
8. **Where atomic edits happen.** The proposal makes `sources/` read-only
   and names `canon/` as the place an edit means something; the
   alternative makes the splits a primary and a second home for content.
   Recommendation: `canon/` edits, read-only splits.
9. **Move `exports/raw-chatgpt-shares/` into `archive/chatgpt-shares/`**
   during the phase 0/1 re-seal (a 90-file repoint in two overlays that
   are re-sealed anyway), or keep it as a named exception under `exports/`.
   Recommendation: move it; one archive with no exceptions is the point.

## 7. Adversarial reviews, logged

### 7.1 Review of revision 1 (2026-09-02)

Reviewed by a second model over the full session transcript; each checkable
claim then tested against the tree and the scripts. Outcome: design
coherent, not ready to ratify. Folded into revision 2 as noted.

1. Phase 1 was not "scripts only": 350 files under `drafts/` and `canon/`
   cite `data/botify-exports/` inside hashed frontmatter. → §4.1, decision 1.
2. §4.5 reversed the operator's same-day instruction to keep byte copies in
   `sources/` without listing it as a decision. → decision 2.
3. `archive/` had no owner; "write-once" contradicted how `bot.json` and
   media manifests are overwritten; a single `INDEX.json` is a corruption
   hazard; retroactive rows would invent dates. → §4.1.
4. `history/overlays/` on promotion assumed a promotion tool that does not
   exist. → §4.3.
5. Visual dedup facts were unchecked. Checked: 199 of 215 art images have a
   byte-identical reference; the 75 MB inside `references/` is 20
   within-entity groups plus the `reaper` pair; `verify-provenance.mjs`
   reads export JSON; path cross-links go stale. → §4.6.
6. `scratch/` as disposable contradicted "save the scratchpad". →
   `workspace/`, decision 3.
7. "Retire OneDrive" was already committed. → removed.
8. Five stories' canon (149 files) uses bare pointers and passes only
   because drafts override them. → §1, §4.2, phase 0.
9. "Drop caps over time" left a gradient. → §4.4.
10. Smaller: "four homes" overstated; intra-Botify 46 MB not reclaimable;
    `references/`/`art/` snapshots; companion normalization spec must be
    primary. → §1, §4.1, §4.8, §5.

Refuted by inspection: `scaffold-story.mjs` writes no templates; the
compiler skips `README.md` and `_`-prefixed Markdown and names `_minor.md`
as an exception; the Chaos overlay has no `replace` on the three canon
scenes.

### 7.2 Review of revision 2 (2026-09-02)

Same method. Outcome: stronger, not ready to ratify. Folded into revision 3
as noted.

1. Phase 0 stales overlay baselines: 141 of the 149 bare-pointer canon
   files are `replace` targets and the other 8 are `remove` targets, which
   also resolves why those 8 pass today (the merged tree drops them). →
   §1, §4.3 standing rule, phase 0.
2. No tool verified canon alone; the verifier checks the merged tree. →
   §4.2 `--canon-only`, phase 0 prerequisite.
3. The share-capture move was back, un-grandfathered, and would have added
   BattleChasers as a ninth overlay to re-seal. → §4.1 grandfathered.
4. Phase 2 touches `verify-provenance.mjs`, which selects the newest JSON
   in `exports/` root. → phase 2 check.
5. Overlay count is ten, not eleven. → §5.
6. "Derived" was claimed for views whose scripts live only in the
   workspace folder, and the `earlier/` scripts write into `canon/scenes/`.
   → goal 5, §4.8, phase 3, do-not-rerun.
7. Write-once collided with fixed-name consumers, and the media manifest
   writer is unidentified. → §4.1 scoping, `_history/`, phase 1.
8. The operator's "atomic edits" purpose was unresolved against a
   read-only `sources/`. → §4.5, decision 8.
9. Phase 4 as provenance repair: **refuted**, none of the 199 matched
   reference sidecars is legacy-incomplete.
10. Dangling `art/` citations after phase 4: **refuted**, none exist.
11. Smaller: the two photos are already references with sidecars (→ §4.1);
    "one writing tool per folder" softened (→ goal 6); `archive/chatgpt/`
    filename exception named (→ §4.7); phase 1's repoint reaches repo-side
    files (→ phase 1).

### 7.3 Review of revision 3 (2026-09-02)

Same method. Outcome: no further architectural flaw; four mechanics
defects, three decisions, cheap fixes. Folded into revision 4 as noted.

1. `remove` entries carry `baseline_sha256` (checked: every remove entry in
   every manifest), so phase 0 stales 149 baselines, not 141. → phase 0.
2. Versioned chat re-exports beside the current file would abort both
   consumers, which resolve a chat by glob prefix and assert one match. →
   §4.1: fixed names stay current, prior versions go to `_history/`.
3. Phase 1's "drafts only" claim **holds**: no canon file cites
   `data/botify-exports`; the 350 files span exactly eight stories. →
   recorded in phase 1.
4. §4.8 called `drafts/_control/scenes/` derived, but only the engine-cut
   threads are; the raw-archive and earlier-script docs have no rebuild
   tool. → §4.8 split into derived and primary-with-provenance rows.
5. The share-capture grandfather rested on a re-seal cost phase 0 already
   pays. → decision 9.
6. Two authorities for "which story does an original serve". → §4.1: the
   index row is authoritative; `build_sources.py` reads it.
7. No deployment boundary. Checked: the runtime reads only `config.json`,
   `story.json`, and `exports/`. → §3.
8. Phase 4 had no restore path. → staged-aside copy until
   `verify-references.mjs` passes.
9. Smaller: §1 overstated what never ran on canon alone; `--canon-only`
   cannot cover the packages; re-seal churn folded; `archive/operator/`
   and the photo exception named in goal 2; `DECISIONS.md` placed in
   `_control/` only; the Botify index is built before the rename and the
   snapshot rule now covers `archive/`.
