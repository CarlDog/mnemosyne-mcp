# Companion Profile & Voice Projection Design

**Status: Proposal, recorded 2026-08-29.** This document captures
operator-directed design input and schedules no implementation by itself.
[STATUS.md](../STATUS.md) remains the source of current project priority.
Nothing here reopens [ARCHITECTURE.md](ARCHITECTURE.md) §8's exclusion of a
runtime voice/audio interface.

The operator-set direction is narrower and already clear: a character's voice
is part of that character's durable identity. Canon therefore needs enough
provider-neutral detail to design or select a convincing voice. A Kindroid or
Botify voice ID, model choice, upload, and account binding are deployment state,
not canon.

This proposal also records the larger companion-profile boundary exposed by an
audit of the character templates and the current Kindroid/Botify surfaces. It
does not silently add a new directory to the ratified
[data layout](DATA_LAYOUT.md), a second executable template subsystem, or an
automatic provider-sync path.

## 1. Problem

Mnemosyne currently has three related but different things:

1. Rich, provider-neutral character canon. The core character template has a
   one-line `voice` field and short quotes, but no acoustic/performance profile.
2. Companion-chat generators. Kindroid and Botify carry their own server-side
   persona, memory, voice, and conversation state. Mnemosyne sends selected
   story context through the only shared channel available: visible message
   text in [`companion-message.ts`](../src/companion-message.ts).
3. A few legacy `DISTILLED ESSENCE` blocks in Chaos Saga character files. They
   resemble deployment payloads but mix stable personality, relationship state,
   visual detail, and transient plot context without a schema or reliable
   heading boundary.

The existing character files are source material, not safe provider payloads.
For example:

- Pronouns exist, but gender identity does not; one must not be inferred from
  the other.
- Joining `Relationships` and `Current Status` exceeds Kindroid's current
  1,000-character Key Memories editor limit for every filled BattleChasers core
  character reviewed.
- Joining all short quotes exceeds Kindroid's current 750-character Example
  Message limit for some characters.
- An unheaded appearance/canon block beneath one legacy persona heading makes a
  normal H2 parser extract more than Kindroid's 2,500-character Personality
  editor limit, even though the intended persona paragraph fits.
- Botify memories are atomic facts retained about the user; they are not the
  bot's persona and are not semantically interchangeable with a single
  Kindroid Key Memories block.

A second problem is read/write asymmetry. Kindroid's public update surface can
patch persona fields but cannot read them back. Botify can archive a full bot
definition and manage memory items, but the current sibling MCP does not expose
bot-definition writes. A safe design must therefore start with capture and
comparison, not with synchronization.

## 2. Goals

- Keep character canon provider-neutral, rich, and useful to storytelling.
- Give core characters a detailed, reusable voice specification suitable for
  casting, voice generation, or selecting the closest provider voice.
- Render bounded Kindroid and Botify payloads without treating either
  provider's vocabulary as canon.
- Preserve four distinct authorities: canon, desired projection, observed
  provider state, and account-specific binding.
- Make every proposed write reviewable field by field.
- Preserve unknown provider state instead of confusing it with an empty value.
- Record asset provenance, consent, and rights for any voice reference.
- Fail visibly on an over-limit projection; never silently truncate canon.

## 3. Non-goals

- A voice recorder, player, speech-to-speech path, or runtime audio interface.
- Automatic creation or upload of a Kindroid custom voice.
- Reverse-engineering unsupported Kindroid write endpoints for Learned Context,
  Journal, Favorites, avatars, or voice settings.
- Automated Kindroid page/DOM/network capture without written authorization
  from Kindroid. Ordinary human use of the UI is not permission to scrape it.
- Shipping Botify bot-definition writes before their route, authentication,
  replacement semantics, and retry behavior are live-validated.
- Group-chat roster/context/directive projection. That is a separate,
  multi-character lifecycle from an individual companion profile.
- Treating a changed canon file as authorization to mutate an external account.
- Storing API keys, bearer tokens, machine-specific paths, or raw account IDs in
  canon.
