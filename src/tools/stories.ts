// Story management tools: mnemo_story_list, mnemo_story_use.
// See docs/ARCHITECTURE.md §2 and STATUS.md "v0 Contract" for the
// design rationale (marker-based stories, combined create+use).

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { OcClient } from "../oc-client.js";
import {
  createStory,
  findStory,
  listStories,
  type MnemoStory,
} from "../stories.js";
import { getCurrentStoryId, setCurrentStoryId } from "../config.js";
import { asText, withLogging } from "./helpers.js";

interface AnnotatedStory extends MnemoStory {
  current: boolean;
}

export function registerStoryTools(server: McpServer, oc: OcClient): void {
  server.registerTool(
    "mnemo_story_list",
    {
      title: "List Mnemosyne Stories",
      description:
        "List all Mnemosyne stories. A story is an OpenChronicle project containing the Mnemosyne story marker. Other OC projects (codebase memory, etc.) are filtered out.",
      inputSchema: {},
    },
    withLogging("mnemo_story_list", async () => {
      const [stories, currentId] = await Promise.all([
        listStories(oc),
        getCurrentStoryId(),
      ]);
      const annotated: AnnotatedStory[] = stories.map((s) => ({
        ...s,
        current: s.id === currentId,
      }));
      return asText({ stories: annotated, count: annotated.length });
    }),
  );

  server.registerTool(
    "mnemo_story_use",
    {
      title: "Set Active Story",
      description:
        "Set the active story by name or OC project UUID. With create_if_missing=true, creates a new story (OC project + marker) if none matches. Persists the active story id to local config so it survives restarts.",
      inputSchema: {
        name_or_id: z.string().min(1).describe("Story name or OC project UUID"),
        create_if_missing: z
          .boolean()
          .optional()
          .describe(
            "If true and no existing story matches, create a new one. Default false.",
          ),
      },
    },
    withLogging(
      "mnemo_story_use",
      async (args: { name_or_id: string; create_if_missing?: boolean }) => {
        const { name_or_id, create_if_missing } = args;
        let story = await findStory(oc, name_or_id);
        if (!story) {
          if (!create_if_missing) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify(
                    {
                      error: "story_not_found",
                      message: `No story matches "${name_or_id}". Pass create_if_missing=true to create one.`,
                    },
                    null,
                    2,
                  ),
                },
              ],
              isError: true,
            };
          }
          story = await createStory(oc, name_or_id);
        }
        await setCurrentStoryId(story.id);
        return asText({
          id: story.id,
          name: story.name,
          created_at: story.created_at,
          current: true,
        });
      },
    ),
  );
}
