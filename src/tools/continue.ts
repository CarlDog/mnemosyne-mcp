// mnemo_continue: generate the next beat of the active story.
//
// Flow:
//   1. Pull context from OC (rules, style, characters, locations, scenes,
//      lore, worldbuilding) — sequential per-type recalls, ranked by
//      relevance to the user's direction.
//   2. Assemble the system prompt using v2's block ordering.
//   3. Call the generator LLM (default: Ollama).
//   4. Auto-save the result as a scene entity (name = ISO timestamp).
//   5. If validate=true, run an LLM second pass against rules / style /
//      characters / locations and attach the verdict to the response.
//      Save-first: the beat is persisted regardless of validation
//      outcome; failures land in the response, not as exceptions.

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { OcClient } from "../oc-client.js";
import type { LlmProvider } from "../llm.js";
import { buildSystemPrompt, gatherContext, MODES } from "../prompt.js";
import { saveEntity, retagValidation } from "../entities.js";
import { requireCurrentStoryId } from "../config.js";
import {
  combineKindroidTarget,
  findStory,
  type KindroidTarget,
} from "../stories.js";
import {
  DEFAULT_GROUP_MAX_TURNS,
  MAX_GROUP_MAX_TURNS,
  MIN_GROUP_MAX_TURNS,
  resolveKindroidTarget,
} from "../kindroid-provider.js";
import {
  validateContent,
  classifyVerdict,
  type ValidationReport,
} from "../validator.js";
import { log } from "../log.js";
import { asText, withLogging } from "./helpers.js";

const DEFAULT_MODE: (typeof MODES)[number] = "director";

export function registerContinueTool(
  server: McpServer,
  oc: OcClient,
  generator: LlmProvider,
  validator: LlmProvider,
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
        max_tokens: z
          .number()
          .int()
          .min(1)
          .max(8192)
          .optional()
          .describe(
            "Cap on generation length. Ollama defaults to 2048 when unset; " +
              "cloud providers pass this through only when set (their own " +
              "defaults apply otherwise -- note the newest OpenAI reasoning " +
              "models reject the field outright). Ignored by kindroid/botify.",
          ),
        temperature: z
          .number()
          .min(0)
          .max(2)
          .optional()
          .describe(
            "Sampling temperature. Ollama defaults to 0.8 when unset; cloud " +
              "providers pass this through only when set, and ranges/support " +
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
      },
    },
    withLogging(
      "mnemo_continue",
      async (args: {
        direction: string;
        mode?: (typeof MODES)[number];
        max_tokens?: number;
        temperature?: number;
        model?: string;
        kindroid_kin?: string;
        kindroid_group_id?: string;
        group_max_turns?: number;
        allow_user?: boolean;
        validate?: boolean;
      }) => {
        const storyId = await requireCurrentStoryId();
        const mode = args.mode ?? DEFAULT_MODE;

        const context = await gatherContext(oc, storyId, args.direction);
        const systemPrompt = buildSystemPrompt(mode, context);

        // Throws on a genuine kindroid_kin + kindroid_group_id conflict.
        const explicitTarget = combineKindroidTarget(
          args.kindroid_kin,
          args.kindroid_group_id,
        );

        // Only fetch the story marker (an extra OC round trip) when it
        // could actually matter: no explicit override, and a story-bound
        // target is meaningless to any generator but Kindroid.
        let storyTarget: KindroidTarget | undefined;
        if (explicitTarget === undefined && generator.name === "kindroid") {
          const story = await findStory(oc, storyId);
          storyTarget = story?.kindroid_target;
        }
        const kindroidTarget = resolveKindroidTarget(
          explicitTarget,
          generator.name,
          storyTarget,
        );

        const beat = await generator.generate({
          systemPrompt,
          userMessage: args.direction,
          temperature: args.temperature,
          maxTokens: args.max_tokens,
          model: args.model,
          context,
          kindroidTarget,
          groupMaxTurns: args.group_max_turns,
          allowUser: args.allow_user,
        });
        const beatText = beat.text;
        const groupMeta = {
          ...(beat.groupEnded !== undefined && {
            group_ended: beat.groupEnded,
          }),
          ...(beat.groupTurns !== undefined && {
            group_turns: beat.groupTurns,
          }),
        };

        // A group can hand the floor back before anyone speaks (allow_user:
        // true only). Nothing was generated, so there is no beat to save --
        // saving an empty scene would poison both recall and the validator.
        // The direction itself HAS already been posted to the group by
        // advanceGroup, so say so: the caller must continue the scene, not
        // re-send, or the group sees it twice.
        if (beatText.trim() === "") {
          return asText({
            yielded_to_user: true,
            beat_text: "",
            saved: false,
            message:
              "The group handed the floor straight back to you -- no AI " +
              "turns were generated, so nothing was saved. Your direction " +
              "was already posted to the group; do not re-send it. Take " +
              "the turn: call mnemo_continue again with what you say next.",
            mode,
            ...groupMeta,
          });
        }

        // Guard the save: the beat is an expensive LLM generation, and a
        // transient OC write failure must not discard it. On save error,
        // still return the beat text with a save_error field so the user
        // can retry the persist (e.g., via mnemo_save_entity) without
        // regenerating.
        const beatName = `Scene ${new Date().toISOString()}`;
        let memoryId: string | undefined;
        let savedTags: string[] | undefined;
        let saveError: string | undefined;
        try {
          const saved = await saveEntity(oc, storyId, {
            type: "scene",
            name: beatName,
            body: beatText,
          });
          memoryId = saved.memory_id;
          savedTags = saved.tags;
        } catch (err) {
          saveError = (err as Error).message;
          log.warn("mnemo_continue", "scene save failed", { msg: saveError });
        }

        let validation: ValidationReport | undefined;
        let validationError: string | undefined;
        if (args.validate) {
          try {
            validation = await validateContent(validator, context, beatText);
          } catch (err) {
            validationError = (err as Error).message;
            log.warn("mnemo_continue", "validation pass failed", {
              msg: validationError,
            });
          }
        }

        // Tag the saved scene with its validation verdict (v0.1.3
        // validator-gated inclusion — see STATUS.md). Only when both the
        // save succeeded and a verdict was actually produced: no memoryId
        // means nothing to tag, no validation means no verdict to classify
        // (validate=false, or the validator pass itself failed). Best-effort
        // metadata — must never fail the tool call for an already-saved beat.
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
            log.warn("mnemo_continue", "validation retag failed", {
              msg: (err as Error).message,
            });
          }
        }

        return asText({
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
          ...(validationError !== undefined && {
            validation_error: validationError,
          }),
          ...groupMeta,
        });
      },
    ),
  );
}