- A second seed/template execution engine. Seed templates remain a human/LLM
  authoring contract and imports remain one-shot copies, as ratified in
  [IMPORT_EXPORT_DESIGN.md](IMPORT_EXPORT_DESIGN.md).

## 4. Authority and layer model

The design keeps four layers separate:

| Layer | Authority | Mutable by | Must not contain |
| --- | --- | --- | --- |
| Character canon | Narrative truth and voice identity | Operator/editorial tooling | Provider limits, provider IDs, observed account state |
| Desired projection | Reviewed payload Mnemosyne would like a provider to hold | Projection tooling/operator | Credentials, invented read-back values |
| Observed snapshot | What a supported capture method actually saw | Capture tooling; append-only in normal operation, with authorized purge/redaction | Guesses for fields the method could not observe |
| Binding | Which account target/profile receives a projection | Explicit operator action | Character truth or copied credentials |

For stories using the living-canon filesystem, `canon/characters/` remains the
human-editable authoring surface and OpenChronicle remains the live runtime
copy. A companion projection is a derived operational artifact, never a second
narrative authority.

The current architecture stores the active story pointer locally and provider
runtime configuration in environment variables. A proposed per-story
`companions/` tree would therefore be a deliberate amendment to both the
ratified [data layout](DATA_LAYOUT.md) and the locked local-state posture in
[ARCHITECTURE.md](ARCHITECTURE.md) §2. This document records a candidate shape;
it does not ratify that amendment.

Existing story-level Kindroid targeting remains story-marker state. Future
per-character Kin/Botify bindings require the marker/export schema evolution
already anticipated in [IMPORT_EXPORT_DESIGN.md](IMPORT_EXPORT_DESIGN.md), not
an ad hoc raw ID hidden in a character file.

Immediately before a mutation, an apply adapter must resolve the logical
binding and verify the expected provider, account scope, and immutable target
identity/fingerprint against the reviewed plan. A display name is insufficient.
If the supported provider surface cannot verify account and target identity,
automated apply is blocked rather than pointed by assumption.

## 5. Canonical character additions

The detailed existing character sections remain authoritative for identity,
personality, background, relationships, and status. A bounded
`persona_summary` is a derived deployment projection, not a second canonical
summary to maintain.

The core character template should eventually retain its one-line frontmatter
`voice` value as a mechanically derived/index-only summary and add the
following provider-neutral body sections. The full `Voice Profile` is
authoritative; a compiler/linter must regenerate or flag a conflicting
frontmatter summary rather than choosing silently.

- `## Portrayal Guardrails` — ways the character must not collapse into a stock
  archetype or violate established agency/boundaries.
- `## Voice Profile` — acoustic and performance identity described below.
- `## Voice Performance Examples` — complete contrasting utterances, separate
  from a list of quotable one-liners.
- `## Scene Behavior & Hooks` — a clearer replacement for bare `Hooks`, keeping
  behavior distinct from possibilities that have not happened.

An optional `gender_identity` frontmatter field should be distinct from
`pronouns`. Neither is a mechanical substitute for the other.

The deliberately lightweight recurring-character template should not inherit
the full field set automatically. A recurring character needs an abbreviated
voice profile only when their repeated use or companion deployment justifies
it. Promotion to a companion target produces a projection; it does not require
inflating every supporting character.

These additions extend the existing requirements in
[LIVING_CANON_STANDARD.md](LIVING_CANON_STANDARD.md) §3.1-3.2 for voice,
habitual manner, and encounter behavior. Provider character limits never
become canon limits.

Detailed acoustic profiles and four examples can materially enlarge the OC
character body that current prompt assembly sends to a generator/validator.
They must not be enabled globally until a representative prompt-budget
benchmark measures the cost and chooses one explicit policy: compile only a
short dialogue-relevant summary into ordinary story context, add
section-aware ContextPlan filtering, or prove full inclusion affordable. The
canonical file still retains the complete profile either way.

### 5.1 Voice Profile content

A complete voice profile should answer:

- **Summary:** one sentence that helps a reader recognize the voice quickly.
- **Perceived age and register:** youthful/mature quality, soprano/alto/tenor/
  baritone/bass where useful, and comfortable pitch range without reducing a
  character to a label.
