// The sweep is a recursive delete that runs inside the operator's private
// story tree, so its two safety rules -- exact name shape, and owning process
// gone -- are pinned here rather than trusted.
import { mkdir, mkdtemp, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { sweepStaleStoryFixtures } from "./helpers/story-fixtures.js";

const roots: string[] = [];

afterEach(async () => {
  const { rm } = await import("node:fs/promises");
  await Promise.all(
    roots.splice(0).map((r) => rm(r, { recursive: true, force: true })),
  );
});

async function storiesRoot(names: string[]): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "mnemo-sweep-"));
  roots.push(root);
  for (const name of names) {
    // A directory with content, so a failed recursive delete cannot pass by
    // accident on an empty folder.
    await mkdir(join(root, name, "canon"), { recursive: true });
    await writeFile(join(root, name, "canon", "_story.md"), "seeded\n", "utf8");
  }
  return root;
}

async function remaining(root: string): Promise<string[]> {
  return (await readdir(root)).sort();
}

const DEAD = () => false;
const ALIVE = () => true;

describe("sweepStaleStoryFixtures", () => {
  it("removes an orphaned fixture whose process has exited", async () => {
    const root = await storiesRoot([
      "verify-overlay-66904-1e70eab6",
      "promote-overlay-1234-deadbeef",
    ]);

    const removed = await sweepStaleStoryFixtures(root, DEAD);

    expect(removed).toEqual([
      "promote-overlay-1234-deadbeef",
      "verify-overlay-66904-1e70eab6",
    ]);
    expect(await remaining(root)).toEqual([]);
  });

  it("leaves a fixture alone while its process is still running", async () => {
    // A sibling worktree or another session mid-run. Deleting this would break
    // a test that is currently using it.
    const root = await storiesRoot(["verify-overlay-66904-1e70eab6"]);

    const removed = await sweepStaleStoryFixtures(root, ALIVE);

    expect(removed).toEqual([]);
    expect(await remaining(root)).toEqual(["verify-overlay-66904-1e70eab6"]);
  });

  it("never touches a real story, even with every process reported dead", async () => {
    const real = [
      "battlechasers",
      "miskatonic-archives-the-blackwood-case",
      "star-wars-the-black-ledger",
      "the-noctis-veil",
      "_art-library",
    ];
    const root = await storiesRoot(real);

    const removed = await sweepStaleStoryFixtures(root, DEAD);

    expect(removed).toEqual([]);
    expect(await remaining(root)).toEqual([...real].sort());
  });

  it("requires the generator's exact shape, so near misses survive", async () => {
    // Every one of these starts like a fixture and is not one. A prefix match
    // would delete all of them.
    const nearMisses = [
      "verify-overlay",
      "verify-overlay-",
      "verify-overlay-66904",
      "verify-overlay-66904-1e70eab", // seven hex digits
      "verify-overlay-66904-1e70eab6z", // trailing junk
      "verify-overlay-abc-1e70eab6", // pid is not a number
      "verify-overlay-66904-1E70EAB6", // uppercase hex
      "my-verify-overlay-66904-1e70eab6", // not anchored at the start
      "gated-1e70eab6", // real shape, but lives in a temp repo, never here
    ];
    const root = await storiesRoot(nearMisses);

    const removed = await sweepStaleStoryFixtures(root, DEAD);

    expect(removed).toEqual([]);
    expect(await remaining(root)).toEqual([...nearMisses].sort());
  });

  it("returns nothing when the stories root does not exist", async () => {
    const root = await mkdtemp(join(tmpdir(), "mnemo-sweep-"));
    roots.push(root);

    await expect(
      sweepStaleStoryFixtures(join(root, "not-here"), DEAD),
    ).resolves.toEqual([]);
  });

  it("is actually called by both suites that build fixtures in the real tree", async () => {
    // Without this the sweep could be deleted from either beforeAll and every
    // test above would still pass: the helper would be correct and inert. The
    // read is asserted non-empty first, so a wrong path cannot satisfy this by
    // finding nothing.
    const { readFile } = await import("node:fs/promises");
    const here = new URL(".", import.meta.url);
    for (const suite of [
      "verify-draft-overlay.test.ts",
      "promote-overlay.test.ts",
    ]) {
      const source = await readFile(new URL(suite, here), "utf8");
      expect(source.length, `${suite} read as empty`).toBeGreaterThan(1000);
      expect(source, `${suite} no longer sweeps`).toContain(
        "sweepStaleStoryFixtures(STORIES_ROOT)",
      );
    }
  });

  it("uses the real liveness check by default, and this process is alive", async () => {
    // Pins that the default argument is wired: a fixture stamped with THIS
    // process's pid must survive a call that passes no predicate.
    const slug = `verify-overlay-${process.pid}-1e70eab6`;
    const root = await storiesRoot([slug]);

    const removed = await sweepStaleStoryFixtures(root);

    expect(removed).toEqual([]);
    expect(await remaining(root)).toEqual([slug]);
  });
});
