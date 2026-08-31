# Companion Provider Candidates — Nomi.ai, SpicyChat.ai, Candy.ai

**Research snapshot: 2026-08-31.** Not ratified architecture, not an
implementation commitment. The operator created testing accounts on all
three platforms and asked for a survey of API availability so a future
MCP-server build (mirroring the existing `kindroid-mcp`/`botify-mcp`
pattern) is scoped against real constraints instead of discovered mid-build.
Findings below are gathered from public docs, ToS pages, and third-party
sources as of this date — re-verify before committing engineering time, all
three products iterate quickly and none of this is contractually binding.

## Why this exists

mnemosyne's `GENERATOR_PROVIDER` roster already includes two companion-chat
providers, Kindroid and Botify (see CLAUDE.md's provider list), each backed
by a real API and a sibling MCP server that mnemosyne talks to as an MCP
client (`src/kindroid-client.ts`, `src/botify-client.ts`). Nomi.ai,
SpicyChat.ai, and Candy.ai are candidate additions to that same shape. This
document doesn't decide whether to build them — it establishes what each
build would actually require, and where the legitimate-access boundary
falls for each platform.

## Summary table

| Platform | Official API | Auth | ToS on automation | Verdict |
|---|---|---|---|---|
| **Nomi.ai** | Yes — documented REST API at `api.nomi.ai/v1` | API key, from Profile → Integrations | Ambiguous — general ToS bans "automating interaction with the System" with no explicit API carve-out, even though the API itself is officially documented and promoted | Buildable now, same shape as Kindroid/Botify — resolve the ToS gap with Nomi support first |
| **SpicyChat.ai** | No | N/A — only private, undocumented endpoints | Silent — neither permits nor prohibits automation/scraping in the (largely unreviewed) ToS | Only path is a reverse-engineered client against endpoints that can change without notice |
| **Candy.ai** | No | N/A | Explicitly prohibits reverse-engineering and using platform content with "off-platform artificial intelligence... technologies" | No legitimate integration path today |

## Nomi.ai

**Official API.** REST/JSON at `https://api.nomi.ai/v1`, documented at
[api.nomi.ai/docs](https://api.nomi.ai/docs/). Auth is an API key in the
`Authorization` header, obtained from the app's Profile tab → Integrations
— no separate developer-portal approval step found. Nomi actively promotes
the API (announced Sept 2024, [partnership outreach at
partnerships@nomi.ai](https://nomi.ai/nomi-ai-companion-api-partnerships/)),
and a community wiki covers it independently
([wiki.nomi.ai](https://wiki.nomi.ai/What_is_the_AI_Companion_API%3F)). No
API-specific pricing tier was found; the consumer product is freemium
(free tier + paid Standard plan, ~$15.99/mo as of mid-2026).

**Endpoints (much thinner than Kindroid's or Botify's):**
- `GET /v1/nomis`, `GET /v1/nomis/:id` — list/get
- `POST /v1/nomis/:id/chat` — 1:1 chat (core loop)
- `GET /v1/nomis/:id/avatar`
- `GET/POST/PUT/DELETE /v1/rooms...`, `POST /v1/rooms/:id/chat[/request]` —
  group-chat "rooms" (multiple Nomis), roughly Kindroid-group-chat-shaped

**Not exposed via API** despite existing in the app: persona/backstory
editing, voice, AI image generation, memory/journal ("Mind Map"),
webhooks. A Nomi provider would be closer to Kindroid's single-AI surface
than to Botify's, and couldn't do group-target persona management the way
`mnemo_story_use`'s `kindroid_kin`/`kindroid_group_id` binding implies for
Kindroid.

**Rate limits:** described only as "generous," no published numbers; 429
on excess, escalating enforcement on repeat violations, higher limits
available on request to support@nomi.ai.

**ToS tension (flag before building):** the general [Nomi.ai
ToS](https://nomi.ai/terms-of-service/) contains a blanket, unqualified ban
on "automated account registration and automating interaction with the
System," plus the standard scraping/reverse-engineering prohibitions — with
**no explicit API carve-out in the ToS text itself**, even though the API
is separately documented, announced, and promoted for third-party
integration. No standalone API Terms of Service or developer agreement was
found. This is very likely an oversight (issuing an API key and publishing
docs for it strongly implies permission), but it isn't spelled out anywhere
— worth a support email for a definitive answer before shipping a server
against it, cheap insurance against relying on an implicit read.

**Company context:** built by Glimpse.ai (founded 2020, Baltimore); mostly
self-funded (~$4.27M raised, last round Dec 2023). Active 2026 development:
a proprietary "Aurora" LLM (Jan 2026), a V3 voice engine (Feb 2026), "Mind
Map 2.0" (late 2025). Claims 1M+ users have tried a Nomi relationship.

**Unofficial wrappers around the official API** (not reverse-engineering,
just client libraries): `nomiai-php`
([oliverearl/nomiai-php](https://github.com/oliverearl/nomiai-php)),
`nomiai-php-laravel`, `nomi-cli` (Go,
[sjourdan/nomi-cli](https://pkg.go.dev/github.com/sjourdan/nomi-cli)) —
useful as reference implementations for request/response shape, not as
dependencies.

## SpicyChat.ai

**No official public API.** No developer portal, key-issuance flow, or
docs site found. Support runs through Discord and a ticket system, not a
dev portal. Two GitHub projects explicitly bill themselves as unofficial
and reverse-engineered:
[SSL-ACTX/spicychat-api](https://github.com/SSL-ACTX/spicychat-api) and
[DeoDorqnt387/UNOFFICIAL-SpicyChat-API](https://github.com/DeoDorqnt387/UNOFFICIAL-SpicyChat-API).
Both extract a bearer token from browser DevTools network traffic and call
undocumented endpoints directly — there is no other access path.

**Capabilities implied by the wrappers:** persistent chat with history,
message edit/regenerate/undo, persona ("mask") CRUD, bot/character config
(name, greeting, persona, avatar, visibility, bring-your-own-OpenAI-key),
"Director Mode" generation params (temperature/top-k) and premium-model
access. Web-app features with **no confirmed API access**: group chats
(2–10 characters), per-character lorebooks (closed beta as of Nov 2026),
12-language mode (Apr 2026), voice, cross-session summaries.

**Rate limits:** undocumented anywhere; the product gates by subscription
tier rather than a metered request count.

**ToS:** the live terms page is client-rendered and couldn't be fetched
directly. A third-party disclosure audit
([VerifyWise, dated 2026-06-12](https://verifywise.ai/ai-trust-index/spicychat))
that reviewed the actual policy found **no language either permitting or
prohibiting automation, bots, or scraping** — silent, not permissive. The
same audit flags an adverse content-license clause (a broad, perpetual,
sublicensable grant over user chats/generations) and an overall disclosure
grade of F (19/100). Confirmed 18+ age-verification requirement with
third-party age-assurance in the UK/EU and reported state-level access
blocks in the US (secondary source, not independently confirmed).

**Company context:** founded 2023, HQ listed Newark, DE; CB Insights tags
"a16z Bio Health" as an investor with no disclosed amount — treat as
low-confidence. Active weekly public-update cadence (Discord/X). Free tier
plus three paid tiers ($5/$14.95/$24.95 per month). Claimed 21-model
roster (DeepSeek V3 671B, WizardLM-2 8x22B MoE, etc.) comes only from
SEO/affiliate blogs, unverified against a primary source.

**Bottom line:** any integration here is necessarily an unofficial,
token-scraped client operating in a ToS gray zone against endpoints that
can change without notice — a materially different risk profile from
Nomi's documented-but-ambiguous situation.

## Candy.ai

**No official public API and no realistic path to one.** No developer
portal, docs, or key issuance found anywhere in Candy.ai's own materials
(operated by EverAI Limited, Malta). Two GitHub look-alikes are unrelated:
"CandyChain" is an unconnected blockchain/agent-marketplace project, and
"CandyDocs" is a generic SaaS feedback tool.

**Capabilities** are product-only (web app, not API): text chat,
persistent "Memory" tab, real-time voice with emotionally-modulated TTS,
on-demand image generation, and "Live Action" (AI video clips up to 120s,
shipped Dec 2025, upgraded Feb 2026). No group-chat feature found.

**Rate limits:** consumer-only, not API — reported ~100 msgs/day (Basic
tier), ~5/day (free tier), unlimited text on higher tiers, plus a
100-token/month allowance for images/voice/video. Figures are from SEO
review sites and conflict slightly between sources; approximate.

**ToS — explicit prohibition, fetched directly from [Candy.ai's live
Terms of Service](https://candy.ai/terms-of-service):** Section 5.1(b)
bans deciphering, decompiling, disassembling, or reverse-engineering the
platform; 5.1(d)/(e) ban unauthorized access and interference. **Section 3
restricts using platform content "in connection with off-platform
artificial intelligence or machine learning technologies"** — this reads
as a direct block on exactly the kind of third-party integration an MCP
server would be. Unlike SpicyChat's silence, this is an affirmative "no."
Tokens are explicitly non-transferable/non-tradeable (Section 9).

**Company context:** EverAI Limited (Malta), co-founded by Thomas Lacroix
(CMO). Reported ~$25M ARR (end FY2024) and ~38M monthly visitors
(mid-2026), operating as a PWA to avoid app-store fees. CB Insights lists
investors (a16z Bio Health, a16z Talent x Opportunity, Maiora Ventures) on
an unclaimed profile with a redacted amount — the health/talent-VC pairing
for an NSFW companion app looks like a possible data-mismatch; treat as
unverified. Underlying model undisclosed by the company; third-party
teardowns speculate a fine-tuned open-weight Llama/Mistral model,
unconfirmed.

## Recommendation

- **Nomi.ai** — the one candidate with a real path forward, following the
  `kindroid-mcp` shape (single-AI + room/group chat, API-key auth). Before
  building: get a definitive answer from Nomi support on the
  automation-clause/API-docs contradiction in the ToS. Scope expectations
  down from Kindroid/Botify parity — no persona-edit, voice, image, or
  webhook endpoints exist to wrap.
- **SpicyChat.ai** — hold. Building against scraped bearer tokens and
  undocumented endpoints is real engineering risk (breakage without
  notice) layered on a ToS that's silent rather than permissive. Worth
  revisiting if SpicyChat ships an official API (their public roadmap
  hasn't mentioned one) — don't invest in a client this fragile without
  an explicit go-ahead.
- **Candy.ai** — do not build against the current ToS. The prohibition on
  off-platform AI use of platform content is a direct hit on the MCP-server
  use case, not a generic reverse-engineering clause. Revisit only if
  EverAI ships an official API or changes Section 3.
