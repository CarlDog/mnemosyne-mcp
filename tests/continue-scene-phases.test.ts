// Focused unit coverage for continueScene's phase-boundary behavior
// (src/application/continue-scene.ts, split into named phase functions
// 2026-09-08 -- phase-end audit) using a fully hand-built ContinuationPort
// mock, no real OC or LLM needed. Fills a real gap: no existing test
// exercised the positionApplied-relabeling catch in continueScene itself
// (tests/continue-position.test.ts's "not rolled back when generation
// fails" case goes through a LATER phase -- generate -- which the relabel
// catch doesn't even wrap; nothing previously drove a gather-phase
// RunOutcomeError after a landed position write). Written specifically to
// verify the 2026-09-08 phase-function split preserved this exact
// behavior, and to close the coverage gap going forward.

import { describe, it, expect, vi } from "vitest";
import { continueScene } from "../src/application/continue-scene.js";
import { makeRunContext } from "../src/run-context.js";
import { RunOutcomeError } from "../src/run-outcome.js";
import type { ContinuationPort } from "../src/application/ports/continuation.js";
import type { ContextBundle } from "../src/application/model.js";

const EMPTY_CONTEXT: ContextBundle = {
  rules: [],
  style: [],
  characters: [],
  locations: [],
  scenes: [],
  lore: [],
  worldbuilding: [],
};

/** Every method throws by default -- a test that reaches an un-overridden
 * method fails loudly instead of silently returning something plausible. */
function basePort(overrides: Partial<ContinuationPort> = {}): ContinuationPort {
  const unexpected = (name: string) => async () => {
    throw new Error(`unexpected call: ${name}`);
  };
  return {
    generatorName: "ollama",
    contentCapability: "sfw",
    admissionMode: "warn",
    defaultMaxTokens: 512,
    contextMarginTokens: 0,
    gatherContext: vi.fn(unexpected("gatherContext")),
    effectiveContextWindow: vi.fn(async () => undefined),
    buildSystemPrompt: vi.fn(() => ""),
    renderAdmittedContext: vi.fn((context: ContextBundle) => context),
    capabilityWarnings: vi.fn(() => []),
    storyBinding: vi.fn(async () => ({})),
    applyPosition: vi.fn(unexpected("applyPosition")),
    generate: vi.fn(unexpected("generate")),
    saveScene: vi.fn(unexpected("saveScene")),
    validate: vi.fn(unexpected("validate")),
    retagValidation: vi.fn(async () => {}),
    nowIso: vi.fn(() => "2026-01-01T00:00:00.000Z"),
    calibration: vi.fn(() => {}),
    warn: vi.fn(() => {}),
    ...overrides,
  };
}

