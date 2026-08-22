// mnemo_import_story coverage. Pure unit tests (preflight planning,
// export-document parsing/version gate) run unconditionally; the
// integration suite exercises the real OC path — batch create, dry_run
// writes-nothing, conflict abort, skip/overwrite, created_at backdating,
// and the full export→import round-trip into a second story — and skips
// without OC_URL.

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  importStory,
  parseExportDocument,
  planImport,
  readExportFile,
  type ImportRecord,
} from "../src/import.js";
import { exportStory } from "../src/export.js";
import { listAllEntities, saveEntity } from "../src/entities.js";
import { createStory, findStory } from "../src/stories.js";
import type { MnemoStory } from "../src/stories.js";
import type { OcClient } from "../src/oc-client.js";
import { setupTestStory, teardownStory, testStoryName } from "./helpers.js";

const RECORD: ImportRecord = {
  type: "character",
  name: "Aria Voss",
  content: "A cartographer.",
};

describe("planImport (pure)", () => {
  it("plans create for records with no existing counterpart", () => {
    const plan = planImport([RECORD], new Set(), "error");
    expect(plan.aborted).toBeUndefined();
    expect(plan.entries).toEqual([
      { index: 0, type: "character", name: "Aria Voss", status: "create" },
    ]);
  });

  it("aborts on conflict under on_conflict=error, with a would-be status per record", () => {
    const plan = planImport(
      [RECORD, { ...RECORD, name: "Holt" }],
      new Set(["character Aria Voss"]),
      "error",
    );
    expect(plan.aborted).toBe("conflicts");
    expect(plan.entries[0]!.status).toBe("conflict");
    expect(plan.entries[1]!.status).toBe("create");
  });

  it("marks conflicts skip/overwrite under those modes without aborting", () => {
    const existing = new Set(["character Aria Voss"]);
    expect(planImport([RECORD], existing, "skip").entries[0]!.status).toBe(
      "skip",
    );
    expect(planImport([RECORD], existing, "overwrite").entries[0]!.status).toBe(
      "overwrite",
    );
    expect(planImport([RECORD], existing, "skip").aborted).toBeUndefined();
  });

  it("aborts on an in-batch duplicate regardless of conflict mode, naming the first index", () => {
    const plan = planImport([RECORD, { ...RECORD }], new Set(), "overwrite");
    expect(plan.aborted).toBe("duplicates_in_batch");
    expect(plan.entries[1]!.status).toBe("duplicate_in_batch");
    expect(plan.entries[1]!.reason).toContain("record 0");
  });

  it("does not confuse same-name entities of different types", () => {
    const plan = planImport(
      [RECORD, { ...RECORD, type: "location" }],
      new Set(),
      "error",
    );
    expect(plan.aborted).toBeUndefined();
    expect(plan.entries.map((e) => e.status)).toEqual(["create", "create"]);
  });

  it("aborts on a record exceeding OC's content cap — a statically-knowable failure must not slip past preflight", () => {
    const plan = planImport(
      [
        { ...RECORD, content: "x".repeat(100_001) },
        { ...RECORD, name: "Holt" },
      ],
      new Set(),
      "error",
    );
    expect(plan.aborted).toBe("invalid_records");
    expect(plan.entries[0]!.status).toBe("invalid");
    expect(plan.entries[0]!.reason).toContain("100,000");
    expect(plan.entries[1]!.status).toBe("create");
  });
});

