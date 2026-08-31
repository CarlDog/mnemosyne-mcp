# Mnemosyne — Architecture

**Status:** Locked decisions; implementation-state refresh 2026-08-31.

This document preserves the initial architectural decisions while describing
their current implementation. [STATUS.md](../STATUS.md) remains authoritative
for current priorities and chronology; comparative adoption assessments do not
change a locked decision by themselves.

Mnemosyne is a storytelling MCP server built on top of OpenChronicle (OC).
It owns narrative logic; OC owns memory. Together they form the substrate
for long-form, persistent, context-aware storytelling sessions through both
MCP-capable hosts and the shipped React Web UI.

The name honors Mnemosyne, Greek personification of remembering and mother
of the Muses — the force by which memory becomes story. Short form: `mnemo`.

---

## 1. Project Shape

**Primary surface: MCP server.** Mnemosyne registers with any MCP-capable
host (Claude Desktop, Claude Code, Cursor, Cline, LM Studio, etc.) and
exposes storytelling tools the host's LLM can call.

**Secondary surface: Web UI.** A standalone React frontend now ships from the
same HTTP process. It supports story/entity browsing and the interactive
continue/validate flow; later mode-specific controls remain design input.

**Both consume the same engine.** The MCP server and Web UI
share Mnemosyne's internal libraries (entity stores, prompt builders,
validator orchestration). No code is duplicated; the two surfaces are
thin adapters over the same core.

### Hexagonal boundary direction

Mnemosyne is migrating incrementally toward hexagonal architecture. The
current dependency direction is:

```text
MCP tools (src/tools/) ─┐
                       ├─> application use cases (src/application/)
REST API (src/api/) ───┘              │
                                      v
                         existing domain/integration modules
```

- `src/tools/` and `src/api/` are inbound driver adapters. They parse
  transport input, map errors, and shape responses; they must not import each
  other.
- `src/application/` owns shared orchestration use cases. Continuation,
  standalone validation, and bulk scene revalidation live here so both inbound
  adapters execute the same policy.
- Existing root modules still combine domain policy with concrete OC and LLM
  integration types. Extracting explicit outbound ports and adapters is a later
  migration slice, so the repository is not yet fully hexagonal.
- `src/index.ts` remains the composition root where concrete clients,
  providers, and inbound transports are assembled.

New shared behavior should enter through an application use case rather than
one inbound adapter importing another. Compatibility re-exports may preserve
old import paths during migration, but new callers should import from
`src/application/`.

**What Mnemosyne is NOT:**
- Not an extension to OpenChronicle. OC v3 deliberately stayed lean and
  cut its v2 storytelling code. Mnemosyne is a separate project that
  *uses* OC, never modifies it.
