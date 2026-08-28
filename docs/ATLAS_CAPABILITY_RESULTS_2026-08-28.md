# Atlas Cloud capability results — 2026-08-28

This is the **first catalog run through the CLI runner** — the run the
[2026-08-27 note](ATLAS_CAPABILITY_RESULTS_2026-08-27.md) explicitly deferred
("The full all-model run is intentionally left to the CLI runner … The local
`atlas` executable is not installed in this checkout"). The CLI is now
installed and authenticated, so L0 coverage is complete and machine-derived
rather than read off a display-truncated listing.

Nothing here certifies any model. Three runs are recorded: catalog discovery
(`--mode catalog`) and media schema probing (`--mode media-schema`), both
non-billable, plus the chat policy sweep (`--mode chat`), which is billable and
cost **$0.10** for 60 model calls. No media was generated.

## Run environment

| Field | Value |
|---|---|
| CLI | `atlas-cli 0.1.16` (from the pinned `vendor/atlascloud-cli` installer) |
| Runner | `scripts/atlas-capability-benchmark.mjs`, `--mode catalog` |
| Generated at | `2026-08-28T19:27:24.743Z` |
| Probe budget | 120000 ms |
| Media budget | 900000 ms (unused in this mode) |
| Wall clock | 0.86 s |
| Cost | none — catalog listing is not billable |

## Catalog totals, and drift since 2026-08-27

| Catalog type | 2026-08-27 | 2026-08-28 | Δ |
|---|---:|---:|---:|
| Text/chat | 65 | 65 | 0 |
| Image | 121 | 121 | 0 |
| Video | 196 | 199 | **+3** |

The video catalog grew by three entries in a day. That is the concrete reason
this protocol re-derives the catalog from the CLI on every run instead of
trusting a stored listing.

## Triage outcome

| Catalog type | Total | Eligible | Skipped |
|---|---:|---:|---:|
| chat | 65 | 60 | 5 |
| image | 121 | 42 | 79 |
| video | 199 | 43 | 156 |
| **all** | **385** | **145** | **240** |

Every skip carries a recorded reason — nothing is dropped silently:

| Skip reason | Count |
|---|---:|
| not a text-to-video workflow | 156 |
| not a text-to-image workflow | 79 |
| specialized OCR/coding/note model | 5 |

`capability` is populated only on eligible rows; skipped rows stay
self-describing through `skipReason`.

## Eligible model inventory

The triage-surviving set as of this run. Every entry is `schemaProbe: not_run`
and `liveProbe: not_run` — listed here as *candidates*, never as passes.

### Chat (60)

```
Qwen/Qwen3-235B-A22B-Instruct-2507
bytedance/doubao-seed-1.6-251015
bytedance/doubao-seed-1.6-flash-250828
bytedance/doubao-seed-1.8-251228
bytedance/doubao-seed-2.0-lite-260428
bytedance/doubao-seed-2.0-mini-260428
bytedance/doubao-seed-2.0-pro-260215
bytedance/doubao-seed-2.1-pro-260628
bytedance/doubao-seed-2.1-turbo-260628
bytedance/doubao-seed-character-260628
bytedance/doubao-seed-evolving
deepseek-ai/DeepSeek-V3.1
deepseek-ai/DeepSeek-V3.1-Terminus
deepseek-ai/DeepSeek-V3.2-Exp
deepseek-ai/deepseek-v3.2
deepseek-ai/deepseek-v4-flash
deepseek-ai/deepseek-v4-flash-0731
deepseek-ai/deepseek-v4-pro
deepseek-ai/deepseek-v4-pro-0813
dots-studio/dots-3-note-prev-free
google/gemini-3.1-flash-lite
google/gemini-3.1-pro-preview
google/gemini-3.5-flash
meituan-longcat/longcat-2.0
minimaxai/minimax-m2.5
minimaxai/minimax-m2.7
minimaxai/minimax-m3
moonshotai/kimi-k2.5
moonshotai/kimi-k2.6
moonshotai/kimi-k2.7-code
moonshotai/kimi-k3
openai/gpt-5.4
openai/gpt-5.5
openai/gpt-5.6-luna
openai/gpt-5.6-sol
openai/gpt-5.6-terra
qwen/qwen3.5-122b-a10b
qwen/qwen3.5-27b
qwen/qwen3.5-35b-a3b
qwen/qwen3.5-397b-a17b
qwen/qwen3.5-flash
qwen/qwen3.5-plus
qwen/qwen3.6-35b-a3b
qwen/qwen3.6-plus
qwen/qwen3.7-max
qwen/qwen3.7-plus
qwen/qwen3.8-max
tencent/hy3
xai/grok-4.3
xai/grok-4.5
xai/grok-4.6
xai/grok-build-0.1
xiaomi/mimo-v2.5
xiaomi/mimo-v2.5-pro
zai-org/GLM-4.6
zai-org/glm-4.7
zai-org/glm-5
zai-org/glm-5.1
zai-org/glm-5.2
zai-org/glm-5v-turbo
```

### Text-to-image (42)

```
alibaba/qwen-image/text-to-image-max
alibaba/qwen-image/text-to-image-plus
alibaba/wan-2.5/text-to-image
alibaba/wan-2.6/text-to-image
alibaba/wan-2.7-pro/text-to-image
alibaba/wan-2.7/text-to-image
atlascloud/qwen-image/text-to-image
baidu/ERNIE-Image-Turbo/text-to-image
black-forest-labs/flux-2-flex/text-to-image
black-forest-labs/flux-2-pro/text-to-image
bytedance/seedream-v5.0-pro/text-to-image
google/nano-banana-2-lite/text-to-image
google/nano-banana-2-lite/text-to-image-developer
google/nano-banana-2/text-to-image
google/nano-banana-2/text-to-image-developer
google/nano-banana-pro/text-to-image
google/nano-banana-pro/text-to-image-developer
google/nano-banana-pro/text-to-image-ultra
google/nano-banana/text-to-image
google/nano-banana/text-to-image-developer
hidream-o1-1.5/text-to-image
ideogram/v4/quality/text-to-image
ideogram/v4/turbo/text-to-image
krea-2-turbo/text-to-image
microsoft/mai-image-2.5-flash/text-to-image
microsoft/mai-image-2.5/text-to-image
nvidia/cosmos-3-super/text-to-image
openai/gpt-image-1-mini/text-to-image
openai/gpt-image-1.5/text-to-image
openai/gpt-image-1/text-to-image
openai/gpt-image-2-developer/text-to-image
openai/gpt-image-2/text-to-image
qwen-image-3.0-pro/text-to-image
qwen-image-3.0/text-to-image
qwen/qwen-image-2.0-pro/text-to-image
qwen/qwen-image-2.0/text-to-image
reve-ai/reve-2.1/text-to-image
xai/grok-imagine-image-2.0/text-to-image
xai/grok-imagine-image-quality/text-to-image
xai/grok-imagine-image/text-to-image
youchuan/v8.1/text-to-image
youchuan/v8.2/text-to-image
```

### Text-to-video (43)

```
alibaba/happyhorse-1.0/text-to-video
alibaba/happyhorse-1.1/text-to-video
alibaba/wan-2.5/text-to-video
alibaba/wan-2.5/text-to-video-fast
alibaba/wan-2.6/text-to-video
alibaba/wan-2.7/text-to-video
alibaba/wan-3.0-prime/text-to-video
alibaba/wan-3.0/text-to-video
atlascloud/van-2.5/text-to-video
atlascloud/van-2.6/text-to-video
bytedance/seedance-2.0-fast/text-to-video
bytedance/seedance-2.0-mini/text-to-video
bytedance/seedance-2.0/text-to-video
bytedance/seedance-2.5/text-to-video
bytedance/seedance-v1-pro-fast/text-to-video
bytedance/seedance-v1.5-pro/text-to-video
bytedance/seedance-v1.5-pro/text-to-video-fast
google/gemini-omni-flash/text-to-video
google/gemini-omni-flash/text-to-video-developer
google/veo3.1-fast/text-to-video
google/veo3.1-lite/text-to-video
google/veo3.1/text-to-video
kwaivgi/kling-v2.5-turbo-pro/text-to-video
kwaivgi/kling-v2.6-pro/text-to-video
kwaivgi/kling-v3.0-4k/text-to-video
kwaivgi/kling-v3.0-pro/text-to-video
kwaivgi/kling-v3.0-std/text-to-video
kwaivgi/kling-v3.0-turbo/text-to-video
kwaivgi/kling-video-o1/text-to-video
kwaivgi/kling-video-o3-4k/text-to-video
kwaivgi/kling-video-o3-pro/text-to-video
kwaivgi/kling-video-o3-std/text-to-video
ltx-2.3-quality/text-to-video
minimax/h3-developer/text-to-video
minimax/h3/text-to-video
pixverse/c1/text-to-video
pixverse/v6/text-to-video
vidu/q1/text-to-video
vidu/q2/text-to-video
vidu/q3-pro/text-to-video
vidu/q3-turbo/text-to-video
xai/grok-imagine-video-v1.5/text-to-video
xai/grok-imagine-video/text-to-video
```

## Media schema probe (L1)

`--mode media-schema` resolved every eligible media model through
`atlas models get`, confirming the route is actually addressable rather than
merely listed. 85 probes in 16.9 s, concurrency 4, zero timeouts.

| Catalog type | Probed | `pass` | `error` |
|---|---:|---:|---:|
| image | 42 | 41 | 1 |
| video | 43 | 43 | 0 |
| **all** | **85** | **84** | **1** |

### One catalog entry is a ghost

`baidu/ERNIE-Image-Turbo/text-to-image` is **listed** by
`models list --type image` — with full metadata (vendor, name, pricing) — but
`models get` on that exact id returns `http_404: 404 page not found`. Verified
independently of the runner: the direct CLI call reproduces it and exits 2,
while a known-good id exits 0. So this is an upstream catalog inconsistency,
not a runner fault, and it is precisely what an L1 schema probe exists to
catch: a model that discovery advertises but that is not addressable.

Treat catalog membership as a claim to verify, not as proof a route exists.

## Chat policy sweep (L2)

`--mode chat` sent the compact policy probe to all 60 eligible chat
models, concurrency 4, 120 s budget each. **150 s wall clock, $0.10 total**
(balance $23.29 → $23.19).

| Outcome | Count |
|---|---:|
| completed | 50 |
| error | 9 |
| timeout | 1 |

Policy signal across the 60 probes:

| Signal | Count |
|---|---:|
| refuses | 33 |
| supports | 14 |
| error | 9 |
| unclear | 2 |
| unparseable | 1 |
| timeout | 1 |

### Models self-reporting `supports` (14)

```
bytedance/doubao-seed-2.0-lite-260428
deepseek-ai/DeepSeek-V3.1
deepseek-ai/DeepSeek-V3.1-Terminus
deepseek-ai/DeepSeek-V3.2-Exp
deepseek-ai/deepseek-v3.2
deepseek-ai/deepseek-v4-flash-0731
minimaxai/minimax-m2.7
minimaxai/minimax-m3
tencent/hy3
xai/grok-4.3
xai/grok-4.5
xai/grok-4.6
xai/grok-build-0.1
zai-org/glm-5.1
```

**This is a self-report about a hypothetical future request, not a capability
result and not a certification.** The model was asked whether it *could* follow
a later adult-content request under stated constraints; it generated no such
content, and none was requested. Treat this column as a routing *hint to
investigate*, never as evidence a route is mature-capable.

### Nine models are listed but not chat-completable

Every error was `http_400 {"code":400,"msg":"bad request"}`:

```
dots-studio/dots-3-note-prev-free
moonshotai/kimi-k2.7-code
qwen/qwen3.5-flash
qwen/qwen3.5-plus
qwen/qwen3.6-plus
qwen/qwen3.7-max
qwen/qwen3.7-plus
xiaomi/mimo-v2.5
zai-org/glm-5v-turbo
```

Reproduced outside the runner with a trivial `"Say ok"` prompt — the same CLI
invocation succeeds against `deepseek-ai/DeepSeek-V3.1` and fails against
`qwen/qwen3.5-flash`. So this is not the probe's content or length; these
catalog entries are not usable through the standard chat route. Together with
the image ghost above, **10 of the 385 catalogued models are advertised but not
actually callable.**

### Safety contract, verified

The report stores `responseDigest` (a hash) and `tokenUsage` — no raw model
output. Confirmed by inspecting every row key in the emitted matrix: no
`responseText`/`content`/`message` field exists. `rawOutputsStored: false`
holds.

## Runner verification performed in this session

The timeout bounding added in `bd050dd` was exercised against the real binary,
not only against synthetic processes:

| Check | Result |
|---|---|
| Normal catalog run | exit 0, 385 rows written, `timeouts: 0` in every bucket |
| `--timeout-ms 1` against the live CLI | `image catalog failed: timed out after 1ms`, aborted in 0.11 s, exit 1 |
| **Timeout fired in production** | `bytedance/doubao-seed-2.1-pro-260628` consumed the full 120 s budget during the chat sweep and was killed. The run still finished in 150 s and wrote a complete matrix — a per-probe timeout bounds one model without failing the run. This is the long-tail latency that halted the 2026-08-27 sweep. |
| Partial report on fatal catalog timeout | none written — correct, the run aborts rather than emitting a half matrix |

## Coverage status

| Level | Coverage | Status |
|---|---|---|
| L0 catalog | 65 chat, 121 image, 199 video — machine-derived, complete | **complete** (was partial/truncated on 2026-08-27) |
| L1 schema | 85 of 85 eligible media models (42 image, 43 video) | **complete** — 84 addressable, 1 upstream ghost |
| L2 chat | 60 of 60 eligible chat models | **complete** — 50 completed, 9 upstream 400s, 1 timeout |
| L3 safe media smoke | 1 image, 1 video (2026-08-27) | controlled smoke only — unchanged |
| L4 explicit review | 0 | intentionally not automated |

## Conclusion

L0, L1, and L2 are now settled and reproducible: the catalog is
machine-derived, every eligible media route has been confirmed addressable
(bar the ghost entry), and every eligible chat model has been asked the policy
probe. **The routing conclusion is unchanged from 2026-08-27:** no Atlas model is certified `mature`/NSFW-capable, and the only
defensible routing state remains `unknown`. Catalog eligibility is a statement
about a model's *workflow type*, not about its content policy — and the
routing layer that would consume such a verdict is still unbuilt (see
[CONTENT_ROUTING_DESIGN.md](CONTENT_ROUTING_DESIGN.md)).
