# V2 Retrospective: OpenChronicle Storytelling Plugin

**Source:** `archive/openchronicle.v2` @ bb217d94, mined from `D:\GitHub\openchronicle-v2-archive\plugins\storytelling\`.

**Purpose:** Capture the durable informational value (schemas, prompts, lessons) from the v2 storytelling plugin so Mnemosyne can be built fresh without re-deriving the domain modeling from scratch. v2 code is **not** being ported — too many architectural assumptions changed (configs moved into OC memories; validation moved from deterministic to LLM-based; standalone MCP, not plugin). This document is the bridge.

---

## 1. Entity Schemas

All v2 entities lived under `plugins/storytelling/domain/`. Most are `@dataclass(frozen=True)` value objects; persistence happens via formatted strings stored as OC memory items with structured tag conventions.

### 1.1 ContentType / ParsedEntity (entities.py)

The import pipeline's intermediate representation. Files on disk become `ParsedEntity` records before being saved as memory items.

```python
class ContentType(Enum):
    CHARACTER = "character"
    LOCATION = "location"
    STYLE_GUIDE = "style-guide"
    INSTRUCTIONS = "instructions"
    SCENE = "scene"
    WORLDBUILDING = "worldbuilding"
    PROJECT_META = "project-meta"

@dataclass(frozen=True)
class ParsedEntity:
    name: str
    content_type: ContentType
    formatted_content: str
    tags: list[str] = field(default_factory=list)
    pinned: bool = False
```

**Tag convention** (load-bearing — the prompt builder retrieves by tag, not by entity type):

| Entity         | Tags                                       |
| -------------- | ------------------------------------------ |
| Character      | `["story", "character", "primary" or "npc"]` |
| Location       | `["story", "location"]`                    |
| Style Guide    | `["story", "style-guide"]`                 |
| Instructions   | `["story", "instructions"]`                |
| Scene          | `["story", "scene", "canon" or "sandbox"]` |
| Worldbuilding  | `["story", "worldbuilding"]`               |
| Project meta   | `["story", "project-meta"]`                |
| Bookmark       | `["story", "bookmark", <bookmark_type>]`   |
| Character stats| `["story", "character-stats"]`             |
| Persona        | `["story", "persona"]`                     |

**Memory content format** (all entities used `[Type] Name\nProject: ...\n\n<body>` so the human-readable header is parseable later):

- `[Character] Carl Ashcombe\nRole: Primary | Status: Active\nProject: <name>\n\n<body>`
- `[Location] Dovecoast\nProject: <name>\n\n<body>`
- `[Scene] <prompt[:80]>\nMode: director | Canon: True\n\n<scene_text>`
- `[Bookmark] <label>\nType: user | Chapter: <ch> | Position: <n>\nScene: <id>`
- `[Character Stats] <name>\n\n{"strength": 14, ...}\n\nProgression:\n- strength: 10 -> 14 (training)`
- `[Persona] <name>\nConfidence: 0.85\n\nPhysical: ...\nVoice: ...\nMannerisms: ...\nTraits: ...`

### 1.2 Engagement Modes (modes.py)

```python
class EngagementMode(Enum):
    PARTICIPANT = "participant"  # User plays a character; LLM is co-actor + supporting cast
    DIRECTOR = "director"        # User directs; LLM performs all characters
    AUDIENCE = "audience"        # User listens; LLM narrates as storyteller
```

This was the core narrative-stance switch. `build_system_prompt(mode, ...)` selected one of three "voice" preambles (see Section 2.1). **Default for conversation-mode integration was `DIRECTOR`** — chosen because director mode degrades most gracefully when context is sparse.

### 1.3 Game Mechanics (mechanics.py)

```python
class DiceType(Enum):  # 9 dice types
    D4, D6, D8, D10, D12, D20, D100, FUDGE, COIN

class ResolutionType(Enum):  # 13 resolution categories
    SKILL_CHECK, COMBAT_ACTION, SOCIAL_INTERACTION, EXPLORATION,
    CREATIVE_ACTION, MENTAL_CHALLENGE, PHYSICAL_CHALLENGE,
    MAGICAL_ACTION, STEALTH_ACTION, SURVIVAL_ACTION, LUCK_CHECK,
    NARRATIVE_CHOICE, CHARACTER_DEVELOPMENT

class DifficultyLevel(Enum):  # value IS the DC
    TRIVIAL = 5
    EASY = 10
    MODERATE = 15
    HARD = 20
    VERY_HARD = 25
    LEGENDARY = 30

