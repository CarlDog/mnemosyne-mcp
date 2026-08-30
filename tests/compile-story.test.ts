import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { parseExportDocument, planImport } from "../src/import.js";
// The compiler is deliberately an operator-facing Node ESM script rather than
// part of the TypeScript server build. Its exported pure functions are the test
// surface; the existing import contract below remains typed from src/import.ts.
// @ts-expect-error -- operational .mjs modules do not emit TypeScript declarations.
import * as compiler from "../scripts/compile-story.mjs";

const {
  buildCompiledExportDocument,
  checkImportCompatibility,
  compileCanonDirectory,
  writeCompiledExport,
} = compiler;

const roots: string[] = [];
const ISO = "2026-08-29T12:34:56.000Z";

async function makeRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "mnemo-compile-story-"));
  roots.push(root);
  return root;
}

async function put(root: string, rel: string, content: string): Promise<void> {
  const file = join(root, rel);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, content, "utf8");
}

async function tryDirectoryLink(
  target: string,
  link: string,
): Promise<boolean> {
  try {
    await symlink(
      target,
      link,
      process.platform === "win32" ? "junction" : "dir",
    );
    return true;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (
      ["EACCES", "ENOSYS", "ENOTSUP", "EOPNOTSUPP", "EPERM"].includes(
        code ?? "",
      )
    ) {
      return false;
    }
    throw error;
  }
}

async function snapshot(root: string): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  async function walk(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name, "en"));
    for (const entry of entries) {
      const file = join(dir, entry.name);
      if (entry.isDirectory()) await walk(file);
      else
        result[relative(root, file).replaceAll("\\", "/")] = await readFile(
          file,
          "utf8",
        );
    }
  }
  await walk(root);
  return result;
}

