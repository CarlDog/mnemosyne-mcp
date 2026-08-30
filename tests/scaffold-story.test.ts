import { execFile } from "node:child_process";
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
// The scaffolder is deliberately an operator-facing Node ESM script rather
// than part of the TypeScript build.
// @ts-expect-error -- operational .mjs modules do not emit TypeScript declarations.
import * as scaffolder from "../scripts/scaffold-story.mjs";
// @ts-expect-error -- operational .mjs modules do not emit TypeScript declarations.
import * as compiler from "../scripts/compile-story.mjs";

const { parseArgs, REPO_ROOT, scaffoldStory } = scaffolder;
const { compileCanonDirectory } = compiler;
const execFileAsync = promisify(execFile);
const roots: string[] = [];

type ExportEntity = {
  type: string;
  name: string;
  content: string;
  pinned?: boolean;
  tags?: string[];
  created_at?: string;
};

const TEST_TIME = "2026-08-30T12:00:00.000Z";

function exportDocument(entities: ExportEntity[]) {
  return {
    mnemosyne_export: 1,
    exported_at: TEST_TIME,
    story: {
      name: "Safe Story",
      created_at: "2026-08-23T05:40:10.768Z",
    },
    entities,
  };
}

async function makeRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "mnemo-scaffold-story-"));
  roots.push(root);
  return root;
}

async function writeExport(
  file: string,
  entities: ExportEntity[],
): Promise<void> {
  await writeJson(file, exportDocument(entities));
}

async function writeJson(file: string, value: unknown): Promise<void> {
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function exists(file: string): Promise<boolean> {
  try {
    await lstat(file);
    return true;
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return false;
    }
    throw error;
  }
}

