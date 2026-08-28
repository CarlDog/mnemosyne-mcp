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
  DEFAULT_SCENE_CONTEXT_STRATEGY,
  MODES,
  SCENE_CONTEXT_STRATEGIES,
  gatherContext,
  buildSystemPrompt,
  resolveSceneContextStrategies,
  type SceneContextStrategy,
} from "../prompt.js";
import { saveEntity, retagValidation } from "../entities.js";
import {
  combineKindroidTarget,
  findStory,
  type KindroidTarget,
} from "../stories.js";
import {
  MIN_GROUP_MAX_TURNS,
  MAX_GROUP_MAX_TURNS,
  resolveKindroidTarget,
} from "../kindroid-provider.js";
import { revalidateScenes } from "../tools/revalidate.js";
import {
  validateContent,
  classifyVerdict,
  type ValidationReport,
} from "../validator.js";
import { asyncRoute } from "./helpers.js";
import { log } from "../log.js";

const validateSchema = z.object({
  content: z.string().min(1),
  scene_context_strategy: z.enum(SCENE_CONTEXT_STRATEGIES).optional(),
  scene_context_fallback_strategy: z
    .enum(SCENE_CONTEXT_STRATEGIES)
    .optional(),
});

const revalidateScenesSchema = z.object({
  // Plain .optional() like the sibling schemas -- a zod .default() here
  // fills the value before the handler's `?? sceneContextStrategy` runs,
  // which silently discards the server-configured strategy.
  scene_context_strategy: z.enum(SCENE_CONTEXT_STRATEGIES).optional(),
  scene_context_fallback_strategy: z
    .enum(SCENE_CONTEXT_STRATEGIES)
    .optional(),
});

