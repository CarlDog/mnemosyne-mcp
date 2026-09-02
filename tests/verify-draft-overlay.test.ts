import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

const REPO_ROOT = fileURLToPath(new URL("../", import.meta.url));
const STORIES_ROOT = join(REPO_ROOT, "data", "stories");
const VERIFIER = join(REPO_ROOT, "scripts", "verify-draft-overlay.mjs");
const CANON_FRONTMATTER = join(REPO_ROOT, "scripts", "canon-frontmatter.mjs");
const DRAFT_NOTICE = join(REPO_ROOT, "scripts", "draft-notice.mjs");
const TEMP_PREFIX = "mnemosyne-draft-overlay-";
const storyRoots: string[] = [];
const links: string[] = [];

type ManifestOperation = {
  path: string;
  operation: "add" | "replace" | "remove";
  baseline_sha256: string | null;
  draft_sha256: string | null;
};

type OverlayFixture = {
  slug: string;
  root: string;
  manifest: {
    schema_version: 1 | 2;
    story_slug: string;
    files: ManifestOperation[];
  };
  replacementDraft: string;
};

function hash(content: string | Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}

async function put(root: string, rel: string, content: string): Promise<void> {
  const file = join(root, rel);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, content, "utf8");
}

async function makeStoryRoot(): Promise<{ slug: string; root: string }> {
  const slug = `verify-overlay-${process.pid}-${randomBytes(4).toString("hex")}`;
  const root = join(STORIES_ROOT, slug);
  await mkdir(root, { recursive: false });
  storyRoots.push(root);
  return { slug, root };
}

async function writeManifest(fixture: OverlayFixture): Promise<void> {
  await put(
    fixture.root,
    "drafts/_control/overlay.json",
    `${JSON.stringify(fixture.manifest, null, 2)}\n`,
  );
}

async function addTemplateDraft(
  fixture: OverlayFixture,
  frontmatter: string,
): Promise<void> {
  const draft = `---
${frontmatter}
---

> **DRAFT — NOT ACTIVE CANON**

Template instructions.
`;
  const templatePath = "characters/_template.md";
  await put(fixture.root, `drafts/${templatePath}`, draft);
  fixture.manifest.files.push({
    path: templatePath,
    operation: "add",
    baseline_sha256: null,
    draft_sha256: hash(draft),
  });
  await writeManifest(fixture);
}

function replacementOperation(fixture: OverlayFixture): ManifestOperation {
  const operation = fixture.manifest.files.find(
    (entry) => entry.operation === "replace",
  );
  if (!operation) throw new Error("test fixture has no replacement operation");
  return operation;
}

async function seedOverlay(
  schemaVersion: 1 | 2,
  location?: { slug: string; root: string },
): Promise<OverlayFixture> {
  const { slug, root } = location ?? (await makeStoryRoot());
  const baselineCharacter = `---
name: Baseline Character
---

Old state.
`;
  const retiredLore = `---
name: Retired Lore
---

This record may be removed by schema 2.
`;
  const replacementDraft = `---
name: Baseline Character
---

> **DRAFT — NOT ACTIVE CANON**

New state.
`;
  const additionDraft = `---
name: New Harbor
---

> **DRAFT — NOT ACTIVE CANON**

Three piers bracket a tidal basin.
`;

  await put(root, "canon/characters/baseline.md", baselineCharacter);
  await put(root, "canon/lore/retired.md", retiredLore);
  await put(root, "drafts/characters/baseline.md", replacementDraft);
  await put(root, "drafts/locations/new-harbor.md", additionDraft);

  const files: ManifestOperation[] = [
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
  ];
  if (schemaVersion === 2) {
    files.push({
      path: "lore/retired.md",
      operation: "remove",
      baseline_sha256: hash(retiredLore),
      draft_sha256: null,
    });
  }

  const fixture: OverlayFixture = {
    slug,
    root,
    manifest: {
      schema_version: schemaVersion,
      story_slug: slug,
      files,
    },
    replacementDraft,
  };
  await writeManifest(fixture);
  return fixture;
}

async function run(
  command: string,
  args: string[],
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: REPO_ROOT,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

async function runVerifier(
  slug: string,
  verifier = VERIFIER,
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return run(process.execPath, [verifier, slug]);
}

async function snapshot(root: string): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  async function walk(directory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name, "en"));
    for (const entry of entries) {
      const file = join(directory, entry.name);
      if (entry.isDirectory()) await walk(file);
      else {
        result[relative(root, file).replaceAll("\\", "/")] = (
          await readFile(file)
        ).toString("base64");
      }
    }
  }
  await walk(root);
  return result;
}

async function stagingDirectories(): Promise<string[]> {
  return (await readdir(tmpdir()))
    .filter((name) => name.startsWith(TEMP_PREFIX))
    .sort();
}

