// mnemo_continue: MCP driver wrapper over the shared continueScene use case.

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { OcClient } from "../oc-client.js";
import {
  MODES,
  SCENE_CONTEXT_STRATEGIES,
  SCENE_CONTEXT_STRATEGY_DESCRIPTION,
  SCENE_CONTEXT_FALLBACK_DESCRIPTION,
  resolveSceneContextStrategies,
  type SceneContextStrategy,
} from "../prompt.js";
import {
  MAX_GENERATION_TOKENS,
  MAX_TEMPERATURE,
  MIN_GENERATION_TOKENS,
  MIN_TEMPERATURE,
} from "../llm.js";
import { combineKindroidTarget } from "../stories.js";
import {
  DEFAULT_GROUP_MAX_TURNS,
  MAX_GROUP_MAX_TURNS,
  MIN_GROUP_MAX_TURNS,
} from "../kindroid-provider.js";
import { asText, withLogging } from "./helpers.js";
import { makeRunContext } from "../run-context.js";
import { resolveStoryId } from "../stories.js";
import type { ContinueScene } from "../application/continue-scene.js";
import { DEFAULT_MODE } from "../application/continue-scene.js";

/**
 * MCP wrapper around continueScene: validates arguments, resolves defaults
 * and conflict edges, and returns the use-case result as tool output.
 */
