// Story import — the typed batch writer half of the import/export design
// (docs/IMPORT_EXPORT_DESIGN.md). Two input modes feed one machinery:
// caller-classified records (the curated path — the HOST conversation did
// the classification and the human approved; this code never guesses),
// or a mnemosyne export document (the round-trip path — a deterministic
// deserialize of a format mnemosyne itself writes; the repo's "no
// deterministic checker" principle is scoped to validating generated
// prose and does not apply here).
//
// Safety semantics, finalized at implementation (the design doc records
// the intent; this comment records the exact behavior):
// - Preflight before any write: one listAllEntities call builds the
//   existing-(type,name) set, so conflicts and in-batch duplicates are
//   known up front.
// - Any in-batch duplicate, or any conflict under on_conflict:"error"
//   (the default), aborts the WHOLE batch with nothing written — a
//   half-imported story is worse than a rejected call. The manifest
//   still reports every record's would-be status so the caller can fix
//   and re-invoke deliberately.
// - on_conflict:"skip"/"overwrite" proceed; a mid-batch write failure is
//   recorded per-record and does NOT abort the walk (same convention as
//   revalidateScenes) — those statuses are in the manifest, never
//   swallowed.
// - dry_run runs the full preflight and returns the plan verbatim with
//   nothing written (v2's dry-run manifest-miscount bug is the cautionary
//   tale: a dry run must report exactly what it did, which is nothing).

import { promises as fs } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import {
  ENTITY_TYPES,
  listAllEntities,
  saveEntity,
  type EntityType,
} from "./entities.js";
import type { OcClient } from "./oc-client.js";
import type { KindroidTarget, MnemoStory } from "./stories.js";

// Single source of truth for the record shape — the tool's inputSchema
// reuses this object so file mode and entities mode can never drift into
// accepting different records.
export const importRecordSchema = z.object({
  type: z
    .enum(ENTITY_TYPES)
    .describe(`Entity type. One of: ${ENTITY_TYPES.join(", ")}.`),
  // No line breaks: formatEntityContent puts the name on the header line,
  // and a name containing \n produces a memory parseEntityContent can
  // never match again — invisible to recall, export, and this import's
  // own preflight, so every re-run would mint another orphan.
  name: z
    .string()
    .min(1)
    .regex(/^[^\r\n]+$/, "Entity names cannot contain line breaks.")
    .describe("Entity name."),
  content: z
    .string()
    .min(1)
    .describe("Entity body — verbatim content, no [Type] header."),
  pinned: z
    .boolean()
    .optional()
    .describe(
      "Pin state. Defaults: rule=true, others=false (same as mnemo_save_entity).",
    ),
  tags: z
    .array(z.string())
    .optional()
    .describe(
      "Extra tags beyond the base set (validation:* tags round-trip here).",
    ),
  // Validated statically so a bad timestamp aborts preflight instead of
  // failing mid-batch at OC's own DomainValidationError — which would
  // leave a partial import from the mode whose contract is
  // nothing-written (and make dry_run's clean preview a lie).
  created_at: z
    .string()
    .datetime({ offset: true })
    .optional()
    .describe(
      "ISO datetime to backdate the entity on create (round-trip timestamp restore).",
    ),
});

export type ImportRecord = z.infer<typeof importRecordSchema>;

// Mirrors export.ts's StoryExportDocument, as a runtime validator. The
// version is a literal 1: a document this build doesn't understand must
// be refused loudly, not half-read.
const exportDocumentSchema = z.object({
  mnemosyne_export: z.literal(1),
  exported_at: z.string(),
  story: z.object({
    name: z.string(),
    created_at: z.string(),
    kindroid_target: z
      .object({ type: z.enum(["ai", "group"]), id: z.string().min(1) })
      .optional(),
  }),
  entities: z.array(importRecordSchema),
});

export interface ParsedExportFile {
  records: ImportRecord[];
  storyName: string;
  /** Present when the document carried a binding. Deliberately NOT
   * applied by import — binding a story to an account's Kindroid target
   * is an explicit mnemo_story_use decision, never an import side
   * effect. Surfaced so the caller knows it exists. */
  kindroidTarget?: KindroidTarget;
}

/** Parse + validate an export document's raw text. Throws with a
 * caller-actionable message on any mismatch — including a specific one
 * for a version this build doesn't read. */
