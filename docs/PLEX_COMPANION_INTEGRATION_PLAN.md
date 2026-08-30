# Plex Companion Integration Plan

**Status:** Reviewed proposal, recorded 2026-08-29 and revised through
independent authority/security and failure/crash adversarial passes. Final
review verdict: **PASS**. This is not ratified or scheduled.
[STATUS.md](../STATUS.md) remains authoritative for current project state.

This plan is grounded in Mnemosyne at `fbaf5f8` and plex-companion at
`402f037`. It supersedes the raw-`mnemo_continue` integration sketched in
[WEBUI_NOTES.md §7](WEBUI_NOTES.md#7-watch-parties--mnemosyne-as-plex-companions-passthrough).

## Decision

Mnemosyne should be **both before and after companion delivery**, but through
one owner-wrapped interaction call rather than separate prepare and record
hooks:

1. plex-companion decides that an event deserves an engagement and sends one
   structured interaction to Mnemosyne;
2. Mnemosyne authorizes and freezes the story route, admits story context, and
   calls the bound companion provider at most once;
3. Mnemosyne classifies the provider outcome and, when a reply is confirmed,
   attempts the route's narrative-record policy before returning a structured
   result;
4. plex-companion records bounded outcome pointers and applies its cooldown.

Mnemosyne is the **lifecycle owner**, not an atomic transaction coordinator.
Kindroid and Botify offer no transaction spanning provider delivery and
OpenChronicle (OC) persistence. A process crash can therefore lose a confirmed
reply after the provider accepted it but before Mnemosyne durably recorded its
prose. The v1 safety choice is to skip or flag that interaction, never to risk
sending it again.

Only **approved engagements** cross this boundary. Filtered or gated webhooks,
status/history reads, pause/resume, Plex/Tautulli lookups, and lore gathering
remain entirely in plex-companion. “Every interaction passes through
Mnemosyne” means every backend-admitted companion engagement, not every Plex
event or control-plane operation.

## V1 guarantees and explicit limits

V1 provides:

- conservative **at-most-one provider dispatch** for an accepted interaction
  ID within the documented replay horizon, in a single Mnemosyne process;
- immutable story UUID, route revision, provider account, and target binding
  authority before a live call;
- one shared mutation coordinator for integration traffic and ordinary
  Mnemosyne companion sends;
- no automatic retry, provider fallback, fan-out, or target change after the
  durable dispatch boundary;
- exact, isolated OC candidate identity and conservative reconciliation after
  an uncertain write; and
- content-free operational ledgers and prose-suppressed integration logs.

V1 does **not** provide:

- atomic provider delivery plus OC recording;
- guaranteed transcript recovery after a crash between provider success and
  the first durable prose write;
- exactly-once OC creation (OC has no idempotency key today);
- multi-process or multi-replica admission; or
- indefinite replay protection after both the acceptance window and its
  tombstone window have closed.

Those limits are acceptance criteria, not implementation details to hide. An
automatic route stays disabled if any component cannot preserve them.

## Why the existing seam is right, but `mnemo_continue` is not

The cross-repository seam is plex-companion's
`CompanionBackend.engage(CompanionContext)`. Its pipeline already owns webhook
filtering, account/library rules, cooldown/chance gates, Plex and Tautulli
facts, completion confidence, lore, suggestion semantics, and manual-gate
bypass. Replacing that backend keeps Plex knowledge out of Mnemosyne.

Mnemosyne's `continueScene()` contains useful inner operations, but the public
`mnemo_continue` contract cannot simply be reused:

- it records generated reply text without an attributable Plex event;
- it saves every nonempty complete result as a scene and has no ambient or
  review-candidate admission policy;
- it has no durable interaction ID or replay fence;
- Kindroid/Botify do not see the assembled prompt, rules, style, or mode;
- its Kindroid group nudge unconditionally asks participants to keep talking,
  conflicting with plex-companion's `natural`, `post_only`, and `forced`
  behavior;
- provider and Botify target selection are process-global, not story-bound;
- story-name lookup is non-unique and chooses the first match; and
- MCP-thrown outcomes lose the structured retry projection an unattended
  client needs.

The plan reuses context planning, provider clients, validation, and OC access
behind a dedicated domain contract. It does not change the meaning of
`mnemo_continue`.

## Authority boundary

| Component | Owns | Must not own |
| --- | --- | --- |
| Plex / plex-companion | Webhook intake and network restriction; filtering and gating; Plex/Tautulli facts; completion and spoiler classification; lore lookup; strict source reservation; cooldown; bounded history | Story lookup; OC writes; caller-selected provider/target; provider retry/fallback |
| Mnemosyne | Source authorization; immutable story route; context admission; server-owned rendering; target verification; shared provider dispatch; replay ledger; typed outcome; candidate/promotion lifecycle | Plex polling; raw-webhook interpretation; inventing completion/spoiler facts |
| Companion adapter | One provider-specific mutation and typed boundary/read-back result | Application retry; fallback; route or narrative-admission decisions |
| OpenChronicle | Story-scoped candidates and admitted live scenes | Provider-delivery idempotency or operational replay ledger |

The request carries normalized Plex **data**, not a rendered instruction. The
original draft left Plex-specific prompt wording in plex-companion; review
showed that an opaque `source_note` would be a prompt-injection and policy
authority channel. Mnemosyne v1 instead owns a versioned renderer while
plex-companion remains authoritative for the structured facts it emits.

## End-to-end lifecycle

```text
Plex webhook / manual companion command
    -> plex-companion filter + gate + facts + lore
    -> strict local interaction/cooldown reservation
    -> one authenticated structured request
    -> Mnemosyne schema/auth/profile/route preflight
    -> exclusive replay reservation (queued)
    -> bounded story lane + shared provider mutation lane
    -> reverify route and immutable target fingerprint
    -> durable dispatching transition immediately before provider call
    -> one provider mutation and typed outcome
    -> isolated candidate write, then optional in-place promotion
    -> structured result
    -> bounded plex-companion history update
```

The caller disconnect rule follows the existing run-outcome posture: cancel a
queued operation when it is provably before dispatch; after the dispatch
boundary, finish outcome normalization and the record attempt even if the
caller disconnects.

## Versioned request: data, not instructions

Add a shared `companionInteract()` domain function. Automatic traffic uses a
dedicated least-privilege REST endpoint such as
`POST /api/integrations/plex-companion/v1/interactions`. An optional
`mnemo_companion_interact` MCP tool may wrap the same function for manual tests,
but the full MCP credential is never authorized for the unattended daemon.

The v1 request has no story name, provider, target, response mode, raw webhook,
raw lore object, rendered prompt, or arbitrary instruction field:

```ts
interface PlexCompanionInteractionV1 {
  schema_version: 1;
  interaction_id: string; // UUIDv7, reserved by plex-companion before the call
  source_key?: string; // required for automatic ingress; optional for manual calls
  story_id: string; // exact OC project UUID, allowlisted by the credential profile
  occurred_at: string; // RFC 3339; bounded by the acceptance window
  payload: StartPayload | ReactionPayload | SuggestionPayload;
}

interface StartPayload {
  kind: "start";
  media: IdentityMediaData;
  // event=playback_started and completion=just_started are implied.
  // Synopsis, genres, cast, rewatch, and enrichment are impossible here.
}

type ReactionPayload = {
  kind: "reaction";
  media: ReactionMediaData;
  generated_enrichment?: GeneratedEnrichmentData;
} & (
  | { origin: "scrobble"; completion: "near_complete" }
  | { origin: "stop"; completion: "unknown" }
  | { origin: "manual"; completion: "unknown" | "complete" }
);

interface SuggestionPayload {
  kind: "suggestion";
  mood_hint?: string;
  local_timing: {
    weekday: "monday" | "tuesday" | "wednesday" | "thursday" |
      "friday" | "saturday" | "sunday";
    daypart: "morning" | "afternoon" | "evening" | "night";
  };
  on_deck: SuggestionMediaData[];
  recently_added: SuggestionMediaData[];
  recently_watched: Pick<IdentityMediaData, "title">[];
}

interface IdentityMediaData {
  rating_key?: string;
  media_type: "movie" | "episode" | "season" | "show" | "other";
  title: string;
  show_title?: string;
  season_number?: number;
  episode_number?: number;
  year?: number;
}

interface ReactionMediaData extends IdentityMediaData {
  synopsis?: string;
  genres: string[];
  cast: string[];
  rewatch: boolean;
}

type SuggestionMediaData = IdentityMediaData;

interface GeneratedEnrichmentData {
  kind: "generated_lore_brief";
  text: string;
  generator: {
    provider: "anthropic_messages_web_search";
    model_id: string;
  };
  sources: ("plex_metadata" | "web_search" | "subtitle")[];
  coverage: "premise_only" | "pre_ending" | "full_item";
  max_words: 80;
}
```

The discriminated union is the validity matrix. A start can only mean
`playback_started/just_started`; a scrobble can only be
`watched_threshold/near_complete`; a stop can only be
`playback_stopped/unknown`; and only a manual reaction may assert `complete`.
Unknown combinations and fields reject before reservation. Suggestion source
buckets remain distinct because on-deck, recently-added, and recently-watched
have different semantics; the mood hint remains bounded untrusted data.

V1 limits titles/model IDs to 256 characters, synopsis to 2,000 characters,
mood hint to 280 characters, genres/cast to 20 entries of 100 characters, and
each suggestion bucket to 20 entries. Generated enrichment is allowed only on
a reaction, remains advisory model output rather than a “fact,” and is limited
to 80 words/800 characters. `subtitle` is allowed only for manual-complete with
`full_item`; automatic scrobble must use `pre_ending`, stop/manual-unknown must
use `premise_only`, and start/suggestion cannot carry enrichment.

Unknown keys fail schema validation. All strings—including Plex synopsis,
suggestion hint, and generated enrichment—remain untrusted data. The renderer
serializes them as canonical JSON inside a clearly delimited untrusted-data
block. Mnemosyne-owned provenance, spoiler posture, kin-autonomy wording, route
context, and response policy are versioned server instructions outside that
block. Dynamic data is never interpolated into an instruction sentence.

This is risk reduction, not a claim that delimiters make an LLM secure.
Cross-repository golden fixtures must preserve plex-companion's current
`near_complete`/`complete`, suggestion provenance, and “do not presume shared
attendance” semantics. Adversarial fixtures include instruction-like titles,
lore, Unicode controls, delimiter strings, oversized arrays, and conflicting
completion claims.

## Result and failure projection

Every request that reaches application handling returns a success-shaped JSON
envelope; only auth/schema/body-limit failures use ordinary transport errors.
The route returns HTTP 200 for terminal application outcomes so generic HTTP
middleware does not infer a retry.

```ts
interface CompanionInteractionResultV1 {
  schema_version: 1;
  interaction_id: string; // canonical ID; may be the source-key index's prior ID
  submitted_interaction_id?: string; // present when source-key coalescing changed it
  run_id: string;
  outcome:
    | "rejected_before_dispatch"
    | "duplicate_in_progress"
    | "accepted_silence"
    | "completed"
    | "completed_but_readback_failed"
    | "provider_dispatch_unknown";
  replayed: boolean;
  coalesced_by?: "interaction_id" | "source_key";
  dispatch_boundary_crossed: boolean; // original interaction, not this HTTP call
  retry_safe: boolean;
  route: {
    revision: string;
    renderer_version: string;
    delivery_policy: DeliveryPolicy;
  };
  context_manifest?: {
    admitted_memory_ids: string[];
    admitted_content_hmac: string;
  };
  reply_text?: string; // immediate first result only; never retained in the ledger
  group_turns?: number;
  record: {
    policy: "ambient" | "review" | "live_scene";
    status:
      | "not_applicable"
      | "candidate_saved"
      | "scene_promoted"
      | "missing"
      | "unknown";
    memory_id?: string;
  };
}
```

`dispatch_boundary_crossed` means the ledger reached `dispatching`; it does not
claim that an upstream server accepted the message. `retry_safe` is true only
for a terminal failure proven to precede that boundary. A terminal replay sets
`replayed: true` and returns the original normalized outcome and bounded
pointers, but never reply text. A duplicate of an active row returns
`duplicate_in_progress`; the caller does not start a second waiter with an
independent deadline. Source-key coalescing returns the pre-existing canonical
interaction ID so plex-companion repairs its local mapping rather than minting
another operation.

Any exception after `dispatching` is `provider_dispatch_unknown` and
non-retryable unless the adapter has typed, testable proof that no request bytes
or tool mutation crossed its own dispatch boundary. A generic MCP/network error
is not such proof. Current generic Kindroid and Botify error classification
cannot be reused unchanged.

## Authentication and ingress gates

Automatic use is blocked until all of these are true:

- the integration route requires a dedicated bearer credential even on
  loopback; it is distinct from `MCP_AUTH_TOKEN` and compared in constant time;
- Host/Origin and body-size middleware run first, integration authentication
  runs next, and no application handler or request logger sees an unauthorized
  body;
- the credential resolves to a server-side profile that allowlists exact story
  UUIDs, interaction kinds, and one route; it grants no MCP, filesystem,
  provider/target **selection or configuration**, or route-edit authority. It
  does authorize mutation of that one fixed provider conversation and receipt
  of its story-informed reply;
- profiles support overlapping old/new token hashes for bounded key rotation,
  rate limits, queue limits, and an absolute request deadline;
- traffic is same-host or on a private authenticated-TLS link. If a reverse
  proxy terminates TLS, it restricts the source IP and strips untrusted
  forwarding headers; and
- plex-companion's currently unsigned Plex webhook ingress is restricted to
  the configured Plex server by host firewall or authenticated reverse proxy
  before automatic engagement is enabled. “On the LAN” alone is not a gate.

A stolen integration token can therefore spam or prompt-influence its fixed
conversation even though it cannot choose another target. Each profile has a
low daily mutation cap, burst limit, immediate server-side kill switch, and
revocation/rotation procedure; the plex-companion kill switch is defense in
depth, not the only revocation mechanism.

The route accepts no filesystem path, provider name, account ID, target ID,
route revision, renderer version, or delivery mode from the caller.

## Story route, live OC references, and target binding

Every story defaults disabled. An operator-reviewed immutable route revision
contains:

- the exact OC project UUID and allowed credential profile/kinds;
- one admission policy: `ambient`, `review`, or `live_scene`;
- one server-owned renderer revision and delivery policy;
- route-bound **live OC reference** memory IDs with expected OC update marker
  and content HMAC;
- provider, account, immutable target ID, and expected target fingerprint in a
  restricted local binding; and
- queue, call-timeout, turn-cap, and candidate-retention bounds.

These are not called “canonical references.” OC scene/entity memories are live
runtime state; nothing in `canon/` is automatically imported into the story.
The HMAC lets Mnemosyne prove that a route-bound live OC reference changed
since route review, not that it drifted from filesystem canon. A missing or
mismatched required reference rejects before dispatch.

The route snapshot is resolved and frozen before replay reservation. The
ledger stores two distinct digests: `request_hmac` covers the full canonical
request, including submitted interaction ID and source key, for same-ID
collision detection; `source_semantic_hmac` covers schema version, story ID,
occurred-at, and payload while explicitly excluding interaction ID and source
key, for coalescing a semantically identical source redelivery under a new
UUID. It also stores the frozen profile/story/route/renderer/target
fingerprint. A later route revision does not turn the same request into an ID
collision. Immediately before dispatch, Mnemosyne confirms the route is still
enabled at that revision and queries the provider identity surface to verify
provider account, immutable target ID, and target fingerprint. Friendly names
are never sufficient for automatic traffic.

The existing story-level Kindroid marker can support manual development only.
It cannot enable automatic traffic unless the provider can return a stable,
verifiable account/target identity. Botify needs a scoped per-story binding and
the same verification before it enters this path. Any story-marker schema
change must coordinate with the unratified content-routing proposal rather
than independently claiming its schema number.

### Delivery capability matrix

The caller does not select a mode. The reviewed route selects only a policy
supported by the verified target:

| Target | `reply_once` | `natural` | `post_only` | `forced(max_turns)` | V1 automatic |
| --- | --- | --- | --- | --- | --- |
| Kindroid single AI | Yes | No | No | No | After identity, boundary, and remote-lifecycle gates |
| Kindroid group | No | Yes | Yes | Yes, bounded | After identity, boundary, and remote-lifecycle gates |
| Botify current full-authority client | No approved contract | No | No | No | **Blocked** |
| Direct LLM generator | Not companion delivery | Not companion delivery | Not companion delivery | Not companion delivery | **Out of scope** |

`natural` zero-turn and `post_only` are successful silence. Single-AI Kindroid
always uses `reply_once`; the route cannot pretend it supports post-only.

## Context and server-owned rendering

The source-aware builder:

1. admits recent eligible scenes using the existing deterministic strategy;
2. includes every required route-bound live OC reference, regardless of media
   title keyphrases;
3. may include ordinary keyphrase-matched lore/worldbuilding within existing
   context budgets;
4. emits the exact admitted memory IDs and a content HMAC in the result
   manifest;
5. renders the normalized Plex DTO through golden-tested Mnemosyne templates;
6. emits one provenance header and the route-owned delivery instruction; and
7. never uses `mnemo_continue`'s generic “automated scene direction” header or
   unconditional group “keep going / @mention” nudge.

Provider-side persona remains the primary voice authority. Rules/style may
drive advisory post-generation validation but must not be described as inputs
when the stateful provider did not receive them.

## Shared provider coordinator and bounded work

V1 uses one process-wide Kindroid mutation coordinator for **all** Mnemosyne
Kindroid sends: new companion interactions and ordinary `mnemo_continue`
traffic. Every operation that can commit live state for a story also uses that
story's lane, including ordinary continuation. A separate integration-only
queue would not serialize either real shared side effect. The first safe
implementation is globally serialized; later partitioning by a verified
account/target key requires its own evidence.

Ordering is fixed:

1. authenticate, validate, freeze route, and reserve the ledger row as
   `queued`;
2. enter a bounded per-story lane, then the shared provider lane;
3. recheck absolute deadline, route revision, required references, and target
   identity;
4. durably transition to `dispatching` immediately before the provider call;
5. release the provider lane after its outcome is normalized; retain the story
   lane through candidate reconciliation/promotion, then release it.

Every operation needing both lanes acquires story first and provider second.
Provider-only operations acquire only the provider lane. No path may acquire a
story lane while holding the provider lane.

Queue depth, maximum queue age, absolute request deadline, provider timeout,
and post-provider record grace are route/profile constants, not caller input.
A queued cancellation or deadline becomes `rejected_before_dispatch`; no row
waiting for a lane is marked ambiguous.

The outer client timeout is **not** evidence that upstream work stopped. The
current Kindroid MCP call can continue server-side after Mnemosyne stops
waiting, and a group advance is a multi-step operation. Before releasing the
provider lane, the coordinator durably records either a terminal result or an
unresolved `dispatching`/unknown row. Any unresolved row quarantines its target
fingerprint and, where serialization is account-wide, the account lane. New
work cannot enter that coordination domain until the adapter observes a remote
terminal operation ID, receives an acknowledged remote cancellation, or waits
a provider-published and integration-tested maximum completion horizon. Mere
elapsed local timeout or visual history inspection is not proof. Without one
of those capabilities, an unknown quarantine is permanent and service must use
a different verified target outside the quarantined domain.

Shutdown stops admission, terminally rejects queued rows, and lets local
`dispatching` work drain only for its configured wait budget; it does not
declare remote completion when that budget expires. On restart, `queued` rows
become retry-safe pre-dispatch rejections; `dispatching` rows become terminal
unknown and re-establish their target/account quarantine before admission
opens; `provider_terminal` or `record_pending` rows reconcile OC only and never
call the provider again.

## Durable replay ledger

This ledger deliberately amends the locked local-state boundary in
[ARCHITECTURE.md](ARCHITECTURE.md) and the current data layout. Ratification
must update those records before implementation. This document alone does not
silently override them.

V1 uses a single-process filesystem ledger under a new versioned subtree such
as `data/integrations/plex-companion/v1/ledger/`. It has an interaction-key row
and an HMACed source-key index for automatic ingress:

- reserve `source/<source-hmac>.json` first and then
  `interaction/<interaction-id>.json` using exclusive create (`wx`, mode
  `0600`), writing canonical JSON, syncing the file, and syncing its parent
  directory after **each** new directory entry before success or dispatch;
- a source-index row stores canonical interaction ID,
  `source_semantic_hmac`, frozen route fingerprint, and phase—but no raw source
  key. If a crash leaves only that row, an identical replay may finish creating
  its still-pre-dispatch interaction row; a mismatch or any uncertain
  invariant remains blocking;
- an existing source index coalesces a newly submitted UUID to its canonical
  interaction ID during `SOURCE_REPLAY_WINDOW`. A different
  `source_semantic_hmac` is a collision and rejects; no second provider
  operation is created;
- update by writing and syncing a unique same-directory temporary file, atomic
  rename over the row, and directory sync where the platform supports it;
- guard read/modify/write with a process-local keyed mutex;
- fail closed with zero provider calls when create, sync, read, parse, rename,
  or invariant validation fails;
- never move a corrupt row away from its key path. Leave it blocking that ID,
  alert, and at most copy its content-free bytes to a restricted quarantine;
- acquire an exclusive integration-instance lease at startup and fail closed
  if another process holds it. Run only one Mnemosyne process against the
  ledger; multi-replica deployment is blocked until an external
  compare-and-set store replaces this algorithm.

If the host filesystem cannot demonstrate durable create, replace, and parent-
directory sync semantics (including the Windows path), or cannot safely enforce
the instance lease, use a transactional SQLite ledger with unique interaction
and source keys instead. Automatic traffic is blocked rather than weakening
the durability contract.

The row contains no prompt, lore, reply, raw webhook, raw provider result,
credential, or raw target ID. It contains interaction/run IDs,
`request_hmac`, `source_semantic_hmac`, HMAC-SHA-256 of source key,
story/profile IDs, frozen route/renderer revision, HMACed target/context
fingerprints, lifecycle state, normalized outcome, timestamps, and optional OC
memory ID. HMACs use a dedicated ledger secret so low-entropy titles, rating
keys, and source keys are not vulnerable to an offline dictionary built from
plain hashes.

Every digest stores its `hmac_key_id`. Rotation adds a new active key; the
verification keyring retains old keys while any route, full row, source index,
or tombstone references them. Startup and key-removal tooling fail closed if a
referenced key is unavailable. Purpose-specific subkeys separate request,
source, target, context, and live-reference digests.

Because the filesystem source index is path-keyed by HMAC, lookup computes and
probes the candidate path under **every retained source-index key** while
holding the source-reservation mutex. Exactly one identical hit coalesces; more
than one hit or any semantic mismatch blocks. Only after proving no retained
key has a row may it reserve a path under the active key. HMAC rotation takes
the same exclusive integration lease. A SQLite implementation may instead use
one stable unique source-identity row with key-versioned encrypted/HMACed
columns, but must preserve the same no-miss property.

States are:

```text
queued -> rejected_before_dispatch
       -> dispatching -> provider_terminal -> record_pending -> done
                     -> provider_dispatch_unknown
                     -> completed_but_readback_failed
```

The full row compacts to a content-free tombstone after the operational review
window **only after it has a non-ambiguous terminal state**. `dispatching`,
provider-unknown, and target/account quarantine records do not age out; they
remain durable until the positive remote-lifecycle proof described above.
Requests are rejected before reservation when `occurred_at` or the
UUIDv7 timestamp is older than `MAX_ACCEPTED_AGE` or implausibly in the future.
Tombstones remain at least `MAX_ACCEPTED_AGE + MAX_QUEUE_AGE +
PROVIDER_TIMEOUT + RECORD_GRACE + CLOCK_SKEW`; only then can they be pruned.
Thus an ID cannot become newly admissible after its tombstone expires because
its own UUIDv7 timestamp is already outside the acceptance window. Exact
durations are ratification inputs and startup rejects an incoherent set.
Automatic source-index rows remain for at least `MAX_ACCEPTED_AGE +
CLOCK_SKEW`, so a source replay cannot outlive its coalescing record while its
original event is still admissible.

A crash after a reply but before any content write is visible only as unknown
or terminal-with-missing-record. Because the ledger is intentionally
content-free and the current providers expose no stable reply ID/read-back
contract, the prose may be lost. Future durable outbox recovery requires a
separate retention, encryption, ACL, and deletion decision; it is not smuggled
into v1.

## Strict plex-companion reservation and cooldown

plex-companion's current best-effort `StateStore` writer swallows write errors
and cannot support automatic admission. Replace it with one strict serialized
persistence owner for existing state plus pending interactions, cooldowns, and
the HMACed source-key index; SQLite transactions are the preferred shape. A
one-time migration retires `state.json` from writes. There must not be a second
writer that can overwrite admission state from a stale in-memory snapshot.
Every automatic gate reads the same authoritative store.

1. after account/library/event filtering, derive the bounded source key,
   acquire one process-global automatic-admission mutex, and look it up in a
   transaction;
2. if it already exists, reuse its UUID and prior admission decision without
   consuming cooldown twice. A pending/lost client response may replay that
   same canonical interaction to Mnemosyne; a locally terminal result needs no
   call;
3. for a new source, evaluate chance and global/per-item cooldown inside the
   transaction. If admitted, allocate UUIDv7, insert the source mapping plus
   pending history row, and advance cooldown for this **backend-admitted
   attempt** in the same commit;
4. fail closed before Mnemosyne on any begin/write/commit/sync error, release
   the admission mutex, call Mnemosyne once, then strictly persist the bounded
   outcome fields.

This closes the current race in which different rating keys can both pass a
global cooldown during a long backend call. It also preserves Plex's existing
intent: every backend-admitted attempt consumes cooldown, including a
Mnemosyne pre-dispatch rejection, duplicate, or provider failure. Manual
engagement may continue to bypass chance/cooldown, but it still reserves its
interaction ID durably before calling.

For a scrobble/stop, the source key is a canonical tuple of Plex server/account,
origin, rating key, and the strongest stable view/session timestamp. A start
without a verified session ID uses a short-window canonical payload fingerprint.
A scheduled suggestion uses local schedule date/slot; a manual invocation gets
a fresh non-deduped ID unless the manual caller explicitly reuses one. The
HMACed source mapping is retained through the same ingress replay window as
Mnemosyne's source index.

plex-companion applies the same key-ID/keyring rule: a source lookup probes all
retained source-index keys transactionally before inserting under the active
key, and key removal is blocked while an admission row references it.

The user-facing history projection stores only interaction/run/story IDs,
outcome, boundary flag, and OC memory ID—never source key, request, or reply
prose. The authoritative store retains the HMACed source-to-interaction mapping
without exposing it as history. A failure to persist the final history update
does not cause provider replay because the committed pre-call reservation
already exists and Mnemosyne owns the second fence.

## Review candidates and live-scene promotion

All confirmed replies that require narrative persistence first use one exact
candidate model in the story's OC project:

- content begins with the unrecognized header
  `[Plex Interaction Candidate v1] <interaction-id>` and contains only the
  compact normalized event plus exact attributed reply, not the full prompt,
  admitted lore, or provider response object;
- tags are exactly `mnemosyne`, `plex-companion`, `interaction-candidate`,
  `interaction:<uuid>`, and `admission:review` at creation;
- it deliberately has no `scene`, `story`, or recognized entity-type header/
  tag, so current recent-scene gathering, entity listing, and story export do
  not admit it; and
- only the dedicated candidate query accepts that header plus exact namespace
  tags. Contract tests cover every existing context and export entry point.

The policies are:

| Policy | OC behavior after confirmed reply |
| --- | --- |
| `ambient` | No prose write |
| `review` | Keep the isolated candidate until explicit promote/reject |
| `live_scene` | Create the same candidate, validate, then promote that memory in place under the story lane |

Promotion uses `memoryUpdate` on the same memory ID: replace the header/content
with the normal `[Scene]` transcript shape, replace candidate tags with normal
scene/provenance tags plus `interaction:<uuid>`, and retain validation result.
Validation errors leave it isolated with `admission:blocked`; warnings may
promote. This is live OC state, not automatic promotion into human-edited
`canon/scenes/`.

Before any candidate create, query the exact interaction tag. One match is
reused, more than one blocks for operator repair. If create/update/delete
returns an uncertain result, query by exact tag and memory ID. An acknowledged
match is reconciled; no match after an ambiguous write remains `unknown` and
is never followed by a blind second create. This intentionally prefers a
missing candidate to a duplicate. On restart, record reconciliation never
calls the companion provider.

Reject performs an acknowledged OC delete and leaves a content-free ledger
tombstone. A delete timeout remains pending until exact-ID reconciliation.
Review candidates default to a proposed 30-day operator-review TTL; expiry and
backup deletion behavior must be ratified and exposed through an authenticated
operator list/promote/reject/purge-status surface before an automatic route
opens. That minimum surface may be MCP/CLI; the richer Web UI can follow. OC
backups may retain rejected prose according to OC's own policy and must be
included in that disclosure.

## Privacy and retention

- Integration request/reply prose is always suppressed from Mnemosyne access,
  application, error, and quarantine logs, even when general
  `MNEMO_LOG_CONTENT=true`; logs carry sizes, state, and HMACed pointers only.
- plex-companion history and both operational ledgers are content-free.
- Review/live-scene prose exists in OC, its backups, and the companion
  provider's conversation; those are the declared durable content stores.
- Invalid bodies are rejected without persistence. Crash dumps and process
  memory remain a documented residual exposure during a live call.
- Transit is same-host or authenticated TLS. Tokens, target bindings, HMAC
  keys, and quarantine paths use restricted local permissions and are excluded
  from exports.
- Candidate rejection, TTL purge, OC backup retention, provider-side deletion,
  and any future outbox have separate, visible retention semantics. None is
  implied by deleting a ledger pointer.

## Provider launch gates

Kindroid is first because both repositories have an understood live path, but
automatic traffic remains blocked until its adapter supplies immutable target
verification, typed dispatch-boundary outcomes, the capability matrix above,
the shared coordinator for every Mnemosyne Kindroid mutation, and a remote
operation ID/status, acknowledged cancellation, or tested provider-published
completion horizon. The current MCP client timeout alone satisfies none of
those remote-lifecycle gates.

Botify is additionally blocked until all of these exist and pass manual
canaries:

1. a dedicated authenticated, versioned companion endpoint—not the current
   full-authority MCP generator client;
2. a fixed-target credential and per-story binding with immutable account/
   target fingerprint query;
3. typed proof of pre-dispatch failure versus post-boundary unknown;
4. documented reply/read-back and accepted-silence semantics;
5. bounded serialization/rate behavior and no hidden retry;
6. contract fixtures for supported delivery policies; and
7. a separate security review and one-target manual canary.

Direct LLM generators are out of scope because generating text is not delivery
to the user-visible companion conversation.

## Implementation slices and dependencies

| Slice | Depends on | Exit gate |
| --- | --- | --- |
| 0. Ratify boundaries | — | Amend ARCHITECTURE/data-layout records; approve auth threat model, replay/TTL constants, candidate retention, first story/target/policy |
| 1. Contract and renderer fixtures | 0 | Cross-repo DTO/golden/adversarial fixtures pass; no provider mutation |
| 2. Route, auth, ledger, recovery | 1 | Fail-closed persistence/corruption/restart tests pass with fake provider count zero where required |
| 3. Candidate lifecycle | 2 | Isolation, exact-tag reconciliation, in-place promotion/reject, export/context leakage tests pass |
| 4. Kindroid adapter/coordinator | 2 | Identity, boundary, capability, queue/deadline/shutdown, and ordinary-`mnemo_continue` serialization tests pass |
| 5. plex-companion backend | 1–4 | Strict reservation/cooldown race tests and no-fallback backend selection pass |
| 6. Manual canary | 5 | Dedicated target in `review`; same-ID replay creates one provider mutation and at most one candidate |
| 7. Minimum operator surface | 6 | Authenticated list/promote/reject/purge status and retention/backup disclosure work without prose logs |
| 8. Automatic canary | 7 | One source kind/story behind kill switch; restart, timeout, quarantine, ambiguity, retention, and cooldown drills pass |
| 9. Review Web UI / wider rollout | 8 | Pending/blocked candidates, exact route/target posture, validation, quarantine, and retention are visible |
| 10. Botify | Botify gates + 9 | Separate manual and automatic canaries pass |

Do not remove plex-companion's direct Kindroid backend during canary. It
remains an operator-selected rollback backend and is never a per-interaction
fallback.

## Acceptance tests

- Filtered/gated webhooks make zero Mnemosyne calls.
- Auth, schema, stale timestamp, non-UUID story, disallowed kind, missing live
  OC reference, route drift, target mismatch, ledger sync failure, and corrupt
  row each produce zero provider calls.
- The route is frozen before reservation; a duplicate uses its original frozen
  metadata even after route configuration changes.
- Same-ID concurrency, a new UUID with the same automatic source key, caller
  timeout, restart, and terminal replay cause at most one provider dispatch
  inside the declared horizon. Reused ID/source key with different request
  content is rejected; terminal replay returns its original normalized outcome
  with `replayed: true` and no reply prose.
- Concurrent new UUIDs with one source key and identical semantic payload
  coalesce to one canonical ID even though their full `request_hmac` values
  differ. The same fixture crosses an HMAC-key rotation and proves lookup under
  every retained source-index key before active-key reservation.
- HMAC rotation preserves replays under old key IDs through all referenced
  route/index/tombstone horizons; removing a referenced verification key fails
  startup.
- A queued crash/deadline is retry-safe; every failure after `dispatching` is
  non-retryable unless the adapter proves pre-dispatch.
- Ordinary `mnemo_continue` and integration sends cannot overlap through a
  second Kindroid mutation lane. Queue depth, age, shutdown, and absolute
  deadline tests are deterministic.
- A simulated outer timeout with continuing remote Kindroid work durably
  quarantines the target/account before another admission; restart reconstructs
  that quarantine. Elapsed local timeout never clears it.
- Single-AI and group targets reject unsupported policies before dispatch;
  natural zero-turn and post-only are successful silence and create no scene.
- plex-companion consumes cooldown for every backend-admitted attempt and its
  strict reservation failure makes zero Mnemosyne calls.
- `ambient` writes no OC prose. Candidate prose is absent from all current
  context/entity/export content; export may list its memory ID only as an
  expected `skipped_memory_ids` exclusion. Promotion updates the same memory
  ID.
- An ambiguous OC create/update/delete never triggers a second provider call
  or blind second memory create; restart recovery is conservative.
- A crash after provider success may yield `record: missing/unknown`, never a
  claim of atomic capture and never an automatic resend.
- Logs, history, ledger, tombstones, and corruption quarantine contain no Plex
  or reply prose, raw target ID, raw source key, credential, or raw upstream
  object.
- Current Botify full-authority MCP cannot satisfy an automatic route.
- Existing `mnemo_continue` behavior is unchanged except that its Kindroid
  mutation now participates in the shared coordinator.

## Rollout and quiescent rollback

Automatic routes and the plex-companion Mnemosyne backend default off. Rollout
is fake provider, contract-only manual call, one real manual mutation on a
dedicated target, then one low-volume automatic source kind/story. Widen only
after an ambiguity drill and a full tombstone/TTL observation window.

Rollback is not an immediate backend toggle on the same target:

1. close new Mnemosyne-backend admission in plex-companion;
2. stop new integration admission in Mnemosyne;
3. reject queued work and drain story/provider lanes;
4. reconcile every `dispatching`, unknown, and record-pending row using a
   remote operation terminal state, acknowledged cancellation, or a tested
   provider-published completion horizon;
5. enable the direct backend for fresh interaction IDs on the same target only
   after that positive remote-lifecycle proof.

Waiting `PROVIDER_TIMEOUT + RECORD_GRACE` alone is never sufficient because the
current MCP timeout does not cancel server-side work. If positive proof is
unavailable, the target (and any shared account serialization domain) remains
quarantined indefinitely; resume only on a deliberately different verified
target outside that domain. Old interaction IDs remain terminal and are never
“repaired” by sending again.

## Ratification decisions

Before implementation, the operator must approve:

1. the deliberate ARCHITECTURE/data-layout amendment and single-process limit;
2. the first exact OC story UUID and verified immutable Kindroid target;
3. first route policy (recommended: `review`) and allowed kind (recommended:
   manual `reaction` only);
4. target delivery policy/turn cap from the capability matrix;
5. request age, queue, provider, record-grace, full-row, tombstone, candidate,
   source-replay, and OC-backup retention values;
6. credential storage/rotation, source network restriction, and HMAC-key
   version/keyring operations;
7. whether loss-without-resend is acceptable for v1 or a separately designed
   encrypted outbox/provider reconciliation contract is required first; and
8. the provider's positive remote-completion/cancellation evidence and the
   coordination domain quarantined when that evidence is unavailable.

No ratification decision authorizes a live companion message. Implementation,
manual canary, and automatic canary are separate explicit execution steps.

## Adversarial review record

Two independent first-pass reviews returned **BLOCK**, and this revision folds
in every blocking class:

| Review lens | Blocking attack | Revision |
| --- | --- | --- |
| Failure/crash safety | Claimed wrapper implied atomic capture; OC has no idempotent save; lane marked dispatching too early; queues/restarts/rollback underspecified | Downgraded to lifecycle ownership and at-most-one dispatch; made transcript loss explicit; exact candidate reconciliation; lane-before-boundary ordering; bounded shutdown/restart; quiescent rollback |
| Durability/replay | Plex writer is best effort; ledger algorithm/corruption/retention absent; cooldown would regress | Added strict fail-closed Plex reservation, synced exclusive ledger algorithm, tombstone horizon, single-process gate, and backend-admitted cooldown semantics |
| Authority/security | Story names and unverifiable friendly targets; broad MCP credential; unsigned ingress; caller prompt/mode authority | UUID-only scoped profile, immutable target fingerprint verification, dedicated REST credential, network ingress gates, structured DTO, server-owned renderer/policy |
| Context/canon/persistence | “Canonical” OC references overstated provenance; candidate exclusion/promotion vague; result omitted context manifest | Renamed and revision-bound live OC references, exact candidate header/tags/in-place promotion, manifest in v1 result, explicit non-import of filesystem canon |
| Privacy/provider compatibility | Plain hashes and prose logging; incomplete capability/Botify gates; normal sends escaped serialization | HMACs, integration-wide prose suppression and retention inventory, target matrix, explicit Botify gates, shared coordinator for all Kindroid sends |

A second pass then found narrower residuals and caused further revisions:

- the DTO now preserves synopsis/genre/cast/rewatch data, distinct suggestion
  buckets and timing, the exact origin/completion matrix, and explicitly
  advisory model-generated enrichment;
- terminal replay returns the original outcome, while source replay uses
  distinct full-request and semantic-payload HMACs, a durable source index,
  multi-key lookup across rotation, and one authoritative plex-companion
  transaction owner;
- client timeout no longer masquerades as remote completion: unresolved work
  durably quarantines its target/account domain, and same-target rollback
  requires positive remote-lifecycle proof;
- every new ledger directory entry is parent-directory-synced before dispatch,
  with transactional SQLite mandatory when durable filesystem semantics cannot
  be proven; and
- the minimum retention/operator surface now precedes automatic canary, fixed-
  route credential risk is explicit, and export is required to exclude
  candidate prose rather than conceal an expected skipped ID.

The final independent re-reviews both returned **PASS**: no remaining
authority, authentication, target-identity, prompt-injection, canon/OC,
privacy/retention, contract, crash, replay, queue, OC-idempotency,
provider-boundary, cooldown, or rollback blockers were found. This verdict
means the document is coherent enough to commit as a proposal; it is not
ratification, implementation approval, or authorization for a live send.

## Related records

- [ARCHITECTURE.md](ARCHITECTURE.md) — locked state/provider boundaries this
  proposal would deliberately amend
- [RUN_OUTCOMES_DESIGN.md](RUN_OUTCOMES_DESIGN.md) — pre-dispatch abort and
  ambiguity semantics reused here
- [CONTEXT_PLAN_DESIGN.md](CONTEXT_PLAN_DESIGN.md) — deterministic context
  admission and manifests
- [COMPANION_PROFILE_DESIGN.md](COMPANION_PROFILE_DESIGN.md) — provider-neutral
  profile/binding separation
- [WEBUI_NOTES.md §7](WEBUI_NOTES.md#7-watch-parties--mnemosyne-as-plex-companions-passthrough)
  — original watch-party direction
- plex-companion `src/pipeline/run.ts`, `src/state.ts`,
  `src/backends/backend.ts`, and `src/backends/kindroid.ts` at `402f037` —
  current source workflow and delivery semantics
