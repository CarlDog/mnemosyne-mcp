// Story management tools: mnemo_story_list, mnemo_story_use.
// See docs/ARCHITECTURE.md §2 and STATUS.md "v0 Contract" for the
// design rationale (marker-based stories, combined create+use).

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { OcClient } from "../oc-client.js";
import {
  combineKindroidTarget,
  createStory,
  findStory,
  listStories,
  setKindroidTarget,
  toStorySummary,
  type MnemoStory,
  type StorySummary,
} from "../stories.js";
import { getCurrentStoryId, setCurrentStoryId } from "../config.js";
import { asText, withLogging } from "./helpers.js";

// AnnotatedStory = StorySummary + "current" (which story the local
// active-story pointer points at) -- meaningful only here, since these
// tools are the ones reading that pointer. toStorySummary (src/stories.ts)
// is shared with the web API, which never annotates "current" (see its
// doc comment for why).
type AnnotatedStory = StorySummary & { current: boolean };

function toAnnotated(
  story: MnemoStory,
  currentId: string | undefined,
): AnnotatedStory {
  return { ...toStorySummary(story), current: story.id === currentId };
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
      const annotated = stories.map((s) => toAnnotated(s, currentId));
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
        kindroid_kin: z
          .string()
          .nullable()
          .optional()
          .describe(
            "Bind this story to a specific Kindroid AI (a raw ai_id or a kindroid-mcp registered name) for single-AI generation, used by mnemo_continue when GENERATOR_PROVIDER=kindroid and no per-call override is given. Mutually exclusive with kindroid_group_id. Pass null to clear a previously-set binding (falls back to the server-wide default). Omit to leave any existing binding unchanged.",
          ),
        kindroid_group_id: z
          .string()
          .nullable()
          .optional()
          .describe(
            "Bind this story to a specific Kindroid group chat (a raw group_id or a kindroid-mcp registered name) instead of a single AI -- mnemo_continue then drives the group's turn loop and returns each AI's reply as part of the beat. Mutually exclusive with kindroid_kin. Pass null to clear. Omit to leave unchanged.",
          ),
      },
    },
    withLogging(
      "mnemo_story_use",
      async (args: {
        name_or_id: string;
        create_if_missing?: boolean;
        kindroid_kin?: string | null;
        kindroid_group_id?: string | null;
      }) => {
        const { name_or_id, create_if_missing } = args;

        // Throws on a genuine kindroid_kin + kindroid_group_id conflict.
        const requestedTarget = combineKindroidTarget(
          args.kindroid_kin,
          args.kindroid_group_id,
        );
        const targetChangeRequested =
          args.kindroid_kin !== undefined ||
          args.kindroid_group_id !== undefined;

        let story = await findStory(oc, name_or_id);
        if (!story) {
          if (!create_if_missing) {
            return asText(
              {
                error: "story_not_found",
                message: `No story matches "${name_or_id}". Pass create_if_missing=true to create one.`,
              },
              { isError: true },
            );
          }
          story = await createStory(oc, name_or_id, requestedTarget);
        } else if (targetChangeRequested) {
          story = await setKindroidTarget(oc, story, requestedTarget);
        }
        await setCurrentStoryId(story.id);
        return asText({ ...toStorySummary(story), current: true });
      },
    ),
  );
}
