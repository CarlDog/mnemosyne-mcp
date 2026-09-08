# Content Routing Design

**Status: proposed 2026-08-26, refreshed and ratified 2026-09-08, all
three slices shipped the same day.** The 2026-09-08 refresh corrected two
claims this doc made that a later refactor overtook (the call site and
the schema number below now match current code, not the 2026-08-26
snapshot) before the operator ratified it; the "Ratified decisions"
section near the end records the four calls that were open, and
"Implementation record" near the end records what shipped and the two
refinements decided along the way. This document exists to
close a real gap: [Living Canon Standard](LIVING_CANON_STANDARD.md) §10
("Routing boundary") already requires that "text and image generation must
be routed independently to explicitly configured SFW or NSFW-capable models
before generation begins" -- which, before this design shipped, no
mechanism in the codebase actually did (confirmed 2026-08-26 by grepping
`src/` for SFW/NSFW routing logic and finding zero matches; the Standard
was describing infrastructure that didn't exist yet). This design
proposed, and as of 2026-09-08 implements, what closes that gap -- see
"Implementation record" near the end for what shipped.

## Background — two prior attempts, one built and unused

1. **OpenChronicle v2's storytelling plugin has nothing on this.** Grepped
   the whole `plugins/storytelling/` tree (`archive/openchronicle.v2` @
   `bb217d94`) for content-rating / NSFW / SFW / moderation logic — every
   hit was a false positive. No design, no code.
2. **OpenChronicle v1 already built a real content-routing mechanism, and
   it never ran.** Lives at `archive/openchronicle.v1`, under
   `infrastructure/content/analysis/` and `infrastructure/registry/`:
   - `ContentRoutingConfig` (`schema_validation.py`) — a Pydantic schema
     with `nsfw_models: list[str]`, `safe_models: list[str]`,
     `default_nsfw_model`, `default_safe_model`, `content_filter_enabled`,
     plus cross-reference validation that every referenced model actually
     exists in the registry.
   - `ModelSelector.recommend_generation_model()` — classified text into
     `nsfw` (with `explicit`/`suggestive`/`mature` severity tiers) via
     confidence-scored keyword detection, then picked a candidate model
     list from `content_routing`.
   - `ContentRouter.get_routing_recommendation()` — a second, simpler
     recommender biasing toward local adapters when NSFW flags fired.

   This is a well-shaped design. **It was never wired to the real
   generation call path.** `content_router.py` calls
   `registry_manager.get_content_routing_rules()` and `get_provider_config()`
   — neither method exists on `registry_manager.py` — so both calls raise
   and get swallowed by broad `except Exception` blocks, silently falling
   back to hardcoded defaults with no NSFW/SFW distinction at all. The live
   production config (`config/registry_settings.json`) has no
   `content_routing` block populated. `ModelSelector`/`ContentRouter` are
   exported and reachable via an optional DI interface
   (`IContentAnalyzer` in `shared/service_interfaces.py`), but no concrete
   binding exists and no call site in the real narrative pipeline
   (`response_orchestrator.py`, `response_planner.py`) ever reads an NSFW
   flag or picks a provider from one. v1's own self-assessment doc,
   `.copilot/MISSING_FEATURES_ANALYSIS.md`, claimed "Complete NSFW
   detection and content filtering — ✅ FULLY IMPLEMENTED" — an overclaim
   relative to that fallback-swallowed reality.

   **This is the load-bearing lesson for this design.** The failure mode
   wasn't a bad schema or a bad classifier — it was building routing
   infrastructure as an optional, DI-resolved side system with no call site
   that unconditionally goes through it. §2 below is designed specifically
   so that mistake isn't repeatable: the check has exactly one call site,
   it is not optional, and there is nothing to silently fail to bind to.

3. **mnemosyne's own `docs/ARCHITECTURE.md` §4 already has a ratified,
   adjacent decision** — the *host/surface* split: Claude Desktop (SFW
   only, host LLM sees every tool result and applies content policy to it)
   vs. a web UI or non-Anthropic host (NSFW-capable, bypasses the host LLM
   entirely). That's a coarser, deploy-time decision about *which surface
   you're using*. Standard §10 asks for something finer-grained: a
   per-request check about *which content you're generating*, at the
   moment of generation. This design extends §4's split rather than
   replacing it — the surface split still determines what a human can see;
   this design determines what mnemosyne will attempt to generate on a
   given provider in the first place.

## The core architectural decision

**A story declares the content rating it requires. A provider declares the
content rating it's capable of. Generation checks the two against each
other, inline, at the one real call site — and refuses, loudly, on
mismatch. No text classifier. No silent softening.**

Three sub-decisions follow from that:

**No content classifier.** v1's keyword-confidence NSFW detector is
exactly the piece that never got wired up, and it's the hardest part of
the whole idea to get right (tuning thresholds, false positives on genre
horror/violence that isn't actually explicit, false negatives on euphemism).
mnemosyne doesn't need to *infer* a story's rating from arbitrary
generated text, because the rating isn't a fact about a request — it's a
fact about the *story*, and every current story already states it
explicitly. Every one of the five imported stories' Living-Canon-polished
export has a rule entity named "Content Framing" that opens with a literal
`Rating Baseline: Mature / hard R...` line. That's already a structured,
human-authored, per-story declaration; this design just needs to make it
machine-readable in one place instead of leaving it as prose a caller
would have to parse.

**Not the rule entity's prose, though — the story marker.** Parsing
"Content Framing"'s free text to extract a rating would repeat the exact
anti-pattern `docs/V2_RETROSPECTIVE.md` already flags: *"Storing
structured data as JSON-embedded-in-prose... Mnemosyne should treat
structured data as structured."* mnemosyne already has a structured,
versioned, per-story metadata record for exactly this class of fact — the
story marker memory (`src/stories.ts`). **Updated 2026-09-08**: the
marker has moved twice since this design was proposed (schema 3 →
`Narrator-Profile` at schema 4 → `position` fields at schema 5,
`STORY_MARKER_SCHEMA = 5` in code today), each addition following the
same optional-line, `undefined`-when-unset pattern this design already
proposed for `Content-Rating`. Three real precedents now, not one — a
stronger case for the same shape, not a weaker one.

**Fail closed, at generation time, with one call site.** The check has to
live where `generator.generate()` is actually called. **Updated
2026-09-08**: the 2026-09-08 `continueScene()` phase extraction moved
that call from `src/tools/continue.ts` into
[`dispatchGenerate()` in `src/application/continue-scene.ts`](../src/application/continue-scene.ts)
— still exactly one call site, just a different file than this design
originally named. The gate belongs at the top of `dispatchGenerate()`,
before `port.generate()` is invoked, not behind an
optional interface a future call site might or might not resolve. If the
story's declared rating exceeds the configured provider's declared
capability, the tool throws before spending an LLM call, with an error
that names the story, the rating, the provider, and what to change. This
is the literal shape of Standard §10's *"If an appropriate route is
unavailable, the system should fail or request a route change
transparently."*

### What this deliberately does NOT attempt

- **Detecting content after the fact.** If a cloud provider's own upstream
  policy refuses or sanitizes a request server-side (already observed
  live: AtlasCloud's safety filter rejected two Thrawn full-body
  generations during the Star Wars visual-reference pass), that error
  should propagate to the caller exactly as received — mnemosyne must not
  catch it and retry with softened wording, and must not catch it and
  silently return a truncated result. This is mostly already true (errors
  propagate through the existing provider classes); Phase 1's
  implementation work should include a short chokepoint sweep confirming
  no call site quietly rewrites a refusal into "success."
- **Image-generation routing.** There's no `mnemo_generate_image` tool.
  Every image in every story so far was generated by hand, through the
  OpenArt/AtlasCloud MCP tools directly, during manual polish-pass
  sessions — not through a mnemosyne server code path this gate could sit
  in front of. Out of scope until that changes; noted so Standard §10
  isn't silently read as "solved" once Phase 1 ships.

## Concrete shape (Phase 1)

### 1. Story marker: `Schema: 6`, new optional `Content-Rating` line

**Updated 2026-09-08** (was `Schema: 4` in the original 2026-08-26
proposal; code has since moved to schema 5 for position tracking).
Mirrors the `Kindroid-Target` / `Narrator-Profile` / position-fields
precedents exactly — optional, appended only when set, older markers
(schema 1-5) still parse via the same legacy-fallback pattern
`parseMarker` already uses.

```
[Mnemosyne Story] Chaos Saga
Created: 2026-05-12T02:59:43Z
Schema: 6
Kindroid-Target: ai:abc123
Content-Rating: nsfw
```

**Vocabulary ratified 2026-09-08: `sfw`/`nsfw`**, not the originally
proposed `sfw`/`mature` — matches Living Canon Standard §10's own literal
wording ("SFW or NSFW-capable") exactly rather than introducing a second,
non-matching vocabulary for the same concept.

- `contentRating?: "sfw" | "nsfw"` added to `MnemoStory` /
  `StorySummary` (`src/stories.ts`), following `kindroid_target`'s exact
  pattern: optional, `undefined` when unset.
- Set via a new `content_rating` param on `mnemo_story_use`, same
  mutually-exclusive-with-nothing, `null`-clears shape as
  `kindroid_kin`/`kindroid_group_id`.
- **Unset is not "sfw" by default in the check** — see §3. An unset rating
  means "no declared requirement," which changes what the gate does, not
  what it assumes.

### 2. Provider capability: declared, not inferred, per provider

Content capability is an operational fact about how a provider is
*configured* (which model is loaded, which Kindroid kin is targeted), not
something derivable from the provider's name. **Checked 2026-09-08**:
`GeneratorCapabilities` (`src/capabilities.ts`, GENERATOR_CAPABILITIES_DESIGN,
shipped 2026-08-28) has no content-rating field and no overlap with this
proposal — it's an auto-derived/instance-keyed table of model *mechanics*
(context window, temperature range, structured-output support), whereas
`contentCapability` here is an operator *declaration* nothing can
introspect. Deliberately kept separate rather than folded into that
table for that reason. Add a `contentCapability: "sfw" | "nsfw"` field
to each provider's config, following the existing
per-provider-literal-env-var convention in `src/index.ts` (so the
`.env.example` schema-drift test keeps seeing every reference):

| Provider | Default | Operator-overridable to `nsfw`? |
|---|---|---|
| `anthropic` / `openai` / `gemini` | `sfw` | **No — ratified final 2026-09-08.** Their own upstream content policy enforces this regardless of what mnemosyne declares; an override would just be a lie that gets caught by a 400/refusal later, after already spending the call. No per-call escape hatch either (considered and rejected at ratification). |
| `ollama` | `sfw` | Yes, via `OLLAMA_CONTENT_CAPABILITY=nsfw` — capability genuinely depends on which model is loaded, which only the operator knows. |
| `kindroid` / `botify` | `sfw` | Yes, via `KINDROID_CONTENT_CAPABILITY` / `BOTIFY_CONTENT_CAPABILITY` — capability depends on the target kin/bot's own configuration, which mnemosyne can't inspect. |
| `atlascloud` | `sfw` | Yes, via `ATLASCLOUD_CONTENT_CAPABILITY` — depends on which underlying model Atlas Cloud routes to. |

Defaulting every provider to `sfw` is the deliberately conservative
choice: an operator who wants `nsfw` has to say so explicitly, matching
this repo's own `docker-deployments.md` instinct (fail toward the
restrictive default, not the permissive one) and matching how
`OLLAMA_VALIDATOR_MODEL` etc. are already required-explicit rather than
inferred.

### 3. The gate itself, in `dispatchGenerate()`

**Updated 2026-09-08** — see the call-site correction above;
`src/tools/continue.ts` no longer calls `generate()` directly.

```
resolvedRating = story.contentRating           // "sfw" | "nsfw" | undefined
providerCapability = generator.contentCapability // "sfw" | "nsfw"

if resolvedRating === "nsfw" and providerCapability === "sfw":
    throw ContentRoutingError(
      `Story "${story.name}" requires an nsfw content rating, but the ` +
      `configured generator (${generator.name}) is only sfw-capable. ` +
      `Either deploy with an nsfw-capable provider, or set this story's ` +
      `content rating explicitly via mnemo_story_use if "nsfw" was set ` +
      `in error.`
    )
