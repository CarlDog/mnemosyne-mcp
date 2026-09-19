# Genre Declaration Design

**Status:** Proposed 2026-09-19; Draft 2 the same day after an adversarial review of
Draft 1 (twelve findings, all folded in; see the revision notes). The shape was decided
by the operator: both homes; controlled terms with free guidance; hard enforcement once
every story is declared; multi-genre over one shared, parent-annotated dictionary;
marker-carried guidance rendered as a structural block for direct providers; terms only
for companion providers; canon written directly on per-story confirmation
**Version:** Draft 2
**Applies to:** every story in the data tree and every story project at runtime

## Purpose

Every story declares its genres, once, in a form the tooling can check and the
generator can read, so that a beat, a chapter, or a fresh character build is written
inside the story's own conventions rather than the model's default reading of the
material. The declaration is multi-genre: a story names the frame it is told in and
the genres it blends, in that order, and every term comes from one shared dictionary so
two stories never mean two things by the same word.

It is a story-level declaration in the family of the content rating
([CONTENT_ROUTING_DESIGN.md](CONTENT_ROUTING_DESIGN.md)) and position tracking
([POSITION_TRACKING_DESIGN.md](POSITION_TRACKING_DESIGN.md)): declared per story on the
story marker, read once per generation, rendered into the context as a structural block
that is never subject to retrieval or dropping. The precedent transfers for the marker
and for the rendering path, not for dispatch: the rating is a gate with one call site,
genre is guidance with several rendering sites, each named below. It supplements the
[Living Canon Standard](LIVING_CANON_STANDARD.md), which governs the quality of the
references the genre is applied to.

## Non-goals

- It does not choose or restrict a provider or a model; content routing does that.
- It does not encode subgenre, tone or mood as controlled values; those are free text
  in the story's own words.
- It does not validate prose against the genre mechanically; a genre break is a judgement
  the validator model and the reviewer make with the declaration in front of them.
- It does not add a genre field to character profiles; a character serves the story's
  declaration through the story block already present in character/3.
- It does not create any retrievable entity: no "Genre" style or lore record exists, so
  nothing is ranked, capped, pinned or scanned as an entity on its way to the prompt.

## 1. The dictionary

One file, tracked, machine-readable, the single source for every consumer:
`src/genre-dictionary.json`. It is read with `readFileSync` through `import.meta.url`,
the pattern `src/version.ts` already uses for `package.json`, so the server (from
`src/` under `tsx` and from `dist/` under `node`) and the tracked scripts (from
`scripts/`) all resolve the same file and no emitted copy exists to go stale. The server
reads it once at startup; editing the dictionary means restarting a running server,
while the scripts read it live.

Each term is a lowercase, hyphenated identifier with four fields: `parent` (another term,
or null for a root), `definition` (one line), `promises` (what the genre owes the
reader), `avoid` (what it must not do). A test asserts every term has the four fields,
every parent resolves without a cycle, and no two definitions are identical.

The dictionary is a genre list, not a taxonomy: subgenres, hybrids and tone words are
free text under `lean` and `subgenres`, so the list stays short enough to be memorised
and stable enough to validate against. Because terms have parents, the ordered `genres`
list has one right answer:

> **The broadest true term comes first; at most two blends follow; anything narrower
> than a dictionary term goes in `subgenres`. A term never appears together with its own
> parent or ancestor.**

The validator rejects a redundant pair. The dictionary of record is the JSON file
itself, never a copy in this document: see
[GENRE_DICTIONARY_SOURCE_REVIEW.md](GENRE_DICTIONARY_SOURCE_REVIEW.md) for the
external-source review that set its current shape.

## 2. The data-tree declaration (authoring truth)

Each story carries `canon/_story.md`. It is an underscore-prefixed root document, which
the layout already reserves, but neither the validator nor the compiler enumerates the
canon root today: both walk the five entity directories and three fixed batch paths, and
`walkEntityFiles` skips underscore-prefixed Markdown. So both scripts gain one explicit
root read of `<dir>/_story.md` outside the entity walk, and
[DATA_LAYOUT.md](DATA_LAYOUT.md)'s "underscore-prefixed Markdown templates are ignored by
compilation" gains this one named exception.

