// Action routes for web clients that should be able to use the same
// scene-context behavior as MCP tools (`mnemo_validate` and
// `mnemo_revalidate_scenes`) without introducing a protocol-level
// dependency.
//
// These are intentionally thin adapters over the same pure functions and
// shared prompt/validation primitives the tools already use.

import type { Router } from "express";
import { z } from "zod";
import type { OcClient } from "../oc-client.js";
import type { LlmProvider } from "../llm.js";
import {
  DEFAULT_SCENE_CONTEXT_STRATEGY,
  SCENE_CONTEXT_STRATEGIES,
  gatherContext,
  type SceneContextStrategy,
} from "../prompt.js";
import { findStory } from "../stories.js";
import { revalidateScenes } from "../tools/revalidate.js";
import { validateContent } from "../validator.js";
import { asyncRoute } from "./helpers.js";

const validateSchema = z.object({
  content: z.string().min(1),
  scene_context_strategy: z.enum(SCENE_CONTEXT_STRATEGIES).optional(),
});

const revalidateScenesSchema = z.object({
  scene_context_strategy: z
    .enum(SCENE_CONTEXT_STRATEGIES)
    .optional()
    .default(DEFAULT_SCENE_CONTEXT_STRATEGY),
});

function requestErrorBody(name: string, error: string): {
  error: string;
  message: string;
} {
  return { error: name, message: error };
}

export function registerInteractiveRoutes(
  router: Router,
  oc: OcClient,
  validator: LlmProvider,
  sceneContextStrategy: SceneContextStrategy = DEFAULT_SCENE_CONTEXT_STRATEGY,
): void {
  router.post(
    "/stories/:storyId/validate",
    asyncRoute(async (req, res) => {
      const { storyId } = req.params as { storyId: string };
      const story = await findStory(oc, storyId);
      if (!story) {
        res.status(404).json({
          error: "story_not_found",
          message: `No story matches "${storyId}".`,
        });
        return;
      }

      const parsedBody = validateSchema.safeParse(req.body);
      if (!parsedBody.success) {
        res.status(400).json(
          requestErrorBody(
            "invalid_body",
            parsedBody.error.issues
              .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
              .join("; "),
          ),
        );
        return;
      }

      const requestedStrategy =
        parsedBody.data.scene_context_strategy ?? sceneContextStrategy;
      const context = await gatherContext(
        oc,
        story.id,
        parsedBody.data.content,
        requestedStrategy,
      );
      const report = await validateContent(
        validator,
        context,
        parsedBody.data.content,
      );
      res.json(report);
    }),
  );

  router.post(
    "/stories/:storyId/revalidate-scenes",
    asyncRoute(async (req, res) => {
      const { storyId } = req.params as { storyId: string };
      const story = await findStory(oc, storyId);
      if (!story) {
        res.status(404).json({
          error: "story_not_found",
          message: `No story matches "${storyId}".`,
        });
        return;
      }

      const parsedBody = revalidateScenesSchema.safeParse(req.body ?? {});
      if (!parsedBody.success) {
        res.status(400).json(
          requestErrorBody(
            "invalid_body",
            parsedBody.error.issues
              .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
              .join("; "),
          ),
        );
        return;
      }

      const result = await revalidateScenes(
        oc,
        validator,
        story.id,
        parsedBody.data.scene_context_strategy ?? sceneContextStrategy,
      );
      res.json(result);
    }),
  );
}
