import type { ContinuationPort } from "../application/ports/continuation.js";
import type { AdmissionMode } from "../context-plan.js";
import { capabilityWarnings } from "../capabilities.js";
import { saveEntity, retagValidation } from "../entities.js";
import type { LlmProvider } from "../llm.js";
import {
  DEFAULT_MAX_TOKENS,
  NUM_CTX_MARGIN_TOKENS,
  OllamaProvider,
} from "../llm.js";
import { log } from "../log.js";
import type { OcClient } from "../oc-client.js";
import {
  buildSystemPrompt,
  gatherContext,
  renderAdmittedBundle,
} from "../prompt.js";
import { findStory } from "../stories.js";
import { validateContentWithUsage } from "../validator.js";

function admissionModeFromEnv(): AdmissionMode {
  const raw = (process.env.MNEMO_CONTEXT_ADMISSION ?? "").trim().toLowerCase();
  if (raw === "" || raw === "warn") return "warn";
  if (raw === "enforce") return "enforce";
  log.warn("context-plan", "unrecognized MNEMO_CONTEXT_ADMISSION; using warn", {
    value: raw,
  });
  return "warn";
}

function logCalibration(
  estimatedTokens: number,
  reportedTokens: number | undefined,
): void {
  if (reportedTokens === undefined) return;
  log.info("context-plan", "estimator calibration", {
    est_tokens: estimatedTokens,
    reported_input_tokens: reportedTokens,
    delta_pct:
      reportedTokens > 0
        ? Math.round(
            ((estimatedTokens - reportedTokens) / reportedTokens) * 100,
          )
        : 0,
  });
}

export function createContinuationAdapter(
  oc: OcClient,
  generator: LlmProvider,
  validator: LlmProvider,
): ContinuationPort {
  return {
    generatorName: generator.name,
    admissionMode: admissionModeFromEnv(),
    defaultMaxTokens: DEFAULT_MAX_TOKENS,
    contextMarginTokens: NUM_CTX_MARGIN_TOKENS,
    gatherContext: (storyId, direction, options) =>
      gatherContext(oc, storyId, direction, options),
    effectiveContextWindow: async (model) => {
      if (!(generator instanceof OllamaProvider)) return undefined;
      const window = await generator.getEffectiveContextWindow(model);
      return typeof window === "number" ? window : undefined;
    },
    buildSystemPrompt,
    renderAdmittedContext: renderAdmittedBundle,
    capabilityWarnings: (options) =>
      capabilityWarnings(generator.name, options),
    storyKindroidTarget: async (storyId) =>
      (await findStory(oc, storyId))?.kindroid_target,
    generate: (options) => generator.generate(options),
    saveScene: async (storyId, name, body) => {
      const saved = await saveEntity(oc, storyId, {
        type: "scene",
        name,
        body,
      });
      return { memory_id: saved.memory_id, tags: saved.tags };
    },
    validate: (context, content) =>
      validateContentWithUsage(validator, context, content),
    retagValidation: async (memoryId, tags, verdict) => {
      await retagValidation(oc, memoryId, tags, verdict);
    },
    nowIso: () => new Date().toISOString(),
    calibration: logCalibration,
    warn: (event, message, fields) => log.warn(event, message, fields),
  };
}
