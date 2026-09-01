// mnemo_export_story coverage. Pure unit tests (document assembly,
// filename slugging) run unconditionally; the integration suite exercises
// the real OC round-trip — listAllEntities completeness, marker exclusion,
// and the actual file write — and skips without OC_URL.

import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  buildExportDocument,
  buildStoryIndex,
  defaultExportFilename,
  defaultExportPath,
  storySlug,
  exportStory,
  type StoryExportDocument,
} from "../src/export.js";
import { listAllEntities, saveEntity } from "../src/entities.js";
import { setKindroidTarget, findStory } from "../src/stories.js";
import type { RecalledEntity } from "../src/entities.js";
import type { MnemoStory } from "../src/stories.js";
import type { OcClient } from "../src/oc-client.js";
import { setupTestStory, teardownStory } from "./helpers.js";

const STORY: MnemoStory = {
  id: "11111111-2222-3333-4444-555555555555",
  name: "Dovecoast",
  created_at: "2026-05-12T00:00:00.000Z",
  marker_memory_id: "marker-1",
};

const ENTITY: RecalledEntity = {
  type: "character",
  name: "Aria Voss",
  body: "A cartographer with salt-stained charts.",
  memory_id: "mem-1",
  pinned: false,
  tags: ["mnemosyne", "story", "character"],
  created_at: "2026-05-12T01:00:00.000Z",
};

describe("buildExportDocument (pure)", () => {
  it("assembles the versioned document shape", () => {
    const doc = buildExportDocument(
      STORY,
      [ENTITY],
      "2026-08-21T12:00:00.000Z",
    );
    // Literal 1, NOT the imported constant — the version gate is the
    // design's riskiest commitment, and pinning it to itself would let a
    // casual bump ship without failing a single test. Bumping the schema
    // must force a conscious edit here.
    expect(doc.mnemosyne_export).toBe(1);
    // Pin the top-level envelope too: an accidental new top-level key is
    // a schema change and must not ship silently.
    expect(Object.keys(doc).sort()).toEqual([
      "entities",
      "exported_at",
      "mnemosyne_export",
      "story",
    ]);
    expect(doc.exported_at).toBe("2026-08-21T12:00:00.000Z");
    expect(doc.story).toEqual({
      name: "Dovecoast",
      created_at: "2026-05-12T00:00:00.000Z",
    });
    expect(doc.entities).toEqual([
      {
        type: "character",
        name: "Aria Voss",
        content: "A cartographer with salt-stained charts.",
        pinned: false,
        tags: ["mnemosyne", "story", "character"],
        created_at: "2026-05-12T01:00:00.000Z",
      },
    ]);
  });

  it("serializes the body without the [Type] Name storage header", () => {
    const doc = buildExportDocument(
      STORY,
      [ENTITY],
      "2026-08-21T12:00:00.000Z",
    );
    expect(doc.entities[0]!.content).not.toContain("[Character]");
  });

  it("includes kindroid_target when the story has one, omits the key otherwise", () => {
    const bound = buildExportDocument(
      { ...STORY, kindroid_target: { type: "group", id: "grp123" } },
      [],
      "2026-08-21T12:00:00.000Z",
    );
    expect(bound.story.kindroid_target).toEqual({
      type: "group",
      id: "grp123",
    });

    const unbound = buildExportDocument(STORY, [], "2026-08-21T12:00:00.000Z");
    expect("kindroid_target" in unbound.story).toBe(false);
  });

  it("preserves out-of-band tags (validation state) verbatim", () => {
    const doc = buildExportDocument(
      STORY,
      [
        {
          ...ENTITY,
          type: "scene",
          tags: ["mnemosyne", "story", "scene", "validation:clean"],
        },
      ],
      "2026-08-21T12:00:00.000Z",
    );
    expect(doc.entities[0]!.tags).toContain("validation:clean");
  });
});