export function parseExportDocument(raw: string): ParsedExportFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("File is not valid JSON — not a mnemosyne export.");
  }
  const version =
    parsed !== null && typeof parsed === "object"
      ? (parsed as { mnemosyne_export?: unknown }).mnemosyne_export
      : undefined;
  if (version !== 1) {
    throw new Error(
      version === undefined
        ? "File has no mnemosyne_export field — not a mnemosyne export document."
        : `Unsupported export schema version ${String(version)} — this build reads version 1.`,
    );
  }
  const result = exportDocumentSchema.safeParse(parsed);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new Error(
      `Export document failed validation at ${issue?.path.join(".") ?? "?"}: ${issue?.message ?? "unknown"}`,
    );
  }
  return {
    records: result.data.entities,
    storyName: result.data.story.name,
    ...(result.data.story.kindroid_target && {
      kindroidTarget: result.data.story.kindroid_target,
    }),
  };
}

export type OnConflict = "skip" | "overwrite" | "error";

export type ImportStatus =
  // planned (dry_run, or an aborted batch's would-be statuses)
  | "create"
  | "overwrite"
  | "skip"
  | "conflict"
  | "duplicate_in_batch"
  | "invalid"
  // executed
  | "created"
  | "overwritten"
  | "skipped"
  | "failed";

export interface ImportResultEntry {
  index: number;
  type: EntityType;
  name: string;
  status: ImportStatus;
  reason?: string;
  memory_id?: string;
}

export interface ImportPlan {
  entries: ImportResultEntry[];
  /** Set when nothing may be written: every entry keeps its would-be
   * status so the caller can fix the batch and re-invoke. */
  aborted?: "invalid_records" | "duplicates_in_batch" | "conflicts";
}

// OC rejects memory content past 100,000 chars (DomainValidationError,
// openchronicle interfaces/mcp/tools/memory.py). Mirrored here so an
// oversized record aborts preflight like a conflict does, instead of
// failing mid-batch after earlier records already wrote — the
// all-or-nothing promise only holds for failures we can see up front.
// If OC's cap ever drifts lower, the write-time failure still surfaces
// per-record as "failed"; this constant is a preflight courtesy, not
// the enforcement.
const OC_MEMORY_CONTENT_CAP = 100_000;

// Stored content is `[TitleCaseType] Name\n\n<body>` (entities.ts's
// formatEntityContent): brackets + space + two newlines = 5 chars of
// framing beyond the field lengths themselves.
function storedContentLength(record: ImportRecord): number {
  return record.type.length + record.name.length + record.content.length + 5;
}

// A space separator is unambiguous here: types come from the fixed
// ENTITY_TYPES enum, none of which contain a space, so the first space
// always splits type from name.
function entityKey(type: string, name: string): string {
  return `${type} ${name}`;
}

/** Pure preflight: classify every record against the existing set and
 * the batch itself. Unit-testable without OC. */
export function planImport(
  records: ImportRecord[],
  existingKeys: Set<string>,
  onConflict: OnConflict,
): ImportPlan {
  const seenInBatch = new Map<string, number>();
  const entries: ImportResultEntry[] = records.map((record, index) => {
    if (storedContentLength(record) > OC_MEMORY_CONTENT_CAP) {
      return {
        index,
        type: record.type,
        name: record.name,
        status: "invalid" as const,
        reason: `Content exceeds OC's ${OC_MEMORY_CONTENT_CAP.toLocaleString("en-US")}-char memory cap (stored size ${storedContentLength(record).toLocaleString("en-US")} incl. the [Type] Name header).`,
      };
    }
    const key = entityKey(record.type, record.name);
    const firstIndex = seenInBatch.get(key);
    if (firstIndex !== undefined) {
      return {
        index,
        type: record.type,
        name: record.name,
        status: "duplicate_in_batch" as const,
        reason: `Same (type, name) as record ${firstIndex} — the second write would silently overwrite the first.`,
      };
    }
    seenInBatch.set(key, index);
    if (existingKeys.has(key)) {
      if (onConflict === "overwrite") {
        return {
          index,
          type: record.type,
          name: record.name,
          status: "overwrite" as const,
        };
      }
      if (onConflict === "skip") {
        return {
          index,
          type: record.type,
          name: record.name,
          status: "skip" as const,
          reason: "Entity already exists; on_conflict=skip.",
        };
      }
      return {
        index,
        type: record.type,
        name: record.name,
        status: "conflict" as const,
        reason:
          "Entity already exists; re-invoke with on_conflict=overwrite or =skip to proceed.",
      };
    }
    return {
      index,
      type: record.type,
      name: record.name,
      status: "create" as const,
    };
  });

  const hasInvalid = entries.some((e) => e.status === "invalid");
  const hasDuplicates = entries.some((e) => e.status === "duplicate_in_batch");
  const hasConflicts = entries.some((e) => e.status === "conflict");
  return {
    entries,
    ...(hasInvalid
      ? { aborted: "invalid_records" as const }
      : hasDuplicates
        ? { aborted: "duplicates_in_batch" as const }
        : hasConflicts
          ? { aborted: "conflicts" as const }
          : {}),
  };
}

