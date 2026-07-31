// mnemo_revalidate_scenes: one-shot bulk validation pass over every scene
// in the active story.
//
// Bootstrap problem this fixes (v0.1.3 step 3 -- see STATUS.md): scenes
// saved before v0.1.3 shipped (or saved via mnemo_save_entity, or via
// mnemo_continue with validate=false) carry no validation:* tag.
// pullFilteredScenes (prompt.ts) treats untagged scenes as fill -- they
// still get included as few-shots, just after validation:clean scenes.
// Running this tool once retroactively tags every existing scene with a
// fresh verdict, so pullFilteredScenes' hard exclusion of
// validation:errors actually takes effect for old content, not just new
// content saved after v0.1.3.
//
// No input args -- walks all scenes in the active story (STATUS.md is
// explicit on this). Sequential per-scene processing, matching this
// codebase's established OC-access convention (see gatherContext's
// comment on why parallel pulls trip OC v3's rate limiter). One scene's
// failure (validator threw on bad JSON, an LLM error, etc.) is caught and
// recorded, not allowed to abort the whole walk.

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { OcClient } from "../oc-client.js";
import type { LlmProvider } from "../llm.js";
import { gatherContext } from "../prompt.js";
import { validateContent, classifyVerdict } from "../validator.js";
import { recall, retagValidation, MAX_RECALL_LIMIT } from "../entities.js";
import { requireCurrentStoryId } from "../config.js";
import { log } from "../log.js";
import { asText, withLogging } from "./helpers.js";

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
 * tests without going through the tool/withLogging wrapper.
 *
 * One scene's failure (gatherContext, validateContent, or the retag write
 * throwing) is caught, logged, and recorded in `failures`; it does not
 * abort the walk over the remaining scenes.
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
      const context = await gatherContext(oc, storyId, scene.body);
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

export function registerRevalidateTool(
  server: McpServer,
  oc: OcClient,
  validator: LlmProvider,
): void {
  server.registerTool(
    "mnemo_revalidate_scenes",
    {
      title: "Revalidate All Scenes",
      description:
        "One-shot bulk validation pass over every scene in the active story. Re-runs the validator against each scene's own gathered context and retags it with a fresh validation:clean or validation:errors verdict. Fixes the bootstrap problem for scenes saved before v0.1.3's validator-gated scene inclusion existed (untagged scenes). No arguments -- walks all scenes in the active story. A single scene's validation failure is recorded in the response's failures list, not raised as an error, so one bad scene doesn't abort the walk.",
      inputSchema: {},
    },
    withLogging("mnemo_revalidate_scenes", async () => {
      const storyId = await requireCurrentStoryId();
      const result = await revalidateScenes(oc, validator, storyId);
      return asText(result);
    }),
  );
}
