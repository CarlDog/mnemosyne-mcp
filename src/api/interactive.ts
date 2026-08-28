// Action routes for web clients that should be able to use the same
// scene-context behavior as MCP tools (`mnemo_continue`,
// `mnemo_validate`, and `mnemo_revalidate_scenes`) without introducing
// protocol-level dependency.
//
// These are intentionally thin adapters over the same pure functions and
// shared prompt/validation primitives the tools already use.

import type { Router } from "express";
import { z } from "zod";
import type { OcClient } from "../oc-client.js";
import type { LlmProvider } from "../llm.js";
import {
  MODES,
  SCENE_CONTEXT_STRATEGIES,
  gatherContext,
  resolveSceneContextStrategies,
  type SceneContextStrategy,
} from "../prompt.js";
import { combineKindroidTarget, type KindroidTarget } from "../stories.js";
import {
  MIN_GROUP_MAX_TURNS,
  MAX_GROUP_MAX_TURNS,
} from "../kindroid-provider.js";
import { continueScene } from "../tools/continue.js";
import { revalidateScenes } from "../tools/revalidate.js";
import { validateContent } from "../validator.js";
import { asyncRoute, parseOr400, requireStory } from "./helpers.js";

// The validate/revalidate bodies carry no scene_context_strategy params:
// validation contexts are gathered validationOnly (no scene pull -- the
// validator's constraintsBlock never reads scenes), so strategy knobs
// here would control nothing. Unknown keys are stripped by zod, so old
// clients still sending them keep working.
const validateSchema = z.object({
  content: z.string().min(1),
});

const revalidateScenesSchema = z.object({});

const continueSchema = z.object({
  direction: z.string().min(1),
  mode: z.enum(MODES).optional(),
  scene_context_strategy: z.enum(SCENE_CONTEXT_STRATEGIES).optional(),
  scene_context_fallback_strategy: z.enum(SCENE_CONTEXT_STRATEGIES).optional(),
  max_tokens: z.number().int().min(1).max(8192).optional(),
  temperature: z.number().min(0).max(2).optional(),
  model: z.string().optional(),
  kindroid_kin: z.string().optional(),
  kindroid_group_id: z.string().optional(),
  group_max_turns: z
    .number()
    .int()
    .min(MIN_GROUP_MAX_TURNS)
    .max(MAX_GROUP_MAX_TURNS)
    .optional(),
  allow_user: z.boolean().optional(),
  validate: z.boolean().optional(),
});

function requestErrorBody(
  name: string,
  error: string,
): {
  error: string;
  message: string;
} {
  return { error: name, message: error };
}

// The strategy pair is required, not defaulted: createApiRouter (the one
// caller) resolves the defaults itself, and dead defaults on inner
// layers are where hardcoded copies drift.
export function registerInteractiveRoutes(
  router: Router,
  oc: OcClient,
  generator: LlmProvider,
  validator: LlmProvider,
  sceneContextStrategy: SceneContextStrategy,
  sceneContextFallbackStrategy: SceneContextStrategy,
): void {
  router.post(
    "/stories/:storyId/continue",
    asyncRoute(async (req, res) => {
      const { storyId } = req.params as { storyId: string };
      const story = await requireStory(oc, storyId, res);
      if (!story) return;

      const body = parseOr400(continueSchema, req.body, res);
      if (!body) return;

      const sceneStrategies = resolveSceneContextStrategies(
        {
          strategy: body.scene_context_strategy,
          fallback: body.scene_context_fallback_strategy,
        },
        {
          strategy: sceneContextStrategy,
          fallback: sceneContextFallbackStrategy,
        },
      );

      // combineKindroidTarget throws on kindroid_kin + kindroid_group_id
      // both set -- a client input error the zod schema can't express
      // (no cross-field rule), so map it to a 400 with the explanatory
      // message instead of letting asyncRoute surface an opaque 500.
      let explicitTarget: KindroidTarget | undefined;
      try {
        explicitTarget = combineKindroidTarget(
          body.kindroid_kin,
          body.kindroid_group_id,
        );
      } catch (err) {
        res
          .status(400)
          .json(requestErrorBody("invalid_body", (err as Error).message));
        return;
      }

      const result = await continueScene(oc, generator, validator, story.id, {
        direction: body.direction,
        mode: body.mode,
        sceneStrategy: sceneStrategies.strategy,
        sceneFallbackStrategy: sceneStrategies.fallback,
        maxTokens: body.max_tokens,
        temperature: body.temperature,
        model: body.model,
        explicitKindroidTarget: explicitTarget,
        // findStory already ran for the 404 check above -- hand its
        // binding over so continueScene doesn't re-fetch the marker.
        storyKindroidTarget: story.kindroid_target,
        storyKindroidTargetPrefetched: true,
        groupMaxTurns: body.group_max_turns,
        allowUser: body.allow_user,
        validate: body.validate,
        reinvokeHint: `call /stories/${story.id}/continue again`,
      });
      res.json(result);
    }),
  );

  router.post(
    "/stories/:storyId/validate",
    asyncRoute(async (req, res) => {
      const { storyId } = req.params as { storyId: string };
      const story = await requireStory(oc, storyId, res);
      if (!story) return;

      const body = parseOr400(validateSchema, req.body, res);
      if (!body) return;

      const context = await gatherContext(oc, story.id, body.content, {
        validationOnly: true,
      });
      const report = await validateContent(validator, context, body.content);
      res.json(report);
    }),
  );

  router.post(
    "/stories/:storyId/revalidate-scenes",
    asyncRoute(async (req, res) => {
      const { storyId } = req.params as { storyId: string };
      const story = await requireStory(oc, storyId, res);
      if (!story) return;

      const body = parseOr400(revalidateScenesSchema, req.body, res);
      if (!body) return;

      const result = await revalidateScenes(oc, validator, story.id);
      res.json(result);
    }),
  );
}
