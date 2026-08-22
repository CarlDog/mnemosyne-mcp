// Story export — serialize a story's full OC project to a versioned JSON
// interchange document. See docs/IMPORT_EXPORT_DESIGN.md for the ratified
// design; the schema here is the design's riskiest commitment (once export
// files exist, changing it is a data migration), which is why it carries a
// version number from day one.
//
// Deliberate schema decisions (all recorded in the design doc):
// - kindroid_target is included when bound — portable across machines,
//   NOT across Kindroid accounts (ids are account-specific).
// - tags are preserved verbatim: validation:clean/errors carries the
//   v0.1.3 scene-filtering state; losing it on round-trip would silently
//   degrade context assembly.
// - per-entity created_at is preserved because OC's memory_save supports
//   backdating — a future import can restore timestamps, which protects
//   RECENT SCENES recency behavior from re-imported legacy scenes.
// - The document is written to a file and NOT echoed into the tool
//   response: export content needs no host judgment, so routing a
//   100-scene story through host context is pure waste (stdio-era
//   contract; revisit retrieval when HTTP transport exists).

import { promises as fs } from "node:fs";
import { dirname, join, resolve } from "node:path";
import {
  ENTITY_TYPES,
  listAllEntities,
  type EntityType,
  type RecalledEntity,
} from "./entities.js";
import { exportsDir } from "./config.js";
import type { OcClient } from "./oc-client.js";
import type { KindroidTarget, MnemoStory } from "./stories.js";

export const EXPORT_SCHEMA_VERSION = 1;

export interface ExportedEntity {
  type: EntityType;
  name: string;
  /** Entity body only — the `[Type] Name` header is storage encoding,
   * reconstructed on import, never serialized. */
  content: string;
  pinned: boolean;
  tags: string[];
  created_at: string;
}

export interface StoryExportDocument {
  mnemosyne_export: typeof EXPORT_SCHEMA_VERSION;
  exported_at: string;
  story: {
    name: string;
    created_at: string;
    kindroid_target?: KindroidTarget;
  };
  entities: ExportedEntity[];
}

export interface ExportManifest {
  path: string;
  schema: typeof EXPORT_SCHEMA_VERSION;
  /** Deliberately mirrors the document's own `kindroid_target` shape
   * (this manifest describes the file's schema) rather than the
   * kindroid_kin/kindroid_group_id param mirroring the story tools'
   * responses use — see tools/stories.ts for that convention. */
  story: { id: string; name: string; kindroid_target?: KindroidTarget };
  counts: Record<EntityType, number>;
  total: number;
  /** OC memory ids in the project that are neither the story marker nor
   * parseable entities — surfaced so nothing is silently absent from the
   * document. Non-empty is unusual, not an error. */
  skipped_memory_ids: string[];
}

/** Pure document assembly — unit-testable without OC or a filesystem. */
export function buildExportDocument(
  story: MnemoStory,
  entities: RecalledEntity[],
  exportedAt: string,
): StoryExportDocument {
  return {
    mnemosyne_export: EXPORT_SCHEMA_VERSION,
    exported_at: exportedAt,
    story: {
      name: story.name,
      created_at: story.created_at,
      ...(story.kindroid_target && {
        kindroid_target: story.kindroid_target,
      }),
    },
    entities: entities.map((e) => ({
      type: e.type,
      name: e.name,
      content: e.body,
      pinned: e.pinned,
      tags: e.tags,
      created_at: e.created_at,
    })),
  };
}

/** `<slugged-story-name>-<utc-timestamp>.json`. Slug keeps [a-z0-9-]
 * only so the name is safe on every filesystem the config dir can live
 * on. The timestamp is UTC to the second (matching `exported_at`, colons
 * stripped for Windows) so back-to-back exports of one story never
 * silently overwrite each other — the concrete loss scenario is
 * export-as-backup, run an import, export again "to inspect", and the
 * pre-import backup is gone. A name that slugs to nothing (e.g. entirely
 * non-Latin) falls back to the story id's prefix rather than a shared
 * "story" bucket, so two such stories can't collide either. */
export function defaultExportFilename(
  storyName: string,
  exportedAt: string,
  storyId?: string,
): string {
  const slug =
    storyName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") ||
    (storyId ? `story-${storyId.slice(0, 8)}` : "story");
  const stamp = exportedAt.slice(0, 19).replace(/:/g, "");
  return `${slug}-${stamp}.json`;
}

function countByType(entities: RecalledEntity[]): Record<EntityType, number> {
  const counts = Object.fromEntries(ENTITY_TYPES.map((t) => [t, 0])) as Record<
    EntityType,
    number
  >;
  for (const e of entities) counts[e.type] += 1;
  return counts;
}

/**
 * Full export orchestration: enumerate every entity, assemble the
 * document, write it to `outPath` (default: the config-dir exports
 * folder), and return the manifest the tool response surfaces. Split from
 * the tool registration so the integration suite can exercise the real
 * OC-to-file path with an explicit temp destination.
 */
export async function exportStory(
  oc: OcClient,
  story: MnemoStory,
  outPath?: string,
): Promise<ExportManifest> {
  const exportedAt = new Date().toISOString();
  const { entities, skipped_memory_ids } = await listAllEntities(
    oc,
    story.id,
    story.marker_memory_id,
  );
  const document = buildExportDocument(story, entities, exportedAt);
  // resolve(): a relative outPath would otherwise land wherever the MCP
  // server process's cwd happens to be (unpredictable under a stdio
  // host), and the manifest's `path` is the document's only retrieval
  // handle — it must be unambiguous.
  const path = resolve(
    outPath ??
      join(
        exportsDir(),
        defaultExportFilename(story.name, exportedAt, story.id),
      ),
  );
  await fs.mkdir(dirname(path), { recursive: true });
  await fs.writeFile(path, JSON.stringify(document, null, 2) + "\n", "utf8");
  return {
    path,
    schema: EXPORT_SCHEMA_VERSION,
    story: {
      id: story.id,
      name: story.name,
      ...(story.kindroid_target && {
        kindroid_target: story.kindroid_target,
      }),
    },
    counts: countByType(entities),
    total: entities.length,
    skipped_memory_ids,
  };
}