- **Timbre and texture:** warm, bright, smoky, clear, rough, breathy, metallic,
  velvet, nasal, dry, or other concrete qualities.
- **Resonance and placement:** chest/head balance, forward/back placement,
  fullness, projection, and how close-mic speech differs from public speech.
- **Accent and dialect:** language/region, strength, code-switching, and sounds
  that carry the accent. Avoid caricature spellings.
- **Cadence and tempo:** baseline speed, rhythm, pause length, sentence endings,
  interruptions, and how often silence does the work.
- **Articulation:** crisp/relaxed consonants, vowel shape, dropped sounds,
  precision, slurring, and formality.
- **Dynamic and emotional range:** volume and pitch movement; what changes under
  anger, fear, affection, authority, intimacy, embarrassment, fatigue, or pain.
- **Breath and non-speech sounds:** breath support, sighs, laughs, whispers,
  crying, humming, throat-clearing, or habitual sounds when canonically useful.
- **Language habits:** vocabulary, syntax, verbal tics, profanity, endearments,
  self-corrections, and topics that change the rhythm. This describes dialogue
  style, not acoustic sound, and should remain explicitly labeled as such.
- **Pronunciation:** character/place names, invented terms, multilingual words,
  and any deliberate nonstandard pronunciation.
- **Avoidances:** qualities a generated or selected voice must not acquire,
  including stereotypes, exaggerated accents, wrong apparent age, excessive
  rasp/fry, sing-song delivery, or unwanted theatricality.
- **Casting/generation notes:** the few traits that matter most when trade-offs
  are unavoidable.

Recommended performance examples:

1. Neutral conversation or practical explanation.
2. Warm/private delivery.
3. Stress, anger, command, or confrontation.
4. Vulnerable, exhausted, or quiet delivery.

The examples must sound like the character, but they are not canonical events
unless separately established. A projection chooses rather than blindly joins
them: Kindroid currently accepts one bounded Example Message, while Botify can
carry an example-message list.

## 6. Candidate projection storage

If the local projection layer is ratified, one candidate layout is:

```text
data/stories/<story-slug>/
├── companions/
│   └── <character-slug>/
│       ├── profile.yaml
│       ├── providers/
│       │   ├── kindroid.yaml
│       │   └── botify.yaml
│       └── snapshots/
│           ├── <stamp>-kindroid.json
│           └── <stamp>-botify.json
└── references/characters/<character-slug>/voice/
    ├── neutral.<ext>
    ├── neutral.json
    ├── warm.<ext>
    └── warm.json
```

This is intentionally a candidate, not a ratified path. Adoption must amend
[DATA_LAYOUT.md](DATA_LAYOUT.md), including ownership and write rules. It must
use `storySlug()`, shell-safe names, repo-relative paths, and UTC timestamps.
The current server may not begin writing these directories merely because this
document names them.

`profile.yaml` would identify the source character and revision and hold only
provider-neutral projection choices or documented overrides. Provider files
would hold desired provider payloads and logical target references. Historical
snapshots would hold observed normalized state plus capture metadata. In normal
operation a new observation appends a snapshot rather than rewriting history;
an authorized retention, consent-revocation, or privacy purge has higher
priority and leaves only a content-free tombstone/audit event.

Raw provider responses are not retained by default. A normalized snapshot
stores only fields required for a declared comparison. Explicitly approved raw
retention must have a purpose, byte/record bound, restrictive filesystem ACL,
encryption at rest where practical, retention deadline, deletion procedure,
and backup-impact disclosure. Authentication headers, cookies, bearer values,
signed access URLs, and unrelated account/profile data must be stripped or
replaced with non-secret fingerprints before storage. Raw field values must
not enter logs, screenshots, errors, test fixtures, or telemetry.

`data/` being gitignored prevents an ordinary accidental commit; it is not an
access-control, encryption, retention, or backup policy. Voice audio, intimate
persona text, media URLs, and provider snapshots need an access-controlled
storage decision independent of Git.

Every projection/snapshot needs at least:

