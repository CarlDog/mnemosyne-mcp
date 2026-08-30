import { spawn } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  rm,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const VALIDATOR = fileURLToPath(
  new URL("../scripts/validate-canon.mjs", import.meta.url),
);
const REPO_ROOT = fileURLToPath(new URL("../", import.meta.url));
const roots: string[] = [];
const links: string[] = [];

async function makeRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "mnemo-validate-canon-"));
  roots.push(root);
  return root;
}

async function put(root: string, rel: string, content: string): Promise<void> {
  const file = join(root, rel);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, content, "utf8");
}

async function linkDirectory(target: string, link: string): Promise<void> {
  await symlink(
    target,
    link,
    process.platform === "win32" ? "junction" : "dir",
  );
  links.push(link);
}

async function runValidator(
  slug: string,
  root: string,
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [VALIDATOR, slug, "--dir", root], {
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
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("validate-canon scene contract", () => {
  it("accepts the compiler-required scene identity and chronology fields", async () => {
    const root = await makeRoot();
    await put(
      root,
      "scenes/cs-001-01-lab--opening.md",
      `---
catalog_key: CS-001-01-LAB
name: Opening
created_at: "2025-05-07T20:13:00-05:00"
---

The tide exposed a second set of stairs.
`,
    );

    const result = await runValidator("test-story", root);
    expect(result.code, result.stderr).toBe(0);
    expect(result.stdout).toContain("OK -- no structural problems found");
  });

  it("rejects missing or invalid name, catalog_key, created_at, and filename identity", async () => {
    const root = await makeRoot();
    const iso = "2025-05-07T20:13:00Z";
    await put(
      root,
      "scenes/cs-001-01-nam--missing-name.md",
      `---
catalog_key: CS-001-01-NAM
created_at: ${iso}
---

Missing name.
`,
    );
    await put(
      root,
      "scenes/cs-002-01-cat--missing-catalog.md",
      `---
name: Missing Catalog
created_at: ${iso}
---

Missing catalog key.
`,
    );
    await put(
      root,
      "scenes/cs-003-01-dat--missing-created.md",
      `---
catalog_key: CS-003-01-DAT
name: Missing Created At
---

Missing chronology.
`,
    );
    await put(
      root,
      "scenes/cs-004-01-iso--invalid-created.md",
      `---
catalog_key: CS-004-01-ISO
name: Invalid Created At
created_at: yesterday
---

Invalid chronology.
`,
    );
    await put(
      root,
      "scenes/cs-005-01-bad--invalid-catalog.md",
      `---
catalog_key: cs-005-01-bad
name: Invalid Catalog
created_at: ${iso}
---

Invalid catalog key.
`,
    );
    await put(
      root,
      "scenes/cs-006-01-other--wrong-prefix.md",
      `---
catalog_key: CS-006-01-MIS
name: Wrong Prefix
created_at: ${iso}
---

Wrong filename prefix.
`,
    );

    const result = await runValidator("test-story", root);
    expect(result.code).toBe(1);
    expect(result.stdout).toContain('frontmatter has no "name" field');
    expect(result.stdout).toContain('frontmatter has no "catalog_key" field');
    expect(result.stdout).toContain('frontmatter requires "created_at"');
    expect(result.stdout).toContain(
      "created_at must be an ISO datetime with Z or an explicit offset",
    );
    expect(result.stdout).toContain(
      "must be four uppercase alphanumeric segments separated by hyphens",
    );
    expect(result.stdout).toContain("filename must start with");
  });
});

describe("validate-canon structural parsing", () => {
  it("requires the closing frontmatter delimiter to occupy its exact line", async () => {
    const root = await makeRoot();
    await put(
      root,
      "characters/aria.md",
      `---
name: Aria
--- trailing text

A cartographer.
`,
    );

    const result = await runValidator("test-story", root);
    expect(result.code).toBe(1);
    expect(result.stdout).toContain("frontmatter opened but never closed");
  });

  it("rejects duplicate frontmatter keys instead of silently taking the last value", async () => {
    const root = await makeRoot();
    await put(
      root,
      "characters/aria.md",
      `---
name: Aria
name: Impostor
---

A cartographer.
`,
    );

    const result = await runValidator("test-story", root);
    expect(result.code).toBe(1);
    expect(result.stdout).toContain('duplicate frontmatter key "name"');
  });

  it("ignores level-two headings inside fenced code blocks", async () => {
    const root = await makeRoot();
    await put(
      root,
      "rules.md",
      `## Evidence Before Answers

Discovery must precede certainty.

\`\`\`markdown
## Evidence Before Answers
\`\`\`
`,
    );

    const result = await runValidator("test-story", root);
    expect(result.code, result.stderr).toBe(0);
    expect(result.stdout).toContain("total entities claimed: 1");
    expect(result.stdout).toContain("OK -- no structural problems found");
  });

  it("keeps a four-backtick fence open across a shorter backtick run", async () => {
    const root = await makeRoot();
    await put(
      root,
      "rules.md",
      `## Evidence Before Answers

Discovery must precede certainty.

\`\`\`\`markdown
\`\`\`
## A Shorter Fence Does Not Expose This Heading
\`\`\`\`
`,
    );

    const result = await runValidator("test-story", root);
    expect(result.code, result.stderr).toBe(0);
    expect(result.stdout).toContain("total entities claimed: 1");
    expect(result.stdout).toContain("OK -- no structural problems found");
  });

  it("rejects an unterminated fenced block without exposing its headings", async () => {
    const root = await makeRoot();
    await put(
      root,
      "rules.md",
      `## Evidence Before Answers

Discovery must precede certainty.

\`\`\`\`markdown
## This Heading Remains Fenced At EOF
`,
    );

    const result = await runValidator("test-story", root);
    expect(result.code).toBe(1);
    expect(result.stdout).toContain(
      'rules.md:5: unterminated fenced code block opened with "````"',
    );
    expect(result.stdout).toContain("total entities claimed: 1");
  });

  it("rejects adjacent and trailing batch headings with empty bodies", async () => {
    const root = await makeRoot();
    await put(
      root,
      "rules.md",
      `## Adjacent Empty
${"   "}
## Evidence Before Answers

Discovery must precede certainty.

\`\`\`markdown
## Fenced Example Is Not An Entity
\`\`\`

## Trailing Empty
${"   "}
`,
    );

    const result = await runValidator("test-story", root);
    expect(result.code).toBe(1);
    expect(result.stdout).toContain(
      'rules.md:1: "## Adjacent Empty" has an empty body',
    );
    expect(result.stdout).toContain('"## Trailing Empty" has an empty body');
    expect(result.stdout).toContain("total entities claimed: 3");
    expect(result.stdout).not.toContain(
      '"## Fenced Example Is Not An Entity" has an empty body',
    );
  });

  it("rejects a batch entity whose only content is its metadata directive", async () => {
    const root = await makeRoot();
    await put(
      root,
      "rules.md",
      `## Metadata Only

<!-- mnemosyne-meta: {"pinned":true} -->

## Evidence Before Answers

<!-- mnemosyne-meta: {"tags":["evidence"]} -->

Discovery must precede certainty.
`,
    );

    const result = await runValidator("test-story", root);
    expect(result.code).toBe(1);
    expect(result.stdout).toContain(
      'rules.md:1: "## Metadata Only" has metadata but no body',
    );
    expect(result.stdout).toContain("total entities claimed: 2");
    expect(result.stdout).not.toContain(
      '"## Evidence Before Answers" has metadata but no body',
    );
  });

  it("accepts YAML single-quoted names with doubled apostrophes", async () => {
    const root = await makeRoot();
    await put(
      root,
      "characters/obrien.md",
      `---
name: 'O''Brien'
---

A careful archivist.
`,
    );

    const result = await runValidator("test-story", root);
    expect(result.code, result.stderr).toBe(0);
    expect(result.stdout).toContain("total entities claimed: 1");
    expect(result.stdout).toContain("OK -- no structural problems found");
  });

  it("rejects malformed double- and single-quoted name scalars", async () => {
    const root = await makeRoot();
    await put(
      root,
      "characters/valid.md",
      "---\nname: Valid\n---\n\nA valid control entity.\n",
    );
    await put(
      root,
      "characters/broken-double.md",
      `---
name: "Broken
---

This malformed scalar must not be accepted.
`,
    );
    await put(
      root,
      "characters/broken-single.md",
      `---
name: 'O'Brien'
---

The inner apostrophe is not doubled.
`,
    );

    const result = await runValidator("test-story", root);
    expect(result.code).toBe(1);
    expect(result.stdout).toMatch(
      /characters[\\/]broken-double\.md: frontmatter "name" is invalid: malformed JSON-style frontmatter value/,
    );
    expect(result.stdout).toContain(
      "single quotes inside a single-quoted YAML value must be doubled",
    );
    expect(result.stdout).toContain("total entities claimed: 1");
  });
});

describe("validate-canon path authority", () => {
  it("rejects story slugs that could escape or alias the story namespace", async () => {
    const root = await makeRoot();
    await put(
      root,
      "characters/aria.md",
      "---\nname: Aria\n---\n\nA cartographer.\n",
    );

    for (const slug of ["../escape", "Uppercase", "under_score"]) {
      const result = await runValidator(slug, root);
      expect(result.code).toBe(1);
      expect(result.stderr).toContain("slug must start with a lowercase");
    }
  });

  it("rejects symlinked canon roots and entity-category directories", async () => {
    const realRoot = await makeRoot();
    await put(
      realRoot,
      "characters/aria.md",
      "---\nname: Aria\n---\n\nA cartographer.\n",
    );
    const linkedRoot = join(tmpdir(), `mnemo-validate-root-${process.pid}`);
    await linkDirectory(realRoot, linkedRoot);

    const rootResult = await runValidator("test-story", linkedRoot);
    expect(rootResult.code).toBe(1);
    expect(rootResult.stderr).toContain(
      "canon root must be a real directory, not a link",
    );

    const containingRoot = await makeRoot();
    await put(
      containingRoot,
      "rules.md",
      "## Evidence Before Answers\n\nDiscovery precedes certainty.\n",
    );
    const linkedCharacters = join(containingRoot, "characters");
    await linkDirectory(join(realRoot, "characters"), linkedCharacters);

    const categoryResult = await runValidator("test-story", containingRoot);
    expect(categoryResult.code).toBe(1);
    expect(categoryResult.stderr).toContain(
      "expected a real directory, not a link",
    );
  });
});
