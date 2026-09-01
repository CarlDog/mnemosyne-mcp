// Run outcomes & cancellation (docs/RUN_OUTCOMES_DESIGN.md, ratified
// 2026-08-28), slices 1-2. Pinned here:
//   1. A pre-aborted run performs zero OC calls and zero generations and
//      surfaces rejected_before_dispatch (retry-safe).
//   2. The ratified disconnect semantics: a generation DISPATCHED, then
//      disconnected, still completes and saves -- the abort signal is
//      never consulted after the generate dispatch.
//   3. canon_write_unknown: a dispatched-save failure is success-shaped
//      with the beat text preserved; a provably-pre-dispatch (rate-limit
//      rejection) failure stays a plainly retryable save_error.
//   4. The REST error handler maps RunOutcomeError to the ratified status
//      map and projection instead of internal_error.
//   5. Companion producers carry their outcomes: Botify's readback throws
//      are completed_but_readback_failed.

import { describe, it, expect, vi } from "vitest";
import type { Response, Request, NextFunction } from "express";
import { continueScene } from "./helpers/application.js";
import { makeRunContext } from "../src/run-context.js";
import {
  RunOutcomeError,
  OUTCOME_HTTP_STATUS,
  assertNotAborted,
} from "../src/run-outcome.js";
import { apiErrorHandler } from "../src/api/helpers.js";
import { extractBotReply } from "../src/botify-client.js";
import type { OcClient, OcMemory } from "../src/oc-client.js";
import type { LlmProvider } from "../src/llm.js";

const STORY_ID = "11111111-2222-4333-8444-555555555555";

function recordingOc(opts?: { saveError?: string }): {
  oc: OcClient;
  searchCalls: number;
  saveCalls: number;
} {
  const state = {
    oc: undefined as unknown as OcClient,
    searchCalls: 0,
    saveCalls: 0,
  };
  state.oc = {
    memorySearch: async () => {
      state.searchCalls += 1;
      return [];
    },
    memoryList: async () => [],
    memorySave: async () => {
      state.saveCalls += 1;
      if (opts?.saveError) throw new Error(opts.saveError);
      return {
        id: "saved-1",
        content: "",
        project_id: STORY_ID,
        tags: [],
        pinned: false,
        created_at: "2026-01-01T00:00:00Z",
      } satisfies OcMemory;
    },
  } as unknown as OcClient;
  return state;
}

const stubGenerator = (generate: LlmProvider["generate"]): LlmProvider => ({
  name: "stub-generator",
  generate,
});

const neverValidator: LlmProvider = {
  name: "stub-validator",
  generate: async () => {
    throw new Error("validator must not run in these tests");
  },
};

const baseOpts = {
  direction: "go on",
  sceneStrategy: "query-ranked" as const,
  reinvokeHint: "call again",
};

describe("phase-boundary aborts", () => {
  it("a pre-aborted run performs zero OC calls and zero generations", async () => {
    const rec = recordingOc();
    const abort = new AbortController();
    abort.abort();
    const generate = vi.fn();
    await expect(
      continueScene(
        rec.oc,
        stubGenerator(generate as unknown as LlmProvider["generate"]),
        neverValidator,
        STORY_ID,
        baseOpts,
        makeRunContext("rest", { storyId: STORY_ID, signal: abort.signal }),
      ),
    ).rejects.toMatchObject({
      outcome: "rejected_before_dispatch",
      retry_safe: true,
      dispatch_attempted: false,
    });
    expect(rec.searchCalls).toBe(0);
    expect(rec.saveCalls).toBe(0);
    expect(generate).not.toHaveBeenCalled();
  });

  it("an abort AFTER gather but before dispatch stops before the generator", async () => {
    const rec = recordingOc();
    const abort = new AbortController();
    const generate = vi.fn();
    // Abort during gather: the recording OC's first search aborts.
    (
      rec.oc as unknown as { memorySearch: () => Promise<OcMemory[]> }
    ).memorySearch = async () => {
      abort.abort();
      return [];
    };
    await expect(
      continueScene(
        rec.oc,
        stubGenerator(generate as unknown as LlmProvider["generate"]),
        neverValidator,
        STORY_ID,
        baseOpts,
        makeRunContext("rest", { storyId: STORY_ID, signal: abort.signal }),
      ),
    ).rejects.toMatchObject({ outcome: "rejected_before_dispatch" });
    expect(generate).not.toHaveBeenCalled();
    expect(rec.saveCalls).toBe(0);
  });

  it("a generation DISPATCHED then disconnected still completes and saves (ratified semantics)", async () => {
    const rec = recordingOc();
    const abort = new AbortController();
    const generator = stubGenerator(async () => {
      // The caller disconnects while the generation is in flight.
      abort.abort();
      return { text: "A finished beat.", complete: true };
    });
    const result = await continueScene(
      rec.oc,
      generator,
      neverValidator,
      STORY_ID,
      baseOpts,
      makeRunContext("rest", { storyId: STORY_ID, signal: abort.signal }),
    );
    expect(rec.saveCalls).toBe(1);
    expect(result.memory_id).toBe("saved-1");
    expect(result.run_id).toMatch(/[0-9a-f-]{36}/);
  });
});

