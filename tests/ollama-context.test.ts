// computeNumCtx: the auto-sizing that keeps a fully-imported story's
// ~16k-token prompt from silently truncating at Ollama's ~4k default —
// the live failure mode is confident word salad, observed on the first
// mnemo_continue against Chaos Saga (2026-08-22).

import { describe, it, expect } from "vitest";
import { computeNumCtx } from "../src/llm.js";

describe("computeNumCtx (pure)", () => {
  it("never sizes below Ollama's own default window", () => {
    const plan = computeNumCtx(1_000, 2048);
    expect(plan.numCtx).toBe(4096);
    expect(plan.capped).toBe(false);
  });

  it("sizes up to fit a large prompt plus the generation budget", () => {
    // The real Chaos Saga case: ~60k chars ≈ ~17.2k tokens estimated.
    const plan = computeNumCtx(60_007, 2048);
    expect(plan.estPromptTokens).toBe(Math.ceil(60_007 / 3.5));
    expect(plan.numCtx).toBeGreaterThan(plan.estPromptTokens + 2048);
    expect(plan.numCtx).toBeLessThanOrEqual(32_768);
    expect(plan.capped).toBe(false);
  });

  it("caps at the configured maximum and reports the squeeze", () => {
    const plan = computeNumCtx(200_000, 2048, 32_768);
    expect(plan.numCtx).toBe(32_768);
    expect(plan.capped).toBe(true);
  });

  it("honors a lowered cap for small-trained-context models", () => {
    // An operator running a llama2-era 4k model caps the window at the
    // model's trained size; a big prompt is then reported as capped
    // (the warning tells them why quality will degrade) instead of
    // silently over-stretching RoPE.
    const plan = computeNumCtx(60_007, 2048, 4_096);
    expect(plan.numCtx).toBe(4_096);
    expect(plan.capped).toBe(true);
  });
});
