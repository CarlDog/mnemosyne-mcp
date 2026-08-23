// mnemo_import_story: typed batch writer into the active story. See
// docs/IMPORT_EXPORT_DESIGN.md and src/import.ts for semantics; this
// file is only the MCP surface.
//
// The entities-vs-file_path mutual exclusivity is enforced in the
// handler, not the schema — MCP inputSchema is per-field only and
// silently drops object-level refinements (see the fleet
// mcp-server-authoring rule), so a cross-field invariant that lived
// there would never run.

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { OcClient } from "../oc-client.js";
import { requireCurrentStoryId } from "../config.js";
import {
  importRecordSchema,
  importStory,
  readExportFile,
  type ImportManifest,
  type ImportRecord,
} from "../import.js";
import { findStory } from "../stories.js";
import { asText, withLogging } from "./helpers.js";

export function registerImportTool(server: McpServer, oc: OcClient): void {
  server.registerTool(
    "mnemo_import_story",
    {
      title: "Import Story Entities",
      description:
        "Batch-write already-classified entities into the active story " +
        "(set one with mnemo_story_use first, or pass `story` to target " +
        "another for this call only). Two modes, exactly one per " +
        "call: `entities` — an array of records the caller has already " +
        "classified and the user has approved (this tool validates and " +
        "writes; it never classifies); or `file_path` — a mnemosyne " +
        "export document, imported verbatim (round-trip restore). " +
        "Preflight is all-or-nothing: any in-batch duplicate, or any " +
        "conflict with an existing entity under the default " +
        "on_conflict=error, aborts the whole batch with nothing written — " +
        "the manifest shows every record's would-be status so you can fix " +
        "and re-invoke. dry_run previews the same plan without writing. " +
        "A file's embedded kindroid_target is reported but never applied — " +
        "bind it explicitly via mnemo_story_use if wanted. Large batches " +
        "write sequentially (OC rate limits); expect roughly a second per " +
        "entity.",
      inputSchema: {
        // The record shape (field descriptions included) lives on the
        // shared importRecordSchema in src/import.ts, so file mode and
        // entities mode can never drift into accepting different records.
        entities: z
          .array(importRecordSchema)
          .min(1)
          .optional()
          .describe(
            "Already-classified records to write. Mutually exclusive with file_path.",
          ),
        file_path: z
          .string()
          .min(1)
          .optional()
          .describe(
            "Path to a mnemosyne export document (mnemosyne_export: 1). " +
              "Mutually exclusive with entities.",
          ),
        dry_run: z
          .boolean()
          .optional()
          .describe(
            "Preview the full per-entity plan; write nothing. Default false.",
          ),
        on_conflict: z
          .enum(["skip", "overwrite", "error"])
          .optional()
          .describe(
            "What to do when a record's (type, name) already exists in the " +
              "story. Default error: abort the batch, write nothing.",
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
      "mnemo_import_story",
      async (args: {
        entities?: ImportRecord[];
        file_path?: string;
        dry_run?: boolean;
        on_conflict?: "skip" | "overwrite" | "error";
        story?: string;
      }) => {
        if (!args.entities === !args.file_path) {
          throw new Error(
            "Pass exactly one of `entities` or `file_path` — they are mutually exclusive input modes.",
          );
        }

        const nameOrId = args.story ?? (await requireCurrentStoryId());
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

        let records: ImportRecord[];
        let file: ImportManifest["file"];
        if (args.file_path) {
          const parsed = await readExportFile(args.file_path);
          records = parsed.records;
          file = {
            path: parsed.resolvedPath,
            story_name: parsed.storyName,
            ...(parsed.kindroidTarget && {
              kindroid_target: parsed.kindroidTarget,
              note:
                "kindroid_target was NOT applied — bind it explicitly via " +
                "mnemo_story_use (kindroid_kin / kindroid_group_id) if wanted.",
            }),
          };
        } else {
          records = args.entities!;
        }

        const manifest = await importStory(oc, story, records, {
          dryRun: args.dry_run ?? false,
          onConflict: args.on_conflict ?? "error",
        });
        return asText({ ...manifest, ...(file && { file }) });
      },
    ),
  );
}
