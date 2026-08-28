// mnemo_export_story: serialize a story to a versioned JSON document on
// disk. See docs/IMPORT_EXPORT_DESIGN.md and src/export.ts for the schema
// decisions; this file is only the MCP surface.

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { OcClient } from "../oc-client.js";
import { requireCurrentStoryId } from "../config.js";
import { exportStory } from "../export.js";
import { findStory } from "../stories.js";
import { asText, assertFilesystemPathAllowed, withLogging } from "./helpers.js";

export function registerExportTool(
  server: McpServer,
  oc: OcClient,
  allowFilesystemPaths: boolean,
): void {
  server.registerTool(
    "mnemo_export_story",
    {
      title: "Export Story",
      description:
        "Serialize a story's full contents (every entity, plus the story's " +
        "Kindroid binding if any) to a versioned JSON document on disk. " +
        "Defaults to the active story; pass name_or_id for another. The " +
        "response is a manifest (file path, per-type counts, anything " +
        "skipped) — the document itself lives in the file. Note: a bound " +
        "kindroid_target's ids are account-specific; the file is portable " +
        "across machines, not across Kindroid accounts.",
      inputSchema: {
        name_or_id: z
          .string()
          .min(1)
          .optional()
          .describe(
            "Story name or OC project UUID. Omit to export the active story.",
          ),
        out_path: z
          .string()
          .min(1)
          .optional()
          .describe(
            "Destination file path. Default: <data dir>/stories/" +
              "<story-slug>/exports/<story-slug>-<date>.json.",
          ),
      },
    },
    withLogging(
      "mnemo_export_story",
      async (args: { name_or_id?: string; out_path?: string }) => {
        if (args.out_path !== undefined) {
          assertFilesystemPathAllowed(allowFilesystemPaths, "out_path");
        }
        const nameOrId = args.name_or_id ?? (await requireCurrentStoryId());
        const story = await findStory(oc, nameOrId);
        if (!story) {
          return asText(
            {
              error: "story_not_found",
              message: `No story matches "${nameOrId}". Use mnemo_story_list to see what exists.`,
            },
            { isError: true },
          );
        }
        const manifest = await exportStory(oc, story, args.out_path);
        return asText(manifest);
      },
    ),
  );
}