```yaml
---
schema: "story/1"
name: "<display name>"
genres: ["<frame>", "<blend>", "<blend>"]   # 1 to 3 dictionary terms; first is the frame
subgenres: ["<free text>", "..."]             # optional
lean: "<one line: this story's own take on its genres>"
conventions:                                   # what this story promises, in its own words
  - "<one line>"
avoid:                                         # what this story must not do
  - "<one line>"
---

Optional prose: how the blend resolves when its genres pull against each other. The
body is authoring notes; nothing reads it.
```

Rules the tooling enforces whenever the file exists:

- `genres`: one to three dictionary terms, none repeated, no term with its own parent or
  ancestor; the first is the frame and wins when conventions conflict.
- `lean`: required, one line, at most 200 characters. `conventions` and `avoid`: lists of
  one-line strings, at most 8 entries of at most 160 characters each, both optional but
  recommended. `subgenres`: free one-line strings. The whole guidance (lean, conventions,
  avoid) is capped at 1,500 characters, because it travels on the marker and into every
  prompt.
- `name`: a non-empty one-line string. The validator checks nothing else about it (it
  works on a directory that is often a temporary copy and has no access to story
  identity). The compiler, which does load `story.json` when it exists, warns on a
  mismatch and never fails on it: `story.json` is server-owned and most trees have none.
- Flat legacy frontmatter and the nested character/3 shape stay exactly as they are; the
  story block is a third shape with its own `schema:` key, parsed by the shared nested
  parser, with its own resolver in `scripts/canon-frontmatter.mjs`.

## 3. Enforcement (hard once every story is declared)

- `scripts/validate-canon.mjs` always validates `_story.md` when the file exists
  (unparseable frontmatter, an unknown term, a redundant parent-and-child pair, the
  cardinality and length rules), naming the file and the offending term. Absence fails
  only under a new `--require-story-block` flag, so every existing invocation and every
  existing test fixture behaves as today until the gate is deliberately turned on.
- `scripts/verify-draft-overlay.mjs` runs the validator three times: on a copy of the
  active canon, on an isolated copy of the drafts alone, and on the merged tree. The
  isolated run never receives the flag, because an overlay that revises one character
  has no reason to carry a `_story.md`; the baseline and merged runs receive it once the
  gate is on. A `drafts/_story.md` is manifested and promoted like any other draft file.
- `scripts/compile-story.mjs` stays permissive: it reads `_story.md` when present and
  carries it into the export; it never fails for its absence, because
  `scripts/scaffold-story.mjs` runs the compiler over a freshly scaffolded stage that
  has no declaration yet. The scaffolder writes `_story.md` from an export that carries
  `story.genres` and `story.genre_guidance`, so the tree round trip preserves the
  declaration.
- The fresh-build tooling under `data/cross-story/templates/tools/` (untracked, uncovered
  by CI) reads the same dictionary through the repository path: `swap_profile.py`
  refuses to install a profile into a story whose `canon/_story.md` is missing once the
  gate is on, and a fresh build's question set opens by showing the story's declared
  genres, or by asking for them when the story has none.
- Turning the gate on is one commit in slice 3, after every existing story is declared:
  the verifier starts passing the flag to its baseline and merged runs, and the
  validator's documented default invocation gains it.

## 4. The compiled export and the runtime marker

**Export.** The export document's story block gains two optional fields,
`genres: string[]` and `genre_guidance: { lean, conventions[], avoid[] }`, validated
against the dictionary and the length rules by the import schema. Like the Kindroid
binding already in that block, import **reports** them and never applies them: setting a
live story's genre is an explicit `mnemo_story_use` decision, so a re-import can never
stomp a runtime edit.

**Marker.** The story marker gains schema 7 with four optional lines:

```text
Genre: <term>, <term>
Genre-Lean: <one line>
Genre-Conventions: <item> | <item>
Genre-Avoid: <item> | <item>
```

Parsing validates on read, as the narrator profile and the content rating do: a term
outside the dictionary is ignored and the story reads as undeclared, so a hand-edited
marker can never carry an arbitrary string into a prompt; guidance lines are plain
strings, capped as in section 2. A schema-7 marker without the lines parses exactly as a
schema-6 marker. In the other direction an older server that rewrites a schema-7 marker
drops the lines and downgrades the schema number, the same exposure the content rating
already has; it is documented, not defended.