describe("parseExportDocument (pure)", () => {
  const VALID_DOC = {
    mnemosyne_export: 1,
    exported_at: "2026-08-21T12:00:00.000Z",
    story: {
      name: "Dovecoast",
      created_at: "2026-05-12T00:00:00.000Z",
      kindroid_target: { type: "group", id: "grp123" },
    },
    entities: [
      {
        type: "character",
        name: "Aria Voss",
        content: "A cartographer.",
        pinned: false,
        tags: ["mnemosyne", "story", "character"],
        created_at: "2026-05-12T01:00:00.000Z",
      },
    ],
  };

  it("parses a valid document, surfacing records and the (unapplied) kindroid target", () => {
    const parsed = parseExportDocument(JSON.stringify(VALID_DOC));
    expect(parsed.storyName).toBe("Dovecoast");
    expect(parsed.kindroidTarget).toEqual({ type: "group", id: "grp123" });
    expect(parsed.records).toHaveLength(1);
    expect(parsed.records[0]!.type).toBe("character");
  });

  it("rejects a future schema version with a version-specific message", () => {
    expect(() =>
      parseExportDocument(
        JSON.stringify({ ...VALID_DOC, mnemosyne_export: 2 }),
      ),
    ).toThrow(/Unsupported export schema version 2/);
  });

  it("rejects JSON that is not an export document at all", () => {
    expect(() =>
      parseExportDocument(JSON.stringify({ hello: "world" })),
    ).toThrow(/no mnemosyne_export field/);
    expect(() => parseExportDocument("not json {")).toThrow(/not valid JSON/);
  });

  it("rejects a structurally invalid document, naming the failing path", () => {
    const bad = {
      ...VALID_DOC,
      entities: [{ type: "spaceship", name: "X", content: "Y" }],
    };
    expect(() => parseExportDocument(JSON.stringify(bad))).toThrow(
      /entities\.0\.type/,
    );
  });

  it("rejects a non-ISO created_at statically — OC would reject it mid-batch otherwise", () => {
    const bad = {
      ...VALID_DOC,
      entities: [
        { type: "scene", name: "X", content: "Y", created_at: "yesterday" },
      ],
    };
    expect(() => parseExportDocument(JSON.stringify(bad))).toThrow(
      /entities\.0\.created_at/,
    );
    // The formats mnemosyne itself round-trips must pass: JS toISOString
    // (Z suffix) and Python isoformat (+00:00 offset, microseconds).
    for (const good of [
      "2026-08-21T12:00:00.000Z",
      "2026-08-22T03:17:29.938031+00:00",
    ]) {
      const doc = {
        ...VALID_DOC,
        entities: [
          { type: "scene", name: "X", content: "Y", created_at: good },
        ],
      };
      expect(() => parseExportDocument(JSON.stringify(doc))).not.toThrow();
    }
  });

  it("rejects an entity name containing a line break — it would create a permanently invisible memory", () => {
    const bad = {
      ...VALID_DOC,
      entities: [{ type: "character", name: "A\nB", content: "Y" }],
    };
    expect(() => parseExportDocument(JSON.stringify(bad))).toThrow(
      /entities\.0\.name/,
    );
  });
});