describe("canon_write_unknown", () => {
  it("a dispatched-save failure is success-shaped with the beat preserved", async () => {
    const rec = recordingOc({ saveError: "fetch failed: socket hang up" });
    const result = await continueScene(
      rec.oc,
      stubGenerator(async () => ({ text: "An expensive beat." })),
      neverValidator,
      STORY_ID,
      baseOpts,
    );
    expect(result.canon_write_outcome).toBe("unknown");
    expect(result.beat_text).toBe("An expensive beat.");
    expect(result.save_error).toMatch(/socket hang up/);
  });

  it("a provably pre-dispatch (rate-limit) failure stays a plain retryable save_error", async () => {
    const rec = recordingOc({
      saveError: "memory_save failed: rate limit exceeded, retry later",
    });
    const result = await continueScene(
      rec.oc,
      stubGenerator(async () => ({ text: "A beat." })),
      neverValidator,
      STORY_ID,
      baseOpts,
    );
    expect(result.canon_write_outcome).toBeUndefined();
    expect(result.save_error).toMatch(/rate limit/);
  });
});

describe("REST error mapping", () => {
  function fakeRes(): Response & { statusCode?: number; body?: unknown } {
    const res: Record<string, unknown> = { path: "/x" };
    res.status = (code: number) => {
      res.statusCode = code;
      return res;
    };
    res.json = (body: unknown) => {
      res.body = body;
      return res;
    };
    return res as unknown as Response & { statusCode?: number; body?: unknown };
  }

  it("maps a RunOutcomeError to the ratified status + projection", () => {
    const res = fakeRes();
    const err = new RunOutcomeError(
      "provider_dispatch_unknown",
      "kindroid_advance_group timed out -- do NOT retry blindly",
    );
    apiErrorHandler(
      err,
      { path: "/api/stories/x/continue" } as Request,
      res,
      (() => {}) as NextFunction,
    );
    expect(res.statusCode).toBe(502);
    expect(res.body).toMatchObject({
      error: "provider_dispatch_unknown",
      retry_safe: false,
      dispatch_attempted: true,
      external_conversation_mutation_possible: true,
    });
    expect((res.body as { message: string }).message).toMatch(/do NOT retry/);
  });

  it("non-typed errors keep the internal_error behavior", () => {
    const res = fakeRes();
    apiErrorHandler(
      new Error("boom"),
      { path: "/x" } as Request,
      res,
      (() => {}) as NextFunction,
    );
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: "internal_error" });
  });

  it("no retry_safe:false outcome maps to a generically-retried status", () => {
    for (const [outcome, status] of Object.entries(OUTCOME_HTTP_STATUS)) {
      const err = new RunOutcomeError(
        outcome as keyof typeof OUTCOME_HTTP_STATUS,
        "x",
      );
      if (!err.retry_safe) {
        expect([502]).toContain(status);
      }
    }
  });
});

describe("lifecycle (slice 3)", () => {
  it("OC rate-limit backoff aborts promptly on the run signal", async () => {
    const { OcClient } = await import("../src/oc-client.js");
    const oc = new OcClient(new URL("http://127.0.0.1:1"));
    // Bypass the network: pretend connected, and make every tool call a
    // rate-limit rejection so the backoff path engages.
    (oc as unknown as { connected: boolean }).connected = true;
    (oc as unknown as { client: unknown }).client = {
      callTool: async () => {
        throw new Error("Error executing tool memory_search: rate limit");
      },
    };
    const abort = new AbortController();
    setTimeout(() => abort.abort(), 50);
    const start = Date.now();
    await expect(
      oc.memorySearch({ query: "x", signal: abort.signal }),
    ).rejects.toMatchObject({ outcome: "rejected_before_dispatch" });
    // First backoff sleep alone is 1000ms; prompt abort must beat it.
    expect(Date.now() - start).toBeLessThan(900);
  });

  it("concurrent config writes serialize into a valid file (atomic rename)", async () => {
    const { promises: fs } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const savedDataDir = process.env.MNEMO_DATA_DIR;
    const dir = await fs.mkdtemp(join(tmpdir(), "mnemo-atomic-cfg-"));
    process.env.MNEMO_DATA_DIR = dir;
    try {
      const { setCurrentStoryId, getCurrentStoryId } =
        await import("../src/config.js");
      await Promise.all([
        setCurrentStoryId("11111111-2222-4333-8444-555555555551"),
        setCurrentStoryId("11111111-2222-4333-8444-555555555552"),
        setCurrentStoryId("11111111-2222-4333-8444-555555555553"),
      ]);
      // Whatever won, the file parses and no temp sibling is left behind.
      const winner = await getCurrentStoryId();
      expect(winner).toMatch(/^11111111-2222-4333-8444-55555555555[123]$/);
      const leftovers = (await fs.readdir(dir)).filter((f) =>
        f.includes(".tmp-"),
      );
      expect(leftovers).toEqual([]);
    } finally {
      if (savedDataDir === undefined) delete process.env.MNEMO_DATA_DIR;
      else process.env.MNEMO_DATA_DIR = savedDataDir;
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});

describe("companion producers", () => {
  it("Botify readback throws are completed_but_readback_failed", () => {
    for (const payload of [
      { trigger_warning: "inference 500" },
      { bot_message: null },
      {},
    ]) {
      try {
        extractBotReply(payload);
        expect.unreachable("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(RunOutcomeError);
        expect((err as RunOutcomeError).outcome).toBe(
          "completed_but_readback_failed",
        );
        expect((err as RunOutcomeError).retry_safe).toBe(false);
      }
    }
  });

  it("assertNotAborted is a no-op on a live signal", () => {
    expect(() =>
      assertNotAborted(makeRunContext("mcp"), "anything"),
    ).not.toThrow();
  });
});