function options(base: string, out: string) {
  return {
    slug: "safe-story",
    base,
    merges: [],
    out,
    coreThreshold: 1,
  };
}

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("scaffold-story safety", () => {
  it("resolves the default canon target from the repository even in another cwd", async () => {
    const root = await makeRoot();
    const scriptUrl = new URL("../scripts/scaffold-story.mjs", import.meta.url);
    const code = `import { parseArgs } from ${JSON.stringify(
      scriptUrl.href,
    )}; process.stdout.write(parseArgs(["stable-story", "--base", "base.json"]).out);`;

    const { stdout } = await execFileAsync(
      process.execPath,
      ["--input-type=module", "--eval", code],
      { cwd: root },
    );

    expect(stdout).toBe(
      join(REPO_ROOT, "data", "stories", "stable-story", "canon"),
    );
    expect(parseArgs(["stable-story", "--base", "base.json"]).out).toBe(stdout);
  });

  it.each([
    {
      label: "a missing version",
      document: (() => {
        const valid = exportDocument([
          { type: "location", name: "Harbor", content: "A safe harbor." },
        ]);
        return {
          exported_at: valid.exported_at,
          story: valid.story,
          entities: valid.entities,
        };
      })(),
      error: /no mnemosyne_export field/i,
    },
    {
      label: "an unsupported version",
      document: {
        ...exportDocument([
          { type: "location", name: "Harbor", content: "A safe harbor." },
        ]),
        mnemosyne_export: 2,
      },
      error: /unsupported export schema version 2/i,
    },
    {
      label: "an arbitrary entities-only object",
      document: {
        entities: [
          { type: "location", name: "Harbor", content: "A safe harbor." },
        ],
      },
      error: /no mnemosyne_export field/i,
    },
  ])(
    "rejects $label before mapping or staging",
    async ({ document, error }) => {
      const root = await makeRoot();
      const base = join(root, "invalid-envelope.json");
      const out = join(root, "invalid-envelope", "canon");
      await writeJson(base, document);

      await expect(scaffoldStory(options(base, out))).rejects.toThrow(error);
      expect(await exists(out)).toBe(false);
      expect(await exists(dirname(out))).toBe(false);
    },
  );

  it("preflights one finished tree while preserving a display alias without changing identity", async () => {
    const root = await makeRoot();
    const base = join(root, "base.json");
    const out = join(root, "story", "canon");
    await writeExport(base, [
      {
        type: "character",
        name: "Runtime Identity",
        content:
          "Name: Display Alias\n\n## Current State\n\nReady for the next scene.",
      },
      {
        type: "location",
        name: "North Harbor",
        content: "Three piers surround a tidal basin.",
      },
      {
        type: "rule",
        name: "Evidence First",
        content: "Discovery must precede certainty.",
      },
      {
        type: "scene",
        name: "Generated Beat",
        content: "This generated beat is not promoted automatically.",
      },
    ]);

    const result = await scaffoldStory(options(base, out));

    expect(result.out).toBe(out);
    expect(result.importCheck).toMatchObject({
      dry_run: true,
      total_written: 0,
      records: 3,
    });
    expect(
      await readFile(join(out, "characters", "runtime-identity.md"), "utf8"),
    ).toContain("name: Runtime Identity\ncurrent_name: Display Alias");
    expect(
      await readFile(join(out, "locations", "north-harbor.md"), "utf8"),
    ).toContain("name: North Harbor");
    expect(await readFile(join(out, "rules.md"), "utf8")).toContain(
      "## Evidence First",
    );
    expect(await exists(join(out, "scenes"))).toBe(false);
    const compiled = await compileCanonDirectory({
      slug: "safe-story",
      dir: out,
    });
    const character = compiled.records.find(
      (record: { name: string }) => record.name === "Runtime Identity",
    );
    expect(character.content).toContain("Current Name: Display Alias");
    expect(
      compiled.records.some(
        (record: { name: string }) => record.name === "Display Alias",
      ),
    ).toBe(false);
    expect(
      (await readdir(dirname(out))).filter((name) =>
        name.startsWith(".canon.scaffold-"),
      ),
    ).toEqual([]);
  });

  it("round-trips real export metadata through one-file and batched canon", async () => {
    const root = await makeRoot();
    const base = join(root, "metadata.json");
    const out = join(root, "metadata", "canon");
    const entities: ExportEntity[] = [
      {
        type: "character",
        name: "Rhea Voss",
        content:
          "Name: Captain Rhea\n\n## Current State\n\nRhea is charting the flooded observatory while the harbor watch closes in around her crew.",
        pinned: true,
        tags: [
          "mnemosyne",
          "story",
          "character",
          "character-focus",
          "validation:clean",
        ],
        created_at: "2026-08-23T05:40:38.495493+00:00",
      },
      {
        type: "character",
        name: "Dockmaster Vale",
        content: "Keeps the tide ledger under lock.",
        pinned: false,
        tags: ["mnemosyne", "story", "character", "encounter"],
        created_at: "2026-08-23T05:41:00.000Z",
      },
      {
        type: "location",
        name: "Flooded Observatory",
        content: "A brass dome rises above the spring tide.",
        pinned: true,
        tags: ["mnemosyne", "story", "location", "active-location"],
        created_at: "2026-08-23T05:42:00.000Z",
      },
      {
        type: "rule",
        name: "Evidence First",
        content: "Discovery must precede certainty.",
        pinned: false,
        tags: ["mnemosyne", "story", "rule", "investigation"],
        created_at: "2026-08-23T05:43:00.000Z",
      },
      {
        type: "style",
        name: "Tidal Prose",
        content: "Use concrete maritime detail and restrained metaphor.",
        pinned: true,
        tags: ["mnemosyne", "story", "style", "pinned-guidance"],
        created_at: "2026-08-23T05:44:00.000Z",
      },
    ];
    await writeExport(base, entities);

    await scaffoldStory({ ...options(base, out), coreThreshold: 80 });
    const compiled = await compileCanonDirectory({
      slug: "safe-story",
      dir: out,
    });
    const byName = new Map(
      compiled.records.map((record: { name: string }) => [record.name, record]),
    );

    for (const entity of entities) {
      const record = byName.get(entity.name);
      expect(record).toMatchObject({
        pinned: entity.pinned,
        tags: entity.tags,
        created_at: entity.created_at,
      });
    }
    expect(
      await readFile(join(out, "characters", "rhea-voss.md"), "utf8"),
    ).toContain('tags: ["character-focus","validation:clean"]');
    expect(
      await readFile(join(out, "characters", "_minor.md"), "utf8"),
    ).toContain('"created_at":"2026-08-23T05:41:00.000Z"');
    expect(await readFile(join(out, "rules.md"), "utf8")).toContain(
      '"created_at":"2026-08-23T05:43:00.000Z"',
    );
  });

  it("rejects malformed schema-v1 metadata before staging", async () => {
    const root = await makeRoot();
    const cases = [
      { field: "pinned", value: "yes", error: /entities\.0\.pinned/i },
      { field: "tags", value: [""], error: /tags must be non-empty/i },
      {
        field: "created_at",
        value: "yesterday",
        error: /entities\.0\.created_at/i,
      },
    ];

    for (const [index, invalid] of cases.entries()) {
      const base = join(root, `invalid-${index}.json`);
      const out = join(root, `invalid-${index}`, "canon");
      await writeExport(base, [
        {
          type: "location",
          name: `Invalid Metadata ${index}`,
          content: "A location that should never be staged.",
          [invalid.field]: invalid.value,
        } as unknown as ExportEntity,
      ]);

      await expect(scaffoldStory(options(base, out))).rejects.toThrow(
        invalid.error,
      );
      expect(await exists(out)).toBe(false);
      expect(await exists(dirname(out))).toBe(false);
    }
  });

  it("leaves a divergent merge base unresolved instead of appending", async () => {
    const root = await makeRoot();
    const base = join(root, "base.json");
    const merge = join(root, "merge.json");
    const ancestor = join(root, "ancestor.json");
    const out = join(root, "divergent", "canon");
    await writeExport(base, [
      {
        type: "location",
        name: "Forked Harbor",
        content: "The base revision replaced the harbor account entirely.",
      },
    ]);
    await writeExport(ancestor, [
      {
        type: "location",
        name: "Forked Harbor",
        content: "The ancestor described a quiet harbor.",
      },
    ]);
    await writeExport(merge, [
      {
        type: "location",
        name: "Forked Harbor",
        content:
          "The ancestor described a quiet harbor.\n\nThe merge added a signal fire.",
      },
    ]);

    const result = await scaffoldStory({
      ...options(base, out),
      merges: [`${merge}|${ancestor}`],
    });

    expect(result.mergeReports[0].appended).toEqual([]);
    expect(result.mergeReports[0].baseDivergedFromAncestor).toEqual([
      "location Forked Harbor",
    ]);
    const rendered = await readFile(
      join(out, "locations", "forked-harbor.md"),
      "utf8",
    );
    expect(rendered).toContain(
      "The base revision replaced the harbor account entirely.",
    );
    expect(rendered).not.toContain("signal fire");
  });

  it("does not mistake ancestor text for an already-present merge suffix", async () => {
    const root = await makeRoot();
    const base = join(root, "base.json");
    const merge = join(root, "merge.json");
    const ancestor = join(root, "ancestor.json");
    const out = join(root, "repeated-ancestor-text", "canon");
    const ancestorContent = "Opening account.\n\nRepeated passage.";
    const suffix = "\n\nRepeated passage.";
    await writeExport(base, [
      {
        type: "lore",
        name: "Repeated Chronicle",
        content: `${ancestorContent}\n\nBase-only annotation.`,
      },
    ]);
    await writeExport(ancestor, [
      {
        type: "lore",
        name: "Repeated Chronicle",
        content: ancestorContent,
      },
    ]);
    await writeExport(merge, [
      {
        type: "lore",
        name: "Repeated Chronicle",
        content: `${ancestorContent}${suffix}`,
      },
    ]);

    const result = await scaffoldStory({
      ...options(base, out),
      merges: [`${merge}|${ancestor}`],
    });

    expect(result.mergeReports[0].skippedAlreadyPresent).toEqual([]);
    expect(result.mergeReports[0].appended).toHaveLength(1);
    const rendered = await readFile(
      join(out, "lore", "repeated-chronicle.md"),
      "utf8",
    );
    expect(rendered).toContain("Base-only annotation.");
    expect(rendered.match(/Repeated passage\./g)).toHaveLength(2);
  });

  it("rejects duplicate identity keys before creating any target", async () => {
    const root = await makeRoot();
    const base = join(root, "base.json");
    const out = join(root, "duplicate", "canon");
    await writeExport(base, [
      { type: "location", name: "Harbor", content: "First version." },
      { type: "location", name: "harbor", content: "Second version." },
    ]);

    await expect(scaffoldStory(options(base, out))).rejects.toThrow(
      /duplicate entity identity/i,
    );
    expect(await exists(out)).toBe(false);
    expect(await exists(dirname(out))).toBe(false);
  });

  it("rejects distinct identities that collide at one slugged output path", async () => {
    const root = await makeRoot();
    const base = join(root, "base.json");
    const out = join(root, "collision", "canon");
    await writeExport(base, [
      { type: "location", name: "North/South", content: "First place." },
      { type: "location", name: "North South", content: "Second place." },
    ]);

    await expect(scaffoldStory(options(base, out))).rejects.toThrow(
      /output path collision.*locations\/north-south\.md/i,
    );
    expect(await exists(out)).toBe(false);
    expect(await exists(dirname(out))).toBe(false);
  });

  it("removes its stage when the compiled import preflight rejects rendered output", async () => {
    const root = await makeRoot();
    const base = join(root, "base.json");
    const out = join(root, "late-failure", "canon");
    await writeExport(base, [
      {
        type: "character",
        name: "Bad Header",
        content: "Pinned: maybe\n\n## Current State\n\nReady for review.",
      },
    ]);

    await expect(scaffoldStory(options(base, out))).rejects.toThrow(
      /pinned must be true or false/i,
    );
    expect(await exists(out)).toBe(false);
    expect(
      (await readdir(dirname(out))).filter((name) =>
        name.startsWith(".canon.scaffold-"),
      ),
    ).toEqual([]);
  });

  it("refuses empty and nonempty existing targets without changing them", async () => {
    const root = await makeRoot();
    const base = join(root, "base.json");
    await writeExport(base, [
      { type: "location", name: "Harbor", content: "A complete location." },
    ]);

    const emptyTarget = join(root, "empty-target");
    await mkdir(emptyTarget);
    await expect(scaffoldStory(options(base, emptyTarget))).rejects.toThrow(
      /refusing to overwrite existing scaffold target/i,
    );
    expect(await readdir(emptyTarget)).toEqual([]);

    const nonemptyTarget = join(root, "nonempty-target");
    await mkdir(nonemptyTarget);
    const sentinel = join(nonemptyTarget, "keep.txt");
    await writeFile(sentinel, "operator data\n", "utf8");
    await expect(scaffoldStory(options(base, nonemptyTarget))).rejects.toThrow(
      /refusing to overwrite existing scaffold target/i,
    );
    expect(await readFile(sentinel, "utf8")).toBe("operator data\n");
    expect(await readdir(nonemptyTarget)).toEqual(["keep.txt"]);
  });
});