const DEFAULT_MODE: (typeof MODES)[number] = "director";
const continueSchema = z.object({
  direction: z.string().min(1),
  mode: z.enum(MODES).optional(),
  scene_context_strategy: z.enum(SCENE_CONTEXT_STRATEGIES).optional(),
  scene_context_fallback_strategy: z
    .enum(SCENE_CONTEXT_STRATEGIES)
    .optional(),
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

function requestErrorBody(name: string, error: string): {
  error: string;
  message: string;
} {
  return { error: name, message: error };
}

export function registerInteractiveRoutes(
  router: Router,
  oc: OcClient,
  generator: LlmProvider,
  validator: LlmProvider,
  sceneContextStrategy: SceneContextStrategy = DEFAULT_SCENE_CONTEXT_STRATEGY,
  sceneContextFallbackStrategy: SceneContextStrategy = sceneContextStrategy,
): void {
  router.post(
    "/stories/:storyId/continue",
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

      const parsedBody = continueSchema.safeParse(req.body ?? {});
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

      const sceneStrategies = resolveSceneContextStrategies(
        {
          strategy: parsedBody.data.scene_context_strategy,
          fallback: parsedBody.data.scene_context_fallback_strategy,
        },
        {
          strategy: sceneContextStrategy,
          fallback: sceneContextFallbackStrategy,
        },
      );
      const mode = parsedBody.data.mode ?? DEFAULT_MODE;

      const gatherStart = Date.now();
      const context = await gatherContext(
        oc,
        story.id,
        parsedBody.data.direction,
        sceneStrategies.strategy,
        sceneStrategies.fallback,
      );
      const gatherMs = Date.now() - gatherStart;
      const systemPrompt = buildSystemPrompt(mode, context);

      // combineKindroidTarget throws on kindroid_kin + kindroid_group_id
      // both set -- a client input error the zod schema can't express
      // (no cross-field rule), so map it to a 400 with the explanatory
      // message instead of letting asyncRoute surface an opaque 500.
      let explicitTarget: KindroidTarget | undefined;
      try {
        explicitTarget = combineKindroidTarget(
          parsedBody.data.kindroid_kin,
          parsedBody.data.kindroid_group_id,
        );
      } catch (err) {
        res
          .status(400)
          .json(requestErrorBody("invalid_body", (err as Error).message));
        return;
      }
      let storyTarget: KindroidTarget | undefined;
      if (explicitTarget === undefined && generator.name === "kindroid") {
        storyTarget = story.kindroid_target;
      }
      const kindroidTarget = resolveKindroidTarget(
        explicitTarget,
        generator.name,
        storyTarget,
      );

      const generateStart = Date.now();
      const beat = await generator.generate({
        systemPrompt,
        userMessage: parsedBody.data.direction,
        temperature: parsedBody.data.temperature,
        maxTokens: parsedBody.data.max_tokens,
        model: parsedBody.data.model,
        context,
        kindroidTarget,
        groupMaxTurns: parsedBody.data.group_max_turns,
        allowUser: parsedBody.data.allow_user,
      });
      const generateMs = Date.now() - generateStart;
      const beatText = beat.text;
      const groupMeta = {
        ...(beat.groupEnded !== undefined && { group_ended: beat.groupEnded }),
        ...(beat.groupTurns !== undefined && { group_turns: beat.groupTurns }),
      };

      if (beatText.trim() === "") {
        res.json({
          yielded_to_user: true,
          beat_text: "",
          saved: false,
          message:
            "The group handed the floor straight back to you -- no AI " +
            "turns were generated, so nothing was saved. Your direction " +
            "was already posted to the group; do not re-send it. Take " +
            "the turn: call /stories/:storyId/continue again with what you say next.",
          mode,
          stages_ms: {
            gather_ms: gatherMs,
            generate_ms: generateMs,
            save_ms: 0,
            validate_ms: 0,
          },
          ...groupMeta,
        });
        return;
      }

      const saveStart = Date.now();
      const beatName = `Scene ${new Date().toISOString()}`;
      let memoryId: string | undefined;
      let savedTags: string[] | undefined;
      let saveError: string | undefined;
      try {
        const saved = await saveEntity(oc, story.id, {
          type: "scene",
          name: beatName,
          body: beatText,
        });
        memoryId = saved.memory_id;
        savedTags = saved.tags;
      } catch (err) {
        saveError = (err as Error).message;
        log.warn("api:continue", "scene save failed", { msg: saveError });
      }
      const saveMs = Date.now() - saveStart;

      let validateMs = 0;
      let validation: ValidationReport | undefined;
      let validationError: string | undefined;
      if (parsedBody.data.validate) {
        const validateStart = Date.now();
        try {
          validation = await validateContent(validator, context, beatText);
        } catch (err) {
          validationError = (err as Error).message;
          log.warn("api:continue", "validation pass failed", {
            msg: validationError,
          });
        } finally {
          validateMs = Date.now() - validateStart;
        }
      }

      if (
        memoryId !== undefined &&
        savedTags !== undefined &&
        validation !== undefined
      ) {
        try {
          await retagValidation(
            oc,
            memoryId,
            savedTags,
            classifyVerdict(validation),
          );
        } catch (err) {
          log.warn("api:continue", "validation retag failed", {
            msg: (err as Error).message,
          });
        }
      }

      res.json({
        beat_name: beatName,
        beat_text: beatText,
        ...(memoryId !== undefined && { memory_id: memoryId }),
        ...(saveError !== undefined && { save_error: saveError }),
        mode,
        context_summary: {
          rules: context.rules.length,
          style: context.style.length,
          characters: context.characters.length,
          locations: context.locations.length,
          scenes: context.scenes.length,
          lore: context.lore.length,
          worldbuilding: context.worldbuilding.length,
        },
        ...(validation !== undefined && { validation }),
        ...(validationError !== undefined && { validation_error: validationError }),
        stages_ms: {
          gather_ms: gatherMs,
          generate_ms: generateMs,
          save_ms: saveMs,
          validate_ms: validateMs,
        },
        ...groupMeta,
      });
    }),
  );

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

      const sceneStrategies = resolveSceneContextStrategies(
        {
          strategy: parsedBody.data.scene_context_strategy,
          fallback: parsedBody.data.scene_context_fallback_strategy,
        },
        {
          strategy: sceneContextStrategy,
          fallback: sceneContextFallbackStrategy,
        },
      );
      const context = await gatherContext(
        oc,
        story.id,
        parsedBody.data.content,
        sceneStrategies.strategy,
        sceneStrategies.fallback,
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

      const sceneStrategies = resolveSceneContextStrategies(
        {
          strategy: parsedBody.data.scene_context_strategy,
          fallback: parsedBody.data.scene_context_fallback_strategy,
        },
        {
          strategy: sceneContextStrategy,
          fallback: sceneContextFallbackStrategy,
        },
      );
      const result = await revalidateScenes(
        oc,
        validator,
        story.id,
        sceneStrategies.strategy,
        sceneStrategies.fallback,
      );
      res.json(result);
    }),
  );
}