export interface ImportManifest {
  dry_run: boolean;
  on_conflict: OnConflict;
  aborted?: "invalid_records" | "duplicates_in_batch" | "conflicts";
  results: ImportResultEntry[];
  counts: Record<ImportStatus, number> | Record<string, number>;
  total_written: number;
  duration_ms: number;
  /** Round-trip mode only: where the document came from, and its
   * embedded kindroid_target if any (reported, never applied). */
  file?: {
    path: string;
    story_name: string;
    kindroid_target?: KindroidTarget;
    note?: string;
  };
}

function countStatuses(entries: ImportResultEntry[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const e of entries) counts[e.status] = (counts[e.status] ?? 0) + 1;
  return counts;
}

export interface ImportOptions {
  dryRun: boolean;
  onConflict: OnConflict;
}

/**
 * Full import orchestration against one story: preflight via a single
 * complete enumeration, then (unless dry_run or aborted) sequential
 * writes through the canonical saveEntity path. The preflight's resolved
 * existence — including each existing entity's memory_id — is threaded
 * into every save, so overwrites go update-by-id and creates skip the
 * dedupe search entirely. That matters twice over: saveEntity's own
 * bounded search (SAVE_DEDUPE_SEARCH_TOPK) can MISS in exactly the bulk
 * regime import creates (a 100-scene story whose auto-named scenes share
 * most search tokens), and a miss on the overwrite path would mint a
 * silent (type, name) duplicate — which would then make the story's next
 * export permanently un-importable (preflight aborts on
 * duplicates_in_batch). It also halves the OC round-trips per record.
 * Split from the tool registration so the integration suite can exercise
 * the real OC path directly.
 */
export async function importStory(
  oc: OcClient,
  story: MnemoStory,
  records: ImportRecord[],
  opts: ImportOptions,
): Promise<Omit<ImportManifest, "file">> {
  const start = Date.now();
  const { entities } = await listAllEntities(
    oc,
    story.id,
    story.marker_memory_id,
  );
  const existingByKey = new Map(
    entities.map((e) => [entityKey(e.type, e.name), e]),
  );
  const existingKeys = new Set(existingByKey.keys());
  const plan = planImport(records, existingKeys, opts.onConflict);

  if (opts.dryRun || plan.aborted) {
    return {
      dry_run: opts.dryRun,
      on_conflict: opts.onConflict,
      ...(plan.aborted && { aborted: plan.aborted }),
      results: plan.entries,
      counts: countStatuses(plan.entries),
      total_written: 0,
      duration_ms: Date.now() - start,
    };
  }

  const results: ImportResultEntry[] = [];
  for (const entry of plan.entries) {
    if (entry.status === "skip") {
      results.push({ ...entry, status: "skipped" });
      continue;
    }
    const record = records[entry.index]!;
    const known = existingByKey.get(entityKey(record.type, record.name));
    try {
      const saved = await saveEntity(oc, story.id, {
        type: record.type,
        name: record.name,
        body: record.content,
        pinned: record.pinned,
        extraTags: record.tags,
        createdAt: record.created_at,
        existing: known
          ? {
              memoryId: known.memory_id,
              tags: known.tags,
              pinned: known.pinned,
            }
          : null,
      });
      results.push({
        index: entry.index,
        type: record.type,
        name: record.name,
        status: saved.created ? "created" : "overwritten",
        memory_id: saved.memory_id,
      });
    } catch (err) {
      results.push({
        index: entry.index,
        type: record.type,
        name: record.name,
        status: "failed",
        reason: (err as Error).message,
      });
    }
  }

  return {
    dry_run: false,
    on_conflict: opts.onConflict,
    results,
    counts: countStatuses(results),
    total_written: results.filter(
      (r) => r.status === "created" || r.status === "overwritten",
    ).length,
    duration_ms: Date.now() - start,
  };
}

/** Read + parse an export document from disk (round-trip mode). The path
 * is resolved for the same reason export resolves its out_path: a stdio
 * server's cwd is unpredictable. */
export async function readExportFile(
  filePath: string,
): Promise<ParsedExportFile & { resolvedPath: string }> {
  const resolvedPath = resolve(filePath);
  const raw = await fs.readFile(resolvedPath, "utf8");
  return { ...parseExportDocument(raw), resolvedPath };
}
