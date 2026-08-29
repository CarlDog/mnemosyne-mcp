// Typed, replay-safe run outcomes (docs/RUN_OUTCOMES_DESIGN.md, ratified
// 2026-08-28). The REST layer used to collapse every thrown error into
// `internal_error`, destroying e.g. Kindroid's "do NOT retry, the message
// may already be posted" instruction. Each outcome carries the projection a
// caller needs to decide whether retrying is safe -- Mnemosyne can prove
// dispatch was ATTEMPTED; it cannot generally prove a remote provider began
// execution, which is why the ambiguous outcomes exist.
//
// `canon_write_unknown` is deliberately NOT here: a dispatched-save failure
// happens when the beat text already exists, and throwing would discard it
// (the no-prose logging rule also forbids carrying it in an error). It is a
// success-shaped field on ContinueSceneResult instead.

import type { RunContext } from "./run-context.js";

export type ThrowableRunOutcome =
  | "rejected_before_dispatch"
  | "timeout_before_dispatch"
  | "provider_dispatch_unknown"
  | "completed_but_readback_failed";

interface OutcomeProjection {
  retry_safe: boolean;
  dispatch_attempted: boolean;
  provider_charge_possible: boolean;
  external_conversation_mutation_possible: boolean;
}

// The assessment's table, verbatim (mutation possibility is reported as
// the worst case "provider-dependent" -> true for dispatch-unknown; the
// producer may narrow it via the constructor's override).
const PROJECTIONS: Record<ThrowableRunOutcome, OutcomeProjection> = {
  rejected_before_dispatch: {
    retry_safe: true,
    dispatch_attempted: false,
    provider_charge_possible: false,
    external_conversation_mutation_possible: false,
  },
  timeout_before_dispatch: {
    retry_safe: true,
    dispatch_attempted: false,
    provider_charge_possible: false,
    external_conversation_mutation_possible: false,
  },
  provider_dispatch_unknown: {
    retry_safe: false,
    dispatch_attempted: true,
    provider_charge_possible: true,
    external_conversation_mutation_possible: true,
  },
  completed_but_readback_failed: {
    retry_safe: false,
    dispatch_attempted: true,
    provider_charge_possible: true,
    external_conversation_mutation_possible: true,
  },
};

// Ratified status map: no retry_safe:false outcome may return a status
// generic clients auto-retry.
export const OUTCOME_HTTP_STATUS: Record<ThrowableRunOutcome, number> = {
  rejected_before_dispatch: 400,
  timeout_before_dispatch: 400,
  provider_dispatch_unknown: 502,
  completed_but_readback_failed: 502,
};

export class RunOutcomeError extends Error {
  readonly outcome: ThrowableRunOutcome;
  readonly retry_safe: boolean;
  readonly dispatch_attempted: boolean;
  readonly provider_charge_possible: boolean;
  readonly external_conversation_mutation_possible: boolean;

  constructor(
    outcome: ThrowableRunOutcome,
    message: string,
    opts?: {
      cause?: unknown;
      /** Narrow the table's worst-case mutation answer when the producer
       * knows better (e.g. a DIRECT provider's dispatch-unknown cannot
       * have mutated a conversation). */
      externalMutationPossible?: boolean;
    },
  ) {
    super(message, opts?.cause !== undefined ? { cause: opts.cause } : {});
    this.name = "RunOutcomeError";
    this.outcome = outcome;
    const p = PROJECTIONS[outcome];
    this.retry_safe = p.retry_safe;
    this.dispatch_attempted = p.dispatch_attempted;
    this.provider_charge_possible = p.provider_charge_possible;
    this.external_conversation_mutation_possible =
      opts?.externalMutationPossible ??
      p.external_conversation_mutation_possible;
  }
}

/** Phase-boundary abort check (docs/RUN_OUTCOMES_DESIGN.md: the signal is
 * consulted before gather and before the generate dispatch -- never after
 * a generation has been dispatched, so a disconnected caller's beat still
 * completes and saves). */
export function assertNotAborted(run: RunContext, phase: string): void {
  if (run.signal.aborted) {
    throw new RunOutcomeError(
      "rejected_before_dispatch",
      `run aborted before ${phase} (caller disconnected or shutdown began); ` +
        "nothing was dispatched -- safe to retry",
    );
  }
}