async function makeMutatingVerifierRepo(): Promise<{
  repo: string;
  verifier: string;
}> {
  const repo = await mkdtemp(join(tmpdir(), "mnemo-mutating-verifier-"));
  storyRoots.push(repo);
  const verifier = join(repo, "scripts", "verify-draft-overlay.mjs");
  await mkdir(dirname(verifier), { recursive: true });
  await copyFile(VERIFIER, verifier);
  await copyFile(
    CANON_FRONTMATTER,
    join(repo, "scripts/canon-frontmatter.mjs"),
  );
  await copyFile(DRAFT_NOTICE, join(repo, "scripts/draft-notice.mjs"));
  await put(
    repo,
    "scripts/validate-canon.mjs",
    `import { appendFile, readdir } from "node:fs/promises";
import path from "node:path";

async function firstMarkdown(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  entries.sort((left, right) => left.name.localeCompare(right.name, "en"));
  for (const entry of entries) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      const nested = await firstMarkdown(file);
      if (nested) return nested;
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
      return file;
    }
  }
  return null;
}

const dirFlag = process.argv.indexOf("--dir");
const root = dirFlag === -1 ? null : process.argv[dirFlag + 1];
if (!root) throw new Error("test validator did not receive --dir");
const file = await firstMarkdown(root);
if (!file) throw new Error("test validator found no Markdown to mutate");
await appendFile(file, "\\nMUTATED BY TEST VALIDATOR\\n", "utf8");
console.log("mutated disposable validator input");
`,
  );
  await put(
    repo,
    "scripts/compile-story.mjs",
    'console.log("fake merged import preflight passed");\n',
  );
  await mkdir(join(repo, "data", "stories"), { recursive: true });
  return { repo, verifier };
}

beforeAll(async () => {
  const tsc = join(REPO_ROOT, "node_modules", "typescript", "bin", "tsc");
  const build = await run(process.execPath, [tsc]);
  expect(build.code, `${build.stdout}\n${build.stderr}`).toBe(0);
  await mkdir(STORIES_ROOT, { recursive: true });
});

