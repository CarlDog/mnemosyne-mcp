# Status

**Last updated:** 2026-09-02.

**BattleChasers scene recovery (2026-09-02).** On operator instruction, the
Chapter One scenes drafted in the BattleChasers ChatGPT project were cut into
nine per-scene files under `data/stories/battlechasers/drafts/scenes/` as
overlay `add` operations (draft banner after the frontmatter; 80 manifest
entries; PASS.md re-sealed), with their README, catalog, index, source
inventory, superseded drafts (`_alternates/`), and the operator-pasted
configuration documents (`_source-documents/`) under `drafts/_control/scenes/`.
The source is the two ChatGPT share links the operator supplied, saved verbatim
(HTML, decoded JSON, rendered transcript) under
`data/stories/battlechasers/exports/raw-chatgpt-shares/`: "Adventure Begins
Unnoticed" holds every scene; "Configuration File Review" holds region
build-outs and the Canon Tracking Directive but no scenes. A ChatGPT project
chat is a drafting session, not play, so the cut rule differs from the Botify
stories: each scene file is the draft the operator locked or moved past (header
to last prose line, assistant framing and chat offers stripped), the eighteen
earlier drafts are kept as superseded alternates with the operator critique
that sank each, and the pasted style-guide and directive versions are archived
as source documents. Keys are `BTC-C01-nn-LOC` in acceptance order; the source's
own numbering (One to Four, an unnumbered Lilith scene, Five to Eight) is kept
as flags. Prose keeps the played names (Thorne Vex, Spark); the mapping to
Hodrek Sootbraid and Fenna "Spark" Darrin, Thorne's thread jumping from Western
Veyra to the Frostfell Fringe with no travel, and the superseded drafts' "Day
17" against Karl's "Thessalune 7" are carried as review flags, not resolved.
Only the Reach Below has a canon location record; the other eight places are
new. `verify-draft-overlay.mjs battlechasers` passes: 143 active and 152 merged
entities, active canon hashes unchanged, writes=0. Nothing was promoted or
imported; `data/` is gitignored, so this entry is the only git record.

**Shadowflame scene recovery (2026-09-02).** On operator instruction, the
played Shadowflame arc was cut into 59 per-scene files under
`data/stories/shadowflame/drafts/scenes/` as overlay `add` operations (draft
banner after the frontmatter; 99 manifest entries; PASS.md re-sealed), with
their catalog, indexes, source inventory, media index, and `_alternates/` under
`drafts/_control/scenes/`. The operator pointed at the `lilith` bot's
five-message greeting chat, which holds no story; the source used is the Dark
Queen Lilith private chat named by `SOURCE_PROVENANCE.md`, now archived at
`data/botify-exports/dark-queen-lilith/chats/` (1,678 messages, played January,
June, and September 2025). Keys are `SF-D0n-bb-LOC` over six story days; the
same invented delineators apply (new scene at a change of place, time, or cast;
contiguous ranges so all 157 deleted messages land in alternates). Prose keeps
the played names (Rosemary, Isolde, Briar Rose Blackwood, Seraphina Thorne,
Blackwood Manor); the mapping to Helena Marlowe, Cecily Fairfax, Beatrice
Ravenscroft, Vivienne Harcourt, and Ravenscroft Manor is carried in
`participants` and review flags, alongside the other source-versus-canon
differences (the explosion is Lilith's own blast, the test subject is called a
girl, no debutante ages, the bot naming Karl "Carl Yeager"). The operator's
role shifts mid-transcript from playing Karl to directing Lilith and the
thralls, recorded per scene. Twenty-eight scenes are flagged mature and one
non-consent. `verify-draft-overlay.mjs shadowflame` passes: 69 active and 133
merged entities, active canon hashes unchanged, writes=0. The Blackwood
catalog's registry links were repointed after that folder's move. Nothing was
promoted or imported; `data/` is gitignored, so this entry is the only git
record.

**Recovered scenes moved into the draft overlays (2026-09-02).** On operator
decision, the recovered scene files for Chaos Saga (256 `CS-*` files) and The
Blackwood Case (50 `BC-*` files) moved from each story's `canon/scenes/` into
`drafts/scenes/` as overlay `add` operations, because they need review before
they are locked in as canon. Each file gained the draft banner after its
frontmatter; content hashes still cover the body alone. Their indexes,
catalogs, source inventories, media index, and `_alternates/` moved to
`drafts/_control/scenes/`. Chaos Saga's three export-established scenes and
its scene-folder documentation stay in `canon/scenes/`; The Blackwood Case no
longer has a `canon/scenes/` folder. Both overlays were rehashed and re-sealed
(Chaos Saga 316 manifest entries, 65 active and 329 merged; The Blackwood Case
110 entries, 101 active and 155 merged); both verifiers pass with active canon
hashes unchanged and writes=0. Nothing was promoted or imported. The two entries
below describe the extractions and should be read with this relocation.

**The Blackwood Case scene recovery (2026-09-02).** On operator instruction,
the played investigation was cut into per-scene files under
`data/stories/miskatonic-archives-the-blackwood-case/canon/scenes/` for later
storybook or graphic-novel rendering. The source is not a ChatGPT raw archive
but the operator's Botify private chat with the GhostHunters bot, exported to
`data/botify-exports/the-ghosthunters/chats/` (1,882 messages, the same
transcript `lore/the-blackwood-case.md` was derived from; the 200-message
"GhostHunters" group chat is a separate side story and was not used). Botify
exports carry no scene headers, so the boundaries are invented delineators
agreed with the operator: a new scene where the story changes place, jumps in
time, or the cast changes, never at a play-session gap. Fifty scenes carry
keys `BC-D0n-bb-LOC` (case day as anchor, location registry in `_catalog.md`),
verbatim prose with bare `Continue` turns dropped, real Botify timestamps,
exact message-index ranges and IDs, listed operator turns, auto-derived
participants, review flags for every source-versus-canon difference
(Millfield/Yeager, coffee shop versus Ex Libris, muscle car versus Reaper,
victim ages, the year-later library beat that canon already supersedes), and
the bot's attached images (`_media-index.md`, 78 images with decoded prompts).
All 129 regenerated branches live in `canon/scenes/_alternates/`. `validate-canon`
reports 151 entities; the overlay still verifies with manifest and hashes
unchanged (merged preflight 155), and PASS.md gained an active-canon note.
Nothing was promoted or imported; `data/` is gitignored, so this entry is the
only git record.

**Chaos Saga source-document validation (2026-09-02).** The operator's
ChatGPT share chats were mined for the project documents behind the drafts.
The Timeline and Story Beats logs turned out never to exist as content: the
chats hold only the Canon Tracking Directive that defines them (six
revisions, now saved verbatim under
`data/stories/chaos-saga/drafts/_control/source-documents/` with the earlier
share-chat versions of the character profiles and Key Locations). Every
profile, location, tattoo, and group-chat document was then checked fact by
fact against the drafts; the report is
`drafts/_control/SOURCE_VALIDATION_2026-09-02.md`. Four absent facts were
folded into the drafts (Jenna's Minneapolis, Cassie's "Big Daddy", Nyx's
protest-camp childhood and sponsorship at seventeen, Kira's two remaining
tattoo placements) and two source conflicts were ruled and recorded in the
entities themselves: Carl's motorcycle is the 1942 Indian Scout 741B, and
Jenna's hair follows the reference art. The entry hall and deck stay folded
into existing location records by design. The overlay was rehashed and
re-sealed twice; the verifier is green with counts unchanged. Nothing was
promoted.

**Chaos Saga scene recovery complete (2026-09-01/02).** On operator
instruction, every scene in the original ChatGPT raw archive (`Chaos Saga
1-4.txt`, hashes matching the 2026-08-29 source inventory) and in the
operator's "Homecoming Fatigue" share chat was extracted verbatim to its own
file under `data/stories/chaos-saga/canon/scenes/`, for later rendering in
storybook or graphic-novel form. Canon now holds 259 scene files (256
recovered plus the three original export scenes): Raw 1 and Raw 2 were cut to
full line coverage, Raw 3 and Raw 4 contributed their reviewed spans, and the
share chat's own locked export blocks supplied fourteen scenes for pivotal
events 34 and 35 with native `CH-048`–`CH-057` IDs. Each file carries a
catalog key, timeline anchor, location code, auto-derived participants,
review flags, and source line/hash provenance; `_index.md` lists them all.
Non-canon prose (style samples, superseded drafts, interactive play, replay
variants, one explicitly non-canon karaoke scene; 80 files) lives in
`canon/scenes/_alternates/`, an underscore folder the validator and compiler
skip. `validate-canon` reports 321 entities; the Chaos Saga overlay still
verifies (merged preflight 329, manifest unchanged). Open for operator review:
one `review` scene (the May 10 morning, played but never exported), the
timeline numbering of events 34/35 against their in-world dates, long-unit
split boundaries, and heuristic location codes on Recovery Days 1–23. The
seven share links are exported to `exports/raw-chatgpt-shares/`; "Breakfast &
Bruises" there proved to be a style-guide header example, not a scene.
Nothing was promoted or imported; `data/` is gitignored, so this entry is the
only git record.

**Draft review pass, re-seals, prequel ratifications, and a Wonderland overlay
(2026-09-01).** Every story's `drafts/` tree was read file by file and reviewed
critically. Small prose corrections landed in BattleChasers (regions index now
places Ironthrone under Kharag Dûm; the Flamewatch encounter entry is Streyhold's;
Lilith's profile-established encounters with both parties were added to the
geometry ledger; four wording fixes), Brass & Nerve (the Mercury Lattice sheath
is gutta-percha, a deliberate visual-anchor change; one hook line demoted to
match r2), Chaos Saga ("Trouble" is Riley's nickname only; Montana Highway
Patrol), The Adjustment Protocol (one wording fix), The Blackwood Case (Reaper
is a 1995 Defender 90), and The Noctis Veil (the Saint Lucia window hook refers
to the college's old photographs, not Lucia's childhood). Each affected overlay
manifest was rehashed on operator instruction and its PASS.md gained a dated
re-seal note; all six pass `verify-draft-overlay.mjs` again with counts and
active-canon hashes unchanged. The two Miskatonic prequel packages were built
out at the core level (named cast, named places, plot spine and ending) and
recorded in each `_control/DECISIONS.md`; the operator ratified October 1719 and
the Kettle inlet for The Black-Salt Compact and the earlier-run (October 1881)
fork for The Last Eastbound Run, with the remaining choices pending. Wonderland,
which already held a curated 76-entity canon with full reference families,
gained its first review-gated overlay, `wonderland-living-canon-r10-2026-09-01`:
35 operations (30 replacements, 3 additions, 2 removals) migrating the Keyblade
and Vorpal Blade to `lore`, adding a current-arc hook ledger and numeric art
anchors, and converting every visual pointer to the repo-relative form the
verifier requires; it verifies at 77 merged entities with zero writes. Nine
overlays now retain PASS evidence. Nothing was promoted or imported.

**Story setting and storyline renamed (2026-09-01).** The former
**GhostHunters** package is now **The Miskatonic Archives: The Blackwood Case**:
**The Miskatonic Archives** is the shared-world setting, **The Blackwood Case**
is the active present-day storyline, and **The GhostHunters** remains the
in-world investigative team. The filesystem root is
`data/stories/miskatonic-archives-the-blackwood-case/`; display-only leading
**The** is omitted from qualified setting filenames and folders. Historical
exports and the sealed revision-11 identifier retain their original
`ghosthunters-` names as provenance. The Black-Salt Compact and The Last
Eastbound Run remain draft-only packages; their thin seed notes and separate
scaffolds contain no canon/ or story.json, and neither was promoted to canon.
The live OpenChronicle project and Mnemosyne marker were renamed in place, and
three existing style records received title-only wording updates. No story
entity was added, deleted, imported, or promoted. Both affected review-overlay
manifests were rehashed and passed their full merged-tree checks.

**Historical prequel scaffolds added (2026-09-01).** The Black-Salt Compact and
The Last Eastbound Run now each have a separate draft-only package with control
metadata plus thin characters, locations, lore, worldbuilding, rules, and style
scaffolds. Their original seed notes remain under The Blackwood Case's control
folder. Neither package has canon/ or story.json, neither is active context,
and no OpenChronicle story record was created.

Historical entries below retain GhostHunters when they describe source-era
records, imports, commits, or decisions; the current storyline name is The
Blackwood Case within The Miskatonic Archives.

**Dependency baseline upgrade merged (2026-08-31).** PR #23 merged to `main` as
`1e07bc8`, bringing Express 5, Zod 4, TypeScript 6, and the fleet's Node 24/npm
11.19.0 baseline. Node declarations are held to major 24, and Dependabot will
defer future major `@types/node` updates until the runtime and CI floor advance
together. The full local gate is green: 418 passing / 64 intentionally skipped
tests, typecheck, server and Web UI build, root and Web UI lint, and Prettier.
GitHub passed Ubuntu, Windows, macOS, lint/format, Dependabot configuration, and
gitleaks before merge.

**Post-push CI follow-up closed (2026-08-31).** The architecture boundary
test now uses platform-neutral containment and exercises both Windows and
POSIX path dialects, fixing the Ubuntu/macOS-only failure. Dependabot now
defers only TypeScript 7 in both npm ecosystems while `typescript-eslint`
requires TypeScript `<6.1`; TypeScript 5/6 updates remain enabled. Local
verification is green at 418 passing / 64 intentionally skipped tests (482
total), plus typecheck, lint, and Prettier.

**Phase-end audit punch list closed (2026-08-31).** Application ports now use
application-owned structural models; the AST guard resolves relative paths and
rejects bare packages plus unapproved outer modules for runtime and type-only
imports. Duplicate story/entity catalog projections were consolidated into
application policy. Prompt rendering, scene-context selection, and Ollama
request policy were extracted from mixed large modules. README/CLAUDE counts
and setup guidance are current, the stale confidence badge is gone, and the Web
UI runs ESLint 10 with zero warnings. Node 24 and npm 11.19.0 are declared via
`.nvmrc`, `engines`, and `packageManager`; clean installs use `npm ci`.

**Hexagonal architecture milestone complete (2026-08-31).** MCP tools and REST
routes are independent inbound drivers over one composition-root-built
`ApplicationUseCases` contract. Continuation, validation, scene revalidation,
and story/entity catalogs depend on application-owned outbound ports and pure
application policy; concrete OpenChronicle, model-provider, persistence,
environment, clock, and logging behavior lives under `src/adapters/` and is
constructed only in `src/index.ts`. Compatibility re-exports used during the
migration are removed. The architecture guard parses TypeScript ASTs to enforce
driver independence, port routing, and composition-root ownership. Repository
verification is green at 418 passing / 64 intentionally env-gated skipped tests
(482 total), plus typecheck, lint, Prettier, and the production server/Web UI
build.

**Story-authoring checkpoint (2026-08-30): eight review-gated Living Canon
overlays are complete.** BattleChasers has 71 operations → 143 entities; Brass
& Nerve 20 → 43; Chaos Saga 60 → 73; The Miskatonic Archives: The Blackwood
Case (formerly GhostHunters) 60 → 105; Midnight Is a Suggestion 41 → 70;
Shadowflame 40 → 74; The Adjustment Protocol 19 → 41;
and The Noctis Veil 13 → 39. Each retains source/asset/scorecard/PASS evidence,
adversarial closure at P0=0/P1=0, and a zero-write import preflight. None was
promoted or imported, all active canon trees remained hash-stable, and
promotion remains an explicit operator decision. The scaffold also preserves
the export entity key as character identity so a display/current `Name:` field
cannot silently create a duplicate runtime character. Repository verification
was green at 399 passing / 64 skipped tests (463 total) at that historical checkpoint.
The Miskatonic Archives also has a control-only Dovecoast-linked historical
storyline seed bank covering a Golden Age of Piracy story (1650–1730) and a
geographically western, Dovecoast-linked Old West story (1865–1895). The ideas
establish no past event or mystery answer.

**Session close (2026-08-30).** Nothing is in flight. The Living Canon overlays
remain inert at their explicit operator-approval boundaries, the Miskatonic
Archives historical-storyline ideas remain control-only seeds, and no active
canon or live OC state changed. New work starts only on an explicit
promotion/rejection decision or a new operator-selected story task; the
enrichment benchmark remains gated on operator-labeled fixtures.

**Previous engineering checkpoint (2026-08-28→29): the external-system research
program is fully executed.** One continuous 2026-08-28→29 arc took the four adoption
assessments from "validate these docs" to done: the claimed decision queue
enumerated as a real artifact
([docs/RESEARCH_DECISION_QUEUE.md](docs/RESEARCH_DECISION_QUEUE.md)) and
the shipped items verified against their own acceptance proofs; **every
remaining P0/P1/P2 and mechanical item shipped** (completion integrity
across all providers, validator locality, schema-validated verdicts,
sibling-MCP contract validation + bounded tool discovery, semantic
readiness at `GET /api/status`, privacy-safe logging + final-sink
redaction, usage telemetry, typed Ollama errors + configurable timeout,
endpoint hygiene); the four design-heavy candidates written up,
**adversarially reviewed (28 confirmed findings folded in), ratified with
their measurement gates run first, and fully built** — run
outcomes/cancellation, generator capabilities, ContextPlan with stable
per-model `num_ctx` + reject-don't-truncate, and retrieval controls with
flag-off enrichment. The verification baseline is **340 passing and 64
skipped tests (404 total)**, typecheck/lint/prettier green, CI green at
every pushed head.

**Session close (2026-08-29).** Nothing is in flight. The actionable queue
is empty; what remains is gated: the **enrichment benchmark needs
operator-labeled fixtures** (expected/exited entities per direction
against the five consolidated stories — the one concrete operator ask;
`MNEMO_QUERY_ENRICHMENT` stays off until its win is recorded), the Ollama
builder/parser extraction is a pure refactor with no behavior gap, the
parked/rejected items keep their documented triggers, and the one known
red is the pre-existing live `continue.test.ts` case (OC-side embedding
lag for freshly saved memories, reproduced at the pre-session baseline
and filed as `mcp-feedback` in openchronicle-mcp's OC project — an
OC-side diagnosis, not a mnemosyne defect).

**Previous engineering checkpoint (2026-08-28): the Atlas capability runner is
hardened and L0-L3 evidence is on record.** Five real defects were found and
fixed by running it — an unbounded subprocess wait, a summary that hid schema
failures, generated media written into the repo against the runner's own
no-raw-output contract, a `--media-model-limit` that took a prefix instead of
sampling both media types, and a job-count "budget" that bounds nothing when
unit prices span 22x. Evidence for every level is in
[the dated results doc](docs/ATLAS_CAPABILITY_RESULTS_2026-08-28.md). Routing
state is unchanged: no Atlas model is certified mature/NSFW-capable.

