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
import { saveEntity } from "../entities.js";
import { requireCurrentStoryId } from "../config.js";
import { validateContent, type ValidationReport } from "../validator.js";
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
            "What should happen next. The user's prompt for the scene.",
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
          .describe("Cap on generation length. Default 2048."),
        temperature: z
          .number()
          .min(0)
          .max(2)
          .optional()
          .describe("Sampling temperature. Default 0.8."),
        model: z
          .string()
          .optional()
          .describe(
            "Override OLLAMA_GENERATOR_MODEL for this call. Useful for trying different models on the same context.",
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
        validate?: boolean;
      }) => {
        const storyId = await requireCurrentStoryId();
        const mode = args.mode ?? DEFAULT_MODE;

        const context = await gatherContext(oc, storyId, args.direction);
        const systemPrompt = buildSystemPrompt(mode, context);

        const beatText = await generator.generate({
          systemPrompt,
          userMessage: args.direction,
          temperature: args.temperature,
          maxTokens: args.max_tokens,
          model: args.model,
        });

        const beatName = `Scene ${new Date().toISOString()}`;
        const saved = await saveEntity(oc, storyId, {
          type: "scene",
          name: beatName,
          body: beatText,
        });

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

        return asText({
          beat_name: beatName,
          beat_text: beatText,
          memory_id: saved.memory_id,
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
        });
      },
    ),
  );
}
