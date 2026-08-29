# Import / Export Design

**Status: ratified 2026-08-21** (operator decisions recorded below). Build
order: `mnemo_export_story` first, `mnemo_import_story` second, the mapping
playbook + seed templates as docs third. This document is the design record;
STATUS.md tracks build progress.

## Background — three research sources

The design was derived from a three-lane research pass (2026-08-21) plus an
independent two-reviewer second-opinion pass (one blind derivation, one
adversarial critique), all archived in the session record. Sources:

1. **The operator's original ChatGPT storytelling projects**
   (`D:\OneDrive\Technology\ChatGPT\Projects` — Chaos Saga, GhostHunters,
   BattleChasers, Wonderland). One evolving idiom, not a fixed format: only
   Project Instructions + Style Guide appear in all four; folder names
   actively lie (BattleChasers' "Profiles/Location" files are worldbuilding
   content); files are composites (every Project Instructions file mixes
   style + worldbuilding + character stubs + rules); there are misfiled
   strays and concatenated drafts. The most consistent operator-authored
   rule across projects is a Memory Governance Directive: nothing enters
   canon without explicit per-item approval.
2. **OpenChronicle v1's archived template system**
   (`archive/openchronicle.v1` in the OC repo — 11 JSON templates, a
   storypack import pipeline, design-analysis docs). The templates were
   never machine-rendered (the render path had zero call sites; the
   validator would have rejected every real template). They functioned as a
   human-and-LLM authoring contract — and that is what templates should
   remain. v1's own analysis docs struck through the ChatGPT-era tracking
   bureaucracy ("administrative theater... OC's engines already handle
   this"), a verdict this design keeps.
3. **OpenChronicle v2's import pipeline** (`archive/openchronicle.v2` —
   the real code, compared against `docs/V2_RETROSPECTIVE.md`). Classified
   by filename substring + per-format regex, explicitly "No LLM calls";
   silent WORLDBUILDING fallback for anything unmatched; blind
   `memory_save` per entity with no dedupe (re-runs duplicate everything);
   a `dry_run` mode with a manifest-miscount bug. The retrospective's own
   verdict — prefer LLM-driven classification over substring rules — stands.

## The core architectural decision

**Classification happens caller-side, in the MCP host conversation. The
server is a typed batch writer that validates and saves — it never
guesses.**

Every prior attempt failed by putting classification *in the software*:
v2's heuristics mis-tagged real content; v1's smarter pipeline died
unfinished. Meanwhile the engines available to a server-side LLM pass are
non-viable: Ollama on the CPU-only NAS runs 5–12 tok/s (a single
generate+validate chain has already blown Claude Desktop's ~4-minute tool
timeout), and Kindroid cannot produce structured output. The most capable
model in the system — the host LLM in front of every tool call — is already
paid for, already interactive (it can ask "this looks like a misfiled
draft, skip it?"), and is where the operator's per-item approval rule
lives naturally.

Corollary: because the tool contract is "caller supplies types," the
classifier is swappable. A future web-UI caller (the NSFW path, which
cannot transit an Anthropic host) can bring its own classifier — or a
human can hand-edit export JSON — and both feed the same dumb writer.

## Tool surface

### `mnemo_export_story` (build first)

Serialize a story's full OC project to a versioned JSON document.

- `name_or_id?` — defaults to the active story.
- Pulls the marker via the existing story lookup and **all** project
  memories via OC's `memory_list` (strict `project_id` scope, no limit —
  not `memory_search`, whose 100-result window would silently truncate).