class OutcomeType(Enum):
    CRITICAL_SUCCESS, SUCCESS, PARTIAL_SUCCESS, FAILURE, CRITICAL_FAILURE

@dataclass(frozen=True)
class DiceRoll:
    dice_type: DiceType
    rolls: tuple[int, ...]
    modifier: int = 0
    advantage: bool = False
    disadvantage: bool = False
    @property
    def total(self) -> int: ...

@dataclass(frozen=True)
class ResolutionResult:
    resolution_type: ResolutionType
    outcome: OutcomeType
    dice_roll: DiceRoll
    difficulty_check: int
    success_margin: int
    character_name: str | None = None
    character_modifier: int = 0
```

**Outcome thresholds** (from `resolution.determine_outcome`):

- D20 natural 20 → `CRITICAL_SUCCESS`
- D20 natural 1 → `CRITICAL_FAILURE`
- `total >= dc + 5` → `SUCCESS`
- `total >= dc` → `PARTIAL_SUCCESS`
- `total >= dc - 3` → `FAILURE`
- `total < dc - 3` → `CRITICAL_FAILURE`

**Notable:** dice engine takes an injectable `Random` instance (`rng: Random | None = None`) for deterministic tests. Honor this in Mnemosyne if dice come back.

### 1.4 Stats (stats.py)

```python
class StatCategory(Enum):
    PHYSICAL, MENTAL, SOCIAL, EMOTIONAL, MORAL

class StatType(Enum):  # 14 stats
    # Physical
    STRENGTH, DEXTERITY
    # Mental
    INTELLIGENCE, WISDOM, CREATIVITY, PERCEPTION
    # Social
    CHARISMA, HUMOR, EMPATHY
    # Emotional
    WILLPOWER, COURAGE, TEMPER
    # Moral
    LOYALTY, GREED

@dataclass(frozen=True)
class StatBlock:
    values: dict[str, int]  # keys are StatType.value strings; range 1-20
    def modifier(self, stat: StatType) -> int:
        # D&D-style: (value - 10) // 2
        return (self.values.get(stat.value, 10) - 10) // 2
    def with_update(self, stat: StatType, value: int) -> StatBlock:
        # immutable update; clamps to [1, 20]

@dataclass(frozen=True)
class StatProgression:
    stat_type: StatType
    old_value: int
    new_value: int
    reason: str
