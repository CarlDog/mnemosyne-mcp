# Atlas Cloud capability results — 2026-08-27

This is the initial live check. The durable, rerunnable matrix is produced by
[`scripts/atlas-capability-benchmark.mjs`](../scripts/atlas-capability-benchmark.mjs);
this note records what was actually observed in this session.

## Catalog discovery

Atlas Cloud reported the following live catalog totals through its model-list
tool:

| Catalog type | Models reported | Triage target |
|---|---:|---|
| Text/chat | 65 | story-suitable text chat; OCR/coding/note-specialized entries skipped |
| Image | 121 | text-to-image only; edit/3D/utility workflows skipped |
| Video | 196 | text-to-video only; image/reference/edit/avatar/utility workflows skipped |

The model-list response was display-truncated for the long image/video lists,
so the runner is designed to use the CLI's machine-readable catalog rather than
copying a truncated listing into source control.

## Evidence captured

| Model | Capability | Probe | Result | Interpretation |
|---|---|---|---|---|
| `deepseek-ai/deepseek-v4-flash-0731` | chat | compact policy probe | `no_final` (`finish_reason=length`) | inconclusive; the model consumed the output budget before returning a label |
| `google/gemini-3.1-flash-lite` | chat | compact policy probe | `REFUSES` | provider/model self-report refuses a future direct adult-content request; not a media result |
| `qwen-image-3.0-pro/text-to-image` | image | model schema inspection | pass | text-to-image route exists; schema supported the later smoke |
| `alibaba/wan-3.0/text-to-video` | video | model schema inspection | pass | text-to-video route exists; schema supported the later smoke |
| `qwen-image-3.0-pro/text-to-image` | image | controlled safe-media smoke | `completed` ($0.04, 29.1s) | non-graphic adult-romance prompt completed; no NSFW flag was reported |
| `alibaba/wan-3.0/text-to-video` | video | controlled safe-media smoke | `completed` ($0.08, 3m23s, 2.0s output) | non-graphic adult-romance prompt completed; no NSFW flag was reported |

Only one image and one video generation job were submitted in this initial
check. The safe smoke prompt is useful for route health, but it cannot
establish explicit NSFW capability, and broad media generation across the live
catalog would spend credits without answering that question safely.

## Current conclusion

Atlas is viable as a catalog and schema source, but this session does not
certify any Atlas model as `mature`/NSFW-capable. The only defensible routing
state from these observations is `unknown` until a terms-compliant, operator-
authorized private review is performed and recorded as a redacted observation.

## Coverage status

| Level | Current coverage | Status |
|---|---|---|
| L0 catalog | 65 text, 121 image, 196 video reported | complete totals; long lists were display-truncated |
| L1 schema | 2 representative text-to-media models | partial |
| L2 chat | 2 retained evidence rows; a broader sweep was halted after long-tail latency | partial |
| L3 safe media smoke | 1 image and 1 video | controlled smoke only |
| L4 explicit review | 0 | intentionally not automated |

The full all-model run is intentionally left to the CLI runner rather than
being represented by guessed pass/fail values. The local `atlas` executable is
not installed in this checkout, and the connector's long-running batch did not
return a stable retained matrix before it was stopped. Models not represented
by an evidence row remain `not_run`/`unknown`, never an implicit pass.