`buildMarkerContent` rebuilds the marker positionally and is called from five sites
(`createStory`, `setKindroidTarget`, `setNarratorProfile`, `setContentRating`,
`applyPositionUpdate`). All five carry the genre fields through, and the acceptance test
re-fetches the story after each of them, because an in-memory object spread would hide a
dropped line.

**Tool.** `mnemo_story_use` gains `genres` (an ordered array of dictionary terms, or null
to clear) and `genre_guidance` (`{ lean, conventions, avoid }`, or null). Both are
validated against the dictionary and the length rules; the guidance text is scanned by
`scanForInjectionSignals` before it is written, and the tool gains
`override_flagged_content`, becoming the fourth write surface that exposes it. Setting
either field re-fetches the story and returns the persisted declaration.

**Rendering.** Genre joins `ContextBundle` next to `position`, and the rebuilt bundle in
`src/application/prompt-policy.ts` passes it through explicitly, the way it passes
`position`; a field left out of that literal never reaches `buildSystemPrompt`, which is
why the acceptance test drives `continueScene` rather than the prompt builder alone.

- Direct providers (Ollama and the cloud four): a structural block in the system prompt,
  after the position line: the frame, the blends, the lean, then the conventions and the
  avoid lines, every guidance string passed through `neutralizeSectionDelimiters` first.
- Companion providers (Kindroid, Botify): one line, `Genre: <frame>; blends: <terms>`,
  beside the position line and counted in `hasContextBlock`. Dictionary identifiers are
  fence-safe by construction, and the lean, conventions and avoid lines never reach a
  companion, in keeping with the 2026-09-03 ruling that a kin's persona carries tone.
- The validator model's context gets the same block as a direct provider, so a genre
  break can be flagged against the declaration.

## 5. Slices

1. Tooling: the dictionary file and its test; the story-block resolver in
   `scripts/canon-frontmatter.mjs`; the explicit root read, the flag and the checks in the
   validator; the compiler's export fields and name warning; the verifier's per-run flag
   handling; the scaffolder's round trip; fixtures for each (the existing validator,
   compiler and verifier suites keep passing unchanged because the flag defaults off);
   `docs/DATA_LAYOUT.md`, CLAUDE.md, CHANGELOG and STATUS updated. No `src/` change except
   the dictionary file and its test.
2. Runtime: the import schema fields; marker schema 7 through all five write sites; the
   story tool's three new parameters; `ContextBundle`, the prompt policy literal, the
   system-prompt block, the companion line, the validator context; tests as in section 6,
   with mutation checks per site.
3. Every existing story declared: one question set per story with a drafted frame, blends,
   lean, conventions and avoid, confirmed by the operator before anything is written; on
   confirmation the block is written directly to `canon/_story.md` (the confirmation is
   the direction, the file is new rather than a promoted draft, and the scaffolder already
   writes canon directly). Every question set and every drafted block lives under
   `data/stories/<slug>/`, never under `docs/` or any committed path. Then the hardening
   commit of section 3.
4. Optional: `check_profile` warns when a profile's story block contradicts the
   declaration.

## 6. Acceptance

- Validator: a tree whose `_story.md` has an unknown term, a term beside its parent,
  four genres, or a 300-character lean fails with the file and the term named; a valid
  block passes; a tree without the file passes without the flag and fails with it.
- Compiler: `--check` on a tree with a valid block yields an export whose story block
  carries `genres` and `genre_guidance`; a tree without the file compiles as today; a
  name that differs from an existing `story.json` produces a warning and no failure.
- Verifier: an overlay that revises one character, on a story whose canon carries a
  block, passes with the gate on (the isolated run is exempt); an overlay adding a
  `drafts/_story.md` with an unknown term fails in the merged run with the term named.
- Scaffolder: an export carrying `story.genres` and `story.genre_guidance` scaffolds a
  tree with `_story.md`, and compiling that tree reproduces the fields.
