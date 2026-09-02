# Scene extraction scripts

The scripts used on 2026-09-01/02 to cut played story transcripts into
per-scene draft files under `data/stories/<slug>/drafts/scenes/` (overlay
`add` operations with the draft banner) and their documentation under
`drafts/_control/scenes/`. They are operator tooling, not part of the server;
they read `data/` (gitignored) and are kept here so the next extraction does
not start from nothing. Nothing here promotes, imports, or touches `canon/`.

## The shared engine

`extract_scenes.py` cuts one or more Botify chat exports for one story,
driven by a config module in this folder:

```bash
cd scripts/scene-extraction
python extract_scenes.py cuts_noctis          # dry run: prints the cut table
python extract_scenes.py cuts_noctis --write  # writes scenes, docs, manifest
node ../../scripts/verify-draft-overlay.mjs the-noctis-veil   # from the repo root
```

A config declares `STORY` (slug, prefix, title, cut date, README text),
`LOCATIONS` (location-code registry), and `CHATS` (one dict per Botify chat:
thread code, export prefix, story-end index, and the cut table of
`(key, title, start, day, location, story_time, participants, flags)`).
Rules the engine enforces: each chat is its own thread (`<STORY>-<THREAD>-<beat>-<LOC>`);
scene ranges are contiguous and cover `#0000` to the story end; deleted
messages go to `_alternates/`; bare `Continue` turns, pure directives, and
image-only bot messages are dropped from bodies and counted; prose is
verbatim apart from line endings. Group chats (`group=True`, exports under
`data/archive/botify/_group-chats/`) have no media manifest and a null
`botName`, so every message is prefixed with a bold speaker label from
`chat.bots` (operator turns are labelled `Operator`). File ownership is scoped
to `<prefix>-<thread>-`, so a run only replaces its own threads' files and
manifest entries; `doc_suffix` keeps a story's existing scene docs untouched
(see `cuts_chaos.py`).

Configs kept: `cuts_black_ledger.py`, `cuts_adjustment.py`, `cuts_noctis.py`,
`cuts_wonderland.py`, `cuts_chaos.py`.

## `build_sources.py`

Rebuilds every storyline's `data/stories/<slug>/sources/` provenance view
from scratch: a `_manifest.json` whose `pointers` name every original the
story derives from under `data/archive/` (path, bytes, SHA-256, never
copied), plus the readable derived files it writes: per-entry splits of the
composite ChatGPT documents and a chronological transcript per Botify chat.
It reads the archive indexes and asserts its chat lists agree with them.
`sources/` is read-only; never hand-edit inside it.

## `earlier/`

**Do not rerun.** Every script here carries a header saying so: several
write into `canon/scenes/`, where those scenes lived before the move.

The one-off scripts that preceded the engine: the Brass & Nerve, Blackwood
Case, and Shadowflame cuts (same rules, one chat each), the Chaos Saga
raw-archive and Homecoming extractions (ChatGPT raw text, not Botify), and
the script that moved recovered scenes from `canon/scenes/` into the draft
overlays. They are kept as records of how those files were produced; the
engine supersedes them for Botify sources.

The full working scratchpad of that session (rendered transcripts, dry-run
tables, helper scripts) is preserved on disk under
`data/scratchpad/2026-09-02-scene-extraction/` (gitignored).

## `../intake.py`

The archive's only writer (`docs/DATA_ARCHITECTURE_PROPOSAL.md` 4.1):
`index`, `ingest`, `verify` per source family, plus `snapshot` and `diff`
for the phase proofs. `build_sources.py` reads the archive indexes and
asserts its chat lists agree with them.

## `../verify-references.mjs`

Checks every story's `references/` and `art/`: sidecar per image, `image_sha256`
matches or the sidecar says why the image is gone, and every hash link
(`promoted_to_sha256`, `deduplicated_into`, `same_bytes_as`) resolves. Run it
after any change to visual assets.
