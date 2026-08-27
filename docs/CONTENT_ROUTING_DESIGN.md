# Content Routing Design

**Status: proposed 2026-08-26, not yet ratified.** This document exists to
close a real gap: [Living Canon Standard](LIVING_CANON_STANDARD.md) §10
("Routing boundary") already requires that "text and image generation must
be routed independently to explicitly configured SFW or NSFW-capable models
before generation begins," but no such mechanism exists in the codebase
today — confirmed by grepping `src/` for SFW/NSFW routing logic and finding
zero matches. The Standard is currently describing infrastructure that
doesn't exist. This design proposes what would close that gap. Nothing here
is built; the "Decisions needed from the operator" section at the end lists
what has to be settled before it is.

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
story marker memory (`src/stories.ts`), currently at `Schema: 3` and
already carrying one optional operational field (`Kindroid-Target`) added
the same way. A rating declaration is the same shape of fact and belongs
in the same place.

**Fail closed, at generation time, with one call site.** The check has to
live where `generator.generate()` is actually called —
[`src/tools/continue.ts:189`](../src/tools/continue.ts) — not behind an
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

### 1. Story marker: `Schema: 4`, new optional `Content-Rating` line

Mirrors the existing `Kindroid-Target` precedent exactly — optional,
appended only when set, older markers (schema 1-3) still parse via the
same legacy-fallback pattern `parseMarker` already uses.

```
[Mnemosyne Story] Chaos Saga
Created: 2026-05-12T02:59:43Z
Schema: 4
Kindroid-Target: ai:abc123
Content-Rating: mature
```

- `contentRating?: "sfw" | "mature"` added to `MnemoStory` /
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
something derivable from the provider's name. Add a `contentCapability:
"sfw" | "mature"` field to each provider's config, following the existing
per-provider-literal-env-var convention in `src/index.ts` (so the
`.env.example` schema-drift test keeps seeing every reference):

| Provider | Default | Operator-overridable to `mature`? |
|---|---|---|
| `anthropic` / `openai` / `gemini` | `sfw` | **No.** Their own upstream content policy enforces this regardless of what mnemosyne declares; an override would just be a lie that gets caught by a 400/refusal later, after already spending the call. |
| `ollama` | `sfw` | Yes, via `OLLAMA_CONTENT_CAPABILITY=mature` — capability genuinely depends on which model is loaded, which only the operator knows. |
| `kindroid` / `botify` | `sfw` | Yes, via `KINDROID_CONTENT_CAPABILITY` / `BOTIFY_CONTENT_CAPABILITY` — capability depends on the target kin/bot's own configuration, which mnemosyne can't inspect. |
| `atlascloud` | `sfw` | Yes, via `ATLASCLOUD_CONTENT_CAPABILITY` — depends on which underlying model Atlas Cloud routes to. |

Defaulting every provider to `sfw` is the deliberately conservative
choice: an operator who wants `mature` has to say so explicitly, matching
this repo's own `docker-deployments.md` instinct (fail toward the
restrictive default, not the permissive one) and matching how
`OLLAMA_VALIDATOR_MODEL` etc. are already required-explicit rather than
inferred.

### 3. The gate itself, in `continue.ts`

```
resolvedRating = story.contentRating           // "sfw" | "mature" | undefined
providerCapability = generator.contentCapability // "sfw" | "mature"

if resolvedRating === "mature" and providerCapability === "sfw":
    throw ContentRoutingError(
      `Story "${story.name}" requires a mature content rating, but the ` +
      `configured generator (${generator.name}) is only sfw-capable. ` +
      `Either deploy with a mature-capable provider, or set this story's ` +
      `content rating explicitly via mnemo_story_use if "mature" was set ` +
      `in error.`
    )
```

- `resolvedRating === undefined` (no rating declared) does **not** throw —
  it's a currently-unmigrated or deliberately-unrated story, and refusing
  every existing story the day this ships would be its own regression.
  Surface it as a warning field in the tool response instead
  (`content_rating_declared: false`), so it's visible without being
  blocking. Whether to eventually make an undeclared rating an error too
  is one of the open decisions below.
- One check, one call site, unconditional — the exact property v1's
  design lacked.

### 4. `.env.example` additions

`OLLAMA_CONTENT_CAPABILITY`, `KINDROID_CONTENT_CAPABILITY`,
`BOTIFY_CONTENT_CAPABILITY`, `ATLASCLOUD_CONTENT_CAPABILITY` — each
documented with its default (`sfw`) and the one valid override
(`mature`). Anthropic/OpenAI/Gemini get no env var at all, since they're
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
- **Defaulting `ollama`/`kindroid`/`botify`/`atlascloud` to `mature`
  since all current storylines are already mature-rated.** Rejected —
  optimizing the default for today's five stories would make the
  restrictive case (a future SFW story) the one that silently gets it
  wrong, which is backwards for a safety-shaped default.

## Decisions needed from the operator

1. Does an **undeclared** story rating stay non-blocking (warning field
   only) permanently, or become an error once every current story has
   been migrated to declare one explicitly?
2. Exact field name/values — `Content-Rating: mature` as proposed, or a
   different vocabulary (the Standard's own §10 language is "SFW or
   NSFW-capable," which doesn't line up one-to-one with "sfw"/"mature" —
   worth deciding the vocabulary once, since it'll appear in the marker
   format, the env vars, and the tool schema).
3. Should `mnemo_story_use`'s new `content_rating` param require an
   explicit value on every *new* story creation (forcing the operator to
   decide up front), or stay optional with the undeclared state from
   decision 1?
4. Is the "no override for cloud providers" table entry final, or should
   there be an explicit escape hatch (e.g. for a deliberately-tame scene
   the operator wants to route through Claude even for a mature-rated
   story) — and if so, does that live as a per-call override on
   `mnemo_continue` rather than a provider-level env var?
