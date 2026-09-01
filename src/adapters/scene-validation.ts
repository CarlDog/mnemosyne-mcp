// Concrete OpenChronicle/logging adapters for bulk scene revalidation.

import type {
  RevalidationObserver,
  SceneValidationStore,
  SceneValidationTarget,
  SceneValidationVerdict,
} from "../application/ports/scene-validation.js";
import {
  createRevalidateScenes,
  type RevalidateScenes,
} from "../application/revalidate-scenes.js";
import { recall, retagValidation, MAX_RECALL_LIMIT } from "../entities.js";
import type { LlmProvider } from "../llm.js";
import { log } from "../log.js";
import type { OcClient } from "../oc-client.js";
import {
  LlmStoryContentValidator,
  OpenChronicleStoryConstraintReader,
} from "./story-validation.js";

export class OpenChronicleSceneValidationStore implements SceneValidationStore {
  constructor(private readonly oc: OcClient) {}

  async list(storyId: string): Promise<SceneValidationTarget[]> {
    return await recall(this.oc, storyId, {
      type: "scene",
      limit: MAX_RECALL_LIMIT,
    });
  }

  async tag(
    scene: SceneValidationTarget,
    verdict: SceneValidationVerdict,
  ): Promise<void> {
    await retagValidation(this.oc, scene.memory_id, scene.tags, verdict);
  }
}

export class LogRevalidationObserver implements RevalidationObserver {
  sceneFailed(scene: SceneValidationTarget, error: string): void {
    log.warn("revalidateScenes", "scene revalidation failed", {
      name: scene.name,
      msg: error,
    });
  }
}

export function createSceneRevalidationAdapter(
  oc: OcClient,
  validator: LlmProvider,
): RevalidateScenes {
  return createRevalidateScenes({
    scenes: new OpenChronicleSceneValidationStore(oc),
    constraints: new OpenChronicleStoryConstraintReader(oc),
    validator: new LlmStoryContentValidator(validator),
    observer: new LogRevalidationObserver(),
  });
}
