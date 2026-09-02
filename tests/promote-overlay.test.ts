import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import {
  mkdir,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const REPO_ROOT = fileURLToPath(new URL("../", import.meta.url));
const STORIES_ROOT = join(REPO_ROOT, "data", "stories");
const WORKSPACE = join(REPO_ROOT, "data", "workspace");
const PROMOTER = join(REPO_ROOT, "scripts", "promote-overlay.mjs");
const cleanups: string[] = [];

type Operation = {
  path: string;
  operation: "add" | "replace" | "remove";
  baseline_sha256: string | null;
  draft_sha256: string | null;
};

type Fixture = {
  slug: string;
  root: string;
  manifest: { schema_version: 2; story_slug: string; files: Operation[] };
  baselineCharacter: string;
};

function hash(content: string | Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}

async function put(root: string, rel: string, content: string): Promise<void> {
  const file = join(root, rel);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, content, "utf8");
}

async function exists(file: string): Promise<boolean> {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
}

async function seed(): Promise<Fixture> {
  const slug = `promote-overlay-${process.pid}-${randomBytes(4).toString("hex")}`;
  const root = join(STORIES_ROOT, slug);
  await mkdir(root, { recursive: true });
  cleanups.push(root);
  const baselineCharacter = `---\nname: Baseline Character\n---\n\nOld state.\n`;
  const retiredLore = `---\nname: Retired Lore\n---\n\nRemovable.\n`;
  const replacementDraft = `---\nname: Baseline Character\n---\n\n> **DRAFT — NOT ACTIVE CANON**\n\nNew state.\n`;
  const additionDraft = `---\nname: New Harbor\n---\n\n> **DRAFT — NOT ACTIVE CANON**\n\nThree piers bracket a tidal basin.\n`;
  await put(root, "canon/characters/baseline.md", baselineCharacter);
  await put(root, "canon/lore/retired.md", retiredLore);
  await put(root, "drafts/characters/baseline.md", replacementDraft);
  await put(root, "drafts/locations/new-harbor.md", additionDraft);
  await put(root, "drafts/_control/PASS.md", "# PASS\n\nSeeded.\n");
  const fixture: Fixture = {
    slug,
    root,
    baselineCharacter,
    manifest: {
      schema_version: 2,
      story_slug: slug,
      files: [
        {
          path: "characters/baseline.md",
          operation: "replace",
          baseline_sha256: hash(baselineCharacter),
          draft_sha256: hash(replacementDraft),
        },
        {
          path: "locations/new-harbor.md",
          operation: "add",
          baseline_sha256: null,
          draft_sha256: hash(additionDraft),
        },
        {
          path: "lore/retired.md",
          operation: "remove",
          baseline_sha256: hash(retiredLore),
          draft_sha256: null,
        },
      ],
    },
  };
  await put(
    root,
    "drafts/_control/overlay.json",
    `${JSON.stringify(fixture.manifest, null, 2)}\n`,
  );
  return fixture;
}

async function run(
  args: string[],
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [PROMOTER, ...args], {
      cwd: REPO_ROOT,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (c: string) => (stdout += c));
    child.stderr.on("data", (c: string) => (stderr += c));
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

async function snapshot(root: string): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  async function walk(directory: string): Promise<void> {
    for (const entry of (
      await readdir(directory, { withFileTypes: true })
    ).sort((a, b) => a.name.localeCompare(b.name, "en"))) {
      const file = join(directory, entry.name);
      if (entry.isDirectory()) await walk(file);
      else
        result[relative(root, file).replaceAll("\\", "/")] = (
          await readFile(file)
        ).toString("base64");
    }
  }
  await walk(root);
  return result;
}

async function manifestFiles(root: string): Promise<Operation[]> {
  return (
    JSON.parse(
      await readFile(join(root, "drafts/_control/overlay.json"), "utf8"),
    ) as {
      files: Operation[];
    }
  ).files;
}

async function backupDirs(slug: string): Promise<string[]> {
  // data/ is gitignored, so a fresh clone (CI) has no workspace directory yet.
  if (!(await exists(WORKSPACE))) return [];
  return (await readdir(WORKSPACE)).filter((n) =>
    n.includes(`-promotion-${slug}-`),
  );
}

afterEach(async () => {
  for (const root of cleanups.splice(0)) {
    const slug = root.split(/[\\/]/).pop() ?? "";
    for (const dir of await backupDirs(slug))
      await rm(join(WORKSPACE, dir), { recursive: true, force: true });
    await rm(root, { recursive: true, force: true });
  }
});