describe("defaultExportFilename (pure)", () => {
  it("slugs the story name and stamps a to-the-second UTC timestamp (colons stripped for Windows)", () => {
    expect(
      defaultExportFilename("Kimmy's Night Shift", "2026-08-21T12:00:05.123Z"),
    ).toBe("kimmy-s-night-shift-2026-08-21T120005.json");
  });

  it("falls back to the story id's prefix when the name slugs to nothing", () => {
    expect(
      defaultExportFilename(
        "!!!",
        "2026-08-21T12:00:00.000Z",
        "11111111-2222-3333-4444-555555555555",
      ),
    ).toBe("story-11111111-2026-08-21T120000.json");
  });

  it("falls back to bare 'story' when no id is supplied either", () => {
    expect(defaultExportFilename("!!!", "2026-08-21T12:00:00.000Z")).toBe(
      "story-2026-08-21T120000.json",
    );
  });
});

describe("defaultExportPath (pure)", () => {
  it("lands in the story's data subtree: stories/<slug>/exports/<file>", () => {
    // Adversarial-review regression: this is the ?? branch exportStory
    // takes when no out_path is given — previously untested entirely.
    const saved = process.env.MNEMO_DATA_DIR;
    const dataRoot = join(tmpdir(), "mnemo-default-path");
    process.env.MNEMO_DATA_DIR = dataRoot;
    try {
      expect(defaultExportPath("Chaos Saga", "2026-08-21T12:00:05.123Z")).toBe(
        join(
          dataRoot,
          "stories",
          "chaos-saga",
          "exports",
          "chaos-saga-2026-08-21T120005.json",
        ),
      );
    } finally {
      if (saved === undefined) delete process.env.MNEMO_DATA_DIR;
      else process.env.MNEMO_DATA_DIR = saved;
    }
  });
});

describe("buildStoryIndex (pure)", () => {
  it("captures the slug↔story join and nothing derivable", () => {
    expect(buildStoryIndex(STORY, "2026-08-23T05:00:00.000Z")).toEqual({
      mnemosyne_story: 1,
      story: {
        id: STORY.id,
        name: "Dovecoast",
        created_at: STORY.created_at,
      },
      slug: "dovecoast",
      updated_at: "2026-08-23T05:00:00.000Z",
    });
  });
});

describe("storySlug (pure)", () => {
  it("names the per-story exports subfolder identically to the filename slug", () => {
    expect(storySlug("Chaos Saga")).toBe("chaos-saga");
    expect(storySlug("Kimmy's Night Shift")).toBe("kimmy-s-night-shift");
    expect(storySlug("The Miskatonic Archives: The Blackwood Case")).toBe(
      "miskatonic-archives-the-blackwood-case",
    );
    expect(storySlug("The Adjustment Protocol")).toBe(
      "the-adjustment-protocol",
    );
  });

  it("shares the filename builder's id-prefix fallback", () => {
    expect(storySlug("!!!", "11111111-2222-3333-4444-555555555555")).toBe(
      "story-11111111",
    );
    expect(storySlug("!!!")).toBe("story");
  });
});

// ---------------------------------------------------------------------------
// Integration: real OC round-trip. Skips without OC_URL.
// ---------------------------------------------------------------------------

const OC_URL = process.env.OC_URL;

const suite = OC_URL ? describe : describe.skip;