- schema version;
- story and character key;
- repo-relative source path and source-content hash;
- provider and logical target reference;
- artifact-appropriate timestamps (`generated_at` for a rendered projection,
  `reviewed_at` after review, `observed_at` for a snapshot); absent events stay
  absent rather than receiving invented timestamps;
- capture method and its coverage limitations;
- field-limit assumptions and their observed-as-of date;
- explicit `unknown`, `unmanaged`, and deliberately empty fields;
- when explicitly retained, a hash and retention class for the raw archived
  provider object;
- review status and reviewer note.

Credentials stay in environment configuration. Provider IDs should resolve
through a binding/registry layer rather than appearing in canonical prose.
Snapshots are untrusted inputs: parsers must enforce a versioned schema,
maximum document/field/array sizes, scalar types, and path confinement. Values
must never be interpolated into prompts, commands, filenames, URLs, or paths;
validation errors must identify the field without echoing its sensitive value.

## 7. Provider-neutral projection model

The compiler should first produce concepts that do not assume a provider:

```yaml
mnemosyne_companion_projection: 1
character:
  story: <story-slug>
  name: <canonical name>
  source_path: <repo-relative path>
  source_sha256: <hash>
profile:
  display_name: <name>
  gender_identity:
    state: value # value | empty | unknown | unmanaged | not_applicable
    value: <explicit value>
  pronouns:
    state: value
    value: <explicit value>
  persona_summary: <stable characterization>
  durable_relationship_facts:
    - key: <stable local key>
      text: <established fact>
  response_constraints:
    - <portrayal rule>
  voice_examples:
    - register: neutral
      text: <complete example>
  opening_situation:
    state: not_applicable
  voice_specification_ref: <canonical section/path>
runtime_overlay:
  story_state_revision: <immutable source revision>
  valid_at: <UTC timestamp>
  expires_at: <UTC timestamp>
  current_story_context:
    state: value
    value: <transient context>
  current_scene:
    state: value
    value: <live situation>
```

This is a rendering intermediate, not another authoring source. Every optional
or nullable value uses a tagged state; omission is invalid when field state is
material. Generated values must cite their source sections. A human override
needs a reason and must not silently flow back into canon.

The persistent desired profile excludes transient story context and scene.
Those values exist only in a runtime overlay with a source revision and expiry.
Apply rejects an expired overlay or one whose story-state revision no longer
matches. Durable current physical, emotional, and social status remains canon;
only the provider's momentary scene-setting/context is ephemeral.

Stable identity, durable facts, response constraints, current context, live
scene, and assets are separate because the providers do not partition them the
same way. The renderer may combine fields when a provider requires it, but it
must record that lossy transformation. Rendering is reproducible from the
retained intermediate and contribution manifest; a lossy provider payload is
not reversible by itself.

## 8. Kindroid projection

The sibling `kindroid-mcp` currently exposes partial, write-only updates for:

| Kindroid field | Current editor limit/availability | Projection source |
| --- | ---: | --- |
| `ai_name` | provider-defined | Canonical name |
| `ai_gender` | provider-defined | Explicit deployment choice; never inferred from pronouns |
| `ai_backstory` | 2,500 | Stable persona summary, selected background, and dialogue-relevant voice/personality traits |
| `ai_memory` | 1,000 | Selected durable established facts only |
| `ai_directive` | 250 | Portrayal guardrails and response behavior |
| `ai_example_message` | 750 | One complete reviewed voice example |
| `ai_additional_context` | plan-gated; Ultra 2,500, MAX 5,000 | Current story/relationship context |
| `current_scene` | 160 | The live situation only |
| `user_name`, `user_gender` | provider-defined | Operator/persona deployment state, not character canon |

Limits above are current observed/provider-documented values, not eternal
schema constants. A projection records the limit set and date used.

Kindroid custom voice construction and selection remain app-only relative to
the public API surface reviewed. The projection may carry a logical
`custom_voice_ref` and observed provider profile metadata, but the detailed
voice specification remains canonical and provider-neutral. An app-only voice
ID must not be written into a character file.

Kindroid Learned Context, Journal, Favorites, model/dynamism settings, and
custom voice state are `unmanaged` unless a supported surface appears.