**Previous engineering checkpoint (2026-08-27): the
scene-context/continue feature series passed an adversarial review, all 11
confirmed findings are remediated, and CI's Test workflow is green again** —
the long-red `lint + format`
job was unformatted files (prettier `--check`), fixed in
`711dcbd..f94a355` along with excluding the `vendor/` submodule from
local eslint/prettier runs; verified against the actual runs at
`f8f8c5a`/`f94a355`. An 8-angle review of `fa90ba2..HEAD` (scene-context
strategies with fallback, the REST continue surface + web-UI continue
flow, Ollama warmup/keep-alive) confirmed 10 findings, and the fix work
surfaced an 11th: `keep_alive` sat inside the Ollama request's `options`
object where Ollama silently ignores it (live-verified — it belongs
top-level), so the entire keep-alive feature had been inert. Remediation
landed as 13 commits (`60051cd..f709be0`): empty-string enum env vars now
read as unset instead of crash-looping startup; the revalidate API
route's zod `.default()` no longer discards the server-configured
strategy; a single `resolveSceneContextStrategies()` makes the documented
"per-call primary override ⇒ no inherited fallback" contract true on
every surface; the kin+group conflict maps to a 400; warmup preloads at
the real configured num_ctx (a 4096-floor warmup just forced a reload on
the first big-story call) and runs HTTP-mode-only by default
(`MNEMO_WARMUP=true` opts stdio in); the web UI no longer crashes on the
group-yield response and defaults to the server's strategy instead of
silently overriding it. Efficiency: validation contexts gather only the
four types the validator actually reads — the scene/lore/worldbuilding
pulls (including revalidate's up-to-100× full-project re-fetch) were
discarded work, so `mnemo_validate`/`mnemo_revalidate_scenes` and their
API routes lost their scene-strategy params outright (operator-approved:
with no scene pull they were knobs controlling nothing) — and the
recency-first scene pool switched to a compact scan-then-hydrate two-hop
(tags+created_at rows, then `memory_get` on ≤5 winners) instead of
transferring every entity body in the project per continue. Structure:
`continueScene()` extracted so the MCP tool and REST route share one
continue core (the route was a drifting ~170-line copy); shared
`requireStory()`/`parseOr400()` API helpers; query-ranked regained the
clean-over-untagged scene preference the refactor had silently dropped.
An OC dogfooding note was filed (memory_list lacks a tags filter,
memory_search lacks order_by — the reason the two-hop exists). Verified:
192 unit tests + 32 live-OC integration tests green, webui builds, dump
scripts smoke-tested against real OC including the empty/invalid env
cases. Earlier (2026-08-27): (**Wonderland is the fifth story fully
consolidated onto the canon/ authoring layer — and the last of the five
original curated-import stories.** 76 entities (10 core characters — every
named character was rich enough to classify core, no batched `_minor.md` —
12 locations, 12 lore, 12 worldbuilding, 9 rules, 21 style headings),
scaffolded from `wonderland-visual-references-2026-08-25.json`. A second
real `scaffold-story.mjs` bug surfaced and was fixed: a rule/style entity
whose own content contains internal `##` sub-headings (two of Wonderland's
own — "Core Narrative Tone," "Evidence & Competing Explanations") was
pushed into `rules.md`/`style.md` without demotion — the same collision
already handled for `_minor.md`'s batched minor characters, but never
extended to rules/style. Fixed by applying the existing `demoteHeadings()`
helper there too; regression-checking the other four stories then found the
identical bug already live in Chaos Saga's `rules.md` and GhostHunters'
`style.md` — both fixed by hand in the published canon/ trees (Chaos Saga
64→62 entities, GhostHunters 105→101, both re-validated clean). Wonderland's
ChatGPT-project source turned out unusually thin — just Project
Instructions + Style Guide, no character/location profile files at all —
so the real character depth actually came from a Botify bot, "Alice Grimm"
(bot 3197891), found only via a private chat-list search since the public
bot catalog returned nothing. A 10-agent extraction/compare workflow
against its ~24,000-line export hit the worst intermittent file-read
failure rate seen yet (only 2 of 6 chunks succeeded); compensated with
direct grep verification ("Marywraithe"/"Frabjous") and manual reads of
the bot's opening scene and the White Queen's-assault climax, finding no
gaps beyond what the two working chunks already surfaced. Six real
divergences were found, and in every case but one the operator ruled to
keep canon's version over the source's more-explicit one — a consistent
"protect the mystery, keep the asymmetry" pattern: the Wrong-Song Child
stays unnamed under the Mystery Entity Clause, the mechanical lantern
stays unexplained, the Vorpal Blade stays silent/masterless (unlike
Alice's bonded, speaking Keyblade), the Market Below's location stays
unresolved, and the mill keeps its one mysterious journal over the
source's multi-volume authored answer. The one blend: cinnamon-roll-
scented mushrooms layered onto canon's existing morel-like visual. Real
narrative-color gaps were folded in (Alice's pre-Wonderland childhood
memories, a Carl survival-promise exchange referencing unnamed dead
"others," a washbasin-as-a-joke-hat moment), while one source-grounded
gap — Carl's hunting background — was deliberately skipped because his
own file already cautions against inventing unestablished civilian-life
specifics. `validate-canon.mjs` reports 76/76 clean, no cross-story leaks;
alice-grimm.md was the only file needing cosmetic heading de-colonization.
**All five original curated-import stories are now fully consolidated onto
canon/; only Star Wars: The Black Ledger remains — a different shape
entirely (no ChatGPT-project origin, already partially live via Botify, an
ongoing story rather than a completed-arc consolidation).** Full writeup
in the dated Done entry below.) Earlier (2026-08-27): (**Shadowflame is the
fourth story fully consolidated onto the canon/ authoring layer — and the
cleanest by a wide margin.** Unlike the other three, it has no ChatGPT-project origin at all;
it came entirely from a Botify bot ("Dark Queen Lilith"), which an earlier
session had flagged with a real unresolved risk — the source's founding
thrall is named "Briar Rose Blackwood," recruited at a "Blackwood
Debutante Ball," the same family surname GhostHunters' entire central
mystery is built around. Pulling the full ~3,900-message source chat and
running a 12-agent extraction/compare workflow confirmed this was already
thoroughly handled by an earlier pass: every thrall is accounted for
under a deliberately renamed identity (documented explicitly in
`lore/open-questions.md`), and "Blackwood" appears exactly once in all of
canon — inside the note explaining the rename. The Lilith/Karl
BattleChasers continuity held up to direct scrutiny too: the relic's
three-name lineage across centuries (Heart of Vehl'Remar → Amulet of
Eternal Night → Shadowflame Heart) is coherent, not drift. One narrow,
deliberate divergence from the source was found and kept (the Heart's
tone — silent/stabilizing in canon vs. one Botify telling's "cursed
burden"). A real scaffold-story.mjs bug surfaced along the way — a
diacritic in "Karl von Jäger" produced a mangled filename — fixed via
NFD-normalization, which also caught the same latent bug already live in
BattleChasers' published canon (`Kharag-dûm`). Full writeup in the dated
Done entry below.) Earlier (2026-08-27): (**GhostHunters is the third story fully
consolidated onto the canon/ authoring layer.** The cleanest of the three
so far — a 4-agent completeness sweep against the original ChatGPT source
found almost everything already present verbatim. Real gaps were narrow:
a second, richer "Interpersonal Dynamics" list for Carl's corgi Max that
never made it into `_minor.md`; the group-chat messaging system itself
(message format, multimedia cues, timestamp logic, hashtags, escalation
rules) — but NOT the per-character availability schedule, which turned
out to already be correctly migrated into each character's own file, so
the new `worldbuilding/group-chat.md` cross-references rather than
duplicates it; the Chapter Lock Trigger Clause (chapter breaks are never
automated); and one judgment call, decided unilaterally — sensory/craft
guidance for writing physical intimacy, re-framed as durable craft advice
independent of the explicit/implicit rating question rather than restored
as a censorship-era relic. Same content-rating liberalization pattern
confirmed again across all three stories now (PG-13/implication-only →
Mature/hard-R explicit, self-censoring "reshape at platform boundary" →
transparent SFW/NSFW routing). `validate-canon.mjs` reports 105/105
clean, no cross-story leaks, no cosmetic polish needed. Full writeup in
the dated Done entry below.) Earlier (2026-08-27): (**Chaos Saga is the second story fully
consolidated onto the canon/ authoring layer.** A 7-agent completeness
sweep against every original ChatGPT source file found no missing
characters or locations, but did surface real detail-level gaps — 4
missing locations, 3 missing mechanical/procedural rules, missing
group-chat output conventions, ~10 narrative-color anecdotes compressed
out of an earlier pass, and one real internal contradiction between
`rules.md` and `style.md` on whether intimate-scene aftermath can be
neutral. All restored/resolved per operator direction; `validate-canon.mjs`
reports 62/62 clean, no cross-story leaks. The scaffold script's header/
body splitter was fixed along the way to handle Chaos Saga's flat
`Label:`-only template (no Markdown headings at all, unlike
BattleChasers) — regression-testing that fix against BattleChasers also
caught a real latent bug that had silently dropped three characters'
`Voice` content, now restored. Full writeup in the dated Done entry
below.) Earlier (2026-08-26): (**The canon/ authoring-layer standard is
built, and BattleChasers is the first story fully consolidated onto it.**
`data/stories/<slug>/canon/` (documented in a new "Canon" section of
[docs/DATA_LAYOUT.md](docs/DATA_LAYOUT.md)) replaces the single-JSON-export
workflow as the permanent, human-editable source of a story's content —
one Markdown file per character/location/lore/worldbuilding entity, shared
`rules.md`/`style.md`, YAML frontmatter for structured fields — with OC
staying canonical for *live* story state the same way it always has (canon/
is closer to source code; OC is the running deployment). `exports/` is
narrowed back to plain server-written `<slug>-<stamp>.json` files, with a
new `exports/archive/` for pre-reorg history. Two new scripts do the
migration: `scripts/scaffold-story.mjs` (export JSON → canon/, including a
generic suffix-append merge for sibling revision forks sharing a parent
revision) and `scripts/validate-canon.mjs` (structural check: frontmatter
parses, no duplicate `(type, name)` entities, no empty bodies) — both
iterated hard against BattleChasers' real export history and hardened
against real bugs found along the way (a `--merge` delimiter that collided
with Windows drive letters, silent data loss on unparsed header lines, a
merge-report display bug on multi-word names, YAML leading-hyphen
ambiguity, stray literal NULL bytes, and heading-level ambiguity inside the
batched minor-character file). BattleChasers is now the first story fully
migrated: 143 entities, verified complete against both its own export
lineage and the original ChatGPT source (2 small rule-clause gaps found and
restored), a Shadowflame truth-tier leak fixed (Lilith/Karl are the same
people centuries apart — BattleChasers-era canon can't assert facts only
true in Shadowflame, e.g. the Heart of Vehl'Remar's full nature), and a
cosmetic/structural polish pass (heading de-colonization, Status+Location
merged into one section) — `validate-canon.mjs` reports it clean. Chaos
Saga is next in the pipeline; a dry-run scaffold surfaced a real script gap
still to fix — unlike BattleChasers, Chaos Saga's original character
template has no Markdown headings at all (flat `Label:` lines end to end,
including multi-paragraph sections like Backstory), so the header/body
splitter needs a Chaos-Saga-aware fix before real extraction. Nothing in
`canon/` has been imported to live OC — it's local-only and gitignored,
per the operator's standing "commit nothing to canon yet" instruction
until a storyline is deliberately locked in. Full writeup in the dated
Done entry below.) Earlier (2026-08-25): (**The Living Canon Standard is
ratified, and story references moved to per-entity folders.**
[docs/LIVING_CANON_STANDARD.md](docs/LIVING_CANON_STANDARD.md) (ratified
2026-08-24) is now the editorial quality contract for curated story
references and export derivatives — proportional character depth,
playable locations, material objects, relationship/knowledge geometry,
hook ecology, truth tiers, current-state extraction, provenance, and
mature-content/routing separation.
[docs/DATA_LAYOUT.md](docs/DATA_LAYOUT.md)'s `references/` convention
moved the same window from flat `<slug>.jpg` files to one folder per
entity (`references/<type>/<slug>/<variant>.png` + sidecar), added an
`objects/` category alongside `characters/`/`locations/`, and expanded
the JSON sidecar schema (`asset_role`, `review_status`,
`provenance_status`, `prompt_capture`); the legacy flat layout is
retired. Also this window: the deferred Atlas Cloud MCP-client design
(`atlascloud-client.ts`, under "What's next") was corrected — the
atlascloud-mcp NAS deployment it targeted was decommissioned
2026-08-25 and the matching dead `.mcp.json` entry removed, so that
design needs a live redeploy or a stdio redesign before it's
actionable (the real `atlascloud` generator provider is unaffected —
it talks to the Atlas Cloud REST API directly and was never routed
through atlascloud-mcp); and
[vendor/atlascloud-cli](vendor/atlascloud-cli) was added as a git
submodule (credit: AtlasCloudAI) for manual shell-side
balance/model/connectivity checks, unused by the generator provider.
Two post-v0 engine-primitive needs were also filed under "What's next"
with no design started: an in-story clock/calendar plus a real RNG for
procedural rolls, and an origin-anchored space+time position
coordinate per story (a story epoch + elapsed time, inspired by a
Stargate gate-address framing — six symbols locate a destination, but
the connection only resolves relative to the seventh, the point of
origin).) Earlier (2026-08-23): **The web UI exists.** WEBUI_NOTES §9 slice 1
(entity library, read-only) shipped end to end — a new `/api/*` REST layer
(`src/api/`, thin adapters over the same domain functions the MCP tools
already wrap) and a real React 19 + Vite SPA (`webui/`, its own package),
built and served by the same Express app slice 0 added. Design direction
"The Archivist's Desk" extends the Chaos Saga reader artifact's palette
into a card-catalog aesthetic. Verified twice over: 220 automated tests
passing (up from 193), and a real browser walkthrough against real
production data (Chaos Saga's 41 entities, all filter counts exact, zero
console errors). One real npm footgun found and fixed along the way:
`npm --prefix webui install` run from the root's CWD silently injects a
self-referencing `file:..` dependency into `webui/package.json` — fixed by
using an actual `cd` instead of `--prefix`. Full writeup in the dated Done
entry below. Earlier, same day — **`mnemo_list_entities` shipped — slice 1's
complete-listing primitive is now a real tool, not just internal
plumbing.** Generalizes the existing (export-only) `listAllEntities()`
into `mnemo_list_entities(type?, include_body?, story?)`: a complete,
unranked enumeration (nothing capped the way `mnemo_recall` is), body
stripped by default to keep a large story's browse response light. Live-
smoke-tested against real production data — Chaos Saga's real 41 entities
came back correctly. Full writeup in the dated Done entry below. Earlier,
same day — **Slice 0 shipped: HTTP transport + story-pointer override —
the exact prerequisite the pre-build review below called for.** `resolveStoryId()` generalizes `mnemo_export_story`'s
existing bypass pattern to all 9 story-touching tools (a per-call `story`
override, deliberately not session-scoped server state); a byte-verbatim
copy of kindroid-mcp's fleet-canonical `mountMcpHttp()` gives mnemosyne
real Streamable HTTP transport for the first time, with `src/index.ts`
mode-switching on `MCP_PORT` (unset = stdio, unchanged). Verified
end-to-end against the real compiled server, not just unit tests: `/health`
+ a real MCP initialize handshake in HTTP mode, and a confirmed
byte-for-byte-unchanged stdio boot. 193 tests passing with `OC_URL` set
(up from 144), including a new `http-integration.test.ts` proving two
concurrent sessions don't collide and the story override bypasses the
pointer over the actual wire. Full writeup in the dated Done entry below.
Earlier, same day — **WEBUI_NOTES.md got its first real review pass, and
the previous headline finding was that §9 has no slice 0.** A paired
senior-sde feasibility review and senior-ui-ux-designer critique (plus a
live browser survey of both reference apps and the real Chaos Saga reader
artifact from the import campaign) converged on the same conclusion: the
doc's build order assumes a foundation — HTTP transport, per-request story
scoping — that doesn't exist yet. New §0 names it; §3/§4's sections got
reality-checked against the actual code; the design critique added a
cold-start gap, a mode-switching layout fix, and two anti-patterns to avoid
on purpose. Full writeup below. Next: scope §0 as real engineering work,
per operator direction — see the dated Done entry for everything.) Earlier,
same day — **outgoing companion-chat messages now carry
a provenance header.** `companion-message.ts`'s `buildCompanionMessage()`
was bracketing the story-context block it prepends but sending the
direction itself, and the group-conversation nudge, bare — so an automated
`mnemo_continue` direction read as the operator typing directly in
Kindroid/Botify's own chat history. Every outgoing message now opens with
`[Mnemosyne — automated scene direction, not Carl typing]` (new
`MNEMO_USER_NAME` env var, default Carl, threaded through both
`KindroidProviderConfig` and `BotifyProviderConfig`). The wording is
researched, not guessed: a 4-agent workflow catalogued Kindroid's and AI
Dungeon's official docs plus Reddit community convention (2026-08-23) —
square brackets beat parens/OOC (AI Dungeon's own docs give the mechanism:
fiction-trained models read `[ ]` as "descriptive indicator, not story
text"; Kindroid's community independently reports brackets outperforming
parens), and the literal word "OOC" is deliberately dropped since heavy
`OOC:`-tagging is reported to train a Kin into echoing it back unprompted.
Framing is descriptive, not imperative — Kindroid's docs warn imperative
directives over-trigger. watch-companion's own `[Watch Companion — automated
... note, not Carl typing]` header already matched this shape exactly and
needed zero changes — it was the reference implementation the research
validated. Paired with a `prompt.ts` addition: every mode directive now
states the asterisk-for-action / plain-dialogue convention (Kindroid's own
documented Example Message format), so the five direct-LLM providers'
generated output stays visually consistent with the wider companion-chat
convention. Consistency is the point, not just style — the operator's own
framing: "when we run into problems, like a bot reacting poorly, it's
easier to isolate what caused it" if every generator formats the same way.
Botify's own OOC/bracket handling was confirmed the same day by a live
probe plus r/botify_ai community research (full detail in the dated
Done entry below) — a bracketed direction read as a scene event, not
Carl typing, and asterisk-for-action came back unprompted, though two
active regression threads mean Botify's own team was mid-fix on the
exact mechanism at the time. 5 new/updated tests (142/142 passing); a separate same-day
watch-companion timeout fix (`KINDROID_ENGAGEMENT_TIMEOUT_MS`, split from
`REQUEST_TIMEOUT_MS`) is documented in that repo's own STATUS.md.) Earlier,
same day — **the import campaign is complete — five
live stories, ~369 entities**. All four original ChatGPT projects are
imported and a fifth story, Shadowflame, was created from material
found in Botify. Chaos Saga 41, GhostHunters 94, BattleChasers 138,
Wonderland 54, Shadowflame 42. The night's biggest methodological
finding: the operator's Botify bots hold *primary canon* — authored
profile blocks and played story logs — so an empty `Profiles/` folder
on disk proves nothing. Wonderland's entire cast was in Botify while
its folders sat empty. Two long transcripts (1,882 and 1,513 messages)
were mined with 8-agent extraction workflows plus continuity critics,
which repeatedly earned their keep: one caught a cast brief leaking
surnames into "extracted" output that appear nowhere in 6,083 lines of
source, and another caught a ratified canon clause that the source
flatly refutes. Previous, same day — **repo-local `data/` directory,
organized by storyline**: operational state moved out of the OS config dir into
gitignored `<repo>/data` — `config.json` at the root plus one
`stories/<slug>/` subtree per storyline holding `exports/` backups and
`references/` assets, `MNEMO_DATA_DIR` override, Docker-mountable as
persistent storage. Legacy OS-config-dir `config.json` auto-migrates
(copy, not move) with fail-soft on a corrupt legacy file; the
pre-commit adversarial review caught both the corrupt-legacy wedge and
an untested default-export-path branch — fixed with regression tests.
Previous, 2026-08-22 — **first generated beat on imported
canon**: `mnemo_continue` against the freshly-imported Chaos Saga
produced "Home Ground" via the Anthropic provider — full 59KB context
(28 entities), style clauses and character voices honored, saved as
canon. The road there surfaced two findings: (1) `OllamaProvider`
never set `num_ctx` — now auto-sized per request to the actual prompt
(pure `computeNumCtx`, capped by new `OLLAMA_NUM_CTX`, warns when
capped below the estimate), making the context window deterministic
regardless of any install's defaults; (2) the desktop's local Ollama
(0.32.15, GPU) turned out to corrupt long-context inference OUTSIDE
mnemosyne's control — two model families produce word salad on prompts
past ~7-8k tokens while staying perfect below ~6k, with the full
window loaded and 100% GPU; bisected and confirmed install-level, not
prompt-level. Local-Ollama big-story use needs that install fixed
(update/reinstall, or try disabling flash attention) or `OLLAMA_URL`
pointed at the NAS; cloud providers are unaffected.) Earlier: **all
four cloud providers live-verified**
— the operator dropped real API keys into `.env` and the env-gated
suites lit up: Anthropic (`claude-sonnet-4-5`), OpenAI (`gpt-5.4-mini`),
Gemini (`gemini-3.6-flash`), and Atlas Cloud
(`deepseek-ai/deepseek-v4-flash`) each completed a real generation
round-trip. One live finding, and it validated a day-old design
decision within hours: Google has retired `gemini-2.5-flash` for new
users — the explicit-model-required posture surfaced it as a clean,
self-explanatory 404 naming the replacement rather than a silently
wrong baked-in default. The live test options also stopped sending
temperature/max_tokens, matching the pass-through posture. Botify
remains env-gated pending the operator picking a storytelling chat
UUID. Earlier (2026-08-21, late): **five new generator providers** — `botify` (MCP client to botify-mcp, the companion-chat
pattern shared with Kindroid via a new extracted
`companion-message.ts` builder), plus direct-API `anthropic`, `openai`,
`gemini`, and `atlascloud` (the OpenAI-compatible pair share one class;
`OPENAI_BASE_URL` makes any compatible host work; Atlas goes direct
rather than through atlascloud-mcp because its `atlas_chat` returns
markdown a machine caller can't safely parse). Cloud providers honor
the system-prompt + per-call model surface, with temperature/token caps
passed through only when set (several current-gen models — Claude Opus
4.7+, OpenAI's reasoning series — reject the fields outright, a
pre-commit adversarial-review catch); the validator stays on Ollama for
all, so `OLLAMA_VALIDATOR_MODEL` is now required for every non-ollama
generator. Live-verification is env-gated
per provider key — wire-format contracts are documented-shape until
keys are set. Earlier: import/export family complete: the
mapping playbook + seed templates shipped as docs —
[docs/IMPORT_PLAYBOOK.md](docs/IMPORT_PLAYBOOK.md) /
[docs/SEED_TEMPLATES.md](docs/SEED_TEMPLATES.md) — closing the design's
third build phase; all that remains is the actual curated imports of
the four ChatGPT projects; earlier same day: `mnemo_import_story`
shipped and live-verified — the export→import round-trip restores a
story into a fresh OC project with pin state, validation tags, and
backdated timestamps all intact; and `mnemo_export_story` shipped
and live-verified against real OC — versioned JSON export per
[docs/IMPORT_EXPORT_DESIGN.md](docs/IMPORT_EXPORT_DESIGN.md), the
interchange schema everything else in the import/export family builds
on; and that design ratified — derived from a three-source research
pass (the operator's original ChatGPT project folders, OC v1's archived
template system, OC v2's import pipeline) plus a two-reviewer
second-opinion pass; next up: the mapping playbook + seed templates as
docs, then the curated ChatGPT-project imports); earlier (2026-08-18):
Ollama transport-error messages now surface
their real cause — `OllamaProvider.generate()`'s catch built its message
from `err.message` only, which on a real `fetch()` failure is Node's generic
`TypeError: fetch failed`, discarding the actual DNS/connection/TLS reason
in `error.cause`; found via a fleet-wide sweep prompted by a live incident
in downloader-mcp; new exported `describeTransportError()` in `src/llm.ts`,
tested in `tests/llm-transport-error.test.ts`); earlier (2026-08-12)
(group-chat generator path live-verified against a real subscriber group, which surfaced a same-speaker-repeats problem; fixed via a per-message conversation nudge, then sharpened to point at Kindroid's documented `@Name` turn-handoff mechanism — both live-verified, confirming a clean 4/4 alternating exchange; earlier (2026-08-08): per-story Kindroid target binding extended to groups — `mnemo_story_use`/`mnemo_continue` gain `kindroid_kin`/`kindroid_group_id`, resolved via `resolveKindroidTarget()`; a tsconfig bug that silently skipped typechecking every test file was found and fixed in passing; also 2026-08-08: found and committed uncommitted Atlas Cloud illustration integration design notes from a prior session — `docs/ILLUSTRATION_INTEGRATION.md`, proposal only, no code changes; earlier (2026-08-05): Phase 6 live-verified against a dedicated test kin; Phase 6 revised — keyphrase-gated story context for the Kindroid generator; v0.1.3 shipped — validator-gated scene inclusion; atlascloud-mcp registered locally in `.mcp.json` + illustration-integration scope recorded in "What's next")

## Phase

**Phase 6 (Kindroid bridge) built and live-verified.** `GENERATOR_PROVIDER=kindroid`
routes story generation through a new `KindroidProvider`, which connects to
kindroid-mcp (now deployed as a Streamable HTTP MCP server on the NAS) as an
MCP client — mirroring `OcClient`'s existing pattern rather than the
originally-planned plain fetch, since kindroid-mcp didn't have HTTP
transport when that plan was written. Generator only; the validator role
always stays on Ollama.

**Revised same day:** the Kindroid path no longer ignores story context
outright. `buildKindroidMessage()` scans the direction for a
character/location/lore/worldbuilding entity NAME mention and folds in only
the matching entries, plus the already-relevance-filtered recent scenes
(always included). This mirrors Kindroid's own keyphrase-triggered "Journal"
feature — confirmed app-only, not reachable via the public API — reimplemented
client-side and populated from the story's existing OC entities (no new
storage, no import step: `mnemo_save_entity` already is the data source).
Rules/style are never surfaced this way; the kin's own persona still carries
tone/voice. Trade-off accepted: a match becomes a visible prefix in the
actual message sent (and thus in your chat history), since Kindroid has no
side channel to inject context invisibly the way its native Journal recall
does. `gatherContext`/`buildSystemPrompt` still run unconditionally in
`continue.ts` regardless of generator, since the optional validator pass
needs the full context either way. 7 new pure unit tests for
`buildKindroidMessage` (keyphrase matching, word-boundary precision, scene
inclusion, rules/style exclusion) — see `tests/kindroid-provider.test.ts`.

**Live-verified (2026-08-05).** A dedicated test kin was designated;
`tests/kindroid-provider.test.ts`'s env-gated real-integration suite ran
against the live NAS deployment (all 11 tests pass, including the 3 real
`kindroid_send_message` round-trips and the `opts.model` override path).
Confirmed end-to-end: `KINDROID_MCP_URL`/`KINDROID_MCP_AUTH_TOKEN`/
`KINDROID_STORYTELLING_KIN` wiring, the MCP-client connection, and a real
reply coming back ignoring `systemPrompt`/`temperature`/`maxTokens` as
designed. Not yet exercised in this pass: an actual `mnemo_continue` call
with `GENERATOR_PROVIDER=kindroid` and a non-empty `ContextBundle` (the
keyphrase-injection path itself is covered by the 8 pure unit tests, not
by a live round-trip with real OC-sourced context).

**Per-story Kindroid target binding: AI or group (2026-08-08).**
`KINDROID_STORYTELLING_KIN` was a single, server-wide AI default with no
way to point different stories at different targets short of passing
`model` on every `mnemo_continue` call, and no way to target a group chat
at all. `mnemo_story_use` now accepts `kindroid_kin` / `kindroid_group_id`
(mutually exclusive; `null` clears), stored as `KindroidTarget {type: "ai"
| "group", id}` on the story's marker memory (`stories.ts` bumped to
marker schema 3 — schema-1 markers with no kin line, and schema-2 markers
with the legacy bare `Kindroid-Kin:` line, always an AI target, both still
parse fine; no migration needed). Follows "OC is canonical for story
state" rather than mnemosyne's local `config.json`, since a target id is
portable story data. `mnemo_continue` gained matching per-call
`kindroid_kin` / `kindroid_group_id` params and resolves the effective
target via `resolveKindroidTarget()`: the per-call override wins, then the
active story's bound target (only relevant when the generator actually is
Kindroid), then `KindroidProvider`'s configured `defaultTarget`
(`KINDROID_STORYTELLING_KIN` or the new `KINDROID_STORYTELLING_GROUP`,
mutually exclusive at startup). At this milestone, `model` stopped doubling
as a Kindroid override and remained Ollama-only; the direct providers added
later now honor it, while Kindroid and Botify ignore it. A Kindroid target
needs a type (ai vs group), not just a bare id. Against a group, `KindroidProvider.generate()`
drives kindroid-mcp's turn loop via the new `KindroidClient.advanceGroup()`
(`allowUser: false` forced — mnemosyne is generating a beat, not waiting on
a live human's real turn; `maxTurns` defaults to 4, matching kindroid-mcp's
own default) and joins the replies into one beat via `formatGroupReplies()`
(`Name: message` per line, in generation order). **Live-verified
2026-08-12** against a real group (a subscriber group tied to a live
Twitch stream) — see the dated Done entry below for the full
walkthrough. 8 new pure tests (`resolveKindroidTarget`,
`formatGroupReplies`, `combineKindroidTarget`), 4 new real-OC integration
tests for the marker round-trip (ai-at-creation, group-at-creation,
bind/rebind-ai-to-group/clear, legacy schema-2 compat) — see
`tests/kindroid-provider.test.ts` / `tests/stories.test.ts`.

**Also fixed in passing:** `tsconfig.typecheck.json` extended
`tsconfig.json` without overriding its inherited `exclude: ["**/*.test.ts"]`
— exclude wins over include, so despite the file's own stated purpose
("typecheck tests too"), every `*.test.ts` was silently skipped by `npm run
typecheck` the whole time. Found while investigating why a stale rename
(`setStoryKin`) in `tests/stories.test.ts` wasn't flagged; fixed by
overriding `exclude` to just `["node_modules", "dist"]` in the typecheck
config. Real errors surfaced immediately once fixed (confirming the bug was
live) and were corrected as part of this same change.

**v0.1.3 shipped** (2026-07-31, a few hours before the Phase 6 work
above landed the same day). Validator-gated scene inclusion — the real
fix for the few-shot-vs-rule diagnostic surfaced 2026-05-11: present-
tense few-shot scenes in RECENT SCENES were drowning out an explicit
past-tense RULE, and no amount of prompt-position shuffling fixed it —
the few-shot content itself had to change. `mnemo_continue(validate=true)`
now tags scenes `validation:clean`/`validation:errors`; `gatherContext`
prefers clean, falls back to untagged, hard-excludes errors; a new
`mnemo_revalidate_scenes` tool retroactively tags pre-v0.1.3 content.
See "Done" below for the full four-step writeup, the OC full-replace-tags
correctness trap it surfaced, and the review-fix follow-up.

**v0.1.2 shipped.** Three more patches from the v0.1.1 dogfooding
session, all targeting the rule-following gaps surfaced by the
Dovecoast smoke test against `nous-hermes2-mixtral` + `phi4:14b`:

1. Validator prompt restructured into a two-step process — enumerate
   each distinct constraint first, then check each independently. The
   v0.1.1 validator caught one constraint per rule and stopped, missing
   structurally identical violations and missing entire constraint
   axes (e.g., catching POV but missing tense in a compound rule).
2. Rule-precedence statement inserted between the mode directive and
   the constraint blocks. The mode directives prime narrative-present
   prose ("Narrate actions, describe the environment..."), and even
   instruction-tuned models followed the mode and the rules awkwardly.
   Explicit precedence fixes that.
3. `mnemo_validate(content)` standalone tool. Counterpart to
   `mnemo_continue`'s `validate=true`; lets the user (or the host LLM)
   feed arbitrary text through the validator without regenerating.
   Splits "did the generator violate?" from "did the validator catch
   it?" cleanly. Plus `scripts/dump-validation.mjs` companion for
   command-line A/B work.

37/37 tests passed at the time.

Current local count (2026-08-31): 418 passing, 64 integration/live-provider
tests skipping cleanly without their external-service environment (482 total).
Typecheck, lint, and Prettier are green. Historical counts below remain attached
to the milestones at which they were measured.

## Done

- **Chaos Saga source-document validation** (2026-09-02). Share-chat
  project documents saved under `drafts/_control/source-documents/`, drafts
  validated against them, four gaps folded in, two conflicts ruled
  (1942 Indian Scout; Jenna's hair follows the art). Overlay rehashed and
  re-sealed; verifier green. Under gitignored `data/`.

- **Chaos Saga scene recovery** (2026-09-01/02). All four raw ChatGPT
  archive files and the Homecoming Fatigue share chat were cut into one file
  per scene under `canon/scenes/` (259 canon scene files, 80 alternates in
  `_alternates/`), verbatim, with catalog keys and provenance. Validator at
  321 entities, overlay verifier green at 329 merged. Lives under gitignored
  `data/`; see the top entry for the open review items.

- **Draft review pass, re-seals, prequel ratifications, Wonderland overlay**
  (2026-09-01). All eight existing overlays were reviewed file by file; six
  received small prose corrections and were rehashed and re-sealed with dated
  notes in their PASS records (BattleChasers, Brass & Nerve, Chaos Saga, The
  Adjustment Protocol, The Blackwood Case, The Noctis Veil). Both Miskatonic
  prequel scaffolds were built out at the core level with the year/inlet and
  timeline-fork choices ratified by the operator. Wonderland gained overlay
  r10 (35 operations, 77 merged entities, verifier green), bringing the count
  of review-gated overlays to nine. Every result remains unpromoted and
  unimported.

- **Hexagonal architecture refactor completed** (2026-08-31). Five application
  use cases are exposed through one `ApplicationUseCases` contract assembled in
  `src/index.ts`: continuation, standalone validation, scene revalidation, and
  story/entity catalogs. Application-owned ports isolate OC, generation,
  validation, persistence, environment, clock, and logging concerns behind
  concrete adapters. MCP and REST drivers receive bound use cases, the former
  compatibility exports are gone, and an AST-based dependency test enforces the
  resulting boundaries and composition-root ownership. Full local verification:
  417 pass, 64 intentionally gated skip, typecheck/lint/format/build green.

- **Bulk scene revalidation moved behind outbound ports** (2026-08-31).
  The use case now reuses the story-constraint-reader and content-validator
  contracts and adds a scene-validation-store port for the existing capped
  enumeration/retag behavior. Its optional observer preserves per-scene warning
  logs at the concrete adapter edge. A focused event-order test proves the walk
  remains sequential, records one failed scene without aborting later scenes,
  and assigns clean/error verdicts correctly. `src/index.ts` injects the bound
  use case into both MCP and REST drivers. Continuation and catalog reads remain
  that was the final precursor to the completed milestone recorded above.

- **Standalone validation gained explicit outbound ports** (2026-08-31).
  The application use case now depends only on story-constraint-reader and
  content-validator contracts. A concrete adapter wraps the existing
  OpenChronicle context gathering and the required local LLM validator, and
  `src/index.ts` binds that adapter once for both MCP and REST injection. Focused
  tests pin port ordering and binding, while the architecture test prevents the
  migrated use case from regaining concrete client/provider imports. This is the
  first outbound-port slice; the remaining dependencies were migrated in the
  completed milestone recorded above.

- **Story and entity catalog reads crossed the application boundary**
  (2026-08-31). Shared catalog use cases now own story-summary projection and
  complete entity enumeration/filtering, including body stripping and
  `skipped_memory_ids`; MCP and REST drivers only add their transport-specific
  concerns. Focused tests cover both projections, and an executable architecture
  test prevented MCP/REST drivers from importing one another or application use
  cases from importing either inbound driver tree; explicit catalog ports and
  AST enforcement followed in the completed milestone above.

- **First hexagonal application-boundary slice completed** (2026-08-31).
  `mnemo_continue`, `mnemo_validate`, and `mnemo_revalidate_scenes` now place
  shared orchestration in `src/application/`; the MCP tools and matching REST
  routes are inbound driver adapters over those use cases and no longer import
  behavior from one another. This was the first slice; the compatibility edges
  and remaining concrete dependencies were removed by the completed milestone
  above.

- **Living Canon draft-overlay closeout completed** (2026-08-30).
  Eight adversarially closed overlays now retain PASS evidence: BattleChasers
  (71 operations → 143 entities), Brass & Nerve (20 → 43), Chaos Saga
  (60 → 73), GhostHunters (60 → 105), Midnight Is a Suggestion (41 → 70),
  Shadowflame (40 → 74), The Adjustment Protocol (19 → 41), and The Noctis
  Veil (13 → 39). Each passed the zero-write import preflight. GhostHunters
  also gained a control-only Dovecoast prequel seed bank. All work remains
  unpromoted and unimported behind explicit operator approval; active canon
  stayed hash-stable.
  A final adversarial tooling pass also closed every confirmed P1/P2: scaffold
  inputs require the real version-1 export envelope; append merges compare only
  the post-ancestor tail; batch fences honor marker length and must close;
  metadata-only records and malformed scalars fail consistently; output
  containment follows junctions/symlinks; and underscore templates reject
  duplicate keys or malformed populated values while retaining intentional
  placeholders.

- **The canon authoring layer now has a deterministic, zero-write import-contract
  check** (2026-08-29). `scripts/compile-story.mjs` maps the canon-shaped
  directory into valid `mnemosyne_export:1` records, including structured
  character frontmatter, batched minor characters, heading-delimited rules and
  style, nested lore, locations/worldbuilding, and selectively promoted scenes
  with their source timestamps. Its default/`--check` mode submits the in-memory
  document to the built server's actual import parser and `planImport` preflight
  without connecting to OpenChronicle; optional `--out` uses exclusive creation,
  refuses source-tree destinations and overwrites, and still performs no import.
  Draft residue, malformed metadata, case-insensitive duplicate keys, invalid
  scene chronology metadata, links, invalid UTF-8, empty or oversized records,
  and unsafe output paths fail closed. `verify-draft-overlay.mjs` now runs the
  same check over its hash-protected merged staging tree after structural
  validation. Focused tests cover quoted/array frontmatter, batch-wide minor
  qualifications, every compiled entity shape, scene timestamps, no-write
  behavior, duplicates, size limits, draft rejection, and output containment;
  the real 143-entity BattleChasers staged overlay and 65-entity active Chaos
  Saga tree both pass the runtime schema/preflight with `writes=0`. This closes
  the Living Canon Standard §11/§13 authoring-to-import dry-run gap; promotion
  approval and live import remain deliberately separate operations.

- **Established scenes joined the `canon/` authoring surface** (2026-08-29).
  Per operator direction, `canon/scenes/<catalog-key>--<slug>.md` now holds
  selectively promoted finished/locked scenes; generated beats are still not
  promoted automatically. Chaos Saga's three export-established scene bodies —
  `Do I Smell Trouble?`, `Home Ground`, and `The Calm After Claiming` — were extracted
  verbatim from the latest revision-10 export with original timestamps, pin
  state, source revision, and content hashes preserved. All repeated export
  copies were byte-identical. The original tracking log/template plus four raw
  ChatGPT archives were parsed separately: the one locked native record enriches
  `Do I Smell Trouble?`; 103 source-confirmed Recovery beats and four new Raw 4
  candidates are line-addressed in a review manifest without bulk-promoting
  them; Raw 1/2 continuity hazards are documented. Scene filenames now begin
  with compact `CS-<timeline>-<beat>-<location>` catalog keys, while SHA-256
  remains integrity-only. A local README, catalog, source inventory, and
  `_template.md` capture the reusable format and chronology. `DATA_LAYOUT.md`
  now documents the category,
  `scaffold-story.mjs` names the explicit-promotion boundary, and
  `validate-canon.mjs` scans `scenes/` as `type:scene`, checks catalog-key
  uniqueness and filename prefixes, and accepts digits after the first
  character in valid frontmatter keys (needed by `sha256`). Chaos Saga validates
  at 65/65 entities; all ten on-disk canon trees remain clean.

- **The two remaining mechanical hardening items shipped** (2026-08-29).
  Typed Ollama error classification (`classifyOllamaHttpError`: 404 →
  exact-tag guidance; `exceed_context_size_error` → the
  reject-don't-truncate message carrying the daemon's exact
  `n_prompt_tokens`/`n_ctx`, tolerant of the nested-JSON-escaped wire
  form; 429/503 → overload with the no-auto-retry rationale) plus a
  configurable `OLLAMA_TIMEOUT_MS` whose timeout message says to raise it
  rather than retry. And the NemoClaw §4 hygiene batch: one central
  `parseServiceUrl` (http(s)-only, no embedded credentials/fragment/query;
  private addresses deliberately allowed) applied to every configured
  endpoint, sanitized origin+path connection logs, `redirect: "error"` on
  the credential-bearing cloud path, 2KB-bounded upstream error bodies,
  and recursive sensitive-key + URL-userinfo redaction at the one log
  sink every line's META passes through (the authored message string is
  not scanned — messages are authored, meta is data). 10 new tests
  (`tests/hardening.test.ts`), including the captured nested-escape wire
  fixture and a timeout-classification case proving the owned-controller
  check survives undici's error wrapping (an advisor catch: name-sniffing
  AbortError would have misclassified real timeouts). Two working notes:
  the pre-commit PII hook blocked the internal NAS hostname from a test
  fixture mid-commit — the second time this session-family that hostname
  gravitated toward a public file (`.codex/config.toml` before it), so
  the hook is load-bearing here, not theoretical. Known Gaps' last
  research entry is closed. 340 passing / 64 skipped.

- **All four ratified designs implemented — the build-out of the research
  program is complete** (2026-08-28, seven commits `2baef78..05317f4`).
  The operator ratified the reviewed proposals; the measurement gates the
  designs demanded were run FIRST and recorded in the docs (any-mismatch
  reload semantics confirmed live at ~6s per `num_ctx` change on the 8B
  model; `truncate/shift` accepted on both daemons with exact
  `n_prompt_tokens` in the rejection; per-mode `relevance` fixtures
  captured, `rrf_score` hybrid-only). Then, in dependency order:
  - **Run outcomes (all 3 slices):** `RunContext` + phase-boundary aborts
    (guarded `res.close` on REST — the empirically-proven `req.close`
    0 ms trap avoided; `extra.signal` on MCP), `RunOutcomeError` with the
    ratified status map through REST, `run_id` on every success,
    companion producers mapped, success-shaped `canon_write_outcome`,
    Botify timeout parity, bounded-grace shutdown owner on both
    transports (OC closed last), single-flight connects, explicit
    OC mutating-retry safety with an abortable backoff threaded through
    the whole gather path, atomic serialized config writes.
  - **Capabilities (all 3 slices):** instance-keyed async resolver
    (distinct generator/validator Ollama descriptors), ONE shared cached
    `/api/show` serving locality + capabilities + window sizing,
    `GET /api/capabilities`, capability-gated Web UI controls
    (`unknown` ≠ unsupported), warn-don't-break `capability_warnings`.
  - **ContextPlan (slices 1–2):** structured `ContextEntry` through
    gather, deterministic `planContext` (ratified drop tiers, memory_id
    tie-break, direction counted), plan-driven rendering, `context_plan`
    manifest + companion `context_selection`, calibration logging,
    `MNEMO_CONTEXT_ADMISSION` (default warn), stable per-model `num_ctx`
    (measurement-backed), `truncate:false`/`shift:false`, empty-message
    load warmup + one-shot `/api/ps`. Cloud enforcement (slice 3) is a
    documented no-op while capability windows are all-unknown.
  - **Retrieval (all 3 slices):** `mode`/`phrase`/`pinnedLimit` with the
    captured relevance object on a search-specific schema, phrase-first
    overwrite lookup, and flag-off vague-direction enrichment
    (`MNEMO_QUERY_ENRICHMENT`, ratified OFF until the settled-fixtures
    benchmark — which needs operator-labeled fixtures — records a win).

  Test baseline: 284 → **330 passing** (64 env-gated skips). Live
  verification along the way: real-OC entities/stories/http/validator
  suites green through every new path, including real generations with
  the new stable-window + `truncate:false` request contract against the
  NAS daemon. Remaining open in the queue: the enrichment benchmark run,
  the §7 final-sink redaction (mechanical), the typed Ollama error
  classification remainder (mechanical), endpoint hygiene (P2), and the
  parked/rejected items whose triggers stand.

- **The four design proposals adversarially reviewed and revised — still
  none ratified** (2026-08-28). Four independent reviewers (one per doc,
  each reading the design against the actual source, the assessments'
  guardrails, and platform feasibility) produced 33 findings; 28 were
  confirmed and folded into the docs, each of which now carries a
  revision note enumerating its corrections. The load-bearing catches:
  - **Run outcomes:** `req.on("close")` fires at ~0 ms on this stack
    (empirically verified by the reviewer) — the draft would have
    aborted *every* REST run at start; now guarded `res.on("close")` +
    `!writableEnded`. The `AbortSignal.any` provider-request composition
    contradicted the design's own pre-dispatch-only semantics — removed
    (signal at phase boundaries only). A thrown `canon_write_unknown`
    would have discarded the beat text the code's own guard preserves —
    now a success-shaped field. One acceptance test copied from the
    assessment contradicted the chosen semantics — inverted.
  - **ContextPlan:** bare fail-closed + the deliberately conservative
    chars/3.5 estimator would have hard-rejected large stories that
    generate fine today, with no recourse — now a `warn|enforce`
    admission mode gated on calibration. "Zero churn" contradicted the
    manifest-accuracy test — rendering is now plan-driven. The
    stable-`num_ctx` premise is contested between the code's own comment
    (bigger-only reloads) and the assessment (any-mismatch) — decision
    #1 is now gated on a live `load_ms` measurement, with status-quo (c)
    added and the desktop deployment's corruption caveat named.
  - **Capabilities:** the sync resolver could never source Ollama's
    `/api/show`-backed window — now async, with `context_window` defined
    as the *effective* window; the validator's descriptor was
    unresolvable from a name-keyed table (two Ollama instances differ) —
    now instance-keyed; the `cancellation` field was aspiration with a
    vocabulary owned by an unratified sibling — dropped; the honest
    resolution matrix is stated so ratification weighs the real payoff
    (companion control removal + unknown-hints, not sliders everywhere).
  - **Retrieval:** `compact` on `memorySearch` would have been rejected
    wholesale by the shared result schema while the request-side test
    stayed green — dropped from v1; the response's `relevance` was
    assumed a number but a captured live response shows an **object**
    (`{channel, rrf_score, …}`) — schema now search-specific and
    fixture-pinned; the <20-char vagueness floor would have buried
    short-but-rich directions ("Aria dies") under a 300-char excerpt —
    classifier gains a no-entity-name condition and the bound drops to
    ≤120; excerpt-scene selection is mandated list-based, which is what
    makes the settled-fixtures benchmark a valid control.

  Facts re-verified during triage: desktop Ollama is **0.33.2** (probed
  live; the draft said 0.33.1), NAS 0.32.15; and the MCP SDK's tool
  handlers do carry a required `extra.signal` (checked against installed
  types). Five reviewer claims were rejected or downgraded as
  no-issue/documentation-precision (each reviewer also explicitly
  cleared the axes where nothing was found, per the no-padding rule).

- **Design proposals written for all four design-heavy open candidates —
  none ratified** (2026-08-28). The decision queue's remaining
  design-conversation tier now has concrete, sign-off-ready proposals,
  each ~150–200 lines of *decisions* (types, placement, chosen semantics,
  slice order, acceptance tests, and an explicit decisions-needed list),
  citing its assessment for rationale:
  - [RUN_OUTCOMES_DESIGN.md](docs/RUN_OUTCOMES_DESIGN.md) — `RunContext`
    threading per surface, the chosen disconnect semantics
    (pre-dispatch-only abort, satisfying both the OpenClaw and Open WebUI
    constraints), the typed replay-safe outcome table as
    `RunOutcomeError` with a REST projection, `canon_write_unknown`,
    Botify timeout parity, and the §7 lifecycle remainder folded in.
    Idempotency keys explicitly excluded — they belong to the
    triage-rejected run registry.
  - [CONTEXT_PLAN_DESIGN.md](docs/CONTEXT_PLAN_DESIGN.md) — OpenClaw §1 +
    Ollama §4/§6 as one design: structured `ContextEntry` surviving to
    assembly, plan-describes-the-actual-payload (companion keyphrase
    selection reported truthfully), three-stage enforcement rollout, a
    live compatibility gate on `truncate/shift` before sending them, the
    warmup/stable-`num_ctx` interaction named, and
    single-context-vs-buckets surfaced as a ratification decision with
    the NAS hardware tradeoff.
  - [GENERATOR_CAPABILITIES_DESIGN.md](docs/GENERATOR_CAPABILITIES_DESIGN.md)
    — the typed static table + model-aware resolver, three-way
    supported/unsupported/**unknown** fields, five named consumers, and
    an explicit non-ratification of content routing (attachment point
    only). Recommends all-unknown cloud context windows over a drifting
    local table.
  - [RETRIEVAL_CONTROLS_DESIGN.md](docs/RETRIEVAL_CONTROLS_DESIGN.md) —
    control exposure **live-confirmed** against the deployed OC's actual
    tools/list (`mode`/`phrase`/`compact`/`pinned_limit` all advertised),
    phrase-first overwrite lookup, and benchmark-gated deterministic
    enrichment — with the benchmark required to run on settled fixtures
    because the open embedding-lag `mcp-feedback` issue sits on the very
    `memory_search` path it exercises.

  The queue now annotates its remaining mechanical items (typed Ollama
  error contract, endpoint hygiene, final-sink redaction) as ratifiable
  directly from the assessments with no design doc, and links each
  designed row to its proposal. Rejected/parked items (run registry, host
  spikes, beat proposals, current-state apply) deliberately received no
  design docs — their triggers stand.

- **Provider usage telemetry: the last un-started item from the research
  queue's ranked list** (2026-08-28). Open WebUI §3 + the Ollama
  assessment's telemetry track, one implementation. Every provider
  previously discarded its response's usage block. `GeneratedBeat` now
  carries an optional `ModelUsage` (source `"reported"` only — locally
  estimated numbers are never mixed in under that label): Ollama maps
  exact prompt/eval counts and normalizes wire-nanosecond load/prompt-eval/
  eval durations to ms; Anthropic maps input/output plus cache-creation and
  cache-read tokens; OpenAI-compat/Atlas map `usage` incl.
  `prompt_tokens_details.cached_tokens`; Gemini maps `usageMetadata` incl.
  `cachedContentTokenCount`; Kindroid/Botify report nothing and stay
  absent. Continuation responses expose `usage.generator` and
  `usage.validator` **separately** (different models/prompts/cache
  semantics — a presentation layer can sum; merged values can't be
  un-merged), via `validateContentWithUsage()` with the plain
  `validateContent` wrapper keeping the other three callers unchanged.
  Guardrails per the assessment: unknown values stay absent (never a
  flattering zero, enforced by a shared `omitUndefined`), `total_tokens`
  only when reported or both parts known, no dollar cost invented from a
  pricing table, and telemetry rides results/logs — never a saved scene
  body. 9 new tests in `tests/usage-telemetry.test.ts`.

  **Flagged, pre-existing, not fixed here:** the env-gated live
  `tests/continue.test.ts` suite (real OC + real NAS Ollama) has one
  failing case — `gatherContext` returns 0 rules for a just-saved test
  story. Reproduced identically on clean HEAD **and** at the pre-session
  baseline `3853d14` via a detached worktree, so it predates all of
  2026-08-28's work; most plausibly OC-side retrieval timing (embedding
  lag for freshly saved memories) or an OC deployment change. Needs its
  own diagnosis pass.

- **Protected semantic readiness at `GET /api/status`** (2026-08-28).
  NemoClaw P1 #2
  ([NEMOCLAW_ADOPTION_ASSESSMENT.md §3](docs/NEMOCLAW_ADOPTION_ASSESSMENT.md),
  previously a Known Gap): `/health` always says `ok` and cannot report a
  dropped OC connection or a missing model — it stays exactly that, cheap
  public liveness. The new route sits behind the existing bearer +
  Host/Origin `apiSecurity` boundary and reports `openchronicle`,
  `generator`, and `validator` as `ready`/`unavailable`/`not_probed` with
  an observation timestamp and a canon-free reason. Every probe is
  non-mutating and non-billable, via a new optional
  `LlmProvider.checkReady()`: OC re-runs the bounded tools/list contract
  check (startup proof isn't continued availability), Ollama hits
  `/api/show` for the exact tag (no inference; the locality probe was
  refactored so requireLocal and plain existence share one path),
  companions do connect+discovery only (never a posted message), and the
  four cloud generators report `not_probed` honestly — a real probe is a
  billable call, and a load balancer must never bill. A 15-second TTL
  cache keeps repeated deployment polls to one probe run, preserving the
  original `checked_at` so staleness is visible. `degraded` from the
  assessment's vocabulary is deliberately unused until a partial state
  exists, and the stdio-side `mnemo_status` twin is recorded as an open
  option rather than smuggled in. 8 new tests in `tests/readiness.test.ts`
  including the route through the real router. Both NemoClaw P1s are now
  closed.

- **Sibling-MCP results are runtime-validated, and required tools are
  discovered before use** (2026-08-28). NemoClaw P1 #1
  ([NEMOCLAW_ADOPTION_ASSESSMENT.md §2](docs/NEMOCLAW_ADOPTION_ASSESSMENT.md),
  previously a Known Gap): `extractStructuredOrParsed<T>` was a compile-time
  cast at a runtime network boundary, and no client checked that the tools
  it calls are advertised. Now every OC/Kindroid/Botify result crossing
  into domain logic parses through a zod schema — the same schema on both
  the `structuredContent` and text-fallback paths — with errors naming the
  service, tool, and field paths but never payload values (upstream bodies
  carry canon). Optional fields are `.nullish()` (Python `None` → `null`);
  extra fields are tolerated (additive upstream evolution must not be an
  outage); Botify's load-bearing `bot_message` null-vs-absent distinction
  survives parsing, test-pinned. New `src/mcp-discovery.ts` runs bounded,
  name-only `tools/list` discovery at each client's connect — page/tool/
  name/cursor caps, duplicate-name and cursor-loop detection, zero
  `tools/call` (proven by a throwing fake) — so OC missing its contract
  **fails startup** (its connect is awaited there), while a companion
  contract mismatch surfaces lazily as provider-unavailable *before any
  message is posted to a real conversation*, with OC-backed browsing
  unaffected. 14 new tests in `tests/mcp-contracts.test.ts`; the full live
  suite ran green against real OC through the new schemas and discovery
  (317 passing). Deliberately not done, per the assessment: no full
  input/output schema fingerprinting — names plus result schemas close the
  demonstrated boundary.

- **Narrative prose removed from default logs** (2026-08-28). The sharpest
  slice of the OpenClaw assessment's §7 operational-safety track: the tool
  invoke line logged the first 200 characters of every long string at info
  and the FULL arguments at debug — on a private storytelling server
  designed for mature material, entity bodies and scene directions were
  default telemetry. `sanitizeToolArgsForLog()` now records lengths for
  prose fields (`content`/`direction`, always — a short direction is still
  story content) and for any string past the threshold, and element counts
  for arrays (import's `entities` carries whole bodies); short identifiers
  (names, ids, modes) stay, since they are the line's diagnostic value.
  The full-args debug line requires an explicit `MNEMO_LOG_CONTENT=true`
  opt-in on top of `LOG_LEVEL=debug`, documented in `.env.example` as
  short-lived. 6 new tests including a stderr-capture proof that no
  emitted line contains the prose. The REST ingress (`src/api/`) was
  verified log-free for bodies as part of this pass: its only log sink is
  the 500 handler (path + error message), and `parseOr400`'s zod issues
  carry field paths, not input values — the chokepoint has no second
  unexamined ingress. The rest of §7 (shutdown ownership, OC
  retry classification, atomic config writes, final-sink secret redaction)
  stays open in the decision queue.

- **Completion integrity extended to all four cloud providers**
  (2026-08-28). The Ollama P0 fix deliberately scoped `complete`/
  `finishReason` to Ollama; the cloud providers still discarded their
  finish reasons, so a truncated *cloud* beat could still auto-save.
  Anthropic (`stop_reason: "max_tokens"`), OpenAI-compat + Atlas
  (`finish_reason: "length"`), and Gemini (`finishReason: "MAX_TOKENS"`)
  now map through one shared `completionFromFinishReason()` normalizer —
  extracted because the classification carries the correctness rule
  ("length means do not auto-save") across four spellings — and hit the
  same `continueScene` no-auto-save guard. Absent finish reason stays
  unreported/complete (Kindroid/Botify have no truncation concept). The
  pure extractors now return `GeneratedBeat`; 5 new normalization tests in
  `tests/cloud-providers.test.ts` (250 passing / 64 skipped).

- **Ollama P0 #2 shipped: the validator route is proven local, not assumed
  local** (2026-08-28). Per
  [OLLAMA_ADOPTION_ASSESSMENT.md §2](docs/OLLAMA_ADOPTION_ASSESSMENT.md):
  Ollama transparently executes `:cloud` models and remote-host aliases
  through the same localhost API, so a localhost `OLLAMA_URL` was never
  proof of local inference — and the validator's request carries the
  story's full canon while the pass is documented as "local and free."
  Three layers, all on the validator instance via a new
  `OllamaConfig.requireLocal`: a `:cloud` tag is refused at startup
  (generator-config) and per call before any fetch; the exact model is
  preflighted via `/api/show` (cached per model, failures evicted), with
  `remote_model`/`remote_host` refused **before** the canon-bearing
  `/api/chat` request is built and a 404 mapped to an actionable
  exact-tag error; and the final response's route fields are re-checked so
  an alias re-pointed after the cached preflight fails loudly with the
  result discarded. The generator instance is unchanged (no `/api/show`
  call at all without the flag) — making the ollama *generator*
  local-by-default is recorded as its own queue row since it belongs with
  the content-routing design. `.env.example` now also recommends
  daemon-side `OLLAMA_NO_CLOUD=1`. 8 new tests in
  `tests/validator-locality.test.ts`, plus a live round-trip against the
  NAS daemon (preflight ok, real generation, actionable missing-model
  error). All three Ollama P0s are now closed.

- **Ollama P0 #3 shipped: validator verdicts are schema-constrained and
  runtime-validated** (2026-08-28). Per
  [OLLAMA_ADOPTION_ASSESSMENT.md §3](docs/OLLAMA_ADOPTION_ASSESSMENT.md): the
  verdict shape used to exist only inside the prompt plus a generic cast,
  and the "defensive" fallback coerced any malformed report into
  `{issues: [], summary: ""}` — i.e. broken validator output read as a
  clean verdict, and a misspelled severity could never equal `error`. Now a
  strict zod `ValidationReportSchema` (closed severity enum, nonempty
  rule/quote/explanation, no extra fields at either level) validates every
  parsed verdict, and a violation throws — a failed validation pass, never
  an empty clean report. The same contract as a hand-maintained literal
  JSON Schema is sent as Ollama's top-level `format` field through a new
  narrow `StructuredOutputCapable` provider surface (deliberately not
  another ignored field on `LlmGenerateOptions`), live-verified accepted
  and shape-enforced against the deployed daemon (0.32.15) before wiring.
  A drift-guard test compares the two schema copies structurally so
  editing one fails until the other follows. At shipment time this used Zod 3
  and deliberately avoided a dependency upgrade; the later Zod 4 baseline
  upgrade retained the explicit provider contract and drift guard. 16 new
  tests in `tests/validator-schema.test.ts`; the live validator suite (real OC +
  NAS Ollama) ran green through the new path. Deliberately deferred, per
  the doc's own sequencing: validator `think: false` (needs its own
  compatibility check), `truncate:false`/`shift:false` (P1), and the full
  typed request-contract extraction.

- **Ollama P0 #1 shipped: a beat cut off at the token budget is no longer
  auto-saved as canon** (2026-08-28). The first of the three remaining P0s in
  [docs/RESEARCH_DECISION_QUEUE.md](docs/RESEARCH_DECISION_QUEUE.md), per
  [OLLAMA_ADOPTION_ASSESSMENT.md §1](docs/OLLAMA_ADOPTION_ASSESSMENT.md).
  `OllamaProvider` now requires a terminal `done: true` response and
  normalizes `done_reason` into `GeneratedBeat.complete`/`finishReason`
  (absent = complete, so every other provider is unchanged). `continueScene`
  returns the costly text with `incomplete: true`, performs zero save calls,
  and skips validation — saving a partial is a deliberate
  `mnemo_save_entity` decision, and no silent retry (a second generation is
  a different scene). A validator verdict cut at its budget now throws
  instead of parsing truncated-but-valid JSON into a clean report. The web
  UI renders the server's message for any no-save response (previously only
  the group-yield case) and styles the incomplete one as a warning.
  8 new tests in `tests/completion-integrity.test.ts`, including the
  acceptance case verbatim: a `length` beat performs zero `memorySave`
  calls and still returns its text.

- **Research decision queue enumerated; the three shipped triage items
  verified against their own acceptance proofs** (2026-08-28, `63b0db9`).
  The triage entry below claimed "a decision queue of 20 live proposals"
  that was written down nowhere;
  [docs/RESEARCH_DECISION_QUEUE.md](docs/RESEARCH_DECISION_QUEUE.md) now
  enumerates every recommendation-table row of the four assessments with its
  disposition, and holds the verification record. Verification found one real
  gap: `a12e992`'s test covers only the guard helper, while NemoClaw §1's
  acceptance proof requires an HTTP MCP integration test through the actual
  per-session server factory — queued, not silently fixed. keep_alive and the
  a11y fixes are fully covered; the "five drift items" were all the Atlas
  corrections in `32e027f`, nothing outstanding. Also fixed: Known Gaps still
  listed HTTP filesystem authority as open while this Done log said it
  shipped (struck), and each assessment header now says its relative
  Mnemosyne links resolve against the recorded `cfd9d7f` snapshot, not HEAD.

- **External-system research read end-to-end, triaged, and three items
  shipped** (2026-08-28, `32e027f`, `ebb6d36`, `9be11f3`, `a12e992`). The five
  documents (3,128 lines) had never been read in full since landing, and
  nothing in them was ratified. Reading them produced a decision queue of
  **20 live proposals against roughly 60 explicit non-adoptions** -- four
  independent audits of much larger systems (OpenClaw 34,426 files, NemoClaw
  6,008, Open WebUI 5,059, against this repo's 135) proposed **no new
  feature**, only boundary and integrity fixes. Six of their
  "already implemented" claims verified true in code; five drift items were
  found, and the Atlas ones were fixed the same day -- that doc specified L3
  result vocabularies the runner never emits, omitted two the live sweep
  actually produced, and overstated what the L1 probe proves. Three items
  shipped:
  - **`OLLAMA_KEEP_ALIVE=-1` produced an HTTP 400 on every generation.**
    Reproduced live: `"keep_alive":"-1"` returns 400, numeric `-1` returns
    200, while `"0"`/`"30m"`/`"90s"` are fine as strings. `.env.example`
    documented exactly `"-1"`, and env vars are always strings, so following
    the documentation broke the server. Numeric values are now sent as
    numbers, and `tests/ollama-keep-alive.test.ts` pins both the value shape
    and the top-level placement that `fa90ba2` got wrong silently once
    already; confirmed non-vacuous by reintroducing the old nesting (3 of 9
    fail).
  - **Caller-supplied filesystem paths are refused over HTTP** (NemoClaw
    section 1, previously a Known Gap). One `makeServer()` factory serves both
    transports, so an HTTP caller could read or write anywhere the process
    can. A flat rejection rather than an allowed-root facility, per the
    assessment's own argument. stdio -- every current deployment -- is
    unchanged. Verified on a live server: over HTTP an `out_path` write is
    refused and no file appears; over stdio the identical call still writes a
    129,864-byte export.
  - **Four keyboard and screen-reader defects** in the web UI, including a
    `.card:focus-visible` rule that could never match because `.card` is a
    non-focusable `<article>`.

  Deliberately **not** taken: the per-story run registry (its own document
  states no incident proves users have hit the race) and both host spikes
  (blocked, and Open WebUI's own analysis predicts a structural failure). The
  roughly 60 rejections are recorded as the set's most durable output -- no
  second memory store beside OC, no automatic retry after a billable or
  externally-mutating call, no fork or frontend transplant, no plugin/skills
  runtime, canon never promoted by recurrence, and a safe pass never a
  capability certification.

- **Phase-end audit: 28 findings, all resolved** (2026-08-28, `41fc26b`
  through `417d18e`). Run as a discrete pass with the punch list surfaced
  before any fix, per the audit's own procedure. The baseline was already
  strong: no test has ever been deleted from history, gitleaks over all 176
  commits found nothing, and this repo's pre-commit hook is *ahead* of the
  fleet canonical version. Findings clustered in two places -- the repo's
  public face, and gate coverage at the edges.
  - **Public-repo leaks.** `.codex/config.toml` was tracked and published the
    internal NAS endpoint on a public repo; `.gitignore` already excluded
    `.mcp.json` for exactly that reason, but Codex's equivalent never got the
    same treatment. `STORYLINE_RESEARCH_BACKLOG.md` listed machine-local paths
    to commercial RPG PDFs. Neither was catchable by the PII hook, whose
    patterns cover home paths and personal email domains.
  - **`SECURITY.md` added and private vulnerability reporting enabled.** A
    public repo documenting its own HTTP trust boundary had no disclosure
    channel but a public issue. Written honestly: no SLA, upstreams scoped
    out, and the three known limitations listed so a reporter does not spend
    effort rediscovering them.
  - **Gate coverage.** `scripts/` (1,724 lines, including the billing-guarded
    Atlas runner) was linted by nothing; webui lint ran in no CI job; the
    webui build used `npm install` while the same workflow pinned `npm ci` at
    root; and Dependabot watched neither `webui/` (18 dependencies, ten a full
    major behind) nor the GitHub Actions.
  - **Real defects.** A canon frontmatter writer and reader that disagreed
    about quoting, corrupting any entity name containing a quote across 55
    files; an HTTP bind failure that threw an unhandled error after every
    startup check had passed; `--mode` typos that wrote an all-`not_run`
    report and exited **0**; and script diagnostics that turned every
    misconfiguration into a stack trace.
  - Documented as correctly absent rather than fixed: CHANGELOG (this Done log
    already is one), CONTRIBUTING, CODE_OF_CONDUCT, and issue templates for a
    repo with no contributors.

- **`src/index.ts` split 774 to 343 lines** (2026-08-28, `82364e8`,
  `417d18e`). Queued by the audit as its own stage rather than a drive-by. Env
  parsing and validation for seven providers moved to
  `src/generator-config.ts` -- it decides *what* to build, `index.ts` builds
  it -- and the instructions blob to `src/instructions.ts`. Exports are
  individual bindings rather than one config object specifically so that no
  call site had to change, which was the lesson from an earlier refactor the
  same day that broke three test files by renaming wholesale. Verified
  behaviorally across four startup paths, not only by typecheck.

  The paired warmup fix **corrected a diagnosis recorded earlier that day**.
  Warmup had been blamed for a libuv abort on bind failure, but deferring it
  past a successful bind left the assertion unchanged, with no warmup line in
  the log to blame. The actual holder is the OpenChronicle client:
  `oc.connect()` has already succeeded when a bind error arrives, so its
  transport is live and exiting on top of it aborts libuv. Closing it first
  fixes it, and a bind failure now exits 1 with a legible error and no
  assertion.

- **Atlas capability runner hardened, and L0-L3 coverage recorded**
  (2026-08-28, twelve Atlas commits between `c176669` and `d213b62`). The protocol landed the day
  before as documentation; actually running it found five defects, each fixed
  the same day and each verified against the live CLI rather than by
  inspection.
  - **Unbounded subprocess wait.** Every probe waited indefinitely, which the
    protocol itself named as the reason it was unsafe to schedule. Bounded in
    `runJson`, the single chokepoint all six call sites pass through, with
    separate budgets for ordinary probes (120 s) and `generate wait` (900 s),
    and a timeout recorded as a *distinct* result rather than folded into
    "error". This stopped being theoretical during the chat sweep:
    `bytedance/doubao-seed-2.1-pro-260628` consumed its full budget and was
    killed while the run still completed — the exact long-tail latency that
    halted the 2026-08-27 sweep.
  - **`--mode all` charged and saved nothing.** The `--media-model-limit`
    requirement was enforced *after* the billable chat sweep, so a run without
    it paid for inference and then threw before writing. Moved to
    argument-parse time.
  - **The summary hid schema failures.** `errors`/`completed` were computed
    from `liveProbe` alone, so a schema-only run reported zero errors while a
    real failure sat in the rows. Counters are now symmetric per probe type.
  - **Generated media was written into the repository.** The smoke run left
    three PNGs in the repo root while the report claimed
    `rawOutputsStored: false` and CLAUDE.md claimed the script never stores raw
    output. Benign here — the probe prompt is non-graphic — but the contract
    exists so a widened probe cannot drop generated adult media into a git
    repo. Fixed with `--no-download`.
  - **A job count is not a cost bound.** Eligible video prices span 22x
    ($0.34-$7.56 measured), and targets are chosen by catalog order, which is
    uncorrelated with price — so a limit of 6 would have cost roughly $14. The
    limit now interleaves image and video rather than taking a prefix, and
    `--max-spend` quotes every target through the non-billable cost endpoint,
    prints the itemization, and refuses to submit if the total exceeds the
    ceiling. On the one run where it mattered, quoted $1.2525 vs actual $1.25.
  - **Coverage:** L0 catalog (385 models, machine-derived), L1 schema (85/85
    eligible media), L2 chat (60/60 eligible), L3 bounded smoke across both
    media types. L4 explicit review stays deliberately un-automated. Two
    upstream findings worth carrying forward: **10 of 385 catalogued models are
    advertised but not callable** (one image route 404s on `models get`, nine
    chat models reject any completion with `http_400`, both reproduced outside
    the runner), and `alibaba/wan-3.0/text-to-video` quotes **$4.80** today
    against the $0.08 recorded on 2026-08-27 — that figure is not a safe basis
    for estimating. Total spend for the day: **$1.45**.
  - The vendored `vendor/atlascloud-cli` submodule turned out to be an
    installer, not a binary; four docs referenced it without saying how to get
    a runnable `atlas`. Documented, including the Windows `.cmd` spawn hazard
    that `ATLAS_CLI_BIN` sidesteps.

- **CLAUDE.md's duplicated status collapsed, and two correctness fixes**
  (2026-08-28, `ad591ef` and `2905bf7`). CLAUDE.md's "Current Sprint" had grown
  to 129 lines restating this file, which the project's own documentation
  discipline forbids — and it had already drifted, still listing GhostHunters
  at 105 entities where the validator reports 101. Collapsed to a pointer after
  verifying every specific detail was already recorded here; five downstream
  contradictions went with it. Separately, `scripts/validate-canon.mjs` exited
  **0** on a `canon/` directory that does not exist, because every `readdir`
  swallowed its own `ENOENT` — so the tool that would verify a restore could
  not distinguish an intact tree from a lost one. Bare catches now treat only
  ENOENT as "absent"; anything else fails loudly. `package.json` also gained
  `private: true` (later scoped to `@carldog/mnemosyne-mcp`): the unscoped npm
  name belongs to an unrelated package, so `bin` + `files` advertised a
  distribution path that could never work.

- **NemoClaw comparative research documented** (2026-08-28). Audited the
  canonical NVIDIA NemoClaw repository at `b7261ff` (clean local clone,
  package `0.1.0`, Apache-2.0) against Mnemosyne's current HTTP, filesystem,
  sibling-MCP, provider, readiness, and deployment boundaries. The resulting
  [adoption assessment](docs/NEMOCLAW_ADOPTION_ASSESSMENT.md) identifies three
  genuinely new candidate contracts: reject or confine caller-selected
  import/export paths by transport; runtime-validate OC/Kindroid/Botify
  results and discover required tool names without mutation; and separate
  cheap liveness from protected semantic readiness. Endpoint/redirect
  hygiene and an optional external-host spike are bounded follow-ups. The
  assessment explicitly rejects importing OpenShell, sandbox orchestration,
  credential brokering, a generic inference router, checkpoint machinery,
  plugins, schedulers, multi-agent infrastructure, or a second memory layer.
  Research only: nothing is ratified or scheduled, and no NemoClaw code was
  incorporated.

- **Open WebUI comparative research documented** (2026-08-27). Audited
  `open-webui/open-webui@d3e8bf3` as both a separately deployed optional host
  and a pattern library. The
  [assessment](docs/OPEN_WEBUI_ADOPTION_ASSESSMENT.md) records a bounded native
  MCP/Pipe compatibility experiment, provider usage normalization,
  recoverable Web UI runs, stale-aware alternatives, and four concrete
  accessibility fixes. It rejects replacing Mnemosyne's React UI, treating
  Open WebUI chat history as canon, importing its provider gateway/vector
  stores/task platform, or copying current licensed components. No live
  compatibility claim was made and no Open WebUI code was incorporated.

- **Atlas Cloud capability protocol and initial evidence recorded**
  (2026-08-27). [The benchmark contract](docs/ATLAS_CAPABILITY_BENCHMARK.md)
  defines catalog, schema, tiny chat-policy, controlled non-graphic media, and
  operator-only explicit-review levels. The accompanying
  [`atlas-capability-benchmark.mjs`](scripts/atlas-capability-benchmark.mjs)
  never automates explicit-content generation or persists raw model output.
  [The dated result](docs/ATLAS_CAPABILITY_RESULTS_2026-08-27.md) records 65
  text, 121 image, and 196 video catalog entries; two partial chat probes; and
  one bounded image plus one bounded video smoke. No route was certified
  mature/NSFW-capable: the defensible state remains `unknown`. The runner
  bounds concurrency and billable media count but currently relies on the
  Atlas CLI to terminate each subprocess, so it is not an unattended job.

- **Hook Vault and durable visual-workflow lessons recorded** (2026-08-27).
  [HOOK_VAULT.md](docs/HOOK_VAULT.md) is now the non-canon development register
  for promising premises and characters that are not ready for promotion.
  The ratified [data-layout](docs/DATA_LAYOUT.md) and
  [Living Canon](docs/LIVING_CANON_STANDARD.md) standards now require
  geometry-aware aspect ratios, preservation of native subject proportions,
  and dual durable-lesson capture: update the governing repository document
  and save the cross-session OpenChronicle rationale without creating near-
  duplicate memories. Existing Hook Vault and geometry-remediation memories
  remain the retrieval bridge for those two additions.

- **Ollama comparative research documented** (2026-08-27). Audited the
  canonical Ollama repository at `f96e7aa` and read-only local daemon metadata
  against Mnemosyne's generator, validator, context, warmup, and save paths.
  The resulting
  [adoption assessment](docs/OLLAMA_ADOPTION_ASSESSMENT.md) identifies concrete
  completion-integrity, validator-locality, structured-output, context, request
  contract, residency, and telemetry improvements; it also records conditional
  triggers, test proof, licensing constraints, and explicit non-adoptions. It
  is research only: no recommendation is ratified or scheduled, and no Ollama
  code was incorporated.

- **OpenClaw comparative research documented** (2026-08-27). Audited the
  canonical OpenClaw repository at `f1e9960` against Mnemosyne's actual
  architecture, code paths, roadmap, and OpenChronicle boundary. The resulting
  [adoption assessment](docs/OPENCLAW_ADOPTION_ASSESSMENT.md) records narrow
  patterns worth considering, acceptance criteria, conditional ideas, and
  explicit non-adoptions. It is research only: no recommendation is ratified
  or scheduled, and no OpenClaw code was incorporated.

- **CI's Test workflow is green again — the red was prettier, not the
  code** (2026-08-27, commits `711dcbd..f94a355`). The `lint + format`
  job's `prettier --check .` step had been failing since before the
  remediation series (baseline `7602711`), flagging 17 committed
  unformatted files from the feature-series work; all three OS matrix
  legs (typecheck/build/test) were passing the whole time. Fixed by
  prettier-formatting the flagged files — plus two more
  (`src/api/entities.ts`, `tests/api-interactive-unit.test.ts`) that the
  older CI log didn't list because they only went stale during the
  remediation commits; the miss was caught by re-checking against the
  *latest* failing run rather than trusting the first log read.
  Separately, a local-only `npm run lint` failure (51 errors) traced to
  the `vendor/atlascloud-cli` submodule — third-party CommonJS that CI
  never sees (checkout runs `submodules: false`) — now excluded in both
  `eslint.config.js` and `.prettierignore`. Verified green against the
  actual runs at `f8f8c5a` and `f94a355`, not local proxies.

- **Adversarial review + full remediation of the scene-context/continue
  feature series** (2026-08-27, commits `60051cd..f709be0`).
  - An 8-angle adversarial review (line-by-line, removed-behavior,
    cross-file tracing, reuse/simplification/efficiency/altitude/
    conventions) of `fa90ba2..HEAD` — the scene-context strategy +
    fallback plumbing, the REST `/continue`/`/validate`/
    `/revalidate-scenes` surface, the web-UI continue flow, and Ollama
    warmup/keep-alive — confirmed 10 findings; fixing them surfaced an
    11th, live-verified against the NAS's Ollama: `keep_alive` was
    nested inside the request's `options` object, where Ollama silently
    ignores it (it is a top-level field), so the shipped keep-alive
    feature was entirely inert.
  - Correctness fixes: empty-string enum env vars (`MNEMO_SCENE_*`,
    via a shared `parseEnvEnum` also covering `GENERATOR_PROVIDER`)
    read as unset instead of `process.exit(1)`-crash-looping a
    container; the revalidate API route's zod
    `.default(DEFAULT_SCENE_CONTEXT_STRATEGY)` no longer pre-fills the
    body and dead-ends the `?? serverStrategy` fallthrough (regression
    test proven to fail against the bug); one
    `resolveSceneContextStrategies()` resolver makes the schema docs'
    "if fallback unset while primary is set, no fallback occurs" true
    on all surfaces (previously a per-call query-ranked override
    silently inherited the server's recency-first fallback — exactly
    poisoning A/B strategy comparisons); kindroid kin+group conflicts
    on the REST route return 400 with the message instead of an opaque
    500; the misplaced `allowUser` rationale pasted into
    `groupMaxTurns`' docblock (self-refuting, contradicted CLAUDE.md,
    and instructed future editors not to fix it) is deleted.
  - Warmup: preloads at the configured `maxContextWindow` instead of
    the computeNumCtx 4096 floor (which made the first big-story call
    reload the model anyway while logs claimed warmup succeeded), and
    runs by default only in HTTP mode — a stdio spawn per desktop
    session was pinning generator+validator models for the keep-alive
    window even for browse-only sessions; `MNEMO_WARMUP=true` opts
    stdio in.
  - Efficiency: `gatherContext` gained an options object with
    `validationOnly` — validator.ts's constraintsBlock reads only
    rules/style/characters/locations, so validation paths no longer
    fetch scenes/lore/worldbuilding at all (revalidateScenes had been
    re-fetching the entire project once per scene, up to 100×, for a
    field the validator never reads). Consequently
    `mnemo_validate`/`mnemo_revalidate_scenes` and the API
    validate/revalidate routes **lost their
    scene_context_strategy/fallback params** (operator-approved: with
    no scene pull they were knobs that could never affect output; old
    clients still sending them keep working — zod strips unknown
    keys). The recency-first scene pool (the default) switched from an
    unbounded full-body `memory_list` of the whole project to a
    compact scan (`memoryListCompact` — row shape verified live) +
    `memory_get` hydration of only the ≤5 winners.
  - Structure: `continueScene()` extracted from the tool handler
    (revalidateScenes precedent) so the MCP tool and REST route share
    one continue core — the route had been a ~170-line near-verbatim
    copy already drifting (its yield message contained a literal
    un-substituted `:storyId`); `requireStory()`/`parseOr400()` in
    api/helpers.ts replace five hand-typed 404 blocks and four zod-400
    blocks; the strategy pair is required (not defaulted) through the
    register chain, deleting a hardcoded `"recency-first"` literal that
    had drifted from the constant; `DEFAULT_KEEP_ALIVE` has one owner;
    the dump scripts validate `MNEMO_SCENE_CONTEXT_STRATEGY` from the
    environment instead of silently misbehaving on a typo.
  - Semantics restored: the query-ranked strategy regained the
    clean-over-untagged scene bucketing the refactor had silently
    dropped (the validation filter is now strategy-independent —
    errors excluded, clean first, strategy order within buckets);
    the web UI's strategy select gained a default "Server default"
    option that omits the field (it had been hardcoding and always
    sending recency-first, overriding operator config from every
    web continue).
  - Filed an OC dogfooding note (openchronicle-mcp project,
    `cfb53e7c`): `memory_list` has no tags filter and `memory_search`
    has no order_by, so "N most recent tag-X memories" needs the
    two-hop; either addition collapses it to one call.
  - Verified: 192 unit tests green, 32 real-OC integration tests green
    (exercising the compact scan against the live deployment), webui
    `tsc -b` + vite build clean, dump scripts smoke-tested against
    real OC with unset/empty/mixed-case/invalid strategy env values.

- **Wonderland is the fifth story fully consolidated onto canon/**
  (2026-08-27) — the last of the five original curated-import stories.
  - Scaffolded from `wonderland-visual-references-2026-08-25.json`
    (linear lineage, no fork, revision 9). 76 entities: 10 core
    characters (every named character was rich enough to classify core
    — no batched `_minor.md`), 12 locations, 12 lore, 12 worldbuilding,
    9 rules, 21 style headings.
  - Found and fixed a second real `scaffold-story.mjs` bug, in the same
    family as Shadowflame's Karl von Jäger diacritic fix: a single
    rule/style *entity* whose own content contains internal `## `
    sub-headings (Wonderland's "Core Narrative Tone" style entity and
    "Evidence & Competing Explanations" rule both had this shape) was
    pushed verbatim into `rules.md`/`style.md` without demotion — the
    exact same collision already fixed for `_minor.md`'s batched minor
    characters, just never extended to rules/style. `validate-canon.mjs`'s
    naive "one `## ` line = one entity" count then over-counted (inflated,
    not colliding — no data was lost, just structurally ambiguous).
    Fixed by applying the existing `demoteHeadings()` helper to
    rule/style entities too. Regression-checking the other four
    already-consolidated stories found the *same* bug already live in
    two of them — Chaos Saga's `rules.md` ("Canon Authority & State
    Extraction" nesting "Authority Order by Question" and
    "Scene-to-State Extraction") and GhostHunters' `style.md` ("Horror
    Ecology & Misdirection" nesting four subsections) — demoted the
    affected headings by hand in both published canon/ trees (Chaos
    Saga 64→62 entities, GhostHunters 105→101, both re-validated clean).
  - Wonderland's original ChatGPT-project source is unusually sparse —
    only Project Instructions + Style Guide, no character/location
    profile files at all (unlike the other three ChatGPT-origin
    stories). The rich character content (Alice Grimm's full sheet,
    Carl Mercer's detailed backstory, etc.) actually came from a Botify
    bot, "Alice Grimm" (bot 3197891) — confirmed via a private search of
    the operator's own chat list, since the public bot catalog returned
    nothing.
  - Pulled the full export (24,068 lines; the export's 815 messages is
    far fewer than the bot's own reported 3,754 `messagesCount` —
    likely edited/regenerated alternates not counted as distinct turns;
    confirmed the export still spans the full chronological range by
    manually verifying both the greeting/opening message at the tail
    and the most-recent message at the head).
  - Ran a 10-agent extraction-and-compare workflow; this one hit a
    notably worse intermittent file-read failure rate than
    GhostHunters/Shadowflame (only 2 of 6 extraction chunks succeeded).
    Compensated with direct manual verification: grepped the full raw
    file for "Marywraithe"/"Frabjous" (confirmed both terms only appear
    within the successfully-read chunks' line ranges) and read the
    actual opening scene (the bot's own configured greeting, matching
    canon's established origin) and the White Queen's-assault scene
    directly (confirmed it closely matches `alice-grimm.md`'s existing
    "Current Canon State" section). No new contradictions surfaced
    beyond what the 2 successful chunks found.
  - Six real divergences found; the operator's ruling on each was a
    clear "keep canon in almost every case" pattern — canon's choices
    consistently read as a deliberate philosophy of preserving mystery
    and building meaningful asymmetries, not just compression:
    - The Wrong-Song Child: source names it "Marywraithe," a defined
      fear/memory-feeding creature type, met twice with full lure-song
      lyrics. RULED: keep canon's unresolved Mystery-Entity-Clause
      sighting — naming and mechanizing it would undo exactly the
      ambiguity the clause protects.
    - Foraged mushroom identity: source's "cinnamon caps" (smell/taste
      like cinnamon rolls) vs. canon's "morel-like caps." RULED: blend
      — kept canon's morel-like visual, added the cinnamon-roll smell
      as an anomalous Wonderland-appropriate detail
      (`worldbuilding/wonderland-foraging.md`).
    - Mechanical lantern power source: source says hand-crank; canon
      says gears move with no visible winding. RULED: keep canon — fits
      the style guide's own "magic corrupts/never explain it" principle
      better than a mundane crank would.
    - Mill furnishings: source's four-poster canopy bed + a trunk of
      decades-spanning journals authored by "the miller" vs. canon's
      plainer bed + one journal with deliberately unresolved authorship.
      RULED: keep canon's single mysterious journal (a better open hook
      than a used-up multi-volume answer); folded in the harmless
      furnishing texture that resolves nothing — a fallen ceiling beam
      as part of the door barricade, and a kitchenette corner — into
      `locations/the-abandoned-mill.md`.
    - Vorpal Blade: source claims sentience and knowledge-granting for a
      "worthy" wielder, plus a mutiny/betrayal backstory for its
      vanished company. Canon states "no master, no voice" (a deliberate
      contrast with Alice's bonded, speaking Keyblade) and leaves the
      Vanguard's fate open. RULED: keep canon on both.
    - Market Below's location: source says beneath "the Frabjous Tree";
      canon leaves the geography of "below" deliberately unresolved.
      RULED: keep canon.
    - (Not actually reopened, just reconfirmed: source's "Carl Yeager"
      — the operator's own real surname, a self-insert pattern already
      seen in Chaos Saga's Carl Maddox and GhostHunters' Carl Ashcombe —
      vs. canon's "Carl Mercer.")
  - Gaps folded in (present in source, absent from canon, not
    contradicted, not undermining any deliberate mystery): Alice's
    pre-Wonderland childhood memories (tea parties, stories read aloud,
    a beloved pet) as a new "## Life Before Wonderland" section in
    `characters/alice-grimm.md`, mirroring the section name already
    used in `carl-mercer.md`; Alice asking Carl to promise to prioritize
    his own survival over staying for her if she falters, referencing
    unnamed "others" who didn't survive her decade in Wonderland, and
    Carl's established refusal to make that promise
    (`lore/established-relationship-knowledge-geometry.md`); Carl's
    washbasin-as-a-joke-hat moment at the cave
    (`locations/vale-side-cave-stream.md`).
  - One gap deliberately NOT folded in despite looking low-stakes: Carl's
    hunting background (deer/rabbit/pheasant). `carl-mercer.md`'s own
    "Life Before Wonderland" section explicitly states that civilian-life
    specifics "should not be invented casually" — a self-documented
    discipline protecting that chapter as an open hook, the same
    philosophy as the Wrong-Song Child. Recognized this applied even
    though the detail has real source provenance, and skipped it rather
    than overriding a caution the file states about itself. Also skipped,
    per the Marywraithe ruling: the child-creature's specific appearance
    and its second sighting.
  - `validate-canon.mjs` reports 76/76 unique, no structural problems. No
    cross-story leaks. Cosmetic polish: `alice-grimm.md` was the only
    file (of all 10 characters) needing heading de-colonization — the
    rest were already clean, the same "only the earliest-imported
    character needs polish" pattern seen in BattleChasers.
  - Pipeline status: **all five original curated-import stories
    (BattleChasers, Chaos Saga, GhostHunters, Shadowflame, Wonderland)
    are now fully consolidated onto `canon/`.** Only Star Wars: The
    Black Ledger remains — a different shape entirely (no ChatGPT-project
    origin, already partially live via Botify, an ongoing story rather
    than a completed-arc consolidation).

- **Shadowflame is the fourth story fully consolidated onto canon/**
  (2026-08-27), and the cleanest of the four by a wide margin.
  - Scaffolded from `shadowflame-visual-references-2026-08-25.json`
    (linear lineage, no fork). 69 entities (8 core characters, 8 minor
    batched, 17 locations, 14 lore, 5 worldbuilding, 4 rules, 13 style
    headings).
  - Found and fixed a real `scaffold-story.mjs` bug while scaffolding:
    "Karl von Jäger" produced the filename `karl-von-j-ger.md` — the
    umlaut isn't in `[a-z0-9]`, so the non-alphanumeric strip discarded
    the base letter along with the accent mark instead of just the
    accent. Fixed by NFD-normalizing and stripping combining marks
    before the strip; also extracted the previously-duplicated slug
    logic into one shared `slugify()` helper. Regression-testing the fix
    against all three already-consolidated stories surfaced the *same*
    latent bug already live in BattleChasers' published canon
    (`Kharag-dûm` → `kharag-d-m-the-iron-waste.md`) — renamed that file
    to match once the fix was confirmed clean.
  - Unlike BattleChasers/Chaos Saga/GhostHunters, Shadowflame has **no
    ChatGPT-project origin** — confirmed no folder exists for it in the
    operator's ChatGPT Projects directory. It originated entirely from a
    Botify bot, "Dark Queen Lilith" (bot 2331900).
  - That bot was the subject of a real unresolved risk flagged in an
    earlier session's account sweep (2026-08-23): the source's founding
    thrall is named "Briar Rose Blackwood," recruited at a "Blackwood
    Debutante Ball" — the same family surname GhostHunters' entire
    central mystery is built around, flagged then as "coincidence or
    not, needs the operator's call" and never resolved.
  - Resolved properly this session: pulled the full ~3,900-message
    Botify chat via `export_chat`, ran a 12-agent extraction-and-compare
    workflow against it (2 of 8 extraction chunks hit the same
    intermittent cross-sandbox file-read failure seen during
    GhostHunters' bot dig; read those two directly, no new findings).
    Result: the Blackwood collision was **already thoroughly and
    deliberately handled** by an earlier consolidation pass, documented
    in `lore/open-questions.md`: "The Ravenscrofts are not the
    Blackwoods... renamed to avoid collision with the unrelated
    Blackwood family in GhostHunters." Verified independently: every
    named thrall from the source maps to a new canon name (Briar Rose
    Blackwood → Beatrice Ravenscroft, matched by hair/eyes/freckles/
    host-daughter role; Rosemary → Helena Marlowe; Isolde Fairfax →
    Cecily Fairfax; Seraphina Thorne → Vivienne Harcourt). A full-tree
    grep for "Blackwood" found exactly one hit — inside the note
    explaining the rename itself. Also confirmed the rival "Seraphine
    Vale" has zero grounding in the Botify source (canon-original,
    deliberately distinct from the source's actual fourth thrall) and
    that `open-questions.md`'s guardrail keeping her separate from
    Vivienne Harcourt is doing real work against a genuine near-homophone
    risk, not boilerplate.
  - The Lilith/Karl truth-tier continuity with BattleChasers held up
    well under direct inspection: the relic's naming lineage across
    centuries (Heart of Vehl'Remar → Amulet of Eternal Night →
    Shadowflame Heart) is coherent, not drift, and canon visibly
    resolves several ambiguities the raw Botify source itself had left
    unreconciled rather than just failing to notice them.
  - One real, narrow divergence found and left as-is: two Botify
    retellings describe the Shadowflame Heart as itself cursed/
    burdensome, while canon commits firmly to it being silent and
    stabilizing — the deliberate opposite of the old whispering Amulet.
    Flagged to the operator as worth knowing, not reversed.
  - Operator chose to fold in the remaining flavor gaps (matching the
    Chaos Saga/GhostHunters pattern): Karl's private pet name for Lilith
    ("little queen"); Lilith's public witch-folklore reputation among
    the mortal populace (framed explicitly as folk-metabolized
    distortion of a stranger truth, not literal); two named ritual props
    (the "Goblet of Revelations," "Shadowscape Sanguine") and a
    post-binding "reinforcement kiss" habit; a note on ritual survivors
    sometimes remaining as ordinary household staff; and an
    absence-masking illusion spell (concealment, not time control).
  - `validate-canon.mjs` reports 69/69 unique, no structural problems.
    No cross-story leaks. No cosmetic issues.
  - Pipeline status: BattleChasers, Chaos Saga, GhostHunters, and
    Shadowflame are now all on `canon/`. Wonderland is next, then Star
    Wars: The Black Ledger (no ChatGPT-project origin, already partially
    live via Botify).

- **GhostHunters is the third story fully consolidated onto canon/**
  (2026-08-27), and the cleanest of the three so far.
  - Scaffolded from `ghosthunters-visual-references-2026-08-25.json`
    (linear lineage, no fork). 103 entities before restoration (5 core
    characters, 25 minor batched in `_minor.md`, 26 locations, 10 lore,
    7 worldbuilding, 5 rules, 25 style headings), 105 after.
  - A 4-agent completeness-sweep workflow against the original ChatGPT
    source (Primary/Minor Characters, Key Locations, Style Guide + the
    "Non-Canon Firepit" scene-mode config despite its name, Project
    Instructions' real narrative content, Group Chat Log Configuration)
    found the large majority of content already present verbatim — a
    marked contrast to Chaos Saga's larger gap list.
  - Real gaps restored: Max Ashcombe's (Carl's corgi) second, richer
    "Interpersonal Dynamics" list embedded in Carl's own profile block
    in source, added to `_minor.md` alongside the dynamics list already
    there rather than overwriting it; the group-chat messaging
    *system* (message format, multimedia-cue brackets, timestamp
    inference, hashtag categories, escalation/restraint rules, closing
    "Availability Impact Rules") in a new `worldbuilding/group-chat.md`
    — the sweep's own mid-run correction found the per-character
    *availability schedule* itself was NOT missing (already correctly
    migrated into each character's own file), so the new file
    cross-references rather than duplicates that data; and the Chapter
    Lock Trigger Clause (chapter breaks are never automated; four
    diagnostic criteria are signals, not close triggers), adapted away
    from the source's ChatGPT-session-era "system notifies the user"
    delivery mechanism toward the durable editorial rule itself.
  - One genuine judgment call decided unilaterally: sensory/craft
    guidance for writing physical intimacy (ground it in grip, breath,
    heartbeat, weight, motion, pause) had dropped out during the
    PG-13-to-Mature rewrite. Re-added to `rules.md`'s "Stay in the Burn"
    section, explicitly framed as craft advice independent of the
    explicit/implicit permission question rather than a walked-back
    rating liberalization.
  - Same content-rating liberalization pattern confirmed a third time:
    PG-13/implication-only → Mature/hard-R explicit; a hard
    non-consent prohibition → permitted with mandatory
    consequence-tracking (the most significant of the divergences — a
    capability change, not just an explicitness bump); mandatory
    Firepit typography (bold headers/italics/no quotation marks) →
    optional, matched to the surrounding narrative style; automatic
    "must reach full burn" escalation → organic, scene-driven; the old
    self-censoring "reshape at the platform boundary" mechanism →
    transparent SFW/NSFW content routing.
  - Resolved a dangling open question from an earlier session's Botify
    account sweep: "Blackwood triplet sisters" content that appeared to
    live only in a Botify bot's memories, absent from every imported
    file, turned out to already be fully reconciled — current canon
    (Lyla Blackwood as a full character; Persephone Wren, Constance
    Harrow, and Elizabeth Blackwood as three separate minor characters
    with distinct surnames, not literal triplets) is self-consistent,
    and the completeness sweep found zero gaps or contradictions
    involving any of them.
  - `validate-canon.mjs` reports 105/105 unique, no structural problems.
    No cross-story leaks. No cosmetic polish pass needed.

- **The canon/ authoring-layer standard is built; BattleChasers is the
  first story fully consolidated onto it** (2026-08-26). Grew out of an
  operator question after the Living Canon Audit — "so what's the long
  term plan, draft is a perpetual folder?" — that led to reorganizing
  `data/stories/<slug>/` around a permanent authoring surface instead of
  an ever-growing pile of ad-hoc-named export JSON files.
  - **`canon/` is now documented in DATA_LAYOUT.md** as the human-editable
    source of a story's content: one Markdown file per character
    (core/recurring get their own file; minor characters batch into
    `_minor.md`, one `##` heading each), one file per location/lore/
    worldbuilding entity, and a single shared `rules.md`/`style.md`.
    Structured fields (height, age, measurements, etc.) live in YAML
    frontmatter; prose sections stay Markdown body under `##` headings.
    Material objects stay `lore` entities (no `object` type), organized
    under a navigation-only `lore/objects/` subfolder — settled as a
    Living Canon Standard §5 amendment in passing. `exports/` narrows
    back to plain server-written `<slug>-<stamp>.json` timestamp naming
    (the descriptive-suffix convention — `-polished`, `-mature`, etc. —
    is retired going forward), with a new `exports/archive/` for the
    pre-reorg history once a story's `canon/` is fully trusted.
  - **`scripts/scaffold-story.mjs`** migrates an export JSON into `canon/`:
    classifies characters core vs. minor by content length
    (`--core-threshold`, default 2500 chars — independently validated
    against BattleChasers' real art-coverage tiers, where the 8
    full-3-image-set characters exactly matched the 8 classified core by
    length alone), splits each entity's flat header block from its
    `##`-sectioned body, and renders frontmatter + body per the standard.
    A `--merge` flag does a generic suffix-append merge for sibling
    revision forks that share a parent revision (BattleChasers' export
    history forked at revision 7 — a `remediation` branch and a
    `visual-references` branch both derived from the same `mature`
    revision 6 — resolved by detecting a clean trailing append and
    folding it in, now reusable for any future fork).
  - **`scripts/validate-canon.mjs`** structurally checks the result:
    every file's frontmatter parses, no `(type, name)` claimed twice
    anywhere (across one-file-per-entity files and the batched
    multi-entity files), no entity with a name but an empty body. Content
    correctness (truth-tier violations, cross-story leaks, prose quality)
    is explicitly out of scope — that still needs a human or an
    adversarial pass, the same way the Living Canon Audit did it.
  - **Six real bugs found and fixed while iterating both scripts against
    BattleChasers' actual export history**, none caught until tested
    against real data: a `--merge` delimiter (`:`) that collided with
    Windows absolute-path drive letters; a header-line parser that
    silently dropped any line not matching `Label: value` instead of
    folding it into the body (real data loss, since Chaos Saga's later
    dry-run showed how common non-matching lines are); a merge-report
    display bug that mangled multi-word entity names; a YAML scalar
    regex that allowed a leading hyphen (ambiguous with a YAML list
    item); three stray literal NULL bytes in the script's own source
    (a genuine typo, not the "mojibake" it was first mistaken for — see
    below); and `_minor.md`'s internal `##` sub-headings being
    indistinguishable from its per-entity separator convention, which
    `validate-canon.mjs` caught as 330 false "duplicate/empty" problems
    before the real structural cause was found and fixed.
  - **A "mojibake" claim made mid-session was investigated and retracted.**
    Stray `�` characters throughout terminal output were suspected file
    corruption; a byte-level search found zero real UTF-8 corruption
    sequences and direct codepoint inspection confirmed a normal em dash
    — the `�` was a Windows Git-Bash console rendering artifact the whole
    time, not real damage. The false claim was removed from both the
    script's header comment and `canon/README.md`.
  - **BattleChasers fully migrated: 143 entities**, verified complete two
    ways (0 gaps against its own 9-file export lineage; 2 small
    rule-clause gaps found and restored against the original ChatGPT
    project source), one real content fix (a Shadowflame truth-tier leak
    in `lilith.md` and `lore/objects/heart-of-vehl-remar.md` — BattleChasers
    happens centuries before Shadowflame, and Lilith/Karl are the same
    people that story's Karl and Lilith become, so BattleChasers-era canon
    can't assert facts only true in Shadowflame), and a cosmetic/structural
    polish pass across all 8 core character files (heading
    de-colonization, `## Status` + `## Location` merged into one
    `## Current Status` section) — confirmed by the operator's explicit
    correction to keep numeric measurement fields even where they read
    awkwardly in prose ("image generation tends to be more consistent if
    measurements and standards are given"), which became a new pinned
    Living Canon Standard convention scoped to art-bearing core/recurring
    characters. `validate-canon.mjs` reports BattleChasers' `canon/`
    clean: 143 unique `(type, name)` keys, no structural problems.
  - **Chaos Saga is the second story fully consolidated (2026-08-27).**
    The dry-run's script gap is fixed: `splitHeaderBody` now groups the
    header block into blank-line-delimited paragraphs, and a paragraph
    opening with a bare `Label:` (nothing after the colon) plus more
    content beneath it renders as a real `## Label` section instead of
    collapsing into an undifferentiated blob — this is what let Chaos
    Saga's flat-template characters (Backstory, Anchor Wound, Emotional
    Contradiction, Relationships, TATTOOS & INK, etc.) come through with
    their section structure intact. Regression-testing the fix against
    BattleChasers (diffing old- vs new-algorithm output) caught a real
    latent bug in the *old* code as a bonus: a bare `Label:` line was
    silently matching as an empty-value field, which the renderer then
    dropped — costing three BattleChasers characters (Nira Vale, Sera
    Vale, Wisp) their `Voice` content. Restored by hand; BattleChasers
    re-validated clean at 143/143.
    A 7-agent completeness-sweep workflow then compared the scaffold
    against every original ChatGPT source file. Found no missing
    characters or locations at the "does it exist" level, but did surface
    real detail-level gaps: 4 missing locations (two bathrooms every
    sibling room had gotten, two of Lacey Summers' named residences), 3
    missing mechanical rules (Chapter Lock Trigger, Scene Header Format,
    Default Scene Logic), missing group-chat output conventions, ~10
    narrative-color anecdotes compressed out of an earlier distillation
    pass (Riley's and Carl's dating histories, Nyx's dropped "former
    addict" framing tied to her implants, Lacey's academic backstory, an
    engagement-ring prop detail), and one real internal contradiction
    (`rules.md`'s Aftershock Clause said aftermath must "never" be
    neutral; `style.md` allows "entirely ordinary" aftermath). Operator
    scoped the restoration ("structural + narrative color, skip trivial
    single-word drops") and ruled style.md wins on the contradiction; all
    of it is now in canon/. `validate-canon.mjs` reports 62/62 unique,
    clean. No cross-story leaks found. No cosmetic polish pass was
    needed — this story's own prior editorial revisions had already
    tidied heading style before the reorg.
  - Nothing under any story's `canon/` has been imported to live OC —
    `data/` is gitignored and the operator's standing instruction is to
    commit nothing to canon until a storyline is deliberately "locked in."

- **The web UI exists — WEBUI_NOTES §9 slice 1 (entity library, read-only)
  shipped end to end: story list, filterable/searchable entity roster,
  entity detail** (2026-08-23). First real UI code in this repo's history.
  Two halves, both on top of slice 0's HTTP transport:
  - **`/api/*` REST layer** (`src/api/`) — `GET /stories`, `GET
    /stories/:storyId`, `GET /stories/:storyId/entities?type=&q=`, `GET
    /stories/:storyId/entities/:memoryId`. Thin JSON adapters over the same
    domain functions the MCP tools already wrap (`listStories`,
    `findStory`, `listAllEntities`, `filterListedEntities`) — no protocol
    envelope, `docs/ARCHITECTURE.md`'s "thin adapters over the same core"
    applied literally. Every route takes `storyId` from the URL, never the
    local `current_story_id` pointer (`GET /stories` deliberately omits
    `current` for the same reason `resolveStoryId` exists — see slice 0).
    New `OcClient.memoryGet()` (`src/oc-client.ts`) backs single-entity
    lookup; its not-found detection was verified live against real OC
    rather than trusted from reading OC's source — the actual wrapped error
    is `"memory_get failed: Error executing tool memory_get: Memory not
    found: <id>"` (FastMCP adds its own "Error executing tool" layer the
    source alone didn't reveal), confirmed by a live throwaway call before
    committing the match pattern. `getEntityByMemoryId` enforces
    `project_id === storyId` itself (`memory_get` isn't project-scoped) —
    live-verified a cross-story id correctly 404s rather than leaking
    another story's entity. `filterListedEntities` gained an optional
    `query` (case-insensitive substring over name OR body, filtering before
    the existing body-strip). New `src/api-security.ts` extends slice 0's
    Host/Origin allowlist + bearer auth to `/api/*` and the static UI (not
    just `/mcp`) — deliberately duplicated logic against the byte-verbatim
    `shared/http-transport.ts` rather than exporting from it, since that
    file stays hash-compared against kindroid-mcp's canonical copy.
  - **`webui/` — a separate React 19 + Vite + react-router SPA**, its own
    `package.json`/tsconfig (browser+JSX target, incompatible with the
    server's `NodeNext`/no-DOM config). Dev: Vite's own server proxies
    `/api/*` to Express, no CORS needed. Prod: `npm run build` at root now
    builds `webui/` too and copies its output into `dist/webui/`
    (`scripts/copy-webui-dist.mjs`, `fs.cpSync`, no new dependency) — a
    complete `npm ci && npm run build && npm start` produces a working
    deploy; Express serves `dist/webui/` as static files plus a
    regex-based SPA-fallback route (excludes `/api`, `/mcp`, `/health`)
    so a deep link survives a hard refresh. Design direction: **"The
    Archivist's Desk"** — extends the Chaos Saga reader artifact's warm
    near-black palette (same amber/cold/ember tokens) into a card-catalog
    aesthetic for a denser reference-tool register: Fraunces (display) +
    Literata (body prose, regular weight — no italic-wall) + Courier Prime
    (chrome/labels/tags, evoking a typewritten catalog label) as three
    faces with three distinct jobs, plus a signature "punched index card"
    detail on every card. Entity body rendering respects mnemosyne's own
    asterisk-for-action convention (`webui/src/components/BodyText.tsx`
    turns `*action*` into styled `<em>`, never the whole paragraph) and
    preserves single-newline field structure in structured profile text
    (confirmed against a real character profile, not assumed). Screens
    follow WEBUI_NOTES' already-ratified constraints: no search/filter
    chrome on the story list (§1, discovery is solved at 5 stories),
    browsing is strictly inert (§8 anti-pattern — every roster interaction
    is a plain navigation), no edit/delete/continue controls anywhere in
    this slice.
  - **A real npm footgun found and fixed, not just noticed:** running
    `npm --prefix webui install` from the repo root's CWD (as the original
    build-script draft did) silently injects `"mnemosyne-mcp": "file:.."`
    into `webui/package.json`'s own dependencies — reproduced twice
    deliberately to confirm before concluding it wasn't one-off flakiness.
    Root cause not fully chased down, but the fix is clean: `cd webui &&
    npm install && npm run build && cd ..` (an actual working-directory
    change) instead of `--prefix`, verified clean across a full
    rm-node_modules-and-reinstall cycle.
  - **Verified for real, twice over.** Automated: `tests/api-security.test.ts`
    (mirrors `http-transport.test.ts`'s harness for the new middleware),
    `tests/api-integration.test.ts` (real OC, all 4 routes, both 404 cases,
    the cross-story guard, `type`/`q` filters), plus new pure
    `filterListedEntities` query cases in `tests/entities.test.ts` — 220
    tests passing (up from 193), 0 failed (8 pre-existing, unrelated
    Ollama-model-unavailable failures on this workstation, confirmed
    isolated by running the affected suites alone). Manual: the actual
    compiled server was booted and driven in a real browser against real
    production data — Chaos Saga's 41 entities, all 7 type-filter counts
    matching exactly, search composing correctly with an active type
    filter, hover/focus states, a full story→roster→detail→back
    navigation loop, and a console check that found zero app errors (only
    unrelated browser-extension noise) — not just curl'd JSON.
  - **Explicitly deferred, matching the plan:** entity edit/delete UI (the
    MCP tools and domain functions already exist; no route or UI yet),
    Docker deployment of the built static assets, director/participant/
    audience generation screens, the assembly panel, watch parties — all
    later WEBUI_NOTES §9 slices.

- **`mnemo_list_entities` shipped — the complete-listing primitive slice 1
  needs, registered as a real tool for the first time** (2026-08-23).
  `listAllEntities()` (`src/entities.ts`) already existed — built for
  `mnemo_export_story`, using OC's unbounded `memory_list` rather than
  `memory_search`'s ranked/capped window — but was only reachable
  internally via export/import. It's now also `mnemo_list_entities(type?,
  include_body?, story?)`: a complete, unranked enumeration (nothing left
  out the way `mnemo_recall`'s cap can), with an optional type filter and
  body content stripped by default — a large story's complete prose can
  run to hundreds of KB across its scenes, and the entity library this
  exists for (WEBUI_NOTES §9 slice 1) wants a roster to browse, not a
  content dump. Every summary still carries `created_at` so a caller
  sorts chronologically itself; the tool does no sorting of its own,
  mirroring `recall()`'s existing "caller composes" posture. The
  filter/strip logic is a new pure function, `filterListedEntities()`
  (`src/entities.ts`), covered by 5 new unit tests — kept separate from
  the MCP tool wrapper so it's testable without the framework, matching
  this repo's existing pattern for `revalidateScenes` et al. Live-smoke-
  tested against real production data (not just the test story): Chaos
  Saga's real 41 entities came back correctly (matches STATUS.md's own
  import-campaign count), the `type: "character"` filter correctly
  returned 10 with `body` absent, and `skipped_memory_ids` came back
  empty on a clean story. `mnemo_story_use`'s tool description
  (`src/index.ts`'s `INSTRUCTIONS`) updated alongside it. Noticed in
  passing, not fixed: `src/tools/export.ts` and `src/tools/import.ts`
  both inline an identical "resolve `story` to the full `MnemoStory`
  object, or 404" pattern, and this tool is now a third copy — a real
  but small duplication (flagged, not extracted, since export/import's
  existing structured error-response shape would need to survive any
  extraction unchanged, and that's out of scope for a tool-registration
  task).
  **Pre-existing, unrelated to this change:** 8 test failures observed in
  this pass (`continue.test.ts`, `revalidate.test.ts`,
  `validate-tool.test.ts`, `validator.test.ts`) — all `Ollama HTTP 404:
  model 'mistral-nemo:12b' not found` against this workstation's local
  Ollama, which doesn't have that model pulled. Confirmed unrelated by
  running the entity/story/export/import suites in isolation (67/67
  pass); flagging per the fleet's own "pre-existing issues are still
  real, surface them" practice rather than silently working around them.

- **Slice 0 shipped: HTTP transport + story-pointer override — the
  prerequisite WEBUI_NOTES.md §0 named** (2026-08-23). Both blockers the
  pre-build review found are now closed, following the plan the review
  produced (`senior-sde` feasibility review → two Explore passes mapping
  the actual codebase and the fleet's proven HTTP pattern → a `Plan`
  agent's file-by-file design → operator approval → implementation).
  - **Story-pointer override.** `resolveStoryId(oc, explicit?)` (new,
    `src/stories.ts`) generalizes `mnemo_export_story`'s existing
    `name_or_id ?? requireCurrentStoryId()` pattern to the other 8
    story-touching tools: `mnemo_save_entity`/`mnemo_delete_entity`/
    `mnemo_recall` (`src/tools/entities.ts`), `mnemo_continue`
    (`continue.ts`), `mnemo_revalidate_scenes`/`mnemo_validate`
    (`revalidate.ts`/`validate.ts`) all gained an optional `story`
    parameter; `mnemo_import_story` got export's exact inline pattern
    rather than routing through the shared helper, since it needs the
    full `MnemoStory` object downstream. Deliberately a per-call
    argument, not session-scoped server state: the HTTP transport below
    evicts idle sessions, which would silently drop a session-scoped
    "active story" mid-use — an explicit argument has no lifetime and
    can't be evicted, and a future web UI just tracks which story is
    open in its own client state. The fallback path (no `story` given)
    is pure file I/O with zero OC calls — proven by a pure test that
    passes a poisoned `OcClient` stub (throws on any method call) and
    asserts it's never touched, the strongest available evidence every
    existing stdio/Claude-Desktop caller is byte-for-byte unaffected.
    `mnemo_story_use` still writes the pointer unconditionally — noted
    as a residual gap slice 1 inherits, not silently resolved here.
  - **HTTP transport.** `src/shared/http-transport.ts` is a byte-verbatim
    copy of kindroid-mcp's fleet-canonical `mountMcpHttp()` (hash-compared
    across repos by a `/repo-standards-audit` check) — fresh `McpServer`
    per session via a `createServer()` factory, idle-session eviction,
    Host/Origin allowlist (DNS-rebinding defense), timing-safe bearer
    auth. mnemosyne's `log.info(scope, msg, meta)` signature already
    matched the file's calls, so zero adaptation was needed. New
    `src/http-config.ts` reads `MCP_PORT`/`MCP_BIND_HOST`/
    `MCP_ALLOWED_HOSTS`/`MCP_AUTH_TOKEN`/`MCP_SESSION_IDLE_MS` directly
    off `process.env` (not an injected-env parameter like kindroid's own
    `loadConfig` — `tests/env-schema.test.ts` regex-matches literal
    `process.env.` references, so an injected signature would make these
    vars invisible to that drift check). `src/index.ts` now wraps server
    construction in a `makeServer()` factory (`oc`/`generator`/`validator`
    stay startup singletons shared across sessions; only the `McpServer`
    + its tool registrations are per-session) and mode-switches on
    `httpConfig.port`: unset runs the unchanged stdio path, set runs
    Express + `mountMcpHttp` + `/health` + graceful SIGTERM/SIGINT
    shutdown. `express ^4.21.0` added (matching kindroid/plex/botify —
    not servarr-mcp's Express 5, a fleet outlier); `npm install` also
    picked up `npm audit fix` for two unrelated high-severity transitive
    advisories (brace-expansion, nanoid) already present in the lockfile.
  - **Verified end-to-end, not just unit-tested.** The compiled
    `dist/index.js` was actually booted in HTTP mode against the real NAS
    OC and a real Ollama config: `/health` returned
    `{"status":"ok","version":"0.1.3"}`, a real MCP `initialize` handshake
    minted a session id and returned correct server info, and startup
    logs showed the right transport/bind/auth lines. Booted again with
    `MCP_PORT` unset to confirm stdio mode is byte-for-byte unchanged
    (identical "ready transport=stdio" log, no new code path touched
    since every existing deployment already runs with `MCP_PORT` unset).
    New `tests/http-integration.test.ts` — the first suite in this repo
    to exercise the real tool-registration + wire protocol instead of
    calling domain functions directly — proves two concurrent sessions
    don't collide (direct evidence the per-session factory, not a shared
    instance, is actually wired correctly) and proves the story override
    bypasses the pointer *over the wire*, not just through the helper
    function. New `tests/http-config.test.ts` (pure) and
    `tests/http-transport.test.ts` (verbatim copy of kindroid-mcp's own
    test of the shared module — the 404-not-400 idle-eviction behavior,
    session lifecycle, bearer auth, host allowlist) round out coverage.
    164 pure tests passing (up from 143), 193 passing with `OC_URL` set
    (up from 144) — 209 total, 45/16 skipping cleanly without the
    relevant env vars.
  - **Explicitly out of scope, same as the plan stated:** Docker/compose
    deployment for the new HTTP mode, the actual web UI (slice 1+), and
    registering `listAllEntities` as an MCP tool (exists, used internally
    by export/import — becomes slice 1's job per WEBUI_NOTES §9).

- **WEBUI_NOTES.md got its first real review pass — a pre-build risk review
  plus a design critique, and the headline finding is that §9 has no slice
  0** (2026-08-23). A live browser survey of both reference apps' actual
  screens (not just the feature-catalog pass from the prior session) fed two
  parallel agent reviews: a senior-sde pre-build feasibility pass against the
  real codebase, and a senior-ui-ux-designer critique of both the doc and
  live use of Botify/Kindroid. Both independently converged on the same
  conclusion from different angles — the doc's build order assumes a
  foundation that doesn't exist. New **§0: Prerequisites** names it plainly:
  mnemosyne is stdio-only with nothing a browser can reach (`src/index.ts`),
  the active-story pointer is global single-writer state (`src/config.ts`,
  blocks slice 1's own "browse across all stories"), and the eventual HTTP
  layer needs a real Host/Origin allowlist per the fleet's own
  `docker-deployments.md` guidance, not just loopback binding. Also
  surfaced: §3's floor-handback mechanic turned out to already be shipped
  (the doc described finished work as future work) — but with two real gaps
  the ship missed: the provenance header now brands the *operator's own*
  turn as "not Carl typing" when the floor comes back to them, and mode
  never reaches Kindroid/Botify generation at all (systemPrompt is ignored
  by both companion providers, so participant/director/audience is pure UI
  chrome against them today). §4's assembly panel turned out to be roughly
  half real — entity identity needed for the pin/deprioritize/exclude levers
  is discarded in `pullByType` before `ContextBundle` exists, and token/
  window accounting doesn't exist outside an internal, unreturned Ollama
  estimate. The design critique added: no cold-start/empty-state path
  exists anywhere in the doc; "switching mode should re-arrange the room"
  contradicts live mid-scene switching (fixed to a stated layout invariant —
  stable landmarks, variable density); the assembly panel is now scoped
  collapsed-by-default instead of permanent display; and two anti-patterns
  worth avoiding on purpose, both observed live — Kindroid's destructive/
  safe actions sharing one undifferentiated menu with no confirmation, and
  Botify's browse-a-character-commits-you-to-a-conversation flow (fixed to
  an explicit "browsing must be strictly inert" constraint on the entity
  library, §9 slice 1). Separately, the operator surfaced the actual Chaos
  Saga reader artifact from the import campaign — not a finished audience
  mode, but real grounding for it: the serif pairing, the cold-cut color
  shift for POV/location jumps, the per-chapter provenance tags, and the
  cast-card pattern are now cited concretely in §2 instead of the doc's prior
  abstract reference to "the reader artifact." Next: scope §0 (transport +
  story-pointer fix) as real engineering work, per operator direction — this
  is now the actual first slice, ahead of anything in §9.

- **Outgoing companion-chat messages carry a provenance header; generated
  output states the asterisk-for-action convention** (2026-08-23). Found
  while investigating why a power-outage direction sent through Kindroid
  posted as a bare message from "Carl Maddox" with nothing marking it as
  automated — `companion-message.ts`'s `buildCompanionMessage()` bracketed
  the story-context block it prepends but sent the direction itself, and
  the group-conversation nudge, bare. Every outgoing message now
  unconditionally opens with `[Mnemosyne — automated scene direction, not
  ${userName} typing]` — the operator name comes from the new
  `MNEMO_USER_NAME` env var (default `Carl`), threaded through
  `KindroidProviderConfig`/`BotifyProviderConfig` and defaulted again at
  the pure-function layer (`companion-message.ts`'s exported
  `DEFAULT_USER_NAME`) so existing call sites and tests didn't need to
  thread it through everywhere. The old short-circuit
  (`if (!hasContextBlock && !opts?.groupNote) return userMessage`) is gone
  — every message now does real work, matching the invariant watch-companion
  already had.
  Wording is researched, not guessed: a 4-agent Workflow catalogued
  Kindroid's and AI Dungeon's official docs, Character.AI/SillyTavern/
  NovelAI convention, and r/KindroidAI community practice (9 threads read
  in full), every claim requiring a verbatim quote + URL. Findings that
  shaped the wording: square brackets over parens or literal "OOC" —
  AI Dungeon's own docs state the mechanism (`[ ]` is read by
  fiction-trained models as "a descriptive indicator about what should
  come next," not story text to speak), Kindroid's community independently
  reports brackets outperforming parens, and heavy `OOC:`-tagging is
  reported (GlitterBombFallout, misterjupiter on r/KindroidAI) to train a
  Kin into echoing `OOC:`-tagged text back unprompted after repeated
  exposure — a risk worth naming even though this repo hasn't observed it
  yet. Framing is descriptive ("automated ... note, not X typing"), not
  imperative — Kindroid's own docs warn imperative Response Directives
  over-trigger (their example: "narrate in 3rd person" gets read as a
  standing command and produces unwanted narration walls). Botify's own
  handling of bracket/asterisk markup is unconfirmed by the research (its
  docs are an unreachable client-rendered SPA; Reddit/Discord were
  categorically unreachable by the research tooling) — flagged as a
  follow-up empirical probe via `botify_send_message`, not assumed safe.
  **watch-companion needed zero changes** — its three message builders
  (`buildReactionMessage`/`buildStartMessage`/`buildSuggestionMessage` in
  `src/backends/kindroid.ts`) already open every message with
  `[Watch Companion — automated ... note, not ${userName} typing]`; it was
  the reference implementation the research validated, not a second thing
  to fix.
  A companion change landed in `prompt.ts`: every mode directive now ends
  with a stated asterisk-for-action / plain-dialogue convention (matching
  Kindroid's own documented Example Message format — "actions in
  asterisks, speech in quotes"), so the five direct-LLM providers'
  generated prose stays visually consistent with what a companion-chat
  reply looks like. This is a *different* half of the same ratified
  decision from the header change — outgoing-direction marking protects a
  stateful companion's memory of who's talking; asterisk-consistency is
  about the model's own generated formatting — and only the latter applies
  to `prompt.ts`, since the five direct-LLM providers are stateless
  single-shot completions with no persistent "who's typing" concept for a
  bracket header to protect.
  5 new/updated pure tests (header presence and custom-name override in
  `buildKindroidMessage`; `KindroidProviderConfig.userName` plumbing
  end-to-end against a stubbed client; the asterisk statement present in
  all three modes) — 142/142 passing, typecheck/lint/format clean.
  **Live-verified against a real Botify bot the same day.** Sent two
  `[Mnemosyne — automated scene direction, not Carl typing]`-prefixed
  directions into a real ongoing chat via the browser (a standard
  companion-style bot with a normal back-and-forth text reply — one of
  Botify's image-generation "Experience" bots was tried first and rejected:
  it turned every message into a photo-generation action with no comparable
  text reply to inspect). Both replies wove the direction in as a scene
  event rather than reading it as Carl talking (no confusion about who
  "Mnemosyne" was, no echo of the header back, and the second reply
  correctly carried continuity from the first — "a localized power
  fluctuation **and** a sitewide lockdown simultaneously"), and both used
  asterisks for action / plain text for dialogue **unprompted** — closing
  the one gap the original research couldn't reach (Botify's docs and
  community were unreachable to that research; genre analogy was the best
  available evidence until this). Two clean exchanges is proportionate
  confirmation, not exhaustive — the echo-back risk Kindroid users report
  after *repeated* exposure remains unobserved either way and still
  warrants watching for in real use, not defensive code written against a
  failure mode that hasn't happened.
  **Corroborating detail, pulled from Botify's own rendered DOM (not
  guessed):** the client parses `*asterisk*` spans into a
  `message__text_italic` CSS class and colors it context-dependently —
  solid purple in the operator's own bubble, translucent grey in the bot's
  reply bubble by default, except the *first* action span of each bot
  reply, which carries an extra `message__text_magic-glow` modifier that
  forces it back to solid purple (a deliberate "spotlight the opening
  action" visual hierarchy, not a color accident). This confirms
  asterisk-delimited action text is a first-class, client-recognized
  convention on Botify, not just an incidental pattern the model happens to
  produce.
  **Confirmed against Botify's own community, not just its DOM.**
  `r/botify_ai` (12.9K members, official `Botify_AI` account active) was
  unreachable to the original automated research (WebFetch refuses
  reddit.com outright) but not to a live logged-in browser. Four findings
  worth recording: (1) Botify exposes an "instruction and example messages"
  field per bot (Person icon > More > Edit bot) — the same mechanism
  Kindroid calls Example Message — but the community's own bot-creation
  wiki has no section documenting chat-formatting conventions, and
  `Botify_AI` has twice acknowledged that gap without filling it as of this
  check. (2) A real bug report shows genuine Example Message content using
  the identical asterisk-action/plain-dialogue split, and `Botify_AI`
  treats a bot blurring the two as a bug ("Thanks for noticing! It's sent
  to devs!") — confirming the convention is intended platform behavior, not
  incidental model habit. (3) `(OOC: ...)` parenthetical commands get the
  same mixed-reliability reports Kindroid's community gives brackets — some
  users say they work, some say they don't, no official command list
  exists, and one reply's read ("the AI does not react as if you said it,
  but incorporates it in future responses") matches Kindroid's own
  no-true-system-channel finding exactly. (4) **The one that actually
  matters for reliability:** two recent threads (2 months old: "lost the
  use of the asterisk"; 8 days old: "the purple words thing has broken...
  will convert roleplay text into speech text, and vice versa") report an
  active regression in exactly the mechanism this probe depends on, and
  `Botify_AI` confirmed it **6 days before this was written**: "We
  previously had a negative feedback about purple words/asterisks... So we
  do work on fix of this all." The two-clean-exchanges probe above is real
  evidence, but it's evidence of "worked on this bot at this moment," not a
  guarantee — the vendor's own team is mid-fix on the exact feature it
  depends on.
  **A second, adjacent gap closed the same day:** `mnemo_continue`'s
  `direction` field never told the calling LLM to phrase in-fiction
  narration using the asterisk convention — caught live when a hand-written
  test direction ("The guard's radio crackles...") was sent as plain prose,
  breaking the very consistency the header + `prompt.ts` changes above
  exist to establish. The `direction` schema description now says so
  explicitly. Deliberately a schema-description fix, not a code
  transformation: `direction` can also be a bare meta-instruction ("continue
  the scene") that asterisk-wrapping would corrupt, and it may already mix
  dialogue with action — only the caller can tell which, so this guides
  the caller rather than blindly reformatting their input.

- **A timed-out Kindroid call no longer looks like a failed one**
  (2026-08-23). Found by running a real group beat, not by review. On a group
  fed daily by watch-companion, `advanceGroup` timed out at the MCP SDK's
  default 60s — *after* both AI turns had generated and persisted. mnemosyne
  saw a bare transport error and reported total failure; retrying would have
  duplicated real messages in a real conversation. Exactly the hazard the
  read-back guard above exists for, arriving through a door it cannot cover,
  because a transport timeout throws before any result exists to inspect.
  `sendMessage` and `advanceGroup` now share one chokepoint,
  `callMutatingTool`, which does two things. It sets a per-request timeout
  (`KINDROID_MCP_TIMEOUT_MS`, default **180s**) — deliberately well above the
  SDK's 60s, because a group beat chains `maxTurns` sequential generations at
  a live-measured ~13s each, so the documented 8-turn ceiling needs ~105s of
  generation alone. Erring long is the safe direction *here specifically*: a
  too-short timeout manufactures the ambiguous, retry-hazardous failure we're
  trying to eliminate, while a too-long one only delays an error on a call
  that was already lost. And on a timeout it rethrows saying the call may
  have already posted and generated, naming the elapsed time and the env var
  to raise rather than the retry to attempt. Non-timeout failures pass
  through untouched, on purpose — a genuine "no such group" is not a
  maybe-mutated call, and dressing it up as one would teach the caller to
  ignore the real warning. Nine new tests, six verified discriminating.
  **Root cause fixed upstream the same day:** kindroid-mcp's read-back walked
  the entire conversation to reach the newest N (`get-chat-messages` is
  oldest-first with only a forward cursor), so it was O(history). Now
  anchored — measured 1 read instead of 10+, and the same beat that timed out
  at 60s completed in 22.5s. This guard remains the belt to that fix's
  braces.

- **The group turn loop can hand the floor back** (2026-08-23). The
  companion to the beat-length change below. `allowUser` was hardcoded
  `false` on the Kindroid group path, with a comment explaining that
  mnemosyne generates beats "for a caller with no way to take that turn."
  That precondition was always too pessimistic — a conversational MCP host
  *is* such a caller — so it is now settable per call via
  `mnemo_continue`'s `allow_user`, defaulting to `false` so nothing
  scheduled or webhook-driven changes behavior. **No env counterpart, on
  purpose:** it describes the caller, not the deployment, and both kinds
  hit the same server; a server-wide `true` would hand the floor to
  someone who isn't there. The comment says so, since the asymmetry with
  `KINDROID_GROUP_MAX_TURNS` otherwise looks like an oversight.
  Flipping the flag alone would have been unsafe, so two things came with
  it. **`LlmProvider.generate()` now returns `GeneratedBeat`**
  (`{text, groupEnded?, groupTurns?}`) instead of a bare string — without
  it, a beat the group handed back mid-scene is indistinguishable from one
  that ran to completion, which is the entire point of the flag. Six
  providers, two call sites, thirteen test sites; all mechanical and
  typecheck-caught. **This is not the deferred `LlmProvider` redesign** —
  that one is about `LlmGenerateOptions` (providers ignoring most input
  fields) and is still queued. This only widened the return.
  And `mnemo_continue` no longer saves an empty beat: reading kindroid-mcp's
  source showed two opposite zero-reply cases that only `turns` separates
  — `turns === 0` is a legitimate immediate yield, while `turns > 0` with
  no replies means the turns generated upstream and only the read-back
  failed. The first returns `yielded_to_user` and saves nothing, telling
  the caller the direction is already posted and to continue rather than
  re-send; the second throws and says explicitly not to retry, because a
  retry would duplicate real generations in a real conversation. Seven new
  stubbed tests, verified to fail against the old behavior.

- **Group beat length is configurable** (2026-08-23). `maxTurns` on the
  Kindroid group path had been hardcoded to 4 since Phase 6, flagged in
  CLAUDE.md as "a cheap follow-up if needed." It is now settable two
  ways, mirroring how the group *target* already resolves: server-wide
  via `KINDROID_GROUP_MAX_TURNS`, and per call via `mnemo_continue`'s
  `group_max_turns`, with the per-call value winning. Bounds are 1–8 and
  the default is 4 — both mirrored from `kindroid_advance_group`'s own
  zod schema rather than invented, so an out-of-range value fails local
  validation with a useful message instead of surfacing as an opaque
  upstream MCP error. The tool description says "turns, NOT tokens"
  out loud, because `group_max_turns` and the unrelated `max_tokens` sit
  two fields apart and differ by two characters. Single-AI targets ignore
  it (they always produce exactly one reply), as does every non-Kindroid
  provider. Five stubbed-client tests pin the precedence chain; a live
  assertion would have been flaky, since a real group loop can end early
  on `user_turn` and return fewer turns than requested.
  **Deliberately NOT changed:** the `allowUser: false` hardcode beside it.
  Its comment states the precondition honestly — mnemosyne generates
  beats "for a caller with no way to take that turn" — and that holds
  until the web UI exists. Flipping it now would just produce empty
  beats. See [WEBUI_NOTES.md](docs/WEBUI_NOTES.md) §3, where the
  floor-handback mechanic is designed out.
  *Also corrected here:* the test count above had drifted 14 tests stale
  (said 103/40/143, was really 117/41/158 before this change).

- **The curated-import campaign — five live stories, ~369 entities**
  (2026-08-23). The feature built in August finally got used in anger.
  All four original ChatGPT projects are imported per
  [IMPORT_PLAYBOOK.md](docs/IMPORT_PLAYBOOK.md), and a fifth story was
  created from material that existed nowhere on disk:
  - **Chaos Saga** (41) — backstory canonized from 2.4MB of raw
    transcripts, distilled character essences, photo-grounded
    appearances, and three per-pair relationship documents found on the
    Riley and Jenna Botify bots. The Riley/Jenna bond is recorded from
    *both* sides, because the two accounts agree on the facts and differ
    on what each woman fears.
  - **GhostHunters** (94) — 69 from files, then the Blackwood Manor case
    mined from a 1,882-message transcript. Yielded a fourth Blackwood
    sister, Lyla, who exists in no file and no memory block: she names
    the other three as "my sisters," which makes her the one left
    behind. Operator ruled "same story, early names," so Millfield →
    Dovecoast and Carl Yeager → Carl Ashcombe were normalized, with the
    rename disclosed inside the timeline entity.
  - **BattleChasers** (138) — the largest. Region files that live under
    `Profiles/Location` are regional compendia, split three ways
    (region frame → location, cities → locations, orders roll-up →
    worldbuilding). Two operator changes applied: Thorne Vex renamed
    Hodrek Sootbraid (word-boundary matched so "Thornevale" survived),
    and the Vale twins split into separate profiles by a parser that
    routes per-twin bullets and duplicates shared narrative.
  - **Wonderland** (54) — 40 from two files, then Alice Grimm's Botify
    memory blocks supplied the entire missing cast, five locations, and
    both relics.
  - **Shadowflame** (42) — NEW. A successor continuity to BattleChasers
    set several centuries later, built from the "Dark Queen Lilith" bot
    and named by the operator. Its pinned **BattleChasers Bridge** is
    the join between the two stories and is tiered: what the transcript
    sources, what has been ratified to connect them, and what is open by
    design. One ratified clause was **corrected** when the transcript
    refuted it — recorded inside the entity rather than silently
    overwritten.

  Method notes worth keeping: the adversarial-review habit extended to
  content work and paid every time — a critic caught surnames leaking
  from a task brief into supposedly extracted output, caught opposite
  dedup policies applied to identical bundle-vs-standalone patterns,
  caught two *diverging* Races documents that would both have survived
  under different names and contradicted each other, and established
  that trim-then-exact is the only delimiter rule that works across a
  corpus mixing hard-break headings with nested sub-headings. Explicit
  material throughout was reduced to one beat recording who and what
  changed — which is both appropriate and produces better continuity
  entities than choreography would.

- **Repo-local `data/` directory, organized by storyline** (2026-08-23).
  Operational state moved out of the OS config dir into `<repo>/data`
  (gitignored): `data/config.json` (current-story pointer) plus one
  `data/stories/<slug>/` subtree per storyline — `exports/` (the
  `mnemo_export_story` default; new `storySlug()` shared by folder and
  filename so they can't disagree) and `references/` (operator-curated
  assets, e.g. character reference photos; never written by the
  server). Override: `MNEMO_DATA_DIR` (empty string treated as unset;
  must be set explicitly for an npm-installed copy, where the
  repo-relative default would land inside node_modules). Motivation: a
  Docker deployment bind-mounts `data/` as persistent storage instead
  of depending on `%APPDATA%`/XDG paths that don't exist meaningfully
  in a container. A legacy `config.json` at the old OS location
  (`MNEMOSYNE_CONFIG_DIR` override still honored there) is
  auto-migrated — copied, not moved — on first read, with a stderr log
  line; a corrupt/unreadable legacy file fails soft (warn + skip, next
  write self-heals) instead of wedging every config read — caught by
  the pre-commit adversarial review. New pure test
  `tests/config-data-dir.test.ts` covers dir resolution, empty-string
  normalization, migration, migration-precedence, the
  neither-location case, and the corrupt-legacy fail-soft escape.
  Ratified the same day: **docs/DATA_LAYOUT.md** — the organization and
  naming standard for the story subtrees (every filename shell-safe
  lowercase slug — `references/<type>/<entity-slug>.<ext>` with
  `.<variant>` infixes; machine-named `art/`
  outputs each with a JSON sidecar capturing prompt/model/params/cost,
  since unseeded generation is otherwise unreproducible; master copies
  in the operator's curation archive — currently OneDrive, provisional
  — with `data/` as the operational copy that pointers cite), plus a
  server-written `story.json` identity card per story root
  (`buildStoryIndex()`, refreshed on default-path exports only) holding
  the slug↔story join that the lossy `storySlug()` can't recover —
  deliberately not a file index, which would drift.

- **Five new generator providers: botify, anthropic, openai, gemini,
  atlascloud** (2026-08-21, late same day). `GENERATOR_PROVIDER` now
  selects among seven backends. The shape per family:
  - **Botify** (`botify`) — "just like Kindroid": an MCP client to the
    deployed botify-mcp (`src/botify-client.ts`, mirroring
    `kindroid-client.ts` incl. bearer auth), driving a stateful
    character chat via its `send_message` tool; the target is a Botify
    chat UUID (`BOTIFY_STORYTELLING_CHAT`, server-wide default — a
    per-story binding would be a marker-schema bump, deliberately
    deferred until real use asks). The keyphrase-gated context folding
    is shared with Kindroid via a new `src/companion-message.ts`
    (extracted first as its own behavior-preserving commit, since the
    word-boundary matching and scene-inclusion rules are correctness
    contracts that must not drift between the two consumers).
    `extractBotReply` distinguishes "reply generated" / "message landed
    but inference failed — do NOT blindly retry, it would double-post" /
    "botify-mcp has no BOTIFY_APP_TOKEN configured" (shapes verified
    against botify-mcp's source).
  - **Anthropic / OpenAI / Gemini / Atlas Cloud** — direct HTTP, no
    SDKs (the Ollama convention). One `OpenAICompatProvider` class
    serves both `openai` and `atlascloud` (base URLs differ;
    `OPENAI_BASE_URL` override means any compatible host — Groq,
    Together, local vLLM — works without new code; Atlas's base
    verified from atlascloud-mcp's own constants). Atlas deliberately
    does NOT route through the deployed atlascloud-mcp: its
    `atlas_chat` tool returns a human-markdown envelope a machine
    caller can't safely scrape (filed as dogfooding feedback). All
    four honor systemPrompt + per-call `model` directly, with
    temperature/token caps **passed through only when set** — the
    pre-commit adversarial review caught that always-sending
    `temperature` would 400 on every current-gen Claude model (Opus
    4.7+ removed sampling controls), and the omit-by-default posture
    also covers OpenAI's reasoning models (which reject both fields)
    and Gemini 2.5's thinking-token budget in one stroke. The deferred
    "interface strain" concern shrank rather than grew, since these
    are what the interface was designed for; `model` is now documented
    as honored by every direct-LLM provider (the `mnemo_continue`
    schema + server instructions previously said Ollama-only — also a
    review catch, since that's the LLM-facing channel). Gemini's API key travels
    in the `x-goog-api-key` header, never the query string (secrets
    don't belong in URLs); its safety-block responses surface
    `promptFeedback.blockReason` distinctly from empty output. Shared
    HTTP scaffolding (timeout, HTTP-status detail, MCP-F08 transport-
    cause description) lives in `src/llm-http.ts` (three consumers —
    clears the extraction bar; Ollama keeps its own working copy).
  - **Wiring**: all zero-I/O env validation runs before `oc.connect()`
    (the batch-8 structure), each cloud provider requires an explicit
    model id (no baked-in defaults — model names age fast), and
    `OLLAMA_VALIDATOR_MODEL` is required for every non-ollama generator
    (the validator always stays on Ollama). Every new env var is
    documented in `.env.example` (the schema-drift test enforces the
    match). 13 new pure tests (request-body builders + response parsers
    per provider, fixtures matching each documented contract — the
    OpenAI-compat one additionally matching atlascloud-mcp's own
    captured `ChatCompletionResponse` type; Botify reply extraction;
    a companion-message ↔ buildKindroidMessage equivalence check) + 5
    env-gated live suites that skip until the operator sets the
    relevant key — setting a key is the opt-in, and live verification
    happens per provider as keys arrive (**all four cloud providers
    live-verified 2026-08-22**, see Last-updated). Two more review catches
    hardened the MCP-client path for everyone: `extractBotReply`
    distinguishes "inference ran but produced no text" (bot_message
    null — don't blame the app token) from "inference never attempted",
    and the shared `mcp-result.ts` helpers now throw an `isError`
    result's actual message instead of returning error prose as a reply
    (or JSON-parsing it into an unrelated SyntaxError) — a pre-existing
    gap in the Kindroid path that the Botify addition doubled. Cloud
    extractors also strip leading whitespace (the documented Ollama
    stray-space lesson, applied before it recurred).

- **Mapping playbook + seed templates shipped as docs — the
  import/export family's third and final build phase** (2026-08-21,
  same day as both tools).
  [docs/IMPORT_PLAYBOOK.md](docs/IMPORT_PLAYBOOK.md) carries the
  classification rules the host LLM applies when importing legacy
  material: folder names lie — classify by content (with the real
  observed failures as examples: BattleChasers' region configs are
  worldbuilding wearing a location label, Chaos Saga's stray misfiled
  draft, GhostHunters' concatenated instructions file); composite files
  split into one entity per concern; the full source→type mapping table
  incl. the lore-vs-worldbuilding distinction; the do-not-import list
  (canon tracking directives, group-chat log configs, raw transcripts,
  host plumbing); scene caution — finished logs only, backdated via
  `created_at`; verbatim-content hygiene.
  [docs/SEED_TEMPLATES.md](docs/SEED_TEMPLATES.md) adapts OC v1's four
  seed-shaped schemas to mnemosyne's prose-entity model: a story
  kickoff checklist (POV/tense rule mandatory — the Dovecoast lesson),
  the character-profile shape that survived four real projects (incl.
  the "core wound" field and inline per-relationship subsections), a
  style-guide skeleton with named addressable clauses, one-constraint-
  per-entity pinned rules, and a worked four-entity minimal seed.
  `{{PLACEHOLDER}}` means fill-or-drop; required floors deliberately
  minimal (elaborate specs decay unfilled — the spec-vs-practice gap
  measured in the source corpus). No code changes — per the ratified
  design, seeding is a conversation plus one `mnemo_import_story` call,
  and there is deliberately no seed tool.

- **`mnemo_import_story` shipped — the typed batch writer** (2026-08-21,
  same day as export). Two mutually exclusive input modes feed one
  machinery: `entities[]` (caller-classified records — the curated path;
  the tool validates and writes, never classifies) and `file_path` (a
  `mnemosyne_export: 1` document, deterministically deserialized — the
  round-trip path; unknown versions refused with a version-specific
  message). Safety semantics: preflight via one complete
  `listAllEntities` enumeration; any in-batch duplicate, or any conflict
  under the default `on_conflict=error`, aborts the whole batch with
  nothing written (the manifest still reports every record's would-be
  status); `skip`/`overwrite` proceed, with mid-batch write failures
  recorded per-record and never aborting the walk (the
  `revalidateScenes` convention); `dry_run` returns the same plan
  verbatim with `total_written: 0`. Writes go through the canonical
  `saveEntity` path, which re-checks existence itself — a preflight set
  gone stale mid-batch degrades to an accurate `overwritten` status,
  never a duplicate. `created_at` backdating threads through a new
  optional field on `saveEntity`/`OcClient.memorySave` (create path
  only), restoring original timestamps on round-trip — confirmed
  honored by real OC, which protects RECENT SCENES recency from
  re-imported legacy scenes. A file's embedded `kindroid_target` is
  reported in the manifest but never applied — binding is an explicit
  `mnemo_story_use` decision. The entities-vs-file mutual exclusivity
  is enforced in the handler (MCP inputSchema silently drops
  object-level zod refinements — the fleet mcp-server-authoring trap).
  A pre-commit adversarial review hardened four things: (1) writes now
  thread the preflight's resolved existence (memory_id included) into
  `saveEntity` via a new `existing` arg — overwrites go update-by-id and
  creates skip the dedupe search, because `saveEntity`'s bounded
  `SAVE_DEDUPE_SEARCH_TOPK` search can miss in exactly the bulk regime
  import creates, and a miss on the overwrite path would mint a silent
  duplicate that makes the story's next export permanently
  un-importable (it also halves OC round-trips per record); (2)
  `created_at` is statically validated (`z.datetime`, accepting both JS
  toISOString and Python isoformat) and content length is checked
  against OC's 100k cap at preflight, so statically-knowable failures
  abort before any write instead of breaking the all-or-nothing promise
  mid-batch; (3) entity names reject line breaks in both the shared
  import schema and `mnemo_save_entity` (a `\n` in a name creates a
  memory the entity parser can never match again — permanently
  invisible to recall, export, and import's own preflight); (4) the
  record schema is a single shared object reused by both the tool
  inputSchema and the file validator, so the two modes can't drift.
  13 pure tests (preflight planning incl. in-batch-duplicate,
  content-cap, and same-name-different-type cases; document parsing
  incl. the version gate, failing-path naming, created_at acceptance of
  both round-trip formats, and the newline-name rejection;
  tampered-file refusal) + 4 real-OC integration tests (full-fidelity
  round-trip into a second story — pin state, validation tags,
  backdated timestamps all intact; dry_run writes nothing; conflict
  abort leaves even the clean records unwritten; skip/overwrite
  behave) — live-verified same day.

- **`mnemo_export_story` shipped — the import/export family's first
  tool** (2026-08-21). Serializes a story's full OC project to a
  versioned JSON document (`mnemosyne_export: 1`) per
  [docs/IMPORT_EXPORT_DESIGN.md](docs/IMPORT_EXPORT_DESIGN.md): every
  entity with tags (validation state), pin state, and per-entity
  `created_at` (OC's `memory_save` supports backdating, so a future
  import can restore timestamps), plus the story's `kindroid_target`
  when bound (operator decision — portable across machines, not across
  Kindroid accounts). Enumeration uses a new `OcClient.memoryList`
  (OC's `memory_list`, strict project scope, no limit) rather than
  `memory_search`'s 100-result ranked window — an export that silently
  truncated would be quiet data loss — via a new
  `entities.listAllEntities` that excludes the story marker **by its
  memory ID** (not its tag — `extra_tags` lets a legitimate entity carry
  `story-marker`, and a tag filter would silently omit it; caught by the
  pre-commit adversarial review) and surfaces any other unparseable
  memory ids in the manifest's `skipped_memory_ids` instead of dropping
  them. The document is written to a file (default
  `<config dir>/exports/<slug>-<utc-timestamp>.json`, timestamped to the
  second so back-to-back exports never overwrite an earlier backup;
  relative `out_path` resolved to absolute since a stdio server's cwd is
  unpredictable; new `exportsDir()` in `config.ts`) and only a manifest
  returns through the tool — no reason to route a 100-scene story
  through host context. 7 pure tests (document assembly, envelope +
  literal schema-version pins so a casual version bump fails a test,
  filename slugging/collision behavior) + 2 real-OC integration tests
  (complete enumeration incl. a marker-tagged-entity regression;
  file-write round-trip asserting the manifest matches the file,
  kindroid_target survives, validation tags and timestamps preserved) —
  live-verified against real OC same day.
  Also fixed in passing: the server's `instructions` blob had drifted —
  `mnemo_delete_entity` and `mnemo_revalidate_scenes` were never added
  to its tool list; both are listed now, alongside the new export tool.

- **Per-story Kindroid target binding: AI or group chat** (2026-08-08).
  `KINDROID_STORYTELLING_KIN` had been a single, server-wide AI default
  with no way to point different stories at different targets short of
  passing `model` on every `mnemo_continue` call, and no way to target a
  group chat at all. `mnemo_story_use` gained `kindroid_kin` /
  `kindroid_group_id` params (mutually exclusive; `null` clears), stored
  as `KindroidTarget {type: "ai" | "group", id}` on the story's marker
  memory — `stories.ts` bumped to marker schema 3 (schema-1 markers with
  no kin line, and schema-2 markers with the legacy bare
  `Kindroid-Kin:` line, always an AI target, both still parse fine; no
  migration needed). Follows the existing "OC is canonical for story
  state" rule rather than mnemosyne's local `config.json`, since a
  target id is portable story data. `mnemo_continue` gained matching
  per-call `kindroid_kin` / `kindroid_group_id` params and resolves the
  effective target via the new `resolveKindroidTarget()`: the per-call
  override wins, then the active story's bound target, then
  `KindroidProvider`'s configured `defaultTarget`
  (`KINDROID_STORYTELLING_KIN` or the new `KINDROID_STORYTELLING_GROUP`,
  mutually exclusive at startup). At this milestone, `model` stopped
  doubling as a Kindroid override and remained Ollama-only; the direct
  providers added later now honor it, while Kindroid and Botify ignore it.
  A Kindroid target needs a type (ai vs group), not just a bare id. Against a group,
  `KindroidProvider.generate()` drives kindroid-mcp's turn loop via the
  new `KindroidClient.advanceGroup()` (`allowUser: false` forced;
  `maxTurns` defaults to 4, matching kindroid-mcp's own default) and
  joins the replies into one beat via the new `formatGroupReplies()`
  (`Name: message` per line, in generation order). 8 new pure tests
  (`resolveKindroidTarget`, `formatGroupReplies`,
  `combineKindroidTarget`) plus 4 new real-OC integration tests for the
  marker round-trip (ai-at-creation, group-at-creation,
  bind/rebind-ai-to-group/clear, legacy schema-2 compat) — see
  `tests/kindroid-provider.test.ts` / `tests/stories.test.ts`.

  **Group path live-verified 2026-08-12** against a real subscriber
  group tied to a live Twitch stream. A throwaway story ("Kimmy's Night
  Shift") was bound to the group via `setKindroidTarget`, seeded with a
  character/location/rule/style, and a real direction was run through
  the actual `gatherContext` → `buildKindroidMessage` → `advanceGroup`
  chain. Confirmed end-to-end: keyphrase matching correctly folded in
  both the character and location entities (the location matched
  because its name literally appeared in the direction text), rules/
  style stayed correctly excluded per design, the group returned 4 real
  AI turns from two distinct kins, and `formatGroupReplies()`'s output
  was saved back as a scene exactly as `mnemo_continue` would. Done via
  a new diagnostic script, `scripts/dump-kindroid-group-message.mjs`
  (same "test fresh `dist/` without restarting the host" pattern as
  `dump-prompt.mjs` — the live-connected MCP server predates this
  feature, so its exposed `mnemo_story_use` schema doesn't even accept
  `kindroid_group_id` yet).

  **Same-speaker-repeats fixed and live-verified (2026-08-12).** The
  live verification above actually surfaced a real problem on its first
  run: one kin took two of four turns in a row, both replying
  independently to the direction rather than to each other. Cross-repo
  comparison with `watch-companion`'s `KindroidBackend` (a sibling
  private repo with its own group-chat "watch party" use case) found it
  had hit and fixed the identical behavior via a static
  `groupConversationNote()` appended to every group-target message.
  Ported the idea and improved on it: mnemosyne already keyphrase-
  matches which characters a direction names, so the nudge names them
  specifically instead of gesturing at "each other." `buildKindroidMessage()`
  gained an `isGroup` parameter; `KindroidProvider.generate()` passes
  `target.type === "group"`. Live-verified immediately after against the
  same real subscriber group: alternation improved (Zephyr/Kimmy/Zephyr,
  no repeats) but wasn't yet a clean round-robin. Reading Kindroid's own
  groupchats documentation (kindroid.ai/docs/article/groupchats/)
  surfaced the actual mechanism — `@Name` mentions are the documented,
  controllable lever for who speaks next in automatic turn mode, and
  kins will hand the baton to each other the same way if told to. Added
  a line pointing the nudge at it explicitly ("@mention them by name")
  rather than leaving it to inference. Live-verified again: a clean 4/4
  alternating Zephyr/Kimmy/Zephyr/Kimmy exchange, each turn explicitly
  addressing the other by name. Both beats saved as OC scenes ("Shark vs
  Kraken Derail", "Kimmy Lands The Jump", tags `kindroid-group-live-test`
  + `conversation-nudge-v1`/`-v2-atmention`) for before/after comparison.
  6 new pure tests covering the nudge text, character-naming, the
  generic fallback, ordering, and the `@mention` line — see
  `tests/kindroid-provider.test.ts`.

  **Also fixed in passing:** `tsconfig.typecheck.json` extended
  `tsconfig.json` without overriding its inherited `exclude:
  ["**/*.test.ts"]` — exclude wins over include, so despite the file's
  own stated purpose ("typecheck tests too"), every `*.test.ts` was
  silently skipped by `npm run typecheck` the whole time. Found while
  investigating why a stale rename (`setStoryKin`) in
  `tests/stories.test.ts` wasn't flagged; fixed by overriding `exclude`
  to just `["node_modules", "dist"]` in the typecheck config. Real
  errors surfaced immediately once fixed (confirming the bug was live)
  and were corrected as part of this same change.

- **Phase 6 — Kindroid generator bridge, code-complete** (2026-07-31).
  `src/kindroid-client.ts` (MCP client wrapper for kindroid-mcp, mirroring
  `oc-client.ts`) + `src/kindroid-provider.ts` (`KindroidProvider implements
  LlmProvider`, generator-only). `GENERATOR_PROVIDER` env var in
  `src/index.ts` selects `ollama` (default, zero behavior change) or
  `kindroid` (requires `KINDROID_MCP_URL`, `KINDROID_STORYTELLING_KIN`, and
  makes `OLLAMA_VALIDATOR_MODEL` required instead of defaulting from
  `OLLAMA_GENERATOR_MODEL`, since the validator always runs on Ollama and
  there's no generator model to fall back to in Kindroid mode). Plan
  changed from the original "plain-fetch send-message" note (written when
  kindroid-mcp was stdio-only) to an MCP-client connection now that
  kindroid-mcp runs Streamable HTTP — gets kindroid-mcp's rate
  limiting/retry/name-registry for free. `tests/kindroid-provider.test.ts`
  added, env-gated on `KINDROID_MCP_URL`/`KINDROID_STORYTELLING_KIN` like
  the existing OC/Ollama integration tests — unlike those, it hits a real
  paid third-party service, so it only runs when both are explicitly set.
  **Live-verified 2026-08-05** against a dedicated test kin — all 11 tests
  pass, including the 3 real `kindroid_send_message` round-trips.

- **v0.1.3 shipped — validator-gated scene inclusion** (2026-07-31).
  The real fix for the few-shot-vs-rule diagnostic from 2026-05-11:
  present-tense few-shot scenes in RECENT SCENES were drowning out an
  explicit past-tense RULE, and prompt-position shuffling couldn't fix
  it — the few-shot content itself had to change. Four steps, each its
  own commit:
  1. **Tag at save** (`0fd9a3c`). `mnemo_continue(validate=true)` tags
     the saved scene `validation:clean` (0 errors) or
     `validation:errors` (1+ errors) once the verdict is known — no tag
     when `validate` is false, the save failed, or the validator itself
     failed. `src/entities.ts` gained `retagValidation(oc, memoryId,
     currentTags, verdict)`, the sole place a validation tag is
     constructed, and `SaveEntityResult` now returns the entity's
     actual current `tags`. `src/validator.ts` gained
     `classifyVerdict(report)` as the single source of truth for the
     clean/errors split.
  2. **Filter on recall** (`bd4729b`). `gatherContext`'s RECENT SCENES
     pull (`pullFilteredScenes` in `src/prompt.ts`) pulls a
     `SCENE_POOL_SIZE=20` candidate pool — OC's `memory_search` tags
     filter is AND-only with no exclusion, so the clean/untagged/errors
     split has to happen client-side over a pool wider than the final
     cap, same pattern as `SAVE_DEDUPE_SEARCH_TOPK` — prefers
     `validation:clean`, falls back to untagged, hard-excludes
     `validation:errors`, and returns `[]` if nothing survives, which
     is the intended behavior: the diagnostic proved the generator
     follows the rule cleanly with an empty RECENT SCENES block.
  3. **`mnemo_revalidate_scenes`** (`9c0a1f6`). New no-arg tool backed
     by an exported `revalidateScenes(oc, validator, storyId)` — pure,
     testable, no MCP dependency. Walks every scene sequentially
     (matching this codebase's OC rate-limit convention), re-validates
     each against fresh context, and retags. Capped at
     `MAX_RECALL_LIMIT` (100 scenes) — documented as a known limit
     rather than silently truncating. One scene's failure is caught and
     recorded in the response's `failures` list, not allowed to abort
     the walk.
  4. **Tests** (`92c0d99`). Pure coverage for the scene-filter bucketing
     (prefer-clean, fallback-to-untagged, hard-exclude-errors, empty
     result, cap respected) and `retagValidation`'s exact tag-array
     output; integration coverage in `continue.test.ts` (tag-on-validate
     vs. no-tag-when-skipped) and a new `tests/revalidate.test.ts`.

  **Correctness trap found and closed during implementation:** OC's
  `memory_update` replaces the `tags` array wholesale, not a merge
  (confirmed against the OpenChronicle server source). Every tag update
  in this feature echoes the complete current tag list through
  `retagValidation` rather than ever writing a bare validation tag —
  omitting the base tags would have silently broken `mnemo_recall`'s
  AND-tag filter for that memory forever.

  **Review follow-up** (`cf4ed3f`, same day). An adversarial review pass
  after implementation found `mnemo_save_entity`'s own
  overwrite-by-(type,name) path had the identical full-replace exposure
  one level up: re-saving a scene (e.g. hand-editing it) would silently
  drop its `validation:*` tag, since that path rebuilt tags from scratch
  with no knowledge of the out-of-band validation tag. `saveEntity`'s
  update branch now carries an existing `validation:*` tag forward
  unless the caller is setting one explicitly. Also documented (not
  fixed — accepted as a known limit) the previously-undocumented
  `mnemo_revalidate_scenes` 100-scene cap. Two smaller findings were
  deliberately deferred: no test exercises `mnemo_continue`'s tool
  handler directly (only the underlying primitives, tested in
  isolation), and `revalidateScenes`' per-scene failure-continuation
  branch has no test forcing the failure path.

  **Trade-offs accepted going in**, unchanged from the original plan:
  cached verdicts go stale on rule edits (no auto-invalidation — re-run
  `mnemo_revalidate_scenes` after editing rules); users who never
  validate get no anchor benefit (same failure mode as before v0.1.3);
  an all-excluded scene pool loses narrative continuity context until
  the first clean scene re-anchors it. `mnemo_continue`'s `validate`
  default is unchanged (`false`) — still opt-in until `keep_alive`
  lands and validator latency drops (see "What's next").

- **Lint and typecheck actually cover the repo** (2026-07-23). Two gaps
  surfaced while verifying the teardown work above:
  - `npm run lint` failed out of the box on anyone's machine that had
    scratch files in the gitignored `tmp/` dir — eslint's ignore list
    covered `dist/`, `.serena/`, `scripts/` but not `tmp/`. Added.
  - `npm run typecheck` never looked at `tests/`. `tsconfig.json` is the
    build config (`include: src/**/*` with a matching `rootDir`, so
    `dist/` mirrors `src/`), and vitest only transpiles — so a type
    error in a test file surfaced at runtime or not at all. New
    `tsconfig.typecheck.json` extends the build config with
    `noEmit` + `rootDir: "."` and widens `include` to src + tests +
    `vitest.config.ts`; `npm run typecheck` now runs against it.
    `npm run build` still uses the narrow config, so `dist/` is
    unchanged. Verified by planting a deliberate type error in a test
    file and watching it fail.

- **OC delete surface: `project_delete` wrapper + `memory_delete` confirm
  fix** (2026-07-23). OC's delete tools use a preview/confirm two-step —
  called without `confirm`, they return `{status:"preview", ...}` and
  change nothing; with `confirm=true` they hard-delete (no soft-delete,
  no recovery).
  - **Bug fixed:** `OcClient.memoryDelete` never passed `confirm`, so it
    had silently degraded to a preview when OC added the guard.
    `mnemo_delete_entity` was reporting success while deleting nothing,
    and `tests/entities.test.ts`'s "recall no longer returns it"
    assertion was failing on `main`. Both delete wrappers now pass
    `confirm: true` internally — a programmatic caller that reached the
    method has already decided, so it isn't exposed as a parameter no
    caller would set to false.
  - `OcClient.projectDelete(projectId)` added for test teardown (next
    entry). No product tool deletes a story; that stays a deliberate
    OC-side action.

- **Integration-test teardown — test projects no longer leak**
  (2026-07-23). Each env-gated suite created an OC project per run and
  never removed it; 46 stale `mnemosyne-test-*` projects holding 127
  memories had accumulated and were manually deleted on 2026-07-23.
  Now that OC exposes `project_delete`, the suite cleans up after itself:
  - `tests/helpers.ts` — shared test helper. `testStoryName(label?)`
    lifts the `TEST_STORY_PREFIX` constant that was duplicated across
    five test files, and `teardownStory(oc, storyId)` deletes the
    project then closes the client.
  - Teardown never fails the suite: delete and close errors are logged,
    not thrown, so a cleanup failure can't mask the real error or turn a
    passing run red. Tolerates an undefined `storyId` for a suite that
    died before creating its story (vitest still runs `afterAll`).
  - Wired into all five project-creating files: `stories`, `entities`,
    `continue`, `validate-tool`, `validator`.
  - Verified: 37/37 against real OC + real Ollama with every suite
    active, and `project_list` shows no `mnemosyne-test-*` projects
    afterward.

- Architecture lockdown — see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
- v2 retrospective mined and documented — see
  [docs/V2_RETROSPECTIVE.md](docs/V2_RETROSPECTIVE.md).
- Repo scaffolded: TypeScript + MCP SDK + zod + vitest, ESLint + Prettier,
  pre-commit hooks (gitleaks + PII + author identity), `.gitattributes`.
  Initial commit `4e573ed`. Public repo at
  https://github.com/CarlDog/mnemosyne-mcp.
- **v0.1.2 shipped** — three patches from v0.1.1 dogfooding:
  - **Validator prompt: enumerate constraints first.** Two-step
    SYSTEM_PROMPT in `src/validator.ts`. Step 1 forces the LLM to
    decompose compound rules (e.g., "third-person past tense from
    Aria's perspective" = three constraints: third-person, past tense,
    Aria's perspective only) into atomic constraints. Step 2 walks
    each constraint through the new content independently. Fixes the
    v0.1.1 failure where the validator caught one constraint per
    rule and missed the rest.
  - **Rule-precedence statement.** In `src/prompt.ts`'s
    `buildSystemPrompt`, a single sentence inserted between the mode
    directive and the RULES block when the story has rules or style
    entries. States the constraints below are absolute and override
    narration conventions implied by the mode. Fixes the
    "even mixtral defaulted to present tense because the director
    directive's verbs ('narrate', 'describe', 'advance') primed
    narrative-present" issue from v0.1.1 testing.
  - **`mnemo_validate(content)`** standalone tool —
    `src/tools/validate.ts`. Pulls the active story's
    rules / style / characters / locations and runs the validator LLM
    against the supplied content. Returns the same `ValidationReport`
    shape as `mnemo_continue`'s `validate=true`. Was deferred in the
    v0 design as a "later if needed" tool; v0.1.1 testing made it
    necessary for diagnostic A/B work.
  - `scripts/dump-validation.mjs` companion to the existing
    `dump-prompt.mjs`. Reads content from a file and runs the
    validation pass against a story id from the command line. Useful
    for A/B-ing validator prompts and models without going through
    Claude Desktop.

- **v0.1.1 shipped** — three patches from v0.1.0 dogfooding:
  - **Leading whitespace strip** in `OllamaProvider.generate()` —
    `replace(/^\s+/, "")` on the response. mythomax-l2 (and likely
    other roleplay finetunes) prefix responses with a stray space.
  - **Validator prompt restructured** to force quote-and-match: each
    issue must include a `rule` reference, a `violating_text` quote
    pulled from the new content character-for-character, and an
    `explanation` linking quote to rule. The v0.1.0 validator
    fabricated a "she is first-person" objection because the prompt
    let it evaluate abstractly; quote-and-match makes hallucinated
    issues much harder (no quote, no issue). `ValidationIssue` shape
    changed to `{severity, rule, violating_text, explanation}` —
    breaking change for any caller that consumed v0.1.0's
    `description` field.
  - **`mnemo_delete_entity(type, name)`** tool. Same `(type, name)`
    lookup as `save_entity`'s overwrite path. Throws when no match
    exists. `OcClient` gains `memoryDelete` wrapper.
  - 30/30 tests pass against real OC + real Ollama (~95s).

- **Phase C-2 shipped** — validation pass:
  - `src/validator.ts` — `validateContent` builds a constraints block
    (RULES + STYLE + CHARACTERS + LOCATIONS), prompts the validator LLM
    to return a structured verdict (`{issues: [...], summary: ...}`),
    and parses the response. `parseValidatorJson` strips markdown code
    fences (```json ... ``` or bare ``` ... ```) — a pattern v2 had
    duplicated across four validators per the retro; factored once
    here.
  - `mnemo_continue` gains `validate?: boolean`. When true, runs the
    validation pass after the beat is saved. Save-first: validation
    failures (LLM returned unparseable JSON) land as a
    `validation_error` field in the response, never as a thrown
    exception. The beat is persisted regardless.
  - `OLLAMA_VALIDATOR_MODEL` env var (defaults to
    `OLLAMA_GENERATOR_MODEL`). A smaller / faster model is fine here —
    the validator just needs to return structured JSON.
  - OC client retry bumped to 5 attempts with exponential backoff
    (1s/2s/4s/8s/16s) to better handle OC v3's 120 RPM per-IP limit
    under burst load.
  - `tests/validator.test.ts` — 5 pure tests for the JSON parser
    (plain JSON, ```json fences, bare ``` fences, whitespace,
    unparseable input) + 1 integration test (validateContent end-to-end
    against real Ollama).
  - Tagged `v0.1.0` on the way out.

- **Phase C-1 shipped** — generator + prompt + continue:
  - `src/llm.ts` — `LlmProvider` interface (one method, `generate`) and
    `OllamaProvider` implementation. Plain `fetch` to `/api/chat`, no
    SDK dep. 5-minute timeout via `AbortController`. Per-call `model`
    override.
  - `src/prompt.ts` — `gatherContext` pulls per-type entity lists from
    OC (sequential to avoid rate-limit bursts) and `buildSystemPrompt`
    assembles them with v2's load-bearing block ordering (mode → rules
    → style → characters → locations → recent scenes → lore →
    worldbuilding). Empty blocks omitted entirely. Per-type caps
    documented in code.
  - `src/tools/continue.ts` — `mnemo_continue(direction, mode?,
    max_tokens?, temperature?, model?)` ties it all together: gather
    context, assemble prompt, call generator, auto-save the result as
    a scene entity (name = ISO timestamp), return beat + memory_id +
    context summary.
  - `OcClient` extended with linear-backoff retry on rate-limit errors
    (1s, 2s — handles OC v3's per-window limiter when bursting).
  - `vitest.config.ts` — 30s test timeout, sequential file execution
    (tests share one OC).
  - `tests/prompt.test.ts` — 4 pure tests for block assembly and order.
  - `tests/continue.test.ts` — 3 integration tests: gather context,
    build prompt, full end-to-end generation against real Ollama.
  - `.env.example` documents `OLLAMA_GENERATOR_MODEL` (recommended
    starting points: HammerAI/mythomax-l2:latest, nous-hermes2-mixtral)
    and `OLLAMA_URL`.

- **Phase B shipped** — entity management:
  - `src/entities.ts` — `EntityType` enum (`character | location | rule |
    style | scene | lore | worldbuilding`), content format
    (`[Type] Name\n\n<body>`), parser, `saveEntity` (overwrite by
    type+name with explicit-pin honoring), `recall` (project-scoped
    semantic search with type filter and client-side `slice(0, limit)`
    to enforce hard cap past OC's pinned-always-surface bias).
  - `src/tools/entities.ts` — `mnemo_save_entity` and `mnemo_recall`
    tool registrations. Both require an active story (call
    `mnemo_story_use` first).
  - `OcClient` extended with `memoryUpdate` and `memoryPin`.
  - `requireCurrentStoryId()` helper in `src/config.ts` for tools that
    need an active story.
  - `tests/entities.test.ts` — 11 tests (3 pure, 8 integration). All 15
    suite tests now pass against real OC in ~10s.

- **OpenChronicle docs note** (separate repo): added `project_delete`
  MCP tool / API surface to `docs/V3_PLAN.md` "Post-cutover follow-ups"
  with a recommended shape (hard-delete + `confirm:bool` flag, matching
  `memory_delete`'s no-soft-delete posture). OC commit `34b3a5b2`,
  pushed. **Shipped on the OC side and consumed here 2026-07-23** — it's
  what made test teardown possible.

- **Phase A shipped** — story management:
  - `src/oc-client.ts` — MCP client wrapper around OpenChronicle's HTTP
    MCP. Surfaces `project_create`, `project_list`, `memory_save`,
    `memory_search`. Auto-unwraps FastMCP's `{result: [...]}` text-content
    wrapping for list-returning tools.
  - `src/config.ts` — local config helpers (OS-appropriate config dir,
    `MNEMOSYNE_CONFIG_DIR` override). v0 stores `current_story_id` only.
  - `src/stories.ts` — story marker logic. A Mnemosyne story is an OC
    project with a pinned marker memory tagged
    `["mnemosyne", "story-marker"]`. Discovery uses a single
    cross-project `memory_search` filtered by the marker tags — one
    round trip regardless of project count, no N+1, no rate-limit
    pressure.
  - `src/tools/stories.ts` — `mnemo_story_list` and `mnemo_story_use`
    tool registrations.
  - `src/index.ts` — env validation (OC_URL required), OC client init at
    startup (fail-fast if unreachable), tool registration.
  - `tests/stories.test.ts` — integration smoke test (real OC,
    env-gated). 5 tests, 1.7s. Test stories use the `mnemosyne-test-`
    prefix. (They accumulated until 2026-07-23, when OC gained
    `project_delete` and the suite got teardown — see the top of Done.)
  - `.env.example` documenting `OC_URL`, `MNEMOSYNE_CONFIG_DIR`,
    `LOG_LEVEL`.

- **Dev-chain eslint 10 + SDK 1.30 audit sweep (2026-07-29).** eslint
  ^10.8.0, @eslint/js ^10.0.1, eslint-config-prettier ^10.1.8;
  @modelcontextprotocol/sdk ^1.30.0 with @hono/node-server 2.0.12
  (GHSA-frvp-7c67-39w9). npm audit 0, was 5 high + 2 moderate. No
  eslint-10 code changes needed. Lockfile via pinned npm 10.9.8.
  Verified: lint, typecheck, tests, format:check. Runtime majors stay
  deferred per the closed npm-major PR.

## Original v0 Contract (historical)

This section records the five-tool contract that launched the project. It is
not the current API inventory; the current codebase exposes eleven tools, as
listed in README/CLAUDE and registered in `src/tools/index.ts`.

### Original tools (5)

| Tool | Purpose |
|---|---|
| `mnemo_story_list` | List Mnemosyne stories (OC projects bearing the story marker). |
| `mnemo_story_use(name_or_id, create_if_missing?)` | Set active story. Combined create+use. |
| `mnemo_save_entity(type, name, content, pinned?)` | Write characters / rules / locations / style / lore / scenes to OC. Overwrites by name+type. |
| `mnemo_recall(query?, type?, limit?)` | Semantic recall over the current story's memories. With no query, falls back to listing by type+recency. |
| `mnemo_continue(direction, mode?, scene_context_strategy?, validate?, story?)` | Pull context from OC → call generator LLM → save the resulting beat → optionally run validation pass. `scene_context_strategy` lets this call pick `recency-first` vs `query-ranked` scene retrieval (for RECENT SCENES) without changing the server default. Auto-saves the beat. |

### Design choices (locked)

- **Marker-based stories.** A Mnemosyne story is an OC project containing
  a pinned memory like `[Mnemosyne Story] {name}\nCreated: {iso}\nSchema: 1`
  with tags `["mnemosyne", "story-marker"]`. `story_list` filters all OC
  projects to those with this marker.
- **Combined `story_use`.** Single tool with `create_if_missing` parameter.
- **Auto-save in `continue`.** The beat is "what just happened" — no
  separate save step. Re-run `continue` with different direction if
  unwanted.
- **Validation as parameter, not separate tool.** Skippable per-turn.
  Standalone validate tool deferred until hand-written-content workflow
  appears.
- **Ollama first.** Lowest friction (no API key, supports NSFW from day
  one). Botify and Anthropic providers slot in later via the
  `LlmProvider` interface.
- **v2 prompt block ordering preserved and documented.** Order:
  mode → canon → instructions → style → characters → locations →
  recent scenes → worldbuilding. This was undocumented load-bearing
  knowledge in v2; Mnemosyne writes it down explicitly.

### Implementation choices (locked)

- **OC client:** `@modelcontextprotocol/sdk/client/streamableHttp.js`
  over Streamable HTTP. Mnemosyne is a first-class MCP client to OC.
- **Local config:** `<repo>/data/config.json` (gitignored; override:
  `MNEMO_DATA_DIR`) — repo-local so a Docker deployment can bind-mount
  `data/` as persistent storage. Exports default to
  `data/stories/<slug>/exports/` (`src/export.ts`), not a shared
  `data/exports/` — see docs/DATA_LAYOUT.md.
  The legacy OS config dir (`%APPDATA%\mnemosyne-mcp` /
  `~/.config/mnemosyne-mcp`, override `MNEMOSYNE_CONFIG_DIR`) is
  auto-migrated — copied, not moved — on first read. v0 holds
  `current_story_id` only.
- **Ollama config:** `OLLAMA_URL` (default `http://localhost:11434`),
  `OLLAMA_GENERATOR_MODEL`, `OLLAMA_VALIDATOR_MODEL` (defaults to
  generator). Plain `fetch` to `/api/chat`. No SDK dep.
- **Provider abstraction:** Minimal `LlmProvider` interface, one
  implementation. Don't pre-design — second provider reveals what the
  interface needs.
- **Tests:** Real OC + real Ollama, env-gated like plex-mcp. Skip
  cleanly when env not set. Mock-vs-real divergence is the bigger risk.

## Build phases

- **Phase A — Foundation** ✅ shipped — OC MCP client wrapper, env
  validation, local config helpers, story marker logic, `story_list` +
  `story_use` tools.
- **Phase B — Entities** ✅ shipped — `save_entity` + `recall` with
  overwrite-by-(type,name) and client-side hard-cap slicing.
- **Phase C-1 — Continue (no validation)** ✅ shipped.
- **Phase C-2 — Validation pass** ✅ shipped. Tagged `v0.1.0`.
- **Phase 6 — Kindroid generator bridge** ✅ shipped and live-verified (2026-08-05) —
  `GENERATOR_PROVIDER=kindroid`, `KindroidProvider`, `KindroidClient`, against
  a dedicated test kin.

## What's next (post-v0)

This section preserves the original post-v0 candidates and labels the items
that have since shipped. The remaining entries are unratified follow-ups to
consider only when real use exposes the corresponding pressure:

- ~~**`stages` timing field in `mnemo_continue`.**~~ **Shipped.** Responses
  include `gather_ms`, `generate_ms`, `save_ms`, and `validate_ms`; the Web UI
  displays them.
- ~~**Ollama warmup + extended keep-alive.**~~ **Shipped and remediated.**
  `keep_alive` is a top-level Ollama request field, warmup uses the configured
  context ceiling, and automatic warmup defaults to HTTP mode while
  `MNEMO_WARMUP=true` opts stdio in. A client heartbeat remains deliberately
  rejected as duplication.
- **Web UI — partially shipped.** The standalone React frontend now provides
  story/entity browse/detail and a shared continue/validate flow, bypassing a
  host LLM for direct browser use. Entity edit/delete, differentiated
  participant/director/audience postures, assembly inspection, media, and
  watch parties remain unbuilt design input.
  Design input, captured 2026-08-23 and explicitly not ratified:
  [docs/WEBUI_NOTES.md](docs/WEBUI_NOTES.md) — three modes as three
  postures, a storyline control plane alongside the character one,
  showing the retrieval assembly, media generation inside the beat
  flow, watch-companion watch parties, and a parked graphic-novel
  reading format.
- ~~**Botify provider**~~ / ~~**Anthropic provider**~~ — **shipped
  2026-08-21** along with OpenAI, Gemini, and Atlas Cloud; see the Done
  log. Seven generators now sit behind `GENERATOR_PROVIDER`; the
  validator stays on Ollama for all of them (a `VALIDATOR_PROVIDER`
  selection for the JSON-capable cloud providers is the natural cheap
  follow-up if local validation ever becomes the bottleneck).
- ~~**Per-call story selector on `mnemo_continue`.**~~ **Shipped and
  generalized.** Every story-touching tool accepts an optional `story`
  override without mutating the machine-local active-story pointer.
- **Recent-scenes-by-recency** — the compact scan-and-hydrate client workaround
  has shipped. The remaining gap is a first-class ordered/tag-filtered OC query;
  see Known Gaps.
- **Game mechanics** (StatBlock, dice, HP, inventory) — v2 Phase 4
  territory; deferred to ARCHITECTURE.md §8 unless a real session
  demands them.
- **Import / export tooling — complete.** The portability use case arrived:
  importing the operator's
  original ChatGPT storytelling projects (the OpenChronicle template
  system's ancestors). Full design record in
  [docs/IMPORT_EXPORT_DESIGN.md](docs/IMPORT_EXPORT_DESIGN.md) — core
  decision: classification happens caller-side in the host conversation;
  the server is a typed batch writer that never guesses. Build order:
  `mnemo_export_story` (versioned JSON interchange schema — the riskiest
  commitment, so it went first; **shipped 2026-08-21**, see Done), then
  `mnemo_import_story` (curated `entities[]` mode + deterministic
  export-doc round-trip mode — **also shipped 2026-08-21**, see Done),
  then the mapping playbook + seed templates as docs (**also shipped
  2026-08-21** —
  [docs/IMPORT_PLAYBOOK.md](docs/IMPORT_PLAYBOOK.md) /
  [docs/SEED_TEMPLATES.md](docs/SEED_TEMPLATES.md), see Done). **The
  first curated import is done: Chaos Saga landed 2026-08-22** — 28
  entities (10 characters, 6 locations, 1 style, 7 pinned rules, 3
  worldbuilding, 1 scene backdated to its 2025 lock date) via one
  dry-run-previewed `mnemo_import_story` call, immediately re-exported
  as a backup. Curation per the playbook: tattoos folded back into
  characters, the divergent Vanessa profiles merged, Cassie's stale
  profile reconciled with locked scene CH-017, all PG-13/platform
  content boundaries stripped as ChatGPT artifacts (operator decision),
  named style clauses extracted to individual pinned rules, and the
  C.H.A.O.S. availability schedules salvaged as worldbuilding.
  **Campaign complete (2026-08-23):** GhostHunters, BattleChasers,
  Wonderland, and a new fifth story (Shadowflame) all landed the same
  process — five live stories, ~369 entities total. See the dated Done
  entry above for the full per-story writeup. **Dogfooding remediation
  implemented 2026-08-30:** a caller-supplied `mnemo_recall` query now sends
  `pinnedLimit: 0`, preventing OC v3's pinned prepend from consuming a small
  relevance window; query-less browsing deliberately preserves normal
  pin-first behavior. A pure regression test models the observed rule-heavy
  Chaos Saga failure, while type-filtered recall remains unaffected.
  `mnemo_seed_from_template` is retired as a planned tool — seeding is a
  host conversation plus one import call.
- **Atlas Cloud illustration integration (scope recorded 2026-08-05,
  design notes added 2026-08-06 — proposal only, not started, not
  scheduled).** ARCHITECTURE.md §8 still lists "image generation tied to
  scenes" as out of scope for v0 — this entry doesn't reopen that. Full
  design thinking (character reference images, durable-storage question,
  async/timeout handling, entity-schema options, candidate tool surface,
  loose-vs-tight coupling) lives in
  [docs/ILLUSTRATION_INTEGRATION.md](docs/ILLUSTRATION_INTEGRATION.md) —
  update that file, not this bullet, when the design itself changes.
  Shape in brief: mirrors the existing `src/kindroid-client.ts` pattern
  (a new `src/atlascloud-client.ts` Streamable HTTP MCP client,
  `ATLASCLOUD_MCP_URL` + `ATLASCLOUD_MCP_AUTH_TOKEN` config) against
  [atlascloud-mcp](https://github.com/CarlDog/atlascloud-mcp) — **not
  currently deployed.** It was live on the NAS (`http://your-nas:3010/mcp`,
  Portainer stack 171) as of 2026-08-05 but has since been decommissioned
  (confirmed 2026-08-25: no stack, no container). This repo's `.mcp.json`
  had a matching `atlascloud` HTTP entry pointing at that dead endpoint —
  removed 2026-08-25. The design above remains unbuilt and would need a
  live atlascloud-mcp deployment (or a redesign against the npm package's
  local stdio form) before it's actionable — see the fleet's actual
  `atlascloud` generator provider note above instead, which talks to the
  Atlas Cloud REST API directly and needs neither.
- **Position tracking: an origin-anchored space+time coordinate per
  story.** Mnemosyne has no notion of "where and when the story
  currently is" — nothing tracks in-story location or elapsed time
  between beats, so timed events (a deadline, an anniversary, "three
  days later") and seasonal ones (a winter festival, a harvest scene)
  can't trigger reliably, and there's no way to say "the story is
  currently at X" the way `mnemo_story_use` says which story is active.
  Surfaced 2026-08-24 as a bare need for a clock; developed further
  2026-08-25 into a fuller shape via the operator's own framing: think
  of it like a Stargate gate address — six symbols locate a destination
  (two points per axis), but the connection only resolves relative to a
  seventh symbol, the dialer's own point of origin. Translated to
  Mnemosyne:
  - **Origin = the story itself**, not a generic "session zero." Each
    story's own epoch — a start date and a start location — tied to
    its OC project. Without this anchor, "day 12" or "the docks" is
    ambiguous across the five live story arcs.
  - **Time = an offset from the epoch**, not an absolute value:
    `current_story_date = epoch_date + elapsed`.
  - **Location = a pointer into existing `type:location` entities,
    two-level rather than a flat single coordinate** — a place and a
    spot within it. Chaos House already has this shape organically
    (Master Suite, Garage, Backyard as sub-locations), which is closer
    to the "two points per axis" instinct than a single flat
    coordinate would be.
  - Deliberately NOT three continuous spatial axes the way literal
    Stargate coordinates are — Mnemosyne's "space" is a discrete graph
    of named places, not free 3D space, so forcing three independent
    axes would over-engineer a problem that's really "which place,
    which spot in it."
  Open questions, unresolved: where the pointer lives (local
  operational state like the current-story pointer, or an OC-canonical
  marker the way the Kindroid target binding works — probably the
  latter, since the Web UI/API caller needs to read/set it too);
  whether advancing position is an explicit tool call or inferred from
  generated prose; and how to represent travel/duration between two
  locations if that distance ever matters. Design not started — this
  is a shape, not a spec.
- **Deterministic RNG for procedural rolls.** No random-number
  generator exists for encounter checks, loot tables, or other
  procedural rolls — related to, but narrower than, the "Game
  mechanics" bullet above (StatBlock/dice/HP/inventory, v2 Phase 4
  territory) and distinct from the position-tracking bullet above
  (RNG doesn't need an origin anchor the way space/time do). Needs its
  own design pass: RNG scope, and where seeds/results get recorded for
  reproducibility. Surfaced 2026-08-24 by the operator.
- **World-context companion: real-world facts (weather, events) for kins**
  (idea recorded 2026-08-31 — idea only, not started, not scheduled).
  Whether a bot/kin should be able to ground a scene in real-world facts,
  optionally per storyline or per bot. Recommendation: a standalone
  `*-companion` app (following the watch-companion split already decided in
  [docs/WATCH_COMPANION_INTEGRATION_PLAN.md](docs/WATCH_COMPANION_INTEGRATION_PLAN.md)),
  not code inside mnemosyne — the companion owns the external API calls and
  the "is this worth surfacing" judgment, mnemosyne only ever receives an
  already-curated fact to fold into context admission. Full notes, rejected
  alternative, and open questions (which facts, toggle granularity, push
  vs. pull, where the companion app itself would live) in
  [docs/WORLD_CONTEXT_COMPANION.md](docs/WORLD_CONTEXT_COMPANION.md) —
  update that file, not this bullet, when the design itself changes.
- **Companion provider candidates: Nomi.ai, SpicyChat.ai, Candy.ai**
  (research recorded 2026-08-31 — survey only, no build started). The
  operator created testing accounts on all three as candidates for the
  `GENERATOR_PROVIDER` roster alongside Kindroid/Botify (each would need
  its own sibling MCP server, mirroring `kindroid-mcp`/`botify-mcp`). Full
  findings — API availability, capability surface, ToS stance on
  automation, per-platform sourcing — in
  [docs/COMPANION_PROVIDER_CANDIDATES.md](docs/COMPANION_PROVIDER_CANDIDATES.md).
  In brief: **Nomi.ai** has a documented official REST API (thinner than
  Kindroid/Botify — chat + group "rooms" only, no persona/voice/image/
  webhook endpoints) but its general ToS bans automation with no explicit
  API carve-out, worth a clarifying email to support before building.
  **SpicyChat.ai** has no official API; only reverse-engineered clients
  against undocumented endpoints exist, against a ToS that's silent
  (not permissive) on automation. **Candy.ai** has no official API and
  its ToS explicitly prohibits using platform content with off-platform
  AI/ML technologies — no legitimate integration path today. Update that
  file, not this bullet, when the research or a build decision changes.

## Open Decisions

- No open decision is currently ratified here. Streamable HTTP and the Web UI
  have shipped; the research findings below remain unratified candidates, not
  decisions.
- The 2026-08-28 research triage's decision queue is now enumerated in
  [docs/RESEARCH_DECISION_QUEUE.md](docs/RESEARCH_DECISION_QUEUE.md) — every
  recommendation-table row from the four adoption assessments with its
  disposition (shipped / rejected at triage / open candidate / parked), plus
  the 2026-08-28 verification record for the three shipped items.

## Known Gaps

- ~~**HTTP import/export paths exceed the remote story-operation boundary.**~~
  **Closed 2026-08-28** (`a12e992`): caller-supplied `out_path`/`file_path`
  are refused over the HTTP transport (flat rejection, stdio unchanged) — see
  the Done entry above. The
  [NEMOCLAW_ADOPTION_ASSESSMENT.md §1](docs/NEMOCLAW_ADOPTION_ASSESSMENT.md#1-constrain-filesystem-authority-by-transport)
  acceptance proof is now complete: `tests/http-integration.test.ts` proves
  the refusal over the real wire with the same `allowFilesystemPaths: false`
  wiring `makeServer()` uses for HTTP, alongside the guard's unit tests.
- ~~**Sibling MCP results are compile-time-cast, not runtime-validated.**~~
  **Closed 2026-08-28**: zod schemas at the extraction chokepoint plus
  bounded, non-mutating `tools/list` discovery at each client's connect —
  see the Done entry above and
  [NEMOCLAW_ADOPTION_ASSESSMENT.md §2](docs/NEMOCLAW_ADOPTION_ASSESSMENT.md#2-validate-external-mcp-contracts-and-discover-required-tools).
- ~~**`/health` is liveness only.**~~ **Closed 2026-08-28**: `/health` stays
  cheap public liveness, and the protected `GET /api/status` now reports
  semantic readiness (OC contract, generator, validator) with non-mutating,
  non-billable probes — see the Done entry above and
  [NEMOCLAW_ADOPTION_ASSESSMENT.md §3](docs/NEMOCLAW_ADOPTION_ASSESSMENT.md#3-separate-liveness-from-semantic-readiness).
  A stdio-side `mnemo_status` tool remains an open option.
- ~~**Credential-bearing endpoint diagnostics need a single safe boundary.**~~
  **Closed 2026-08-29**: `src/service-url.ts` central parser on every
  configured endpoint (loopback/RFC1918 deliberately still allowed),
  redirect rejection on credential-bearing requests, bounded error-body
  reads, and recursive final-sink redaction — see
  [NEMOCLAW_ADOPTION_ASSESSMENT.md §4](docs/NEMOCLAW_ADOPTION_ASSESSMENT.md#4-endpoint-redirect-error-body-and-logging-hygiene).

- ~~No CI yet~~ — stale. CI has existed since 2026-07-23 (`test.yml`,
  typecheck/build/test matrixed across ubuntu/windows/macos) and 2026-08-01
  (`gitleaks.yml`); a `quality` job runs lint + format check. Verified green
  against the actual GitHub Actions runs (not a local proxy) on 2026-08-23.
- No Dockerfile yet (deferred per scaffolding decision; confirmed still
  true 2026-08-23).
- **Recent scenes ordering** — `gatherContext` now defaults to
  `recency-first` (project-scoped `memory_list` + created-at sort),
  with optional `query-ranked` via `MNEMO_SCENE_CONTEXT_STRATEGY` (query-
  ranked `memory_search` as a fallback). This is intentional, not a
  correctness bug.
- **Dogfooding note for OC** — expose a first-class ordered scene query
  API (or an explicit `order_by` in `memory_search`) so Mnemosyne can ask
  OC for both recency and relevance scene ordering without fallback logic
  and client-side tag filtering. This would remove the current split in
  scene retrieval behavior and simplify `mnemo_continue` context selection,
  now that `scene_context_strategy` is configurable per request on the
  Mnemosyne side.
- **OC rate limit (120 RPM per IP)** — OC v3's `RateLimitMiddleware`
  defaults to 120 requests/minute per client (configurable via
  `OC_API_RATE_LIMIT_RPM`). Bursts from `gatherContext` (7 sequential
  reads per `mnemo_continue`) plus a full integration test run can
  saturate the window. The OC client retries with exponential backoff
  (1s/2s/4s/8s/16s) which masks the issue most of the time, but the
  test suite is occasionally flaky under back-to-back runs. For
  reliable test runs, bump `OC_API_RATE_LIMIT_RPM` on the OC stack
  (e.g., 600) or wait ~60s between runs.