export function registerContinueTool(
  server: McpServer,
  oc: OcClient,
  continueScene: ContinueScene,
  sceneContextStrategy: SceneContextStrategy,
  sceneContextFallbackStrategy: SceneContextStrategy,
): void {
  server.registerTool(
    "mnemo_continue",
    {
      title: "Continue the Story",
      description:
        "Generate the next beat of the active story. Pulls context from OpenChronicle (rules, style, characters, locations, recent scenes, lore, worldbuilding) using v2's load-bearing block ordering, calls the generator LLM, and auto-saves the result as a scene entity. Default mode is 'director' (LLM performs all characters and narrates). With validate=true, runs an LLM second pass against rules / style / characters / locations and returns a verdict alongside the beat. The beat is saved regardless of validation outcome.",
      inputSchema: {
        direction: z
          .string()
          .min(1)
          .describe(
            "What should happen next. The user's prompt for the scene. " +
              "When it narrates an in-fiction event or action (not a bare " +
              'meta-instruction like "continue the scene"), phrase it the ' +
              "same way generated beats are: physical action in *asterisks*, " +
              "dialogue plain -- so the direction and the beat it produces " +
              "read as one consistent voice, not two.",
          ),
        mode: z
          .enum(MODES)
          .optional()
          .describe(
            `Engagement mode. participant=user plays a character; director=LLM performs all characters; audience=LLM narrates as storyteller. Default ${DEFAULT_MODE}.`,
          ),
        scene_context_strategy: z
          .enum(SCENE_CONTEXT_STRATEGIES)
          .optional()
          .describe(SCENE_CONTEXT_STRATEGY_DESCRIPTION),
        scene_context_fallback_strategy: z
          .enum(SCENE_CONTEXT_STRATEGIES)
          .optional()
          .describe(SCENE_CONTEXT_FALLBACK_DESCRIPTION),
        max_tokens: z
          .number()
          .int()
          .min(MIN_GENERATION_TOKENS)
          .max(MAX_GENERATION_TOKENS)
          .optional()
          .describe(
            "Cap on generation length. Ollama defaults to 2048 when unset; " +
              "cloud providers pass this through only when set (their own " +
              "defaults apply otherwise -- note the newest OpenAI reasoning " +
              "models reject the field outright). Ignored by kindroid/botify.",
          ),
        temperature: z
          .number()
          .min(MIN_TEMPERATURE)
          .max(MAX_TEMPERATURE)
          .optional()
          .describe(
            "Sampling temperature. Ollama defaults to 0.8 when unset; " +
              "cloud providers pass this through only when set, and ranges/support " +
              "vary by provider (Anthropic accepts 0-1 and current-gen Claude " +
              "models reject the field entirely). Ignored by kindroid/botify.",
          ),
        model: z
          .string()
          .optional()
          .describe(
            "Override the generator's default model for this call. Honored by " +
              "every direct-LLM provider (ollama, anthropic, openai, gemini, " +
              "atlascloud -- each interprets it as its own model id/tag); " +
              "ignored by kindroid/botify. For a Kindroid per-call override, " +
              "use kindroid_kin / kindroid_group_id instead.",
          ),
        kindroid_kin: z
          .string()
          .optional()
          .describe(
            "Kindroid per-call override (GENERATOR_PROVIDER=kindroid only): target this specific AI (a raw ai_id or a kindroid-mcp registered name) for this call only. Mutually exclusive with kindroid_group_id. Precedence: this override, then the active story's own bound target (see mnemo_story_use's kindroid_kin/kindroid_group_id params), then the server-wide KINDROID_STORYTELLING_KIN/KINDROID_STORYTELLING_GROUP default.",
          ),
        group_max_turns: z
          .number()
          .int()
          .min(MIN_GROUP_MAX_TURNS)
          .max(MAX_GROUP_MAX_TURNS)
          .optional()
          .describe(
            `How many AI turns a Kindroid GROUP target generates for this beat (${MIN_GROUP_MAX_TURNS}-${MAX_GROUP_MAX_TURNS}, default ${DEFAULT_GROUP_MAX_TURNS}) -- a longer exchange between the kins, not a longer single reply. Note this is turns, NOT tokens: max_tokens above is the unrelated generation-length cap. No effect on a single-AI Kindroid target (always exactly one reply) or on any other provider. Overrides KINDROID_GROUP_MAX_TURNS for this call only.`,
          ),
        allow_user: z
          .boolean()
          .optional()
          .describe(
            "Kindroid GROUP targets only: let the turn loop hand the floor back to you mid-scene instead of forcing AI-only turns (default false). Pass true only if you can actually take that turn -- a conversational caller can, a scheduled one cannot. When the loop yields, the response carries group_ended='user_turn'; if it yields before anyone speaks you get yielded_to_user=true, an empty beat, and NOTHING is saved -- your direction is already posted to the group, so continue the scene rather than re-sending it.",
          ),
        kindroid_group_id: z
          .string()
          .optional()
          .describe(
            "Kindroid per-call override (GENERATOR_PROVIDER=kindroid only): target this specific group chat (a raw group_id or a kindroid-mcp registered name) for this call only -- drives the group's turn loop and returns each AI's reply as part of the beat. Mutually exclusive with kindroid_kin. Same precedence as kindroid_kin.",
          ),
        validate: z
          .boolean()
          .optional()
          .describe(
            "Run an LLM validation pass after generation. Returns a verdict (issues + summary) alongside the beat. The beat is always saved first; validation results are advisory.",
          ),
        story: z
          .string()
          .min(1)
          .optional()
          .describe(
            "Story name or OC project UUID. Overrides the active story for this call only; omit to use the active story (mnemo_story_use).",
          ),
      },
    },
    withLogging(
      "mnemo_continue",
      async (
        args: {
          direction: string;
          mode?: (typeof MODES)[number];
          scene_context_strategy?: SceneContextStrategy;
          scene_context_fallback_strategy?: SceneContextStrategy;
          max_tokens?: number;
          temperature?: number;
          model?: string;
          kindroid_kin?: string;
          kindroid_group_id?: string;
          group_max_turns?: number;
          allow_user?: boolean;
          validate?: boolean;
          story?: string;
        },
        extra,
      ) => {
        const storyId = await resolveStoryId(oc, args.story);
        const run = makeRunContext("mcp", { storyId, signal: extra.signal });
        const sceneStrategies = resolveSceneContextStrategies(
          {
            strategy: args.scene_context_strategy,
            fallback: args.scene_context_fallback_strategy,
          },
          {
            strategy: sceneContextStrategy,
            fallback: sceneContextFallbackStrategy,
          },
        );

        // Throws on a genuine kindroid_kin + kindroid_group_id conflict;
        // the message reaches the MCP caller as the tool error.
        const explicitTarget = combineKindroidTarget(
          args.kindroid_kin,
          args.kindroid_group_id,
        );

        const result = await continueScene(
          storyId,
          {
            direction: args.direction,
            mode: args.mode,
            sceneStrategy: sceneStrategies.strategy,
            sceneFallbackStrategy: sceneStrategies.fallback,
            maxTokens: args.max_tokens,
            temperature: args.temperature,
            model: args.model,
            explicitKindroidTarget: explicitTarget,
            groupMaxTurns: args.group_max_turns,
            allowUser: args.allow_user,
            validate: args.validate,
            reinvokeHint: "call mnemo_continue again",
          },
          run,
        );
        return asText(result);
      },
    ),
  );
}