The [Kindroid Terms](https://kindroid.ai/v2/docs/kindroid-legal/) boundary
recorded by the sibling MCP blocks automated browser/DOM/network capture,
browser-backed replication, and systematic page scraping unless Kindroid gives
written authorization for the intended operation. Supported baseline methods
are ordinary human transcription during normal UI use and an official or
support-provided export, each with declared coverage. Do not retain browser
traces, network logs, or screenshots as a workaround.

The Kindroid MCP mutation journal is not observed provider state. It proves
only that one MCP instance submitted a payload the API accepted at that time;
later UI edits, another client, or another deployment can supersede it. Treat a
journal record as an `accepted_unverified` write event/last-known-write hint,
never as a current snapshot or safe pre-edit baseline. Snapshot availability
is not write authority.

## 9. Botify projection

The current Botify client research identifies these semantic authoring fields:

- `name`, `description`, `appearance`, `bio`, `greeting`,
  message examples, `instruction`, avatar-generation prompt, `pronoun`, and
  tags;
- definition/deployment fields including visibility, avatar/idle/hero assets,
  selected voice, chat-photo behavior, tags, and remix/original-bot provenance.

Known current UI constraints include a 50-character name, a 140-character
public bio, and an observed 1,250-character aggregate example-message budget.
No defensible exact caps were found for description, appearance, greeting, or
instruction; the design must preserve `unknown` instead of inventing limits.

These names are semantic, not yet a normative write contract. Researched
client layers use different message-example spellings (`message_examples` and
`exampleMessages`), and visibility/pronoun enums remain endpoint-specific.
Before a renderer emits a Botify request, a dated live evidence fixture must
pin the exact endpoint, wire names, enum values, required/nullability rules,
and response behavior.

Recommended mappings:

| Botify field | Projection source | Important caveat |
| --- | --- | --- |
| `name` | Canonical name | Enforce the observed name bound |
| `pronoun` | Explicit pronouns | Not a substitute for gender identity |
| `description` | Stable persona/background | Do not mix public marketing copy into persona |
| `appearance` | Canonical visual identity | Keep generated asset URLs out of canon |
| `bio` | Deliberate public summary | Public surface; default to private/unlisted workflow |
| `greeting` | Initial encounter/opening situation | Not equivalent to a continuously changing current scene |
| message examples | Reviewed voice examples | Preserve examples individually; wire name remains evidence-gated |
| `instruction` | Response constraints/guardrails | Do not hide story facts here |
| avatar prompt | Visual-authoring input | The final write DTO carries generated asset URLs instead |
| voice/assets/tags/privacy | Provider deployment state | Sidecar/binding only |

Botify's account chat persona is account-scoped, unlike Kindroid's per-Kin user
fields. It belongs in a separate user-persona deployment record, never in a
character profile.

### 9.1 Botify memories

Botify memories are independent records scoped to a user and bot. Each has its
own provider item ID and replacement/deletion lifecycle. They should be modeled
as reviewed atomic facts with stable local keys and observed provider IDs.

Do not split and upload every Kindroid Key Memories sentence automatically.
Only facts that are truly about the user/relationship and appropriate for that
specific bot qualify. General world lore, the bot's own identity, speculative
hooks, and current scene state do not.

Botify definition writes are not currently exposed by the sibling MCP. Its
`archive_bot` output is useful evidence and recovery material, but the current
loose read type does not prove that the archive contains every owner-only
writable field or that read-only metadata may be resubmitted. A future writer
must use a separately modeled, live-validated full write DTO and validated
preservation semantics. Never replay the raw archive as a request, construct a
partial object and assume omitted fields survive, or claim archive-to-write
round-trip safety before it is proven.

## 10. Snapshot, diff, and apply workflow

The required order is:

1. **Author canon.** Resolve contradictions in narrative authority before
   touching a provider.
2. **Render desired state.** Produce the provider-neutral intermediate and
   provider payloads without writing externally.
3. **Validate.** Enforce known limits and field semantics. Report which source
   sections contributed to each field. Fail rather than truncate.
4. **Capture observed state.** Record capture time, method, raw-object hash, and
   fields the method could not see.
5. **Normalize.** Normalize line endings and provider wrappers without changing
   semantic text. Preserve raw snapshots separately when needed.
6. **Diff.** Show desired, observed, unknown, unmanaged, and over-limit fields
   independently.
7. **Review and bind.** The operator selects the exact fields and expected
   account/target identity. Unknown observed values require explicit
   acknowledgement before overwrite.
8. **Verify identity and apply once.** Resolve the logical binding immediately
   before mutation and verify provider, account scope, and immutable target
   fingerprint. Kindroid can then use a partial patch for selected fields.
   Future Botify writes require a separately live-validated write DTO and
   preservation contract; an archive object is not that DTO.
9. **Record outcome.** Persist the submitted payload and outcome. A transport
   timeout after a mutating request is `unknown`, not safely retryable.
10. **Capture after.** Read back where possible. Where read-back is impossible,
    mark the result `accepted_unverified`, not synchronized.

Capture methods have different authority:

- **Botify definition:** `archive_bot` provides the definition visible to its
  read endpoint; it is not assumed complete relative to a future write DTO.
  Memory listing captures atomic memory records separately.
- **Kindroid public API:** no persona read-back. Ordinary human transcription
  or an official/support-provided account export can provide partial evidence,
  but each must declare coverage. Automated browser capture is blocked absent
  written vendor authorization. The MCP write journal is an
  `accepted_unverified` event, not observed state. Unseen fields stay unknown.

No canon change triggers an automatic provider write. Current scene/context
updates remain explicit runtime actions, not a background synchronization loop.

## 11. Voice reference assets and provenance

If adopted, `references/characters/<slug>/voice/` is a new asset class, not an
implicit extension of the existing image-sidecar contract. Ratification must
amend [DATA_LAYOUT.md](DATA_LAYOUT.md) and the relevant asset-integrity rules in
[LIVING_CANON_STANDARD.md](LIVING_CANON_STANDARD.md).

Suggested variants are `neutral`, `warm`, `command`, `vulnerable`, and
`pronunciation`; only create variants that answer a real performance question.
Keep a provider-neutral master rather than treating a provider upload as the
only copy.

Each audio file needs a same-basename sidecar with at least:

```json
{
  "mnemosyne_voice_reference": 1,
  "subject": { "type": "character", "name": "<canonical name>" },
  "variant": "neutral",
  "asset_role": "source_reference",
  "review_status": "accepted",
  "source": "operator-recorded | licensed | synthetic | other",
  "speaker_ref": "<minimized local reference or synthetic source>",
  "rights_basis": "<ownership/license/consent basis>",
  "rights_artifact_ref": "<license/consent record reference>",
  "consent_status": "confirmed | not-applicable-synthetic",
  "usage_restrictions": null,
  "retention_until": null,
  "revoked_at": null,
  "language": "<BCP-47 tag>",
  "accent_notes": "<provider-neutral description>",
  "transcript": "<verbatim transcript>",
  "format": "<codec/container>",
  "duration_seconds": 12.4,
  "sha256": "<content hash>",
  "created_at": "<UTC timestamp>",
  "provenance_status": "complete"
}
```

Voice can be biometric and identifying. Source audio must be owned, licensed,
synthetic with an appropriate license, or recorded with informed consent for
the intended use. Do not clone or imitate a real person's voice without
authorization. Minimize speaker identity in the asset sidecar and keep the
actual consent/license evidence in an access-controlled record referenced by
`rights_artifact_ref`. Record purpose, restrictions, expiry, revocation, and
deletion obligations. `unknown` consent is not acceptable for an adopted voice
reference. Raw audio and provider snapshots require access-controlled storage;
gitignore alone is insufficient.

Provider-side deletion does not delete the durable master; local deletion does
not delete a provider profile. Any future tooling must make both scopes
explicit. Consent withdrawal or a rights/retention expiry initiates an
authorized purge across local masters, derivatives, provider uploads, and
known backups where feasible; the audit retains only a content-free tombstone.

## 12. Legacy migration

The eight Chaos Saga `DISTILLED ESSENCE` blocks are migration inputs, not a
schema to perpetuate.

For each block:

1. Resolve stale relationship/status claims against current authoritative
   canon.
2. Reconcile stable characterization into the existing authoritative
   personality/background sections; derive the bounded deployment
   `persona_summary` from them rather than creating duplicate canon.
3. Move behavior boundaries into `Portrayal Guardrails`.
4. Move acoustic/performance facts into `Voice Profile` and language habits
   into the explicitly labeled dialogue-style subsection.
5. Select complete example utterances rather than joining every quote.
6. Keep durable established relationship facts separate from current context.
7. Keep durable current physical, emotional, and social status in canon, but
   remove only momentary provider scene-setting from the persistent character
   profile and place it in an expiring runtime overlay.
8. Give appearance and unrelated lore their own H2 boundaries so a projection
   parser cannot absorb them accidentally.

Do not edit matching files in `exports/`; those are backups, not the authoring
surface.

## 13. Adversarial review

The design must defend against these failure modes:

| Failure | Consequence | Required defense |
| --- | --- | --- |
| Duplicated truth | Canon and profile prose drift | Derived projection, source hash, contribution trace |
| False provider equivalence | Facts land in the wrong semantic field | Provider-neutral intermediate plus explicit lossy mappings |
| Unauthorized Kindroid capture | Terms or privacy boundaries are violated | Human transcription or an official/support export only unless Kindroid gives written authorization for automation |
| Blind Kindroid write | Unknown live state is overwritten | Supported baseline + unknown/empty distinction + selected patch |
| Partial Botify write assumption | Omitted definition fields disappear | Live-validated write DTO, preservation contract, and pre-write review; never replay an archive as a request |
| Wrong account or target | A correct payload changes the wrong companion | Account binding plus immutable target fingerprint verified immediately before apply |
| Silent truncation | Character loses load-bearing nuance | Hard validation with actionable overflow report |
| Transient state fossilized | Old scenes become permanent identity | Revision-bound, expiring runtime overlay separate from durable canon |
| Pronoun/gender inference | Misgendering and lossy identity | Separate explicit fields; no inference |
| Memory dumping | Botify stores persona/world facts as user memory | Atomic semantic review per memory item |
| Unauthorized voice imitation | Privacy, consent, and legal harm | Rights/consent provenance and controlled source storage |
| Consent later withdrawn | A disallowed voice remains locally or at a provider | Revocation-aware bindings plus scoped purge and content-free tombstone |
| Sensitive data retained casually | Voice biometrics, tokens, or private profile text leak | Minimize collection; access control, encryption, redaction, retention, purge, and backup policy |
| Profile crowds out story context | Rich voice prose degrades generation quality | Projection-specific prompt budget and benchmark before global prompt inclusion |
| Stale provider assumptions | A changed UI/API invalidates output | Limits-as-of metadata and live validation before apply work |
| Ambiguous mutating timeout | Retrying duplicates or overwrites state | `unknown` outcome; inspect before retry |
| Provider content treated as instructions | Snapshot text influences tooling | Treat archives as untrusted data, never executable directives |

## 14. Rejected alternatives

- **Put Kindroid/Botify fields directly in character canon.** Rejected because
  provider vocabularies, limits, IDs, and mutability differ and change.
- **One universal persona blob.** Rejected because stable persona, memory,
  directive, examples, current context, and scene have different lifecycles.
- **Use short quotes as the voice profile.** Rejected because wording style
  does not define pitch, timbre, accent, cadence, emotional modulation, or
  generation avoidances.
- **Treat provider voice ID as canon.** Rejected because it is account-specific
  deployment state and may disappear while the character's voice identity
  remains valid.
- **Auto-sync on canon edit.** Rejected because an edit is not external-write
  authorization and both providers have dangerous read/write asymmetries.
- **Map Kindroid Key Memories directly to Botify memory items.** Rejected
  because Botify's records are atomic facts about the user and relationship.
- **Store current scene in the character template.** Rejected because it is
  transient runtime state.
- **Reuse image sidecars for audio without amendment.** Rejected because voice
  needs speaker, consent, rights, transcript, format, and deletion semantics.

## 15. Candidate implementation slices

Nothing below is scheduled. If ratified, the smallest useful sequence is:

1. **Canon guidance:** update the core character and seed-template guidance
   with `gender_identity`, Portrayal Guardrails, Voice Profile, complete
   performance examples, and clearer hook boundaries. Add a bounded derived
   persona renderer instead of a second canonical summary.
2. **Schema and renderer:** define the provider-neutral intermediate,
   versioned provider projections, contribution tracing, and strict limit
   validation. Establish and benchmark projection-specific context budgets.
   Dry-run only.
3. **Capture and diff:** Botify archive/memory normalization; supported
   Kindroid human-transcription or official-export import with declared
   coverage; historically retained snapshots, authorized purge tombstones, and
   field-level diff. Do not automate Kindroid browser capture without written
   vendor authorization.
4. **Reviewed Kindroid apply:** selected partial fields only, journaled, with
   `accepted_unverified` when read-back remains unavailable, and only after an
   apply-time account/target identity check.
5. **Botify definition apply:** only after the exact write DTO, endpoint,
   enum/nullability rules, and preservation behavior are live-validated.
   Memory CRUD remains a separate reviewed workflow.
6. **Voice assets:** ratify the data-layout amendment, provenance schema, and
   manual custom-voice workflow before any upload automation. Include
   revocation and local/provider/backup purge procedures.

Acceptance requires:

- semantically deterministic payloads from the same canon revision and
  projection config, excluding separately recorded artifact timestamps;
- no silent truncation or gender inference;
- preservation of unknown Botify definition fields proven against a dated,
  live-validated write contract rather than inferred from an archive;
- a diff that distinguishes unknown, empty, unmanaged, changed, and over-limit;
- no external mutation during render, capture, or diff;
- an explicit selected-field audit record for every apply;
- automated apply blocked when account or immutable target identity cannot be
  verified immediately beforehand;
- no automated Kindroid browser capture without written vendor authorization;
- snapshots and voice assets subject to tested access, redaction, retention,
  backup, and authorized-purge controls;
- voice assets rejected when rights/consent metadata is absent, expired, or
  revoked;
- benchmark evidence that the selected profile projection fits its prompt
  budget without materially crowding out story context;
- tests proving a timeout after a mutating request is not automatically retried.

## 16. Open decisions before ratification

1. Does the projection live under a new local `companions/` tree, in a separate
   operator-owned repository/store, or behind a future OC entity type that is
   excluded from narrative prompts?
2. Is `profile.yaml` entirely generated, or may it contain reviewed overrides?
   If overrides exist, how are they reconciled when canon changes?
3. Do per-character provider bindings extend the story marker/export schema or
   live in a separate account-local registry referenced by logical name?
4. Is human transcription sufficient for a first Kindroid observed baseline,
   or can Kindroid provide an official/support export? How is partial coverage
   represented? Browser automation remains excluded unless Kindroid provides
   written authorization.
5. Which audio formats become canonical masters, and are source clips copied
   into the data tree or referenced from an access-controlled archive?
6. Is a detailed Voice Profile required for every core character or only for a
   character selected for voice/companion deployment?
7. Which parts of this proposal amend the Living Canon Standard versus remain
   optional deployment guidance?
8. What prompt budgets and benchmark thresholds govern each provider
   projection and any use of the Voice Profile in Mnemosyne generation?
9. Where do sensitive snapshots and voice assets live, and what are their
   access-control, encryption, retention, deletion, and backup obligations?
10. What provider-specific evidence can verify the account and immutable target
    identity immediately before an apply?

When these are decided, amend the locked/ratified documents explicitly rather
than treating this proposal as if it had already changed them.

## 17. Adversarial revision note

The 2026-08-29 adversarial review materially narrowed this proposal. It blocked
automated Kindroid browser capture without written vendor authorization,
separated accepted writes from observed state, rejected Botify archives as an
assumed write DTO, required apply-time account/target verification, added
sensitive-data and consent-revocation controls, replaced duplicate canonical
summaries with derived projections, and made runtime context revision-bound and
expiring. These are load-bearing constraints, not optional implementation
details.