describe("continueScene position-write relabeling (gatherAndPlan phase)", () => {
  it("relabels a gather-phase RunOutcomeError as retry_safe:false when a position write already landed", async () => {
    const controller = new AbortController();
    const run = makeRunContext("mcp", {
      storyId: "story-1",
      signal: controller.signal,
    });
    const port = basePort({
      applyPosition: vi.fn(async () => {
        // succeeds -- positionApplied becomes true
      }),
      // Abort mid-gather, simulating a caller disconnect after the
      // position write landed but before generation was dispatched.
      // gatherAndPlan's own trailing assertNotAborted("the generate
      // dispatch") then throws RunOutcomeError, which continueScene's
      // wrapping catch must relabel since positionApplied is true.
      gatherContext: vi.fn(async () => {
        controller.abort();
        return EMPTY_CONTEXT;
      }),
    });

    let caught: unknown;
    try {
      await continueScene(
        port,
        "story-1",
        {
          direction: "go on",
          sceneStrategy: "recency-first",
          reinvokeHint: "call again",
          advance: { hours: 5 },
        },
        run,
      );
      throw new Error("expected continueScene to throw");
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(RunOutcomeError);
    const err = caught as RunOutcomeError;
    expect(err.outcome).toBe("rejected_before_dispatch");
    expect(err.retry_safe).toBe(false);
    expect(err.message).toContain("already applied to the story's position");
    expect(err.message).toContain("was NOT rolled back");
    expect(err.message).toContain("mnemo_position_get");
    // The relabel wraps the ORIGINAL message too, not just appends boilerplate.
    expect(err.message).toContain("run aborted before the generate dispatch");

    // Confirm the phases after gather genuinely never ran.
    expect(port.generate).not.toHaveBeenCalled();
    expect(port.saveScene).not.toHaveBeenCalled();
  });

  it("does NOT relabel the same abort when no position update was requested (positionApplied stays false)", async () => {
    const controller = new AbortController();
    const run = makeRunContext("mcp", {
      storyId: "story-1",
      signal: controller.signal,
    });
    const port = basePort({
      // No advance/setDate/moveTo in opts below, so applyPosition must
      // never even be called (the pre-check in applyPositionIfRequested).
      gatherContext: vi.fn(async () => {
        controller.abort();
        return EMPTY_CONTEXT;
      }),
    });

    let caught: unknown;
    try {
      await continueScene(
        port,
        "story-1",
        {
          direction: "go on",
          sceneStrategy: "recency-first",
          reinvokeHint: "call again",
        },
        run,
      );
      throw new Error("expected continueScene to throw");
    } catch (err) {
      caught = err;
    }

    expect(port.applyPosition).not.toHaveBeenCalled();
    expect(caught).toBeInstanceOf(RunOutcomeError);
    const err = caught as RunOutcomeError;
    // Unrelabeled: the plain abort message, no position-write postscript,
    // and the table's stock retry_safe (true) for rejected_before_dispatch
    // stands untouched.
    expect(err.message).not.toContain(
      "already applied to the story's position",
    );
    expect(err.retry_safe).toBe(true);
  });

  it("does NOT relabel a non-RunOutcomeError even when a position write landed", async () => {
    const run = makeRunContext("mcp", { storyId: "story-1" });
    const port = basePort({
      applyPosition: vi.fn(async () => {
        // succeeds -- positionApplied becomes true
      }),
      gatherContext: vi.fn(async () => {
        throw new Error("network exploded, not a RunOutcomeError");
      }),
    });

    await expect(
      continueScene(
        port,
        "story-1",
        {
          direction: "go on",
          sceneStrategy: "recency-first",
          reinvokeHint: "call again",
          advance: { hours: 5 },
        },
        run,
      ),
    ).rejects.toThrow("network exploded, not a RunOutcomeError");
  });

  it("applyPositionIfRequested returns false and skips the OC call when none of advance/setDate/moveTo is given", async () => {
    const run = makeRunContext("mcp", { storyId: "story-1" });
    const port = basePort({
      gatherContext: vi.fn(async () => EMPTY_CONTEXT),
      generate: vi.fn(async () => ({ text: "" })), // empty -> group-yield path, cheapest valid return
    });

    const result = await continueScene(
      port,
      "story-1",
      {
        direction: "go on",
        sceneStrategy: "recency-first",
        reinvokeHint: "call again",
      },
      run,
    );

    expect(port.applyPosition).not.toHaveBeenCalled();
    expect(result.yielded_to_user).toBe(true);
  });
});

describe("content-routing gate (docs/CONTENT_ROUTING_DESIGN.md, ratified 2026-09-08)", () => {
  function contextWith(
    contentRating: "sfw" | "nsfw" | undefined,
  ): ContextBundle {
    return {
      ...EMPTY_CONTEXT,
      ...(contentRating && { content_rating: contentRating }),
    };
  }

  it("refuses before dispatch when an nsfw-rated story hits an sfw-only provider", async () => {
    const generate = vi.fn(async () => {
      throw new Error("unexpected call: generate");
    });
    const port = basePort({
      contentCapability: "sfw",
      gatherContext: vi.fn(async () => contextWith("nsfw")),
      generate,
    });

    await expect(
      continueScene(port, "story-1", {
        direction: "go on",
        sceneStrategy: "recency-first",
        reinvokeHint: "call again",
      }),
    ).rejects.toMatchObject({
      outcome: "rejected_before_dispatch",
      retry_safe: true,
      message: expect.stringContaining("requires an nsfw content rating"),
    });
    expect(generate).not.toHaveBeenCalled();
  });

  it("succeeds when an nsfw-rated story hits an nsfw-capable provider", async () => {
    const port = basePort({
      contentCapability: "nsfw",
      gatherContext: vi.fn(async () => contextWith("nsfw")),
      generate: vi.fn(async () => ({ text: "A beat." })),
      saveScene: vi.fn(async () => ({ memory_id: "m1", tags: [] })),
    });

    const result = await continueScene(port, "story-1", {
      direction: "go on",
      sceneStrategy: "recency-first",
      reinvokeHint: "call again",
    });
    expect(result.beat_text).toBe("A beat.");
  });

  it("succeeds when an sfw-rated story hits an sfw-only provider (the common case)", async () => {
    const port = basePort({
      contentCapability: "sfw",
      gatherContext: vi.fn(async () => contextWith("sfw")),
      generate: vi.fn(async () => ({ text: "A beat." })),
      saveScene: vi.fn(async () => ({ memory_id: "m1", tags: [] })),
    });

    const result = await continueScene(port, "story-1", {
      direction: "go on",
      sceneStrategy: "recency-first",
      reinvokeHint: "call again",
    });
    expect(result.beat_text).toBe("A beat.");
    expect(result.content_rating_declared).toBeUndefined();
  });

  it("never blocks an undeclared rating, regardless of provider capability, and surfaces content_rating_declared:false", async () => {
    for (const contentCapability of ["sfw", "nsfw"] as const) {
      const port = basePort({
        contentCapability,
        gatherContext: vi.fn(async () => contextWith(undefined)),
        generate: vi.fn(async () => ({ text: "A beat." })),
        saveScene: vi.fn(async () => ({ memory_id: "m1", tags: [] })),
      });

      const result = await continueScene(port, "story-1", {
        direction: "go on",
        sceneStrategy: "recency-first",
        reinvokeHint: "call again",
      });
      expect(result.beat_text).toBe("A beat.");
      expect(result.content_rating_declared).toBe(false);
    }
  });

  it("content_rating_declared:false also appears on the group-yield early return", async () => {
    const port = basePort({
      contentCapability: "sfw",
      gatherContext: vi.fn(async () => contextWith(undefined)),
      generate: vi.fn(async () => ({ text: "" })), // empty -> group-yield path
    });

    const result = await continueScene(port, "story-1", {
      direction: "go on",
      sceneStrategy: "recency-first",
      reinvokeHint: "call again",
    });
    expect(result.yielded_to_user).toBe(true);
    expect(result.content_rating_declared).toBe(false);
  });

  it("relabels the gate's refusal retry_safe:false when a position write already landed this call", async () => {
    const port = basePort({
      contentCapability: "sfw",
      applyPosition: vi.fn(async () => {
        // succeeds -- positionApplied becomes true
      }),
      gatherContext: vi.fn(async () => contextWith("nsfw")),
      generate: vi.fn(async () => {
        throw new Error("unexpected call: generate");
      }),
    });

    let caught: unknown;
    try {
      await continueScene(port, "story-1", {
        direction: "go on",
        sceneStrategy: "recency-first",
        reinvokeHint: "call again",
        advance: { hours: 5 },
      });
      throw new Error("expected continueScene to throw");
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(RunOutcomeError);
    const err = caught as RunOutcomeError;
    expect(err.outcome).toBe("rejected_before_dispatch");
    expect(err.retry_safe).toBe(false);
    expect(err.message).toContain("requires an nsfw content rating");
    expect(err.message).toContain("already applied to the story's position");
    expect(err.message).toContain("was NOT rolled back");
  });
});
