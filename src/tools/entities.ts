// Entity tools: mnemo_save_entity, mnemo_recall.
// Both require an active story (mnemo_story_use must have been called).

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { OcClient } from "../oc-client.js";
import { deleteEntity, ENTITY_TYPES, recall, saveEntity } from "../entities.js";
import { resolveStoryId } from "../stories.js";
import { asText, withLogging } from "./helpers.js";

const ENTITY_TYPE_DESCRIPTIONS = `Entity type. One of: ${ENTITY_TYPES.join(", ")}.`;
const STORY_OVERRIDE_DESCRIPTION =
  "Story name or OC project UUID. Overrides the active story for this call only; omit to use the active story (mnemo_story_use).";

export function registerEntityTools(server: McpServer, oc: OcClient): void {
  server.registerTool(
    "mnemo_save_entity",
    {
      title: "Save Story Entity",
      description:
        "Save a story-domain entity (character, location, rule, style guide, scene, lore, or worldbuilding) to the active story. If an entity with the same type+name already exists, it is updated in place; otherwise a new memory is created. Rules default to pinned; everything else defaults to unpinned. Pin state can be overridden via the `pinned` parameter.",
      inputSchema: {
        type: z.enum(ENTITY_TYPES).describe(ENTITY_TYPE_DESCRIPTIONS),
        // No line breaks: the name lives on the [Type] Name header line,
        // and a name containing \n produces a memory the entity parser
        // can never match again — invisible to recall and export.
        name: z
          .string()
          .min(1)
          .regex(/^[^\r\n]+$/, "Entity names cannot contain line breaks.")
          .describe("Entity name (used for type+name dedupe on save)."),
        content: z
          .string()
          .min(1)
          .describe("Entity body. Free-form prose or structured notes."),
        pinned: z
          .boolean()
          .optional()
          .describe(
            "Override pin state. Defaults: rule=true, others=false. On update, only changes pin state if explicitly passed.",
          ),
        extra_tags: z
          .array(z.string())
          .optional()
          .describe(
            'Additional tags appended to the base set ["mnemosyne", "story", <type>]. Useful for sub-categorization (e.g., "primary" vs "npc" for characters).',
          ),
        story: z
          .string()
          .min(1)
          .optional()
          .describe(STORY_OVERRIDE_DESCRIPTION),
      },
    },
    withLogging(
      "mnemo_save_entity",
      async (args: {
        type: (typeof ENTITY_TYPES)[number];
        name: string;
        content: string;
        pinned?: boolean;
        extra_tags?: string[];
        story?: string;
      }) => {
        const storyId = await resolveStoryId(oc, args.story);
        const result = await saveEntity(oc, storyId, {
          type: args.type,
          name: args.name,
          body: args.content,
          pinned: args.pinned,
          extraTags: args.extra_tags,
        });
        return asText(result);
      },
    ),
  );

  server.registerTool(
    "mnemo_delete_entity",
    {
      title: "Delete Story Entity",
      description:
        "Delete an entity from the active story by (type, name). Throws if no entity matches. Useful for removing scenes that came out wrong before they pollute the context for the next mnemo_continue, or for retiring obsolete characters/locations/lore.",
      inputSchema: {
        type: z.enum(ENTITY_TYPES).describe(ENTITY_TYPE_DESCRIPTIONS),
        name: z
          .string()
          .min(1)
          .describe("Entity name. Same lookup rule as save_entity."),
        story: z
          .string()
          .min(1)
          .optional()
          .describe(STORY_OVERRIDE_DESCRIPTION),
      },
    },
    withLogging(
      "mnemo_delete_entity",
      async (args: {
        type: (typeof ENTITY_TYPES)[number];
        name: string;
        story?: string;
      }) => {
        const storyId = await resolveStoryId(oc, args.story);
        const result = await deleteEntity(oc, storyId, args.type, args.name);
        return asText({ ...result, deleted: true });
      },
    ),
  );

  server.registerTool(
    "mnemo_recall",
    {
      title: "Recall Story Entities",
      description:
        "Recall entities from the active story via OpenChronicle's hybrid semantic + keyword search. Pass `query` for a search term; pass `type` to filter to one entity type; pass both for type-scoped semantic search. With no query, results are ranked by tag-match and recency. Default limit 10, cap 100.",
      inputSchema: {
        query: z
          .string()
          .optional()
          .describe(
            "Semantic search query. Optional — when omitted, the type name (or 'story') is used as a soft ranking hint while tags do the actual filtering.",
          ),
        type: z
          .enum(ENTITY_TYPES)
          .optional()
          .describe(`Filter to one entity type. ${ENTITY_TYPE_DESCRIPTIONS}`),
        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .describe("Max results (1-100, default 10)."),
        story: z
          .string()
          .min(1)
          .optional()
          .describe(STORY_OVERRIDE_DESCRIPTION),
      },
    },
    withLogging(
      "mnemo_recall",
      async (args: {
        query?: string;
        type?: (typeof ENTITY_TYPES)[number];
        limit?: number;
        story?: string;
      }) => {
        const storyId = await resolveStoryId(oc, args.story);
        const entities = await recall(oc, storyId, args);
        return asText({ entities, count: entities.length });
      },
    ),
  );
}
