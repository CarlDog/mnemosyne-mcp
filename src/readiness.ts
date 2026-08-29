// Semantic readiness, separate from liveness
// (docs/NEMOCLAW_ADOPTION_ASSESSMENT.md §3). The public /health endpoint is
// deliberately cheap process liveness and always says ok -- it cannot report
// a dropped OC connection, a missing generator model, or an absent validator
// tag. This prober answers the semantic question behind the protected
// /api/status surface, with three hard rules:
//   - every probe is NON-MUTATING and NON-BILLABLE (OC/companions: bounded
//     tools/list discovery; Ollama: /api/show; cloud providers: no free
//     probe exists, so they report `not_probed` -- never `ready`);
//   - a failed or absent probe is `unavailable`/`not_probed`, never
//     coerced to ready;
//   - results are cached for a short TTL so repeated deployment polls
//     cannot turn into probe storms.
// Statuses are ready | unavailable | not_probed; `degraded` from the
// assessment's vocabulary is unused until a partial state actually exists.

import type { OcClient } from "./oc-client.js";
import type { LlmProvider } from "./llm.js";
import { log } from "./log.js";

export type ReadinessStatus = "ready" | "unavailable" | "not_probed";

export interface DependencyReadiness {
  status: ReadinessStatus;
  /** Actionable, canon-free reason for unavailable/not_probed. */
  reason?: string;
}

export interface ReadinessReport {
  /** When this report's probes actually ran (a cached report keeps its
   * original observation time, so staleness is visible). */
  checked_at: string;
  openchronicle: DependencyReadiness;
  generator: DependencyReadiness & { provider: string };
  validator: DependencyReadiness;
}

const CACHE_TTL_MS = 15_000;

async function probeDependency(
  name: string,
  check: (() => Promise<void>) | undefined,
  notProbedReason: string,
): Promise<DependencyReadiness> {
  if (check === undefined) {
    return { status: "not_probed", reason: notProbedReason };
  }
  try {
    await check();
    return { status: "ready" };
  } catch (err) {
    const reason = (err as Error).message;
    log.warn("readiness", "dependency unavailable", { dependency: name });
    return { status: "unavailable", reason };
  }
}

export interface ReadinessProber {
  probe(): Promise<ReadinessReport>;
}

export function createReadinessProber(deps: {
  oc: OcClient;
  generator: LlmProvider;
  validator: LlmProvider;
}): ReadinessProber {
  let cached: { report: ReadinessReport; at: number } | undefined;

  return {
    async probe(): Promise<ReadinessReport> {
      if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
        return cached.report;
      }
      const checkedAt = new Date().toISOString();
      const [openchronicle, generator, validator] = await Promise.all([
        probeDependency("openchronicle", () => deps.oc.checkReady(), ""),
        probeDependency(
          `generator:${deps.generator.name}`,
          deps.generator.checkReady?.bind(deps.generator),
          `the ${deps.generator.name} provider has no free probe -- a real ` +
            "check is a billable call, so readiness is not asserted",
        ),
        probeDependency(
          "validator",
          deps.validator.checkReady?.bind(deps.validator),
          "the validator provider exposes no probe",
        ),
      ]);
      const report: ReadinessReport = {
        checked_at: checkedAt,
        openchronicle,
        generator: { provider: deps.generator.name, ...generator },
        validator,
      };
      cached = { report, at: Date.now() };
      return report;
    },
  };
}
