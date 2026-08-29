// Run identity + cancellation context (docs/RUN_OUTCOMES_DESIGN.md,
// ratified 2026-08-28). Correlation only -- there is deliberately no run
// registry, lane, or snapshot store behind this (rejected at triage).
//
// Each surface supplies only the SIGNAL; the full RunContext is assembled
// inside the handler once resolveStoryId has run (the surface cannot know
// the story id, and story-less tools have none).

import { randomUUID } from "node:crypto";

export interface RunContext {
  /** crypto.randomUUID(); surfaced as `run_id` on success responses so a
   * caller can correlate a completed run with server logs. */
  runId: string;
  storyId?: string;
  surface: "mcp" | "rest";
  signal: AbortSignal;
}

/** Build a RunContext. `signal` defaults to a never-aborting signal so
 * direct callers (unit tests, scripts) need no ceremony. */
export function makeRunContext(
  surface: RunContext["surface"],
  opts?: { storyId?: string; signal?: AbortSignal },
): RunContext {
  return {
    runId: randomUUID(),
    surface,
    ...(opts?.storyId !== undefined && { storyId: opts.storyId }),
    signal: opts?.signal ?? new AbortController().signal,
  };
}