async function seedCompleteCanon(root: string): Promise<void> {
  await put(
    root,
    "characters/aria-voss.md",
    `---
name: "Aria \\"Ace\\" Voss"
full_name: 'Aria "Ace" Voss'
aliases: ["Ace", "Map: Maker"]
pinned: false
tags:
  [
    "character-focus",
    "validation:clean",
  ]
---

She maps coastlines and refuses royal commissions.
`,
  );
  await put(
    root,
    "characters/_minor.md",
    `\`Region\` is the figure's primary established operating area; it never proves a current location.

## Dockmaster Vale

Rattles a brass keyring and wants every manifest signed before dusk.

## Toma Reed

Speaks in clipped weather reports and wants passage upriver.
`,
  );
  await put(
    root,
    "locations/harbor.md",
    `---
name: The Harbor
---

Three stone piers bracket a tidal basin.
`,
  );
  await put(
    root,
    "lore/objects/compass.md",
    `---
name: "Aria's Compass"
material: "Brass: dented, not broken"
tags: [object, lightning]
---

The needle sticks near lightning damage.
`,
  );
  await put(
    root,
    "worldbuilding/weather.md",
    `---
name: Estuary Weather
---

Fog follows the outgoing tide rather than a supernatural will.
`,
  );
  await put(
    root,
    "rules.md",
    `## Adult Cast
<!-- mnemosyne-meta: {"tags":["mature-content"],"created_at":"2025-04-06T12:30:00Z"} -->

Every participant in sexual material is an established adult.

## Evidence Before Answers

Discovery must precede certainty.
`,
  );
  await put(
    root,
    "style.md",
    `## Tidal Prose
<!-- mnemosyne-meta: {"pinned":true,"tags":["pinned-guidance"]} -->

Use concrete sensory detail and restrained metaphor.
`,
  );
  await put(
    root,
    "scenes/cs-001-01-lab--opening.md",
    `---
catalog_key: CS-001-01-LAB
name: "Opening: Low Tide"
participants: ["Aria \\"Ace\\" Voss", "Dockmaster Vale"]
created_at: "2025-05-07T20:13:00-05:00"
pinned: true
tags: ["validation:clean", "locked-scene"]
---

[Chapter: Opening: Low Tide]

The tide exposed a second set of stairs.
`,
  );
  await put(root, "README.md", "Ignored author guidance.\n");
  await put(root, "_control/PASS.md", "> DRAFT CONTROL RECORD\n");
  await put(
    root,
    "scenes/_template.md",
    "---\nname: template\n---\n\nIgnored template.\n",
  );
}

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("compileCanonDirectory", () => {
  it("deterministically compiles every canon entity shape and preserves import metadata", async () => {
    const root = await makeRoot();
    await seedCompleteCanon(root);

    const before = await snapshot(root);
    const first = await compileCanonDirectory({
      slug: "test-story",
      dir: root,
    });
    const second = await compileCanonDirectory({
      slug: "test-story",
      dir: root,
    });
    expect(second.records).toEqual(first.records);
    expect(first.counts).toEqual({
      character: 3,
      location: 1,
      rule: 2,
      style: 1,
      scene: 1,
      lore: 1,
      worldbuilding: 1,
    });

    const character = first.records.find(
      (record: { name: string }) => record.name === 'Aria "Ace" Voss',
    );
    expect(character.content).toContain('Full Name: Aria "Ace" Voss');
    expect(character.content).toContain('Aliases: ["Ace","Map: Maker"]');
    expect(character.tags).toEqual([
      "mnemosyne",
      "story",
      "character",
      "character-focus",
      "validation:clean",
    ]);
    expect(character.pinned).toBe(false);

    const object = first.records.find(
      (record: { name: string }) => record.name === "Aria's Compass",
    );
    expect(object.tags).toEqual([
      "mnemosyne",
      "story",
      "lore",
      "object",
      "lightning",
    ]);

    expect(
      first.records.find(
        (record: { name: string }) => record.name === "Dockmaster Vale",
      ).content,
    ).toContain("brass keyring");
    for (const minorName of ["Dockmaster Vale", "Toma Reed"]) {
      expect(
        first.records.find(
          (record: { name: string }) => record.name === minorName,
        ).content,
      ).toContain("never proves a current location");
    }
    const adultCast = first.records.find(
      (record: { name: string }) => record.name === "Adult Cast",
    );
    expect(adultCast.pinned).toBe(true);
    expect(adultCast.tags).toContain("mature-content");
    expect(adultCast.created_at).toBe("2025-04-06T12:30:00Z");
    const style = first.records.find(
      (record: { name: string }) => record.name === "Tidal Prose",
    );
    expect(style.pinned).toBe(true);
    expect(style.tags).toContain("pinned-guidance");

    const scene = first.records.find(
      (record: { type: string }) => record.type === "scene",
    );
    expect(scene.created_at).toBe("2025-05-07T20:13:00-05:00");
    expect(scene.content).toBe(
      "[Chapter: Opening: Low Tide]\n\nThe tide exposed a second set of stairs.",
    );
    expect(scene.tags).toEqual([
      "mnemosyne",
      "story",
      "scene",
      "validation:clean",
      "locked-scene",
    ]);

    const document = buildCompiledExportDocument({
      records: first.records,
      storyName: "Test Story",
      storyCreatedAt: ISO,
      exportedAt: ISO,
    });
    const parsedDocument = parseExportDocument(JSON.stringify(document));
    expect(
      parsedDocument.records.find((record) => record.name === "Adult Cast")
        ?.created_at,
    ).toBe("2025-04-06T12:30:00Z");
    expect(
      checkImportCompatibility(document, {
        parseExportDocument,
        planImport,
      }),
    ).toEqual({
      dry_run: true,
      total_written: 0,
      records: 10,
      statuses: { create: 10 },
    });
    expect(await snapshot(root)).toEqual(before);
  });

  it("rejects a draft marker before compilation", async () => {
    const root = await makeRoot();
    await put(
      root,
      "characters/aria.md",
      `---
name: Aria
---

> **DRAFT — NOT ACTIVE CANON**

Unaccepted text.
`,
    );
    await expect(
      compileCanonDirectory({ slug: "test-story", dir: root }),
    ).rejects.toThrow(/draft\/control marker/);
  });

  it("rejects duplicates case-insensitively across one-file and batched characters", async () => {
    const root = await makeRoot();
    await put(
      root,
      "characters/aria.md",
      "---\nname: Aria Voss\n---\n\nCore record.\n",
    );
    await put(root, "characters/_minor.md", "## aria voss\n\nDuplicate.\n");
    await expect(
      compileCanonDirectory({ slug: "test-story", dir: root }),
    ).rejects.toThrow(/duplicate \(character/);
  });

  it("keeps a four-backtick fence open across a three-backtick line", async () => {
    const root = await makeRoot();
    await put(
      root,
      "rules.md",
      [
        "## Fence Length",
        "",
        "````text",
        "```",
        "## Not An Entity",
        "````",
        "",
        "Body after the fence.",
        "",
        "## Real Entity",
        "",
        "Real body.",
        "",
      ].join("\n"),
    );

    const compiled = await compileCanonDirectory({
      slug: "test-story",
      dir: root,
    });
    const rules = compiled.records.filter(
      (record: { type: string }) => record.type === "rule",
    );
    expect(rules.map((record: { name: string }) => record.name)).toEqual([
      "Fence Length",
      "Real Entity",
    ]);
    expect(rules[0].content).toContain("## Not An Entity");
  });

  it("rejects an unterminated batch fence at end of file", async () => {
    const root = await makeRoot();
    await put(
      root,
      "rules.md",
      [
        "## Evidence Before Answers",
        "",
        "````text",
        "## This Must Not Become Folded Content",
        "",
        "Still inside the code block.",
      ].join("\n"),
    );

    await expect(
      compileCanonDirectory({ slug: "test-story", dir: root }),
    ).rejects.toThrow(/unterminated fenced code block/);
  });

  it.each([
    [
      "misplaced",
      `## Evidence Before Answers

Discovery must precede certainty.

<!-- mnemosyne-meta: {"pinned":true} -->
`,
    ],
    [
      "duplicate",
      `## Evidence Before Answers
<!-- mnemosyne-meta: {"pinned":true} -->
<!-- mnemosyne-meta: {"tags":["evidence"]} -->

Discovery must precede certainty.
`,
    ],
  ])("rejects a %s mnemosyne-meta directive", async (_case, content) => {
    const root = await makeRoot();
    await put(root, "rules.md", content);

    await expect(
      compileCanonDirectory({ slug: "test-story", dir: root }),
    ).rejects.toThrow(/misplaced or duplicate mnemosyne-meta directive/);
  });

  it("rejects oversize content and invalid import metadata before output", async () => {
    const oversized = await makeRoot();
    await put(
      oversized,
      "characters/aria.md",
      `---\nname: Aria\n---\n\n${"x".repeat(100_001)}\n`,
    );
    await expect(
      compileCanonDirectory({ slug: "test-story", dir: oversized }),
    ).rejects.toThrow(/100,000-char/);

    const invalid = await makeRoot();
    await put(
      invalid,
      "scenes/cs-001-01-lab--opening.md",
      `---
catalog_key: CS-001-01-LAB
name: Opening
created_at: yesterday
pinned: "yes"
---

Scene body.
`,
    );
    await expect(
      compileCanonDirectory({ slug: "test-story", dir: invalid }),
    ).rejects.toThrow(/pinned must be true or false|ISO datetime/);
  });

  it("requires a backdated timestamp for every selectively promoted scene", async () => {
    const root = await makeRoot();
    await put(
      root,
      "scenes/cs-001-01-lab--opening.md",
      "---\ncatalog_key: CS-001-01-LAB\nname: Opening\n---\n\nScene body.\n",
    );
    await expect(
      compileCanonDirectory({ slug: "test-story", dir: root }),
    ).rejects.toThrow(/requires created_at/);
  });
});

describe("writeCompiledExport", () => {
  it("creates one explicit output and refuses overwrite or source-tree output", async () => {
    const source = await makeRoot();
    await put(
      source,
      "characters/aria.md",
      "---\nname: Aria\n---\n\nA cartographer.\n",
    );
    const outputRoot = await makeRoot();
    const compiled = await compileCanonDirectory({
      slug: "test-story",
      dir: source,
    });
    const document = buildCompiledExportDocument({
      records: compiled.records,
      storyName: "Test Story",
      storyCreatedAt: ISO,
      exportedAt: ISO,
    });
    const output = join(outputRoot, "test-story.json");
    await expect(writeCompiledExport(output, document, source)).resolves.toBe(
      output,
    );
    await expect(writeCompiledExport(output, document, source)).rejects.toThrow(
      /refusing to overwrite/,
    );
    await expect(
      writeCompiledExport(join(source, "compiled.json"), document, source),
    ).rejects.toThrow(/inside its source canon directory/);
  });

  it("rejects output routed into the real source through a linked ancestor", async ({
    skip,
  }) => {
    const source = await makeRoot();
    await mkdir(join(source, "routed-output"));
    const sourceAliasRoot = await makeRoot();
    const sourceAlias = join(sourceAliasRoot, "source-alias");
    if (!(await tryDirectoryLink(source, sourceAlias))) skip();

    const outputRoot = await makeRoot();
    const routedAncestor = join(outputRoot, "through-source");
    if (!(await tryDirectoryLink(source, routedAncestor))) skip();

    const document = buildCompiledExportDocument({
      records: [],
      storyName: "Test Story",
      storyCreatedAt: ISO,
      exportedAt: ISO,
    });
    const output = join(routedAncestor, "routed-output", "test-story.json");
    await expect(
      writeCompiledExport(output, document, sourceAlias),
    ).rejects.toThrow(/inside its source canon directory/);
    await expect(
      readFile(join(source, "routed-output", "test-story.json"), "utf8"),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });
});