- Parses each memory through the existing entity parser. The story marker
  is excluded **by its memory ID** — never by its tag, since `extra_tags`
  lets a legitimate, parseable entity carry the marker's tag, and a tag
  filter would silently omit it from the one enumeration whose contract
  is completeness. (The marker's information already appears as the
  document's `story` block.) Any other unparseable memory is excluded
  from `entities` but **listed in the response manifest** — nothing
  silently drops.
- Writes the document to a file (default
  `<data dir>/stories/<story-slug>/exports/<story-slug>-<utc-timestamp>.json`,
  one subtree per storyline — timestamped
  to the second so back-to-back exports of one story never silently
  overwrite an earlier backup; a relative `out_path` is resolved to
  absolute, since a stdio server's cwd is unpredictable and the
  manifest's path is the document's only retrieval handle) and returns
  the path plus a per-type manifest. The document is not echoed into the tool response:
  export content needs no host judgment, so routing a 100-scene story
  through host context is pure waste. (File-write is a deliberate
  stdio-era contract; revisit retrieval when HTTP transport exists.)

Export is first because the interchange schema is the riskiest
commitment — once export files exist and imports have run against them,
changing the schema is a data migration.

### Export document schema (version 1)

```json
{
  "mnemosyne_export": 1,
  "exported_at": "<iso-datetime>",
  "story": {
    "name": "<story name>",
    "created_at": "<iso-datetime>",
    "kindroid_target": { "type": "ai | group", "id": "<id>" }
  },
  "entities": [
    {
      "type": "character",
      "name": "<name>",
      "content": "<body, without the [Type] Name header>",
      "pinned": false,
      "tags": ["mnemosyne", "story", "character"],
      "created_at": "<iso-datetime>"
    }
  ]
}
```

- `kindroid_target` is included (operator decision 2026-08-21) and omitted
  when the story has none. **Caveat:** ai/group ids are account-specific —
  portable across machines, not across Kindroid accounts.
- `tags` are preserved verbatim: `validation:clean`/`validation:errors`
  carry the v0.1.3 scene-filtering state, and losing them on round-trip
  would silently degrade context assembly.
- `created_at` per entity is preserved because OC's `memory_save` supports
  backdating — a round-trip import can restore timestamps, which also
  protects RECENT SCENES recency behavior from being distorted by
  re-imported legacy scenes.
- `mnemosyne_export: 1` is the version gate. Known future addition (see
  Future direction below): per-character provider bindings.

### `mnemo_import_story` (build second)

A typed batch writer. Two input modes, one machinery:

- `entities[]` — an array of already-classified
  `{type, name, content, pinned?, tags?}` records (the curated path: host
  classifies, human approves in conversation, one call commits).
- `file_path` — a mnemosyne export document; deterministic deserialize,
  no classification involved (the round-trip path). The locked "no
  deterministic checker" principle does not apply here — it is scoped to
  validating generated prose, not to parsing a format mnemosyne itself
  writes.

Shared behavior (semantics finalized at implementation, 2026-08-21):
validate every record against the entity-type enum before any write; save
through the existing `saveEntity` path (which already handles the OC
full-replace-tags trap), threading the preflight's resolved existence —
including each existing entity's `memory_id` — into every write:
overwrites go **update-by-id** and creates skip the dedupe search
entirely, because `saveEntity`'s own bounded search
(`SAVE_DEDUPE_SEARCH_TOPK`) can miss in exactly the bulk regime import
creates, and a miss on the overwrite path would mint a silent duplicate
that makes the story's next export permanently un-importable; `dry_run`
previews the
full per-entity plan without writing; `on_conflict: "skip" | "overwrite"
| "error"` (default `error` — nothing is silently clobbered) governs
collisions with existing entities. Preflight is **all-or-nothing**: one
complete `listAllEntities` enumeration detects conflicts and in-batch
duplicates up front, and any duplicate — or any conflict under `error` —
aborts the whole batch with nothing written, the manifest still
reporting every record's would-be status (a half-imported story is worse
than a rejected call). Under `skip`/`overwrite`, a mid-batch write
failure is recorded per-record and never aborts the walk (the
`revalidateScenes` convention). Records may carry `created_at`, which
backdates on create via OC's own `memory_save` support — round-trip
timestamp restoration, protecting RECENT SCENES recency from re-imported
legacy scenes. A file's embedded `kindroid_target` is reported in the
manifest but **never applied** — binding a story to an account's targets
is an explicit `mnemo_story_use` decision, not an import side effect.
The entities-vs-file mutual exclusivity is enforced in the handler, not
the schema (MCP `inputSchema` silently drops object-level refinements).
Writes are sequential (OC rate-limit convention); the response carries
`duration_ms`.