```

- `resolvedRating === undefined` (no rating declared) does **not** throw —
  **ratified final 2026-09-08: this stays non-blocking permanently**, not
  just until migration completes. It's a currently-unmigrated or
  deliberately-unrated story; refusing every existing story the day this
  ships would be its own regression, and no future flag-day forces
  migration either. Surface it as a warning field in the tool response
  instead (`content_rating_declared: false`), so it's visible without
  being blocking. `mnemo_story_use`'s `content_rating` param stays
  optional on new story creation too, for the same reason.
- One check, one call site, unconditional — the exact property v1's
  design lacked.

### 4. `.env.example` additions

`OLLAMA_CONTENT_CAPABILITY`, `KINDROID_CONTENT_CAPABILITY`,
`BOTIFY_CONTENT_CAPABILITY`, `ATLASCLOUD_CONTENT_CAPABILITY` — each
documented with its default (`sfw`) and the one valid override
(`nsfw`). Anthropic/OpenAI/Gemini get no env var at all, since they're
not operator-overridable; that absence is itself part of the design and
worth a comment in `.env.example` saying why, so it doesn't read as an
oversight later.

## Phase 2 (future direction, not designed)

True per-request routing — running two generator instances simultaneously
(e.g. a local uncensored Ollama model alongside a cloud SFW model) and
picking between them per call — is closer to what Standard §10's wording
literally suggests, and closer to what v1 attempted. It's a real
architecture change: `src/index.ts` builds exactly one `generator`
singleton today, and multi-provider selection would need that to become
a set, plus a per-call selection step (an explicit `content_rating`
argument on `mnemo_continue`, most likely, rather than reintroducing a
classifier).

Not designing this now, on purpose: Phase 1's plumbing (the rating field,
the capability declarations) is the actual prerequisite, and per this
project's own no-over-engineering rule, Phase 2 should only get designed
once Phase 1 is live and an operator actually wants automatic switching
instead of the current manual "deploy the right provider for this story"
workflow.

## Rejected alternatives

- **v1's confidence-scored keyword classifier.** Rejected per the
  Background section above — this is the specific piece that rotted
  unused, and reproducing it here would risk the same fate for the same
  reason (hard to tune, easy to leave unwired).
- **Parsing the "Content Framing" rule entity's prose at generation
  time.** Rejected as the `V2_RETROSPECTIVE.md`
  format-then-parse-is-fragile anti-pattern applied to a new field —
  any rewording of that rule's prose (which the Living Canon Standard's
  own polish-pass workflow explicitly invites) would silently break
  extraction with no error.
- **No gate at all; trust the operator to deploy the right provider.**
  This is close to today's actual behavior, and it's exactly what
  Standard §10 was written to end — the Standard's own text explicitly
  rules out "the system should fail... transparently" being satisfied by
  hoping the operator got the deployment right.
- **Defaulting `ollama`/`kindroid`/`botify`/`atlascloud` to `nsfw`
  since all current storylines are already mature-rated.** Rejected —
  optimizing the default for today's five stories would make the
  restrictive case (a future SFW story) the one that silently gets it
  wrong, which is backwards for a safety-shaped default.
- **A per-call `content_rating` override on `mnemo_continue`** letting a
  deliberately-tame scene route through an sfw-only cloud provider even
  within an nsfw-rated story. Considered and rejected at ratification
  (2026-09-08) alongside the "no override for cloud providers" decision
  below — more surface area for a need that hasn't come up.

## Ratified decisions (2026-09-08)

The four questions this design was blocked on, each with the operator's
answer:

1. **Undeclared rating stays non-blocking permanently** — not just until
   migration completes. No future flag-day is planned to force every
   story to declare a rating.
2. **Vocabulary is `sfw`/`nsfw`** — not the originally proposed
   `sfw`/`mature`. Matches Living Canon Standard §10's own literal
   wording exactly, appearing consistently in the marker format, the env
   vars, and the tool schema.
3. **`mnemo_story_use`'s `content_rating` param stays optional on new
   story creation** — follows directly from decision 1; forcing a
   decision at creation time when it's not enforced later would be
   inconsistent friction.
4. **No escape hatch for cloud providers — final.** No per-call override
   on `mnemo_continue` either (considered as part of this decision, see
   Rejected alternatives above). Cloud providers' own upstream content
   policy already gates this regardless of what mnemosyne declares.

Overall disposition: **ratified as refined** (not revised further, not
rejected). Phase 1 implementation proceeds in slices per the "Concrete
shape" section above, each its own commit with tests, tracked in
[RESEARCH_DECISION_QUEUE.md](RESEARCH_DECISION_QUEUE.md)'s Phase 3b.

## Implementation record

All three slices shipped 2026-09-08, closing this design. Two
implementation refinements beyond the pseudocode above, both decided
during slice 3 rather than pre-specified:

- **The refusal message names the provider, not the story.** §3's
  pseudocode included `story.name`; the shipped message omits any story
  identifier -- the caller already knows which story they called
  `mnemo_continue` against (it's their own request), so threading a name
  or id through `dispatchGenerate()` just to restate it back added a
  parameter without adding information.
- **The position-write relabeling postscript (docs/POSITION_TRACKING_DESIGN.md
  refinement 5) is a shared helper (`positionAppliedNote()`), not
  duplicated.** The gate is a second pre-dispatch throw site in the same
  "still nominally pre-dispatch" span `continueScene()`'s own comment
  anticipated ("if a new phase function ever goes in this span, it must
  sit inside this try/catch, or get its own relabel") -- it took the
  "own relabel" branch rather than being folded into the existing
  `gatherAndPlan()` try/catch, to avoid touching that already-reviewed
  boundary. Both throw sites now call the same helper rather than
  repeating the postscript text.

Mutation-tested against real OC and hand-built `ContinuationPort` mocks:
the gate condition itself (both directions -- disabling it entirely, and
separately breaking the "undeclared never blocks" rule specifically),
and the position-relabeling branch. `tests/gather-context-position.test.ts`
confirms `content_rating` resolves from a real story marker at the same
zero-extra-cost fetch `position` already uses, and survives an unrelated
marker rewrite.
