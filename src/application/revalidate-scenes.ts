// Shared use case: re-run validator over all scenes in a story.

import type {
  RevalidationObserver,
  SceneValidationStore,
} from "./ports/scene-validation.js";
import type {
  StoryConstraintReader,
  StoryContentValidator,
} from "./ports/story-validation.js";
import { classifyVerdict } from "./validation-policy.js";

export interface RevalidateFailure {
  name: string;
  error: string;
}

export interface RevalidateResult {
  scenes_checked: number;
  tagged_clean: number;
  tagged_errors: number;
  failures: RevalidateFailure[];
}

export interface RevalidateScenesDependencies {
  scenes: SceneValidationStore;
  constraints: StoryConstraintReader;
  validator: StoryContentValidator;
  observer?: RevalidationObserver;
}

/**
 * Walk every scene sequentially, validate it against its story constraints,
 * and retag it with the fresh verdict. One scene's failure is recorded and
 * observed without aborting the remaining walk.
 */
export async function revalidateScenes(
  dependencies: RevalidateScenesDependencies,
  storyId: string,
): Promise<RevalidateResult> {
  const scenes = await dependencies.scenes.list(storyId);
  let taggedClean = 0;
  let taggedErrors = 0;
  const failures: RevalidateFailure[] = [];

  for (const scene of scenes) {
    try {
      const context = await dependencies.constraints.read(storyId, scene.body);
      const report = await dependencies.validator.validate(context, scene.body);
      const verdict = classifyVerdict(report);
      await dependencies.scenes.tag(scene, verdict);
      if (verdict === "clean") taggedClean++;
      else taggedErrors++;
    } catch (err) {
      const error = (err as Error).message;
      dependencies.observer?.sceneFailed(scene, error);
      failures.push({ name: scene.name, error });
    }
  }

  return {
    scenes_checked: scenes.length,
    tagged_clean: taggedClean,
    tagged_errors: taggedErrors,
    failures,
  };
}

export type RevalidateScenes = (storyId: string) => Promise<RevalidateResult>;

export function createRevalidateScenes(
  dependencies: RevalidateScenesDependencies,
): RevalidateScenes {
  return async (storyId) => await revalidateScenes(dependencies, storyId);
}