describe("promote-overlay", () => {
  it("dry run leaves the story byte-identical", async () => {
    const fixture = await seed();
    const before = await snapshot(fixture.root);
    const result = await run([fixture.slug, "--revision", "r1", "--all"]);
    expect(result.code, result.stderr).toBe(0);
    expect(result.stdout).toContain("Dry run: nothing written");
    expect(result.stdout).toContain("replace characters/baseline.md");
    expect(await snapshot(fixture.root)).toEqual(before);
    expect(await backupDirs(fixture.slug)).toEqual([]);
  });

  it("--apply requires --approved-by", async () => {
    const fixture = await seed();
    const result = await run([
      fixture.slug,
      "--revision",
      "r1",
      "--all",
      "--apply",
    ]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("--approved-by");
  });

  it("--all promotes add/replace/remove, empties the manifest, and records evidence", async () => {
    const fixture = await seed();
    const result = await run([
      fixture.slug,
      "--revision",
      "r1",
      "--all",
      "--apply",
      "--approved-by",
      "tester",
    ]);
    expect(result.code, result.stderr + result.stdout).toBe(0);

    const promoted = await readFile(
      join(fixture.root, "canon/characters/baseline.md"),
      "utf8",
    );
    expect(promoted).toBe(`---\nname: Baseline Character\n---\n\nNew state.\n`);
    expect(
      await readFile(
        join(fixture.root, "canon/locations/new-harbor.md"),
        "utf8",
      ),
    ).toBe(
      `---\nname: New Harbor\n---\n\nThree piers bracket a tidal basin.\n`,
    );
    expect(await exists(join(fixture.root, "canon/lore/retired.md"))).toBe(
      false,
    );
    expect(
      await exists(join(fixture.root, "drafts/characters/baseline.md")),
    ).toBe(false);
    expect(
      await exists(join(fixture.root, "drafts/locations/new-harbor.md")),
    ).toBe(false);
    expect(await manifestFiles(fixture.root)).toEqual([]);

    const record = JSON.parse(
      await readFile(
        join(fixture.root, "history/overlays/r1/promotion.json"),
        "utf8",
      ),
    ) as {
      operations: { path: string; promoted_sha256: string | null }[];
      approved_by: string;
    };
    expect(record.approved_by).toBe("tester");
    expect(record.operations.map((o) => o.path)).toEqual([
      "characters/baseline.md",
      "locations/new-harbor.md",
      "lore/retired.md",
    ]);
    expect(record.operations[0]?.promoted_sha256).toBe(hash(promoted));
    expect(
      await exists(
        join(
          fixture.root,
          "history/overlays/r1/control-at-promotion/overlay.json",
        ),
      ),
    ).toBe(true);
    expect(
      await readFile(join(fixture.root, "drafts/_control/PASS.md"), "utf8"),
    ).toContain("## Promotion r1");
    const backups = await backupDirs(fixture.slug);
    expect(backups).toHaveLength(1);
    expect(
      await readFile(
        join(
          WORKSPACE,
          backups[0] ?? "",
          "before/canon/characters/baseline.md",
        ),
        "utf8",
      ),
    ).toBe(fixture.baselineCharacter);
  });

  it("--paths promotes a subset and leaves the rest verifiable", async () => {
    const fixture = await seed();
    const result = await run([
      fixture.slug,
      "--revision",
      "r1",
      "--paths",
      "locations/new-harbor.md",
      "--apply",
      "--approved-by",
      "tester",
    ]);
    expect(result.code, result.stderr + result.stdout).toBe(0);
    expect(
      await exists(join(fixture.root, "canon/locations/new-harbor.md")),
    ).toBe(true);
    expect(await exists(join(fixture.root, "canon/lore/retired.md"))).toBe(
      true,
    );
    expect(
      await exists(join(fixture.root, "drafts/characters/baseline.md")),
    ).toBe(true);
    expect(
      await exists(
        join(fixture.root, "drafts/_control/overlay.promotion.json"),
      ),
    ).toBe(false);
    expect((await manifestFiles(fixture.root)).map((o) => o.path)).toEqual([
      "characters/baseline.md",
      "lore/retired.md",
    ]);
    // the remaining overlay is still promotable
    const second = await run([fixture.slug, "--revision", "r2", "--all"]);
    expect(second.code, second.stderr).toBe(0);
  });

  it("refuses baseline drift with nothing written", async () => {
    const fixture = await seed();
    await put(
      fixture.root,
      "canon/characters/baseline.md",
      "---\nname: Baseline Character\n---\n\nEdited since.\n",
    );
    const before = await snapshot(fixture.root);
    const result = await run([
      fixture.slug,
      "--revision",
      "r1",
      "--all",
      "--apply",
      "--approved-by",
      "tester",
    ]);
    expect(result.code).toBe(1);
    expect(await snapshot(fixture.root)).toEqual(before);
    expect(await exists(join(fixture.root, "history"))).toBe(false);
  });

  it("refuses a revision label already recorded in history", async () => {
    const fixture = await seed();
    await put(fixture.root, "history/overlays/r1/promotion.json", "{}\n");
    const result = await run([fixture.slug, "--revision", "r1", "--all"]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("already exists");
  });
});