```

Mapping `ResolutionType` -> primary `StatType` (used to auto-pick a modifier when a character name is given to `story.resolve`):

```python
RESOLUTION_STAT_MAP = {
    SKILL_CHECK: DEXTERITY,           COMBAT_ACTION: STRENGTH,
    SOCIAL_INTERACTION: CHARISMA,      EXPLORATION: PERCEPTION,
    CREATIVE_ACTION: CREATIVITY,       MENTAL_CHALLENGE: INTELLIGENCE,
    PHYSICAL_CHALLENGE: STRENGTH,      MAGICAL_ACTION: WISDOM,
    STEALTH_ACTION: DEXTERITY,         SURVIVAL_ACTION: WISDOM,
    LUCK_CHECK: WISDOM,                NARRATIVE_CHOICE: CHARISMA,
    CHARACTER_DEVELOPMENT: WILLPOWER,
}
```

Persistence: serialized as a JSON line embedded in a memory item body. Round-tripping is fragile — `_parse_stat_block_content` scans for the first line that starts with `{` and parses it. (See "Anti-Patterns" §4 — Mnemosyne should store structured fields rather than embedded JSON.)

### 1.5 Bookmarks & Timeline (timeline.py)

```python
class BookmarkType(Enum):
    USER, AUTO, MILESTONE, CHAPTER

@dataclass(frozen=True)
class Bookmark:
    id: str
    scene_id: str | None
    label: str
    bookmark_type: BookmarkType
    chapter: str | None = None
    position: int = 0
    created_at: str = ""

@dataclass
class TimelineEntry:
    memory_id: str
    entry_type: str  # "scene" or "bookmark"
    label: str
    chapter: str | None = None
    position: int = 0
    created_at: str = ""
    content_preview: str = ""

@dataclass
class Timeline:
    entries: list[TimelineEntry]
    chapters: dict[str, list[TimelineEntry]]
```

Auto-bookmarks are created on every `save_scene=True` scene generation — convention worth preserving.

### 1.6 Persona (persona.py)

```python
class PersonaExtractionStatus(Enum):
    NOT_AVAILABLE, READY, IN_PROGRESS, COMPLETED, FAILED

@dataclass(frozen=True)
class PersonaSource:
    source_type: str    # "text", "image", "voice", "video"
    content_ref: str
    description: str = ""

@dataclass(frozen=True)
class ExtractedPersona:
    character_name: str
    physical_description: str = ""
    voice_description: str = ""
    mannerisms: str = ""
    personality_traits: str = ""
    sources: tuple[PersonaSource, ...] = ()
    confidence: float = 0.0
```

Only `text` source type was implemented; non-text sources returned `MULTIMODAL_REQUIRED_MESSAGE`. The schema was deliberately kept thin so it could later expand to a fine-tuning-grade record (see BACKLOG note about "persona schema must be rich enough to drive fine-tuning later" — Mnemosyne should heed this and design speech patterns / decision heuristics / example exchanges as first-class fields, not collapsed into one description blob).

### 1.7 Narrative Branching (branching.py)

```python
@dataclass(frozen=True)
class NarrativeBranch:
    description: str
    consequence_type: str
    transition_hint: str

@dataclass
class BranchOptions:
    resolution_result: ResolutionResult
    branches: list[NarrativeBranch]
```

Branches are LLM-generated downstream of a `ResolutionResult` and seeded with per-`OutcomeType` templates (see Section 2.5 prompt).

### 1.8 Consistency & Emotional Reports

```python
@dataclass
class ConsistencyIssue:
    severity: str           # "error" | "warning" | "info"
    description: str
    entity_type: str        # "character" | "location" | "event" | ...
    entity_name: str
    conflicting_memories: list[str] = field(default_factory=list)

@dataclass
class ConsistencyReport:
    issues: list[ConsistencyIssue]
    checked_items: int = 0
    passed: bool = True
    summary: str = ""

class EmotionLabel(Enum):  # Plutchik simplified
    JOY, SADNESS, ANGER, FEAR, SURPRISE, DISGUST, TRUST, ANTICIPATION, NEUTRAL

@dataclass(frozen=True)
class EmotionalBeat:
    character_name: str
    emotion: EmotionLabel
    intensity: float        # 0.0 - 1.0
    trigger: str
    scene_position: str     # "early" | "middle" | "late"

@dataclass(frozen=True)
class EmotionalLoop:
    character_name: str
    emotion: EmotionLabel
    occurrence_count: int
    confidence: float

@dataclass
class EmotionalReport:
    beats: list[EmotionalBeat]
    loops: list[EmotionalLoop]
    arc_summary: str
    character_arcs: dict[str, list[EmotionalBeat]]
```

`StoryContext` was the per-prompt assembled bundle, populated by tag-filtered memory search:

```python
@dataclass
class StoryContext:
    instructions: list[str]
    style_guide: list[str]
    characters: list[str]
    locations: list[str]
    scenes: list[str]
    worldbuilding: list[str]
```

---

## 2. Prompt Templates (Verbatim)

These are copied verbatim from v2 source. Where the prompt is built from f-strings, the variable interpolation is preserved as-is so Mnemosyne can recreate the structure.

### 2.1 Mode Directives (`domain/modes.py::_mode_directive`)

**Participant — with player character:**
> You are {player_character}. Stay in character at all times. Respond as this character would — use their voice, mannerisms, and knowledge. Other characters in the scene are performed by you as supporting cast, but your primary voice is this character.

**Participant — no player character set:**
> You are a character in this story. The user will tell you which character they are playing. Stay in character and respond naturally.

**Director:**
> You are a scene director. The user will describe a scene setup or give direction. You perform ALL characters in the scene — give each their own voice, mannerisms, and dialogue. Narrate actions, describe the environment, and advance the scene based on the user's direction.

**Audience (narrator voice):**
> You are a narrator telling a story. The user is your audience. Write vivid, immersive narrative prose. Perform all characters with distinct voices. Advance the plot naturally. The user may offer light guidance but is primarily here to enjoy the story.

### 2.2 Canon / Sandbox Directives

**Canon:**
> CANON MODE: All events in this scene are canon to the story's continuity. Maintain consistency with established characters, locations, and prior events. Do not contradict established facts.

**Sandbox:**
> SANDBOX MODE: This scene is non-canon. You have creative freedom to explore what-if scenarios, alternate timelines, or experimental ideas without affecting the story's main continuity.

### 2.3 Full Assembled System Prompt Structure

`build_system_prompt` joined the following blocks with `\n\n`, omitting empty ones:

1. Mode directive (§2.1)
2. Canon directive (§2.2)
3. `=== PROJECT INSTRUCTIONS ===` followed by entries
4. `=== STYLE GUIDE ===` followed by entries
5. `=== CHARACTERS ===` followed by entries
6. `=== LOCATIONS ===` followed by entries
7. `=== RECENT SCENES ===` followed by entries
8. `=== WORLD-BUILDING ===` followed by entries
9. `=== RESOLUTION OUTCOME ===` followed by `resolution_context` (single string from a `ResolutionResult`)
10. `=== NARRATIVE OPTIONS ===` followed by `branch_context` (formatted branches)

This is the load-bearing structure of v2 storytelling. Every prompt-shaped feature emitted blocks into this template.

### 2.4 Consistency Checker (`application/consistency_checker.py`)

**System message:**
> You are a consistency checker for an interactive story. Your job is to find contradictions between new content and established story facts. Be precise and cite specific conflicts. Return ONLY valid JSON.

**User prompt:**
> Established story context:
> {context_block}
>
> New {content_type} content to validate:
> {content}
>
> Identify any contradictions, inconsistencies, or factual conflicts between the new content and the established context. Return a JSON object with:
> - "issues": array of {"severity": "error"|"warning"|"info", "description": "...", "entity_type": "...", "entity_name": "..."}
> - "summary": brief overall assessment
> If no issues found, return an empty issues array.

Defaults: `temperature=0.2`, `max_output_tokens=1024`, `max_context_items=20` (split 4 ways across `["story","character"]`, `["story","location"]`, `["story","scene"]`, `["story","worldbuilding"]` tag sets).

### 2.5 Narrative Branching (`application/branching.py`)

**System message:**
> You are a narrative branching engine for an interactive story. Generate story branch options as a JSON array. Each branch has: "description" (2-3 sentences), "consequence_type" (1-2 words), "transition_hint" (1 sentence). Return ONLY valid JSON.

**User prompt template** (`_build_branch_prompt`):
> Resolution: {resolution_type.value}
> Outcome: {outcome.value} (margin: {success_margin:+d})
> Expected consequence: {template['consequence']}
> Transition seed: {template['transition']}
> Character: {character_name}     # if provided
> Story context: {context_summary} # if provided
> Generate exactly {branch_count} narrative branch options.

**Per-outcome seed templates:**

| Outcome             | Consequence                                  | Transition                                       |
| ------------------- | -------------------------------------------- | ------------------------------------------------ |
| CRITICAL_SUCCESS    | spectacular success with bonus effect        | The character exceeds expectations dramatically  |
| SUCCESS             | clean success, objective achieved            | The character accomplishes their goal            |
| PARTIAL_SUCCESS     | success with complication or cost            | The character succeeds but at a price            |
| FAILURE             | failure with consequences                    | The character fails and faces setback            |
| CRITICAL_FAILURE    | catastrophic failure with lasting impact     | Everything goes wrong in the worst way           |

Defaults: `temperature=0.9` (high — wants creativity), `branch_count=3`.

### 2.6 Emotional Analyzer (`application/emotional_analyzer.py`)

**System message:**
> You are an emotional analysis engine for interactive storytelling. Identify emotional beats for each character, noting what triggers each emotional shift and its intensity. Return ONLY valid JSON.

**User prompt:**
> Analyze the emotional content of this scene for: {chars_str}
> {prior_context}
> Scene:
> {scene_text}
>
> Return a JSON object with:
> - "beats": array of {"character_name": "...", "emotion": "<one of: joy, sadness, anger, fear, surprise, disgust, trust, anticipation, neutral>", "intensity": 0.0-1.0, "trigger": "...", "scene_position": "early|middle|late"}
> - "arc_summary": brief overall emotional arc description
> Return ONLY valid JSON.

Defaults: `temperature=0.3`, `max_output_tokens=1024`. Loop detection (pure function, no LLM): `EmotionalLoop` flagged when same `(character, emotion)` appears `>= threshold=3` times across current + prior beats.

### 2.7 Persona Extractor (`application/persona_extractor.py`)

**System message:**
> You are a character analyst for an interactive story. Extract a detailed persona profile from the provided text. Return ONLY valid JSON with these fields:
> "physical_description": appearance, build, distinguishing features
> "voice_description": speech patterns, tone, accent
> "mannerisms": habitual gestures, behaviors, tics
> "personality_traits": core personality characteristics
> "confidence": 0.0-1.0 how confident you are in the extraction

**User prompt:**
> Extract persona for: {character_name}
>
> Source text:
> {text_content}

Defaults: `temperature=0.3`, `max_output_tokens=1024`.

**Multimodal-not-supported message** (kept verbatim — useful as a placeholder when Mnemosyne hits the same wall):
> Multimodal persona extraction (image, voice, video) requires the core multimodal conversation input feature (Phase 6). Currently only text-based extraction is supported.

### 2.8 Mode-Switching / Conversation Mode (`application/conversation_mode.py`)

The "story" mode prompt builder didn't have its own LLM prompt — it just hardcoded `EngagementMode.DIRECTOR` and `canon=True`, then ran the same `assemble_story_context` -> `build_system_prompt` pipeline that the scene handler used. The mode switch itself happened at `prepare_ask()` time in core (not in the plugin). Worth knowing: the v2 design assumed the orchestrator decided which mode-builder to call; Mnemosyne as a standalone MCP will need its own mode-resolution step, likely driven by a tool argument or an OC memory tagged `convention`.

---

## 3. Lessons Learned

**Tag conventions are the actual schema.** Domain dataclasses were window-dressing on top of memory items keyed by tag tuples. Every retrieval (`assemble_story_context`, `load_stat_block`, `list_bookmarks`) was a tag-filtered `memory_search`. This worked, but coupled the entire plugin to OC's tag-search ergonomics. Mnemosyne should make the tag/category convention explicit and documented up front, not implicit-via-search.

**Format-then-parse round-tripping is fragile.** Stat blocks stored as `[Character Stats] Name\n\n{json}\n\nProgression:\n- foo: 10 -> 14 (reason)`. Loading meant scanning lines for one starting with `{`, then regex-matching the progression bullets. Any format drift breaks loaders silently. Mnemosyne should store structured data structurally — either separate fields on the memory record or first-class entity tables — not embedded text formats.

**LLM prompts grew incrementally and never got A/B-tested.** Each phase (consistency, emotion, persona, branching) added a prompt template that was shipped as soon as it produced parseable JSON. There's no record of which phrasings were tried and rejected. Mnemosyne should at minimum keep a `prompts/` directory with per-template version history so future prompt iteration has a baseline.

**Deterministic engines hide behind LLM calls.** Dice, resolution, stat math, and emotional-loop detection are pure functions with injectable `Random`. The branching and emotion analysis wrap them with an LLM call. v2 mixed these freely; the deterministic core is the part that survived planning across phases. Mnemosyne should keep the deterministic primitives separate from the LLM-driven layer so the former can be tested without API keys.

**`build_system_prompt`'s block ordering was load-bearing and not documented as such.** Mode directive first, canon next, then instructions/style/characters/locations/scenes/worldbuilding/resolution/branches in that order. This priority drove what got truncated when context was tight — but no test enforced the order, and no comment explained why. Preserve the order in Mnemosyne and write it down.

**The `[Type] Name` content-prefix convention** (`[Character]`, `[Location]`, `[Scene]`, `[Bookmark]`, `[Character Stats]`, `[Persona]`) was the one piece of structure that worked across the whole plugin. Both the importer and the bookmark/stat parsers depend on it. Worth keeping in Mnemosyne even though the retrieval substrate changes.

**Persona schema was knowingly thin** (BACKLOG note: "persona schema must be rich enough to drive fine-tuning later"). v2 shipped four flat string fields (physical / voice / mannerisms / personality) plus a confidence float. The author flagged this as a known gap — Mnemosyne has the chance to ship the richer schema (per-trait confidence, raw exchange examples preserved alongside synthesized traits) on day one.

**The "narrator-mcp" name is already in the v2 plan.** V3_PLAN.md line 15 explicitly names `narrator-mcp` as the future home of storytelling if it gets revived. Mnemosyne is that project under a different name; the plan's framing of "reach back into the archive when needed" is the intended workflow.

---

## 4. Anti-Patterns to Avoid

**External config files as source of truth.** v2 had `core.json`, `models/*.json`, per-plugin `config.json`, plus env vars, all wired through three-layer precedence. The hygiene test (`test_config_completeness.py`) existed because config-code drift was a real, recurring bug. Mnemosyne stores config as OC memories tagged `convention` — search is the lookup, no precedence layers, no drift test needed.

**Deterministic ConsistencyChecker.** v2's `check_consistency` is LLM-based, but the surrounding apparatus (split-by-tag retrieval into 4 buckets of `max_context_items // 4`, regex JSON parsing with markdown-fence stripping, severity-based pass/fail boolean) is rigid and brittle. Mnemosyne moves to LLM-driven validation throughout, with the LLM choosing what context to pull rather than the harness pre-bucketing.

**Plugin-shaped storage.** The whole plugin lived under `plugins/storytelling/` and accessed memory through closures (`memory_search`, `memory_save`, `memory_update`, `llm_complete`) injected via a `context: dict[str, Any]` parameter. This worked but meant every handler signature had `context = context or {}; memory_search = ctx.get("memory_search"); ... if memory_search is None: raise RuntimeError(...)` boilerplate at the top. Mnemosyne is a standalone MCP that owns its own OC client — no closure injection, no `context` dict, no per-handler null checks.

**Task-handler ceremony for every operation.** Each story operation became an async handler taking `(task: Task, context: dict | None)`, parsing `task.payload`, emitting `plugin.received_task` / `plugin.completed_task` events, and returning a dict for the orchestrator. That's roughly 30-50 lines of orchestration framing per actual operation. Mnemosyne is just MCP tools — function in, function out, no Task envelope.

**Hard-coded `EngagementMode.DIRECTOR` + `canon=True` in the conversation mode builder.** The story prompt builder didn't take mode or canon as parameters — they were baked into `story_prompt_builder()`. This meant participant/audience modes were unreachable from conversation flows, only from direct `story.scene` task invocations. Mnemosyne should expose mode + canon as tool arguments from the start.

**Storing structured data as JSON-embedded-in-prose.** `StatBlock` persistence was `f"[Character Stats] {name}\n\n{json.dumps(values)}\n\nProgression:\n- ..."`. Loading required string scanning. Mnemosyne should treat structured data as structured (separate memory fields or a sidecar OC tag-keyed key/value store).

**Soft-deletion via tag rewrite.** `delete_bookmark` removed the `bookmark` tag and added a `bookmark-deleted` tag. List/search still has to filter these out. Real deletion via the storage layer is cheaper to reason about; if undelete matters, version the memory rather than tag-flip.

**Conflating event emission with handler logic.** Every handler had `if emit_event: emit_event(Event(...))` wrapping its core work. This was OC v2's audit-trail mechanism. Mnemosyne doesn't have a hash-chained event store and shouldn't grow one preemptively — OC memories themselves are the audit trail.

**Importer's heuristic file classification.** `parsers.py` classifies files via filename substring matching (`["character", "profile", "cast"]` -> `CHARACTER`, etc.) with glob-like wildcards (`style*guide`). It works, but it's load-bearing string matching with no schema. v3 lesson: if Mnemosyne ingests bulk content, prefer LLM-driven classification over substring rules — same direction as moving consistency checking from rules to LLM.

**Explicit "Multimodal deferred" placeholder code.** v2 shipped persona extraction with an entire code path that returns "not available" for non-text sources. Mnemosyne should ship only what works; defer-by-error-message creates user-facing dead ends and code debt.

---

## Appendix: Files Worth Reading Directly

If working on a specific Mnemosyne feature, these are the v2 files most likely to inform it. Paths are relative to the repo root of `archive/openchronicle.v2` @ `bb217d94`. To browse the source, recreate the worktree:

```bash
git -C D:\GitHub\openchronicle-mcp worktree add --detach D:\GitHub\openchronicle-v2-archive bb217d94
# when done:
git -C D:\GitHub\openchronicle-mcp worktree remove D:\GitHub\openchronicle-v2-archive
```

Or read individual files without a worktree:

```bash
git -C D:\GitHub\openchronicle-mcp show bb217d94:plugins/storytelling/domain/entities.py
```

Files of interest:

- Schemas / domain: `plugins/storytelling/domain/{entities,modes,mechanics,stats,timeline,persona}.py`
- Prompt assembly: `plugins/storytelling/domain/modes.py` (`build_system_prompt`)
- Context retrieval pattern: `plugins/storytelling/application/context_assembler.py`
- LLM-driven validators: `plugins/storytelling/application/{consistency_checker,emotional_analyzer,branching,persona_extractor}.py`
- Importer (heuristic file -> entity classification): `plugins/storytelling/{importer,parsers}.py`
- Plugin entrypoint and handler wiring (anti-pattern reference for what NOT to do): `plugins/storytelling/plugin.py`
- v3 reasoning for cutting storytelling: `docs/V3_PLAN.md` (lines 12, 23-26, 111-112, 299-302)
- Persona future-proofing notes: `docs/BACKLOG.md` lines 519-630