suite("exportStory (integration, real OC)", () => {
  let oc: OcClient;
  let storyId: string;
  let outDir: string;

  beforeAll(async () => {
    ({ oc, storyId } = await setupTestStory(OC_URL!, "export"));
    outDir = await mkdtemp(join(tmpdir(), "mnemo-export-"));
    await saveEntity(oc, storyId, {
      type: "character",
      name: "Aria Voss",
      body: "A cartographer.",
    });
    await saveEntity(oc, storyId, {
      type: "rule",
      name: "Tense",
      body: "Past tense only.",
    });
    await saveEntity(oc, storyId, {
      type: "scene",
      name: "Opening",
      body: "The fog rolled in.",
      extraTags: ["validation:clean"],
    });
    // Regression (adversarial review, finding 1): a legitimate entity
    // carrying "story-marker" as an extra tag must still export — the
    // real marker is excluded by memory ID, never by tag.
    await saveEntity(oc, storyId, {
      type: "lore",
      name: "Rogue Tag",
      body: "An entity whose tags collide with the marker's.",
      extraTags: ["story-marker"],
    });
  }, 60_000);

  afterAll(async () => {
    await teardownStory(oc, storyId);
    if (outDir) await rm(outDir, { recursive: true, force: true });
  });

  it("enumerates every entity, excludes the marker by ID, and keeps marker-tagged entities", async () => {
    const story = await findStory(oc, storyId);
    expect(story).not.toBeNull();
    const { entities, skipped_memory_ids } = await listAllEntities(
      oc,
      storyId,
      story!.marker_memory_id,
    );
    expect(entities).toHaveLength(4);
    expect(entities.map((e) => e.type).sort()).toEqual([
      "character",
      "lore",
      "rule",
      "scene",
    ]);
    // The "story-marker"-tagged lore entity survives — exclusion is by
    // the marker's memory ID, not its tag.
    expect(entities.some((e) => e.name === "Rogue Tag")).toBe(true);
    // The real marker is identity-excluded, so an honest skipped list is
    // empty for a normal story.
    expect(skipped_memory_ids).toEqual([]);
  });

  it("writes the document, and the manifest matches the file contents", async () => {
    const story = await findStory(oc, storyId);
    expect(story).not.toBeNull();
    const bound = await setKindroidTarget(oc, story!, {
      type: "group",
      id: "grp-test",
    });

    const outPath = join(outDir, "export.json");
    const manifest = await exportStory(oc, bound, outPath);

    expect(manifest.path).toBe(outPath);
    expect(manifest.schema).toBe(1);
    expect(manifest.total).toBe(4);
    expect(manifest.counts.character).toBe(1);
    expect(manifest.counts.rule).toBe(1);
    expect(manifest.counts.scene).toBe(1);
    expect(manifest.counts.lore).toBe(1);
    expect(manifest.counts.worldbuilding).toBe(0);
    expect(manifest.story.kindroid_target).toEqual({
      type: "group",
      id: "grp-test",
    });

    const doc = JSON.parse(
      await readFile(outPath, "utf8"),
    ) as StoryExportDocument;
    expect(doc.mnemosyne_export).toBe(1);
    expect(doc.story.kindroid_target).toEqual({
      type: "group",
      id: "grp-test",
    });
    expect(doc.entities).toHaveLength(4);

    const scene = doc.entities.find((e) => e.type === "scene");
    expect(scene?.tags).toContain("validation:clean");
    expect(scene?.content).toBe("The fog rolled in.");
    // Round-trip fidelity: created_at present so a future import can
    // backdate via OC's memory_save.
    for (const entity of doc.entities) {
      expect(entity.created_at).toBeTruthy();
    }
  }, 60_000);

  it("default-path export lands in stories/<slug>/exports and refreshes story.json", async () => {
    const story = await findStory(oc, storyId);
    expect(story).not.toBeNull();

    const savedEnv = process.env.MNEMO_DATA_DIR;
    const dataRoot = await mkdtemp(join(tmpdir(), "mnemo-data-"));
    process.env.MNEMO_DATA_DIR = dataRoot;
    try {
      const manifest = await exportStory(oc, story!);

      const storyRoot = dirname(dirname(manifest.path));
      expect(dirname(storyRoot)).toBe(join(dataRoot, "stories"));
      expect(basename(dirname(manifest.path))).toBe("exports");

      const index = JSON.parse(
        await readFile(join(storyRoot, "story.json"), "utf8"),
      ) as { mnemosyne_story: number; story: { id: string }; slug: string };
      expect(index.mnemosyne_story).toBe(1);
      expect(index.story.id).toBe(storyId);
      expect(index.slug).toBe(basename(storyRoot));
    } finally {
      if (savedEnv === undefined) delete process.env.MNEMO_DATA_DIR;
      else process.env.MNEMO_DATA_DIR = savedEnv;
      await rm(dataRoot, { recursive: true, force: true });
    }
  }, 60_000);
});
