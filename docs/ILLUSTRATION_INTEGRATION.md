# Illustration & Reference-Image Integration — Design Notes

**This is a proposal, not a locked decision.** ARCHITECTURE.md §8 still
lists "image generation tied to scenes" as out of scope for v0, and
nothing in this document reopens that line. It exists so the design
thinking has a home before that line item is actually revisited — read
every "would" below as "could," and treat "Open questions" as genuinely
open, not rhetorical. Nothing here is scheduled; the one committed
artifact is the pointer entry in STATUS.md "What's next (post-v0)."

Written 2026-08-06, prompted by a conversation about generating
images/video asynchronously as a story progresses, with each story
carrying reference files — most concretely, what its characters look
like — so generations stay visually consistent.

---

## 1. Motivation

Today, illustrating a Mnemosyne story means leaving the tool entirely:
copy a scene's prose into an image generator by hand, describe a
character from memory, get something that looks different every time.
The idea on the table is to close that loop — let a story carry durable
reference images per character, and let scene generation optionally kick
off an async illustration/video job that uses those references, without
mnemosyne turning into an image editor.

## 2. What Atlas Cloud already gives us — no new work needed there

atlascloud-mcp (already registered ad hoc in this repo's `.mcp.json`) has
every primitive this needs:

- `atlas_upload_media` — local file → temporary public URL
- `atlas_generate_image` / `atlas_generate_video` — submit, get a
  `predictionId` back immediately (already async by design)
- `atlas_get_prediction` — poll a `predictionId` for the result
- `atlas_get_model_info` — a model's exact accepted parameters, including
  whatever it calls its reference-image field (`image`, `image_url`,
  `input_image`, etc. — varies per model, discovered live, not hardcoded)
- `atlas_quick_generate` — one-shot convenience wrapper with a canonical
  `image_url` argument that auto-maps onto the target model's own schema
  field

**The one real gotcha:** URLs from `atlas_upload_media` are explicitly
temporary — Atlas Cloud's own tool description warns uploads "may be
cleaned up periodically" and says not to treat it as permanent hosting.
A character reference needs to survive for a story's entire lifetime
(months, realistically), so mnemosyne can't just save that URL once and
reuse it forever. Whatever holds the reference needs its own durable
copy, independent of Atlas Cloud, and re-uploads to Atlas Cloud
transiently only at generation time.

Net: **the gap is entirely on mnemosyne's side** — data model and
orchestration, not new atlascloud-mcp tooling. Nothing in this proposal
implies work in that repo beyond what's already shipped.

## 3. Building blocks this would need in mnemosyne

### 3a. Durable reference storage

Something outside Atlas Cloud has to be the source of truth for "what
does Aria look like." Candidates, not mutually exclusive:

- A path/URL the user already controls (a NAS media share, a Plex asset,
  anything already durable) — mnemosyne just stores the pointer, does no
  hosting itself. Lowest-effort, but pushes the "where do I put this
  file" problem onto the user every time.
- A dedicated durable directory this repo (or its deployment) owns and
  documents, analogous to how `HOST_UPLOAD_DIR` works for atlascloud-mcp
  itself — except *this* directory would need to actually persist
  (atlascloud-mcp's upload dir explicitly doesn't promise that).

This is a real open question (see §7) — not resolved here.

### 3b. A trigger point

Something has to decide "this beat needs art" and gather the right
character's reference(s) before calling out to atlascloud-mcp. Candidate
shapes are sketched in §6.

### 3c. Async, not blocking — the timeout lesson already on file

STATUS.md's "What's next" already documents a real incident: a
`mnemo_continue` call hit 5:24 total (generator 2:23 + validator 2:57)
against Claude Desktop's ~4-minute MCP tool-call ceiling, which is why
the `stages` timing field is a v0.1.4 candidate in the first place.
atlascloud-mcp's own docs quote **10–30 seconds for images, 2–5 minutes
for 3D/video** generation. Chaining that *synchronously* inside
`mnemo_continue` — on top of an already-tight generator+validator budget
— would reproduce the same timeout failure mode, probably worse.

**Recommendation: don't block on it.** A kickoff call returns a
`predictionId` immediately (which is exactly what `atlas_generate_image`/
`atlas_generate_video` already hand back); checking and attaching the
result happens as a separate, later step — not inside the same tool call
that generates prose.

### 3d. Attach-back

Once a prediction resolves, its result URL needs to land on the relevant
entity in OC — not just surface once in a chat transcript and then be
gone. See §6 for a candidate tool.

## 4. Where would reference images live in the entity model?

Grounded against the actual current schema (`src/entities.ts`): an
entity is `[TitleCaseType] Name\n\n<body>` plain text, `ENTITY_TYPES` is
a fixed union (`character`, `location`, `rule`, `style`, `scene`, `lore`,
`worldbuilding`), and `extra_tags` already supports sub-categorization
(the existing doc comment's own example: `"primary"` vs `"npc"` for
characters). There's no structured or binary field anywhere today — this
would be new ground either way.

Two shapes, not a recommendation to pick one without more thought:

**Option A — a new entity type, e.g. `reference_image`.** Its body holds
the durable URL/path plus a short caption; `extra_tags` links it to the
character it belongs to (e.g. `extra_tags: ["character:Aria"]`) — the
same tagging mechanism already used for sub-categorization today, no new
mechanism invented. `mnemo_recall(type="reference_image")` lists a
story's references for free. Requires extending the `ENTITY_TYPES` tuple
in `entities.ts` (small, scoped, but a real touch to a locked-shape file)
plus wiring the new type through `mnemo_save_entity`'s zod enum.
Keeps raw URLs **out of** a character's own prose body, which matters:
`gatherContext` feeds character bodies straight into the generator/
validator prompt, and a URL string sitting in that text is pure noise to
an LLM, not useful signal.

**Option B — embed inside the character's own body.** E.g. a
`Reference images:` section appended to the character entity's existing
content. Zero schema change. Downside is exactly the noise problem
above — the URL rides along into every prompt that includes that
character, and recall would need new parsing logic to strip it back out
if anything needs the URL programmatically rather than just as prose.

Option A reads like the better fit *on paper* — it mirrors how v0.1.3's
validation tags already attach non-narrative signal to entities without
inventing new storage — but this is exactly the kind of call that should
get made when the feature is actually being built, not speculatively
here.

## 5. Loose coupling vs. tight coupling

Two ends of a spectrum, restated from the chat discussion that prompted
this doc:

- **Loose (zero new mnemosyne code).** atlascloud-mcp is already
  registered in this repo's `.mcp.json`. An interactive session working
  in this repo can already call `atlas_upload_media` /
  `atlas_generate_image` / `atlas_get_prediction` directly today, ad hoc,
  and manually save the result via `mnemo_save_entity`. This works
  *right now* with nothing built — the rest of this document is about
  what a smoother, first-class version would look like.
- **Tight (a real `src/atlascloud-client.ts` + new tools).** Mirrors the
  existing `src/kindroid-client.ts` pattern — a Streamable HTTP MCP
  client wrapper, `ATLASCLOUD_MCP_URL` + `ATLASCLOUD_MCP_AUTH_TOKEN` env
  vars (same shape as the Kindroid config). Smoother experience for
  whoever's actually telling the story, real integration work, and the
  thing ARCHITECTURE.md §8 is explicitly guarding against building
  prematurely.

Nothing forces an all-or-nothing choice — the loose path is available
today as a bridge while the tight path (if it ever gets picked up) gets
designed properly.

## 6. Candidate tool surface (a sketch, not a spec)

Purely illustrative of the shape, not proposed names/signatures to build
against:

- `mnemo_attach_reference_image(character_name, source, caption?)` — the
  character-reference use case specifically. `source` could be a URL the
  user already has, or a local/container path to run through
  `atlas_upload_media` first. Synchronous — uploading a reference image
  is fast and doesn't hit the timeout concern in §3c.
- `mnemo_illustrate_scene(scene_name, model_keyword?, extra_params?)` —
  gathers the scene's linked character references, calls
  `atlas_generate_image`/`atlas_generate_video` (or
  `atlas_quick_generate`), and returns the `predictionId` immediately.
  Does **not** block waiting for the result (§3c).
- A check/attach step — either a new `mnemo_check_illustration
  (prediction_id)` that polls and writes the result onto the scene
  entity once ready, or just leaning on atlascloud-mcp's own
  `atlas_get_prediction` directly (loose coupling for this one step even
  in an otherwise "tight" design) plus a small mnemosyne-side "attach this
  URL to this entity" tool. The second avoids mnemosyne needing any kind
  of background poller or job queue, which fits ARCHITECTURE.md §2's "no
  local database in v0" stance — polling stays the calling session's job,
  mnemosyne only needs to persist a result once it's handed one.

## 7. Open questions (genuinely unresolved)

- **Where does "durable" reference storage actually live?** §3a lists
  candidates; none chosen.
- **Who decides a beat needs art** — the host LLM's judgment while
  telling the story, or only ever an explicit user request? Auto-
  triggering risks the same "manufactures volume" failure mode called
  out for LLM reviewers elsewhere — an eager generator could spray
  illustration jobs (and spend real Atlas Cloud credits) at scenes that
  didn't need them.
- **Do reference images factor into validation at all**, or is this a
  generator-side-only concern? Nothing today gives the validator a way
  to reason about images; probably stays out of scope for a first cut.
- **Multi-reference-image consistency** — whether a given Atlas Cloud
  model even accepts more than one reference image (e.g. a character
  plus a location shot together) is a per-model schema question, not
  something to assume works uniformly. Check `atlas_get_model_info` for
  the specific model in play before designing around an assumed
  capability.
- **Cost/consent** — image and especially video generation spends real
  credits. Any auto-triggered path needs an explicit opt-in, not a
  default-on behavior.

## 8. If/when this gets picked up

The actual backlog entry lives in STATUS.md → "What's next (post-v0)" —
this document is the detail behind that one bullet, not a second source
of status. Update the STATUS.md bullet, not this file, when priority
changes; update this file when the design thinking changes.