describe("readExportFile (pure, filesystem only)", () => {
  it("refuses a tampered or future-version file", async () => {
    const dir = await mkdtemp(join(tmpdir(), "mnemo-import-pure-"));
    try {
      const badPath = join(dir, "future.json");
      await writeFile(
        badPath,
        JSON.stringify({ mnemosyne_export: 99, entities: [] }),
        "utf8",
      );
      await expect(readExportFile(badPath)).rejects.toThrow(
        /Unsupported export schema version 99/,
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// Integration: real OC. Skips without OC_URL.
// ---------------------------------------------------------------------------

const OC_URL = process.env.OC_URL;

const suite = OC_URL ? describe : describe.skip;

suite("importStory (integration, real OC)", () => {
  let oc: OcClient;
  let storyAId: string; // source story: seeded, exported
  let storyB: MnemoStory; // destination story: imported into
  let outDir: string;

  const BACKDATE = "2025-05-07T12:00:00.000Z";

  beforeAll(async () => {
    ({ oc, storyId: storyAId } = await setupTestStory(OC_URL!, "import-src"));
    storyB = await createStory(oc, testStoryName("import-dst"));
    outDir = await mkdtemp(join(tmpdir(), "mnemo-import-"));
    await saveEntity(oc, storyAId, {
      type: "character",
      name: "Aria Voss",
      body: "A cartographer.",
    });
    await saveEntity(oc, storyAId, {
      type: "rule",
      name: "Tense",
      body: "Past tense only.",
    });
    await saveEntity(oc, storyAId, {
      type: "scene",
      name: "Opening",
      body: "The fog rolled in.",
      extraTags: ["validation:clean"],
      createdAt: BACKDATE,
    });
  }, 60_000);

  afterAll(async () => {
    // teardownStory closes the shared client, so delete story B first.
    if (storyB) {
      try {
        await oc.projectDelete(storyB.id);
      } catch {
        // best-effort, matching teardownStory's tolerance
      }
    }
    await teardownStory(oc, storyAId);
    if (outDir) await rm(outDir, { recursive: true, force: true });
  });

  it("round-trips export → import into a second story with full fidelity", async () => {
    const exportPath = join(outDir, "roundtrip.json");
    const storyA = await findStory(oc, storyAId);
    await exportStory(oc, storyA!, exportPath);

    const { records, kindroidTarget } = await readExportFile(exportPath);
    expect(kindroidTarget).toBeUndefined();
    const manifest = await importStory(oc, storyB, records, {
      dryRun: false,
      onConflict: "error",
    });

    expect(manifest.aborted).toBeUndefined();
    expect(manifest.total_written).toBe(3);
    expect(manifest.counts["created"]).toBe(3);

    const imported = await listAllEntities(
      oc,
      storyB.id,
      storyB.marker_memory_id,
    );
    expect(imported.entities).toHaveLength(3);
    const byName = new Map(imported.entities.map((e) => [e.name, e]));
    expect(byName.get("Aria Voss")?.body).toBe("A cartographer.");
    expect(byName.get("Tense")?.pinned).toBe(true); // rule pin state survives
    const scene = byName.get("Opening");
    expect(scene?.tags).toContain("validation:clean"); // validation state survives
    // OC honored the backdate: the re-imported scene carries story A's
    // original timestamp, not the import moment. Verified against the
    // live response, not the docs.
    expect(scene?.created_at.slice(0, 19)).toBe(BACKDATE.slice(0, 19));
  }, 120_000);

  it("dry_run previews conflicts without writing anything", async () => {
    const before = await listAllEntities(
      oc,
      storyB.id,
      storyB.marker_memory_id,
    );
    const manifest = await importStory(
      oc,
      storyB,
      [
        { type: "character", name: "Aria Voss", content: "Different text." },
        { type: "lore", name: "New Legend", content: "Fresh content." },
      ],
      { dryRun: true, onConflict: "error" },
    );
    expect(manifest.dry_run).toBe(true);
    expect(manifest.total_written).toBe(0);
    expect(manifest.results.map((r) => r.status)).toEqual([
      "conflict",
      "create",
    ]);
    const after = await listAllEntities(oc, storyB.id, storyB.marker_memory_id);
    expect(after.entities).toHaveLength(before.entities.length);
  }, 60_000);

  it("aborts a real run on conflict by default, writing nothing — including the clean records", async () => {
    const manifest = await importStory(
      oc,
      storyB,
      [
        { type: "character", name: "Aria Voss", content: "Clobber attempt." },
        { type: "lore", name: "New Legend", content: "Fresh content." },
      ],
      { dryRun: false, onConflict: "error" },
    );
    expect(manifest.aborted).toBe("conflicts");
    expect(manifest.total_written).toBe(0);
    const { entities } = await listAllEntities(
      oc,
      storyB.id,
      storyB.marker_memory_id,
    );
    expect(entities.some((e) => e.name === "New Legend")).toBe(false);
    expect(entities.find((e) => e.name === "Aria Voss")?.body).toBe(
      "A cartographer.",
    );
  }, 60_000);

  it("on_conflict=skip writes only the new records; =overwrite updates in place", async () => {
    const skipRun = await importStory(
      oc,
      storyB,
      [
        { type: "character", name: "Aria Voss", content: "Clobber attempt." },
        { type: "lore", name: "New Legend", content: "Fresh content." },
      ],
      { dryRun: false, onConflict: "skip" },
    );
    expect(skipRun.results.map((r) => r.status)).toEqual([
      "skipped",
      "created",
    ]);
    expect(skipRun.total_written).toBe(1);

    const overwriteRun = await importStory(
      oc,
      storyB,
      [{ type: "character", name: "Aria Voss", content: "Rewritten." }],
      { dryRun: false, onConflict: "overwrite" },
    );
    expect(overwriteRun.results[0]!.status).toBe("overwritten");

    const { entities } = await listAllEntities(
      oc,
      storyB.id,
      storyB.marker_memory_id,
    );
    expect(entities.find((e) => e.name === "Aria Voss")?.body).toBe(
      "Rewritten.",
    );
    expect(entities.some((e) => e.name === "New Legend")).toBe(true);
  }, 120_000);
});