- Marker: after each of the five write sites, a fresh `findStory` still returns the
  genres and guidance; a marker line with an unknown term reads as undeclared; a
  schema-6 marker parses unchanged.
- Rendering: a `continueScene` run on a declared story produces a system prompt with the
  block after the position line, and a companion message with exactly one genre line
  carrying only terms; an undeclared story produces neither.
- Injection: a guidance line shaped like a directive is refused by `mnemo_story_use`
  without the override and written with it; the rendered block neutralizes a section
  delimiter inside a guidance string.
- Mutation checks, one per site: the dictionary lookup in the validator; the root read
  in the compiler; the flag exemption for the isolated run; each of the five marker write
  sites; the prompt policy passthrough; the companion line; the neutralization call.

## 7. Out of scope, named

- Automatic genre detection from prose.
- Per-character or per-scene genre overrides.
- A genre-aware provider choice.
- Migrating the roughly fifty fixture trees in the validator, compiler and verifier
  suites to carry a declaration: the flag defaults off precisely so that is not needed
  until a test wants the gate.

## Revision notes

- Dictionary revised against external sources (2026-09-19, dictionary version 2).
  An adversarial review against the book trade's BISAC headings, the Library of
  Congress genre authority, the Encyclopedia of Science Fiction and the genre
  bodies' own definitions produced 25 edits: 7 reparented terms, 13 rewritten
  entries, `action` and `adventure` merged, and `alternate-history` and `folklore`
  added. Six terms became roots because their former parent forbade a pairing a
  real story needs, and `procedural` moved to `mystery` because it could not
  satisfy `crime`'s own definition. Two entries also carried content-policy
  language rather than genre description; an age or consent boundary is not a
  convention of one genre, it does not vary by genre, and stating it in a single
  term implied the others were exempt. Both are now descriptive, and the real
  boundary stays where it is enforced: the story-level `content_rating` checked
  fail-closed at `dispatchGenerate()` (docs/CONTENT_ROUTING_DESIGN.md). Full
  record and sources: [GENRE_DICTIONARY_SOURCE_REVIEW.md](GENRE_DICTIONARY_SOURCE_REVIEW.md).
- Slice 1 shipped (2026-09-19). The dictionary of record is
  `src/genre-dictionary.json`; Appendix A is superseded and not maintained. The scaffolder refuses an
  export that carries only one of `story.genres` and `story.genre_guidance`
  rather than skipping the block silently, because a dropped declaration is the
  failure section 3 exists to prevent; the compiler's staged round trip in the
  scaffolder compares the compiled block back against the export's declaration.
  The import schema fields named in section 4 belong to slice 2 with the rest of
  the runtime, as section 5 says; slice 1 relies on the current schema ignoring
  unknown story fields, which the compiler's contract check exercises.
- Draft 2 (2026-09-19), after an adversarial review of Draft 1: the guidance moved off a
  pinned style record (retrieval-bound, capped, name-colliding, and unreachable by
  companions under the 2026-09-03 ruling) onto the marker, rendered as a structural block
  for direct providers and as a terms-only line for companions; the dictionary is
  parent-annotated with the broadest-first rule and a redundancy check; the validator's
  gate is a flag scoped to the verifier's baseline and merged runs, never its isolated
  run; both scripts gain an explicit root read because neither enumerates the canon
  root; the compiler stays permissive so the scaffolder keeps working and gains the round
  trip; `name` is only required to be non-empty by the validator; the marker validates
  on read and all five write sites carry the fields; import reports the export's genre
  fields and never applies them; the story tool scans guidance for injection and exposes
  the override; the rendering path is named down to the prompt policy literal; slice 3
  writes canon directly on confirmation and keeps every drafted block in `data/`.

## Appendix A: the draft dictionary (superseded)

This appendix held a prose copy of the 39-term draft list. It went stale within a
day of slice 1 shipping, which is the drift this design warns about everywhere
else, so it is deliberately not maintained here.

The dictionary of record is `src/genre-dictionary.json` (40 terms, 27 roots).
The original draft is in this file's history at the slice 1 commit. The evidence for
every change since is
[GENRE_DICTIONARY_SOURCE_REVIEW.md](GENRE_DICTIONARY_SOURCE_REVIEW.md).
