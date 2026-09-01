// mnemo_revalidate_scenes: MCP driver wrapper over the shared use case.

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { OcClient } from "../oc-client.js";
import { asText, withLogging } from "./helpers.js";
import { resolveStoryId } from "../stories.js";
import type {
  RevalidateFailure,
  RevalidateResult,
  RevalidateScenes,
} from "../application/revalidate-scenes.js";
export type { RevalidateFailure, RevalidateResult };

export function registerRevalidateTool(
  server: McpServer,
  oc: OcClient,
  revalidateScenes: RevalidateScenes,
): void {
  server.registerTool(
    "mnemo_revalidate_scenes",
    {
      title: "Revalidate All Scenes",
      description:
        "One-shot bulk validation pass over every scene in the active story. Re-runs the validator against each scene's own gathered context and retags it with a fresh validation:clean or validation:errors verdict. Fixes the bootstrap problem for scenes saved before v0.1.3's validator-gated scene inclusion existed (untagged scenes). Walks all scenes in the active story (or the story named by the optional `story` override), capped at 100 scenes per run (recall has no pagination); scenes_checked reflects what was actually walked. A single scene's validation failure is recorded in the response's failures list, not raised as an error, so one bad scene doesn't abort the walk.",
      inputSchema: {
        story: z
          .string()
          .min(1)
          .optional()
          .describe(
            "Story name or OC project UUID. Overrides the active story for this call only; omit to use the active story (mnemo_story_use).",
          ),
      },
    },
    withLogging("mnemo_revalidate_scenes", async (args: { story?: string }) => {
      const storyId = await resolveStoryId(oc, args.story);
      const result = await revalidateScenes(storyId);
      return asText(result);
    }),
  );
}
