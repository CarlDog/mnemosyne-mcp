# World-Context Companion — Design Notes

**This is an idea, not a locked decision.** Nothing here is scheduled, and
nothing in this document commits mnemosyne to any new code. It exists so the
architecture thinking has a home before the idea is actually picked up — read
every "would" below as "could," and treat "Open questions" as genuinely open.
The one committed artifact is the pointer entry in STATUS.md "What's next
(post-v0)."

Written 2026-08-31, prompted by a conversation about whether kins/bots should
be able to ground a scene in real-world facts — weather, current events —
optionally per storyline or per individual bot.

## 1. Motivation

Today a companion (Kindroid, Botify) only knows what mnemosyne feeds it from
OC: story entities and recent scenes. It has no notion of "what's actually
happening right now" — what the weather is where a scene is set, or what's in
the news the day a scene takes place. Some stories/bots would benefit from
that grounding (a modern-day story where a character comments on real rain,
a companion whose persona is explicitly plugged into current events); many
wouldn't, and it should never be forced on.

## 2. Architecture direction

Recommendation: **a standalone `*-companion` app, not code inside mnemosyne**
— the same shape already decided for Plex in
[PLEX_COMPANION_INTEGRATION_PLAN.md](PLEX_COMPANION_INTEGRATION_PLAN.md).

That plan's core split is the template: plex-companion owns all Plex/Tautulli
domain knowledge, event filtering, and gating, and hands mnemosyne one
structured, already-decided interaction; mnemosyne stays the narrative
lifecycle owner (context admission, provider dispatch, OC recording) and
never learns anything about Plex itself. The same split applies here:

- A standalone companion (call it `worldinfo-companion` for now, name not
  chosen) would own the external API calls (weather, news feeds), any
  polling/caching/rate-limiting, and the judgment call of "is this fact
  worth surfacing right now" — the same kind of gating plex-companion does
  for cooldowns and chance gates.
- Mnemosyne would receive a small, already-curated fact (or a short list of
  them) and fold it into context admission the same way it already folds in
  other inputs — most likely through the existing keyphrase-gated path in
  `companion-message.ts` / `context-plan.ts`, not a new bespoke channel.
- Mnemosyne never calls a weather or news API directly, never holds an API
  key for one, and never has a scheduling/polling loop of its own — all of
  that stays in the companion app, exactly as Plex/Tautulli facts never
  enter mnemosyne's own code.

Rejected direction: baking live external API calls directly into mnemosyne
(e.g. a new `src/weather-client.ts` called from `gatherContext`). This would
couple a storytelling-memory server to unrelated external APIs, their
rate limits, their auth, and their failure modes — the same coupling the
Plex plan explicitly avoided by keeping Plex knowledge out of mnemosyne.

## 3. Candidate shape (a sketch, not a spec)

Purely illustrative of the shape, not proposed names/signatures to build
against:

- **Per-story / per-bot opt-in**, not a global default-on. Likely lives on
  the story marker (the same place the Kindroid target binding lives today —
  `KindroidTarget` on the OC-canonical story marker) rather than local
  config, since it's portable story data other callers (Web UI, API) need
  to read too.
- **A structured fact, not a raw API payload.** Whatever the companion
  hands mnemosyne should already be curated prose-ready text (e.g. "It's
  raining in [setting]"), not a JSON blob mnemosyne would need to interpret
  — mirrors the "precompute the facts, hand the model a labeled
  authoritative block" discipline used elsewhere for LLM-fed context.
- **Cache-and-refresh lives in the companion**, not mnemosyne. Weather and
  news both change slowly enough that mnemosyne calling out on every
  `mnemo_continue` would be wasteful even if it did own the integration —
  another reason this belongs in a separate app with its own refresh
  cadence, independent of story-generation traffic.

## 4. Open questions (genuinely unresolved)

- **Which facts, exactly?** Weather is low-risk and narratively useful.
  "Global events" is much harder — real current-events news bleeding into
  a fictional story risks tone mismatches (a lighthearted scene landing the
  same day as serious real-world news) and drags in genuinely sensitive
  topics unfiltered. If this is ever built, news likely needs a narrower,
  operator-curated feed rather than a raw headlines API.
- **Where does the per-story/per-bot toggle actually live**, and what's
  the granularity — one flag per story, or a finer per-companion-target
  setting (a story with both a Kindroid AI and a group might want it on
  for one and not the other)?
- **How does mnemosyne receive the fact** — pushed in in the same call as
  a companion interaction (Plex-companion's "one structured interaction"
  pattern), or pulled by mnemosyne from the companion app at context-gather
  time? The Plex plan uses push (companion decides, mnemosyne receives);
  push likely fits here too, but hasn't been thought through.
- **What does "worldinfo-companion" (or whatever it's named) actually look
  like operationally** — is it its own deployable service in the fleet
  (its own repo, its own container, per `docker-deployments.md`), or does
  an existing app absorb it? Nothing here answers that; it's a genuinely
  separate design/decision from the mnemosyne-side shape above.
- **Cost/consent.** Even free-tier weather/news APIs have rate limits and
  sometimes API keys to manage; whoever builds the companion app owns that,
  but it's worth surfacing before assuming this is a zero-cost feature.

## 5. If/when this gets picked up

The actual backlog entry lives in STATUS.md → "What's next (post-v0)" — this
document is the detail behind that one bullet, not a second source of
status. Update the STATUS.md bullet, not this file, when priority changes;
update this file when the design thinking changes.