afterEach(async () => {
  await Promise.all(
    links.splice(0).map(async (link) => {
      try {
        await unlink(link);
      } catch (error) {
        if (
          !error ||
          typeof error !== "object" ||
          !("code" in error) ||
          error.code !== "ENOENT"
        ) {
          throw error;
        }
      }
    }),
  );
  await Promise.all(
    storyRoots
      .splice(0)
      .map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("verify-draft-overlay black-box success paths", () => {
  for (const schemaVersion of [1, 2] as const) {
    it(`verifies schema ${schemaVersion} add/replace${schemaVersion === 2 ? "/remove" : ""} operations without mutating inputs`, async () => {
      const fixture = await seedOverlay(schemaVersion);
      const storyBefore = await snapshot(fixture.root);
      const stagesBefore = await stagingDirectories();

      const result = await runVerifier(fixture.slug);

      expect(result.code, result.stderr).toBe(0);
      expect(result.stdout).toContain(
        `Verified draft overlay for ${fixture.slug}`,
      );
      expect(result.stdout).toContain(
        schemaVersion === 1
          ? "files: 2 (1 replacement, 1 addition, 0 removals)"
          : "files: 3 (1 replacement, 1 addition, 1 removal)",
      );
      expect(result.stdout).toContain("writes=0");
      expect(result.stdout).toContain("temporary staging directory removed");
      expect(await snapshot(fixture.root)).toEqual(storyBefore);
      expect(await stagingDirectories()).toEqual(stagesBefore);
    });
  }
});

describe("verify-draft-overlay promotion-support paths", () => {
  it("verifies an overlay whose manifest is empty between proposals", async () => {
    const fixture = await seedOverlay(2);
    fixture.manifest.files = [];
    await writeManifest(fixture);
    await rm(join(fixture.root, "drafts/characters"), { recursive: true });
    await rm(join(fixture.root, "drafts/locations"), { recursive: true });
    const storyBefore = await snapshot(fixture.root);

    const result = await runVerifier(fixture.slug);

    expect(result.code, result.stderr).toBe(0);
    expect(result.stdout).toContain(
      "files: 0 (0 replacements, 0 additions, 0 removals)",
    );
    expect(await snapshot(fixture.root)).toEqual(storyBefore);
  });

  it("verifies a --manifest subset without demanding every draft be listed", async () => {
    const fixture = await seedOverlay(2);
    const subset = {
      ...fixture.manifest,
      files: fixture.manifest.files.filter(
        (entry) => entry.path === "characters/baseline.md",
      ),
    };
    await put(
      fixture.root,
      "drafts/_control/overlay.promotion.json",
      `${JSON.stringify(subset, null, 2)}
`,
    );
    const storyBefore = await snapshot(fixture.root);

    const result = await run(process.execPath, [
      VERIFIER,
      "--manifest",
      "_control/overlay.promotion.json",
      fixture.slug,
    ]);

    expect(result.code, result.stderr).toBe(0);
    expect(result.stdout).toContain(
      `Verified draft overlay for ${fixture.slug} (subset manifest)`,
    );
    expect(result.stdout).toContain(
      "files: 1 (1 replacement, 0 additions, 0 removals)",
    );
    expect(await snapshot(fixture.root)).toEqual(storyBefore);
  });

  it("rejects a --manifest path outside _control", async () => {
    const fixture = await seedOverlay(1);
    const result = await run(process.execPath, [
      VERIFIER,
      "--manifest",
      "characters/overlay.json",
      fixture.slug,
    ]);
    expect(result.code).toBe(1);
  });
});

describe("verify-draft-overlay black-box rejection paths", () => {
  it("rejects story slugs containing underscores", async () => {
    const result = await runVerifier("invalid_slug");

    expect(result.code).toBe(1);
    expect(result.stderr).toContain(
      "lowercase letters, digits, and hyphens only",
    );
  });

  it("rejects duplicate frontmatter keys in staged templates", async () => {
    const fixture = await seedOverlay(2);
    await addTemplateDraft(fixture, "name: Template\nname: Duplicate");

    const result = await runVerifier(fixture.slug);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("duplicate template frontmatter key");
  });

  it("rejects malformed populated scalars in staged templates", async () => {
    const fixture = await seedOverlay(2);
    await addTemplateDraft(fixture, 'name: "Unclosed');

    const result = await runVerifier(fixture.slug);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("invalid template frontmatter value");
    expect(result.stderr).toContain("malformed JSON-style frontmatter value");
  });

  it("allows intentional blank placeholders in staged templates", async () => {
    const fixture = await seedOverlay(2);
    await addTemplateDraft(fixture, "name:\npinned: false\ntags: []");

    const result = await runVerifier(fixture.slug);

    expect(result.code, result.stderr).toBe(0);
    expect(result.stdout).toContain(
      "underscore-prefixed Markdown templates: 1 OK",
    );
  });

  it("rejects a story-root junction before following its canon authority", async () => {
    const slug = `linked-story-${process.pid}-${randomBytes(4).toString("hex")}`;
    const target = await mkdtemp(join(tmpdir(), "mnemo-linked-story-target-"));
    storyRoots.push(target);
    const fixture = await seedOverlay(2, { slug, root: target });
    const targetBefore = await snapshot(target);
    const link = join(STORIES_ROOT, slug);
    await symlink(
      target,
      link,
      process.platform === "win32" ? "junction" : "dir",
    );
    links.push(link);

    const result = await runVerifier(slug);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain(
      "story root must be a real directory, not a link",
    );
    expect(await snapshot(fixture.root)).toEqual(targetBefore);
  });

  it("rejects traversal in manifest paths", async () => {
    const fixture = await seedOverlay(2);
    replacementOperation(fixture).path = "../escape.md";
    await writeManifest(fixture);

    const result = await runVerifier(fixture.slug);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain(
      "manifest files[0].path has an unsafe component",
    );
  });

  it("rejects symbolic links anywhere in the draft authority tree", async () => {
    const fixture = await seedOverlay(2);
    const target = join(
      tmpdir(),
      `mnemo-overlay-link-target-${randomBytes(4).toString("hex")}`,
    );
    await mkdir(target);
    storyRoots.push(target);
    const link = join(fixture.root, "drafts", "linked-outside");
    await symlink(
      target,
      link,
      process.platform === "win32" ? "junction" : "dir",
    );
    links.push(link);

    const result = await runVerifier(fixture.slug);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("draft overlay contains a symbolic link");
  });

  it("rejects a draft hash mismatch before staging", async () => {
    const fixture = await seedOverlay(2);
    replacementOperation(fixture).draft_sha256 = "0".repeat(64);
    await writeManifest(fixture);

    const result = await runVerifier(fixture.slug);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("draft SHA-256 mismatch");
  });

  it("rejects a missing leading banner and still cleans its temporary stage", async () => {
    const fixture = await seedOverlay(2);
    const bannerless = `---
name: Baseline Character
---

    New state without a review banner.
`;
    await put(fixture.root, "drafts/characters/baseline.md", bannerless);
    replacementOperation(fixture).draft_sha256 = hash(bannerless);
    await writeManifest(fixture);
    const storyBefore = await snapshot(fixture.root);
    const stagesBefore = await stagingDirectories();

    const result = await runVerifier(fixture.slug);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("expected the leading draft blockquote");
    expect(await snapshot(fixture.root)).toEqual(storyBefore);
    expect(await stagingDirectories()).toEqual(stagesBefore);
  });

  it("contains a mutating validator inside disposable copies", async () => {
    const { repo, verifier } = await makeMutatingVerifierRepo();
    const slug = `mutating-validator-${randomBytes(4).toString("hex")}`;
    const root = join(repo, "data", "stories", slug);
    await mkdir(root, { recursive: true });
    const fixture = await seedOverlay(2, { slug, root });
    const storyBefore = await snapshot(fixture.root);
    const stagesBefore = await stagingDirectories();

    const result = await runVerifier(slug, verifier);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("baseline-copy integrity check failed");
    expect(result.stderr).toContain("isolated-copy integrity check failed");
    expect(result.stderr).toContain("staged-canon integrity check failed");
    expect(await snapshot(fixture.root)).toEqual(storyBefore);
    expect(await stagingDirectories()).toEqual(stagesBefore);
  });
});