- Not multi-tenant in v0. Single-user tool. (See §6 for cloud-future
  considerations that don't preclude this.)

---

## 2. State Model: Hybrid, OC-Canonical

OC is the source of truth for all story content. A small local store
holds operational state only.

### In OC (canonical)

Everything story-meaningful lives as OC memories, tagged by type:

- `type:character` — character sheets, traits, voice notes, relationships
- `type:scene` — scene/beat content, scene metadata
- `type:rule` — pinned narrative rules ("never reveal the priest is the killer")
- `type:style` — tone, POV, voice conventions
- `type:location` — world/setting facts
- `type:lore` — background world-building
- `type:worldbuilding` — reusable setting systems and structures
- (additional tags as needed)

Each story is one OC project. Story ownership = project ownership.

### Local (operational only)

A small config holds one thing OC's shape does not fit:

- **Current story pointer** — which OC project ID is active.

Provider/runtime configuration remains environment-driven, and immediate
context is gathered from OC per operation rather than persisted in a local
scratchpad. No local database exists. If structured per-turn state pressure
shows up later (game mechanics, scene ordering issues), revisit then.

### Import / Export

Tooling, not storage. Mnemosyne provides:

- `mnemo_export_story` — serialize one story to the versioned
  `mnemosyne_export: 1` JSON interchange format;
- `mnemo_import_story` — write already-classified inline entities or restore a
  versioned export document into a selected story, with dry-run and explicit
  conflict policy.

The proposed `mnemo_seed_from_template` tool was deliberately retired. Seed
templates are documentation consumed through the same typed import operation,
so there is one write contract instead of a second template subsystem.

**Template imports are one-shot copies, not live links.** If you import
"Fantasy Starter Pack v2" and the pack later updates to v3, your story
does not auto-update. This is correct behavior — you don't want template
revisions retroactively rewriting characters in your in-progress novel —
but should be explicit in user-facing docs.

---

## 3. Generation and Validation

### Two-pass flow

```
User prompt
   ↓
Mnemosyne (gather context: rules, characters, recent scenes from OC)
   ↓
Generation LLM (writes the response)
   ↓
Mnemosyne (orchestrates validation pass — see below)
   ↓
User
```

### Validation: LLM second pass, orchestrated by Mnemosyne

Mnemosyne does NOT validate deterministically (that was v2's
ConsistencyChecker — abandoned). Instead, Mnemosyne:

1. Pulls relevant rules and entities from OC
2. Builds a "check this response against these constraints" prompt
3. Calls a validator LLM (can be cheaper/faster than the generator)
4. Parses the verdict
5. Surfaces flagged issues to the user

**On validation failure: surface to user, do NOT auto-regenerate.**
- Auto-regen burns tokens and can spiral
- Auto-edit risks the validator introducing new violations
- User-in-the-loop is correct for creative work
- This is a knob, not an architecture commitment — easy to change later

**Validation is skippable per-turn.** `mnemo_continue(validate=true)` opts in;
`mnemo_validate` and `mnemo_revalidate_scenes` expose explicit standalone and
bulk review paths. Validation never auto-regenerates prose.

---

## 4. The Claude Desktop / NSFW Constraint

**The MCP host's LLM sees every tool result.** When Mnemosyne returns
generated story text, that text lands in the host LLM's context. The
host LLM has to emit the next assistant turn to relay it to the user.

**Anthropic content policy applies to anything Claude emits, regardless
of source.** Tool results containing graphic content trigger refusals,
sanitization, or conversation bailout — same as if Claude had generated
the content itself.

**Implication:** Claude Desktop is unsuitable as a host for uncensored
("spicy") storytelling, even if the generation LLM is uncensored.

### The two-surface strategy

| Use case | Surface | Notes |
|---|---|---|
| SFW storytelling | MCP in Claude Desktop / Claude Code / etc. | Works fine, host LLM is in the loop |
| NSFW storytelling | Web UI OR MCP in a non-Anthropic host | Web UI bypasses the host LLM entirely |
| Power-user NSFW | MCP in Cline / LM Studio / Ollama-based hosts | Works without web UI |

The Web UI therefore was not a "later if needed" project. Its initial entity
and continuation surfaces have shipped; later mode-specific controls remain
separately scoped work.

---

## 5. LLM Provider Strategy

**Provider-pluggable from day one.** Don't hard-code one model or
one API.

### Implemented generator providers

- **Direct inference:** Ollama, Anthropic, OpenAI-compatible, Gemini, and Atlas
  Cloud.
- **Companion conversations:** Kindroid MCP and Botify MCP.

One generator is selected at startup. Direct providers honor a per-call model
override; companion providers retain their service-specific target and
side-effect semantics.

### Validator differs from the generator when needed

The validator always uses Ollama. This keeps the second pass local and gives it
a structured-generation-capable route even when the generator is a companion
chat or cloud provider. A separate validator-provider abstraction remains
unnecessary without a demonstrated bottleneck.

### Configuration

LLM endpoints, API keys, model names — environment variables, not
hardcoded. See §6 for why.

---

## 6. Cloud-Future Considerations (Design Hints, Not Features)

Cloud-hosted multi-user Mnemosyne is on the long-term horizon. Don't
build for it in v0, but don't paint into a single-user corner either:

- **No single-user assumptions in the schema.** Story ownership lives
  in OC's project model (each story = one OC project), not in env vars
  or hardcoded user identity.
- **Provider config externalized.** All endpoints, keys, paths via env
  vars or config files — never compiled in.
- **Local config is operational, not identity.** `current_story_pointer`
  is "what scene am I on," not "who am I."
- **No per-machine paths in OC memories.** Story content is portable;
  if you migrate hosts, OC is the only thing that has to come with you.

That's the entire cloud-prep checklist for v0. No multi-tenancy, no
auth, no user model. Just don't make those choices impossible later.

---

## 7. Build Sequence

This is the original sequence, now annotated with implementation state:

1. **Architecture lockdown** — complete.
2. **v2 archive retrospective** — complete; see V2_RETROSPECTIVE.md.
3. **Repo scaffold and security hooks** — complete.
4. **v0 tool surface** — complete and expanded to eleven tools.
5. **OC + first-provider build** — complete.
6. **SFW dogfooding and validator remediation** — complete and ongoing as a
   practice.
7. **Provider-pluggability proof** — complete; seven generators ship.
8. **Web UI v0** — partially complete: entity library and interactive continue
   flow ship; later design slices remain unbuilt.
9. **Iterate from observed use** — current standing approach.

---

## 8. Out of Scope (v0)

Explicitly NOT in v0 — to be revisited only after v0 ships and gets
real use:

- Game mechanics (StatBlock, dice, HP, inventory) — v2 had these in
  Phase 4; defer until a real session demands them
- Multi-user / auth / cloud
- Portrait-driven layouts, scene trees, and other richer visual controls in
  the Web UI—the current entity and continue surfaces remain text-first
- Auto-regeneration on validation failure
- Voice or audio interfaces
- Image generation tied to scenes — still out of scope, not reopened by
  this note; the candidate integration shape (atlascloud-mcp, a
  Streamable HTTP MCP server for Atlas Cloud's image/video/audio/LLM
  models) is recorded in STATUS.md "What's next (post-v0)" for when
  this line item is actually revisited
- Inter-story memory bleed (cross-project recall)

---

## Decisions Log

| Decision | Choice | Why |
|---|---|---|
| Project shape | MCP server plus Web UI | MCP remains a primary integration; NSFW needs a host-model bypass |
| State location | OC-canonical hybrid | OC is the substrate; local is operational only |
| External configs | None | OC + import/export tooling replaces them |
| Validation strategy | LLM second pass, surface to user | Fuzzy by nature; user owns the call |
| Validation default | Skippable per-turn | Most turns don't need it |
| Archive approach | Read for context, write fresh | v2 assumptions don't fit v3 architecture |
| Provider strategy | Seven pluggable generators; Ollama validator | Required for content/cost choice while keeping validation local |
| Cloud future | Don't build for it; don't preclude it | Cheap design hints only |