### Mapping playbook + seed templates (build third — docs, not code)

**Shipped 2026-08-21.** The operational copies are the authoritative
ones — this section records only what they are and why:

- **[IMPORT_PLAYBOOK.md](IMPORT_PLAYBOOK.md)**: the hard-won
  classification rules for the host LLM — folder names lie, composite
  files split, the type-mapping table, the do-not-import list (canon
  tracking directives, raw transcripts, host plumbing), scene caution +
  backdating, verbatim-content hygiene.
- **[SEED_TEMPLATES.md](SEED_TEMPLATES.md)**: the four v1 seed-shaped
  schemas (kickoff/meta, character, style guide, rules) adapted to
  mnemosyne's prose-entity model, carrying forward v1's
  `{{PLACEHOLDER}}` fill-or-drop convention, the recurring
  character-profile shape, and named addressable clauses — with
  deliberately minimal required floors (the research showed elaborate
  specs decay unfilled).

Seeding a new story is a conversation, not a tool: the host interviews
the user against a template, then `mnemo_story_use(create_if_missing)` +
one `mnemo_import_story` call.

## Operator decisions (2026-08-21)

- **Curated import, not wholesale.** The four ChatGPT projects get
  hand-picked in conversation, per the operator's own Memory Governance
  rule. Raw transcripts and tracking directives don't come over.
- **Kindroid binding ships in exports** (schema above, with the
  account-specificity caveat).
- **`mnemo_seed_from_template` is retired as a planned tool.** The name
  described a system that never existed (v1's pipeline was structurally an
  importer — `source_path` was mandatory). Templates are documents.
- **`mnemo_continue`'s auto-save stays.** The ChatGPT-era governance rule
  informs *bulk import* semantics (preview, explicit conflict handling) —
  it does not reopen the locked v0 auto-save decision.

## Future direction (recorded 2026-08-21; projection design added 2026-08-29)

The operator's stated vision: each story carries **per-character provider
bindings** — a Kindroid kin or Botify bot per character — with a group
chat for storylines. Today a story binds one Kindroid target total
(`KindroidTarget` on the marker, schema 3). Per-character bindings would
be a marker/entity schema evolution plus generator-routing work, and they
are why the export schema is versioned from day one: a future
`mnemosyne_export: 2` can add a per-character `bindings` field without
migrating v1 documents. Do not build ahead of need; recorded so the
schema isn't designed into a corner.

The provider-neutral character/voice projection, observed-snapshot, and
reviewed-apply boundary is now proposed in
[COMPANION_PROFILE_DESIGN.md](COMPANION_PROFILE_DESIGN.md). That proposal does
not settle or implement per-character bindings, marker/export schema changes,
generator routing, storage location, or automatic synchronization.

## Rejected alternatives

- **Server-side classification pipeline** (v1/v2's shape): no viable
  engine on this stack, and two dead predecessors.
- **Server-side `source_dir` walking**: smuggles the failed pipeline back
  in (walk/split/classify), and dies when HTTP transport arrives. The
  stdio era makes it *possible*, not *right* — per-entity content in the
  call is small once transcripts are excluded, and import is curated
  anyway.
- **A `mnemo_seed_from_template` server tool**: nothing left for it to do
  once templates are documents and import is a batch writer.
- **Preview/confirm as a server-side safety gate**: per this fleet's own
  MCP-authoring rule, a confirm flag is advisory against an autonomous
  agent — real human-in-the-loop lives in the host conversation. `dry_run`
  and `on_conflict` are audit/slip-defense, not prevention, and are
  documented as such.
