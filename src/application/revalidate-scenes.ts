// Shared use case: re-run validator over all scenes in a story.
//
// The MCP tool and HTTP route adapters both call this, keeping the
// bulk-revalidation behavior in one policy location.

import type { OcClient } from "../oc-client.js";
import type { LlmProvider } from "../llm.js";
import { recall, retagValidation, MAX_RECALL_LIMIT } from "../entities.js";
import { gatherContext } from "../prompt.js";
import { classifyVerdict, validateContent } from "../validator.js";
import { log } from "../log.js";

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

/**
 * Walk every scene in the story, re-run the validator against each one's
 * own gathered context, and retag it with the fresh verdict. Pure/testable
 * -- no MCP framework dependency -- so it can be exercised directly by
 * tests without going through the tool wrapper.
 *
 * One scene's failure (gatherContext, validateContent, or the retag write
 * throwing) is caught, logged, and recorded in `failures`; it does not
 * abort the walk over the remaining scenes.
 *
 * Capped at MAX_RECALL_LIMIT (100) scenes -- recall() has no pagination. A
 * story with more scenes than that will have the excess silently
 * unvisited; `scenes_checked` reflects what was actually walked, not
 * necessarily the story's true scene count.
 */
export async function revalidateScenes(
  oc: OcClient,
  validator: LlmProvider,
  storyId: string,
): Promise<RevalidateResult> {
  const scenes = await recall(oc, storyId, {
    type: "scene",
    limit: MAX_RECALL_LIMIT,
  });

  let taggedClean = 0;
  let taggedErrors = 0;
  const failures: RevalidateFailure[] = [];

  // Sequential, not Promise.all -- see gatherContext's comment in
  // prompt.ts on why parallel OC access trips the rate limiter.
  for (const scene of scenes) {
    try {
      // validationOnly: the validator's constraintsBlock never reads
      // scenes/lore/worldbuilding, so gathering them here -- once per
      // scene, with the scene pool being the bundle's most expensive
      // fetch -- was pure waste (and the reason this tool once exposed
      // scene_context_strategy params that could never affect output).
      const context = await gatherContext(oc, storyId, scene.body, {
        validationOnly: true,
      });
      const report = await validateContent(validator, context, scene.body);
      const verdict = classifyVerdict(report);
      await retagValidation(oc, scene.memory_id, scene.tags, verdict);
      if (verdict === "clean") {
        taggedClean++;
      } else {
        taggedErrors++;
      }
    } catch (err) {
      const message = (err as Error).message;
      log.warn("revalidateScenes", "scene revalidation failed", {
        name: scene.name,
        msg: message,
      });
      failures.push({ name: scene.name, error: message });
    }
  }

  return {
    scenes_checked: scenes.length,
    tagged_clean: taggedClean,
    tagged_errors: taggedErrors,
    failures,
  };
}
