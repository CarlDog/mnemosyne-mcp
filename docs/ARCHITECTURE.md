# Mnemosyne — Architecture

**Status:** Locked (initial scope). Updated 2026-05-11.

Mnemosyne is a storytelling MCP server built on top of OpenChronicle (OC).
It owns narrative logic; OC owns memory. Together they form the substrate
for long-form, persistent, context-aware storytelling sessions — initially
text-chat in MCP-capable hosts, eventually a dedicated web UI.

The name honors Mnemosyne, Greek personification of remembering and mother
of the Muses — the force by which memory becomes story. Short form: `mnemo`.

---

## 1. Project Shape

**Primary surface: MCP server.** Mnemosyne registers with any MCP-capable
host (Claude Desktop, Claude Code, Cursor, Cline, LM Studio, etc.) and
exposes storytelling tools the host's LLM can call.

**Secondary surface (planned): Web UI.** A standalone web frontend will
follow. It is on the roadmap, not hypothetical — see §4 for the trigger.

**Both consume the same engine.** The MCP server and the future web UI
share Mnemosyne's internal libraries (entity stores, prompt builders,
validator orchestration). No code is duplicated; the two surfaces are
thin adapters over the same core.

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
- (additional tags as needed)

Each story is one OC project. Story ownership = project ownership.

### Local (operational only)

A small config holds the things OC's shape doesn't fit:

- **Current story pointer** — which OC project ID is active
- **Turn scratchpad** — last-N turns for immediate context window
  assembly (regenerated from OC on session start; not authoritative)
- **Per-user runtime config** — LLM provider, validation toggles, etc.

That's it. No local database in v0. If structured per-turn state pressure
shows up later (game mechanics, scene ordering issues), revisit then.

### Import / Export

Tooling, not storage. Mnemosyne provides:

- `mnemo_export_story` — serialize an OC project's story content to a
  portable format (JSON, possibly YAML)
- `mnemo_import_story` — ingest a portable file, populate a new OC project
- `mnemo_seed_from_template` — bootstrap a new story from a template file

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

**Validation is skippable per-turn.** Most turns probably don't need it.
Triggers can be: explicit request, scene/chapter boundary, or "active
rules exist for this entity" heuristic. Default: only run when explicitly
requested or when pinned rules are in scope.

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
| NSFW storytelling | Web UI (planned) OR MCP in non-Anthropic host | Web UI bypasses host LLM entirely |
| Power-user NSFW | MCP in Cline / LM Studio / Ollama-based hosts | Works without web UI |

The web UI is therefore not a "later if needed" project — it's a planned
deliverable for the NSFW path. SFW MCP work ships first; web UI follows
once the MCP engine stabilizes.

---

## 5. LLM Provider Strategy

**Provider-pluggable from day one.** Don't hard-code one model or
one API.

### Required initial providers

- **Ollama** — local uncensored models for NSFW work
- **Botify MCP** — alternate uncensored route (already in user's stack)
- **Anthropic API** — for SFW work where Claude is appropriate

### Validator can differ from generator

The validation pass can use a smaller/cheaper model than the generator.
Provider config is per-role (`generator_provider`, `validator_provider`),
not global.

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

1. **Architecture lockdown** ← (this document) ✓
2. **v2 archive retrospective** — see V2_RETROSPECTIVE.md
3. **Repo scaffold** — TypeScript, McpServer SDK, zod, tests, pre-commit
   hooks per security rules (gitleaks + PII patterns + author-email check)
4. **v0 tool surface design** — small tool set informed by retro doc
   findings. Likely ~5-8 tools to start.
5. **v0 build** — implement tools, wire to OC and first LLM provider
6. **SFW dogfooding** — use Mnemosyne in Claude Desktop for real
   storytelling sessions, fix what hurts
7. **Second LLM provider** — add Ollama or Botify, validate the
   provider-pluggable architecture holds
8. **Web UI v0** — minimal chat interface that bypasses host LLM,
   targets NSFW use case
9. **Iterate**

Steps 1-2 are research/writing. Step 3 commits the project. Steps 4-9
are iterative engineering with checkpoints.

---

## 8. Out of Scope (v0)

Explicitly NOT in v0 — to be revisited only after v0 ships and gets
real use:

- Game mechanics (StatBlock, dice, HP, inventory) — v2 had these in
  Phase 4; defer until a real session demands them
- Multi-user / auth / cloud
- Visual UI elements in the web frontend (character portraits, scene
  trees) — text chat first
- Auto-regeneration on validation failure
- Voice or audio interfaces
- Image generation tied to scenes
- Inter-story memory bleed (cross-project recall)

---

## Decisions Log

| Decision | Choice | Why |
|---|---|---|
| Project shape | MCP server, web UI on roadmap | Daily driver is MCP; NSFW needs web bypass |
| State location | OC-canonical hybrid | OC is the substrate; local is operational only |
| External configs | None | OC + import/export tooling replaces them |
| Validation strategy | LLM second pass, surface to user | Fuzzy by nature; user owns the call |
| Validation default | Skippable per-turn | Most turns don't need it |
| Archive approach | Read for context, write fresh | v2 assumptions don't fit v3 architecture |
| Provider strategy | Pluggable, multi-provider, per-role | Required for NSFW + cost control |
| Cloud future | Don't build for it; don't preclude it | Cheap design hints only |
