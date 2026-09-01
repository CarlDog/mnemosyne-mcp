import type { ContinuationPort } from "../application/ports/continuation.js";
import { admissionModeFromEnv, logCalibration } from "../context-plan.js";
import { saveEntity, retagValidation } from "../entities.js";
import type { LlmProvider } from "../llm.js";
import { OllamaProvider } from "../llm.js";
import { log } from "../log.js";
import type { OcClient } from "../oc-client.js";
import { gatherContext } from "../prompt.js";
import { findStory } from "../stories.js";
import { validateContentWithUsage } from "../validator.js";

export function createContinuationAdapter(
  oc: OcClient,
  generator: LlmProvider,
  validator: LlmProvider,
): ContinuationPort {
  return {
    generatorName: generator.name,
    admissionMode: admissionModeFromEnv(),
    gatherContext: (storyId, direction, options) =>
      gatherContext(oc, storyId, direction, options),
    effectiveContextWindow: async (model) => {
      if (!(generator instanceof OllamaProvider)) return undefined;
      const window = await generator.getEffectiveContextWindow(model);
      return typeof window === "number" ? window : undefined;
    },
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
