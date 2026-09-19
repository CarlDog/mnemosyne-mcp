// Sweep orphaned overlay-test fixtures out of the real story tree.
//
// Both overlay suites build their fixtures INSIDE `data/stories/`, because the
// verifier and the promotion tool resolve a story by slug under that root and a
// black-box test cannot point them anywhere else. Each suite's `afterEach`
// removes what it created, but that does not run when the process is killed or
// a test times out, so an orphan is left sitting among the operator's real
// stories. Since the genre standard's slice 3 the fixtures also seed a
// `canon/_story.md`, so an orphan now turns up in any listing of declared
// stories -- which is how the first ones were noticed.
//
// This is a recursive delete inside a private data tree, so two rules make it
// safe, and both are load-bearing:
//
//  1. The directory name must match the generator's EXACT shape, process id and
//     all. A real story slug cannot match, and neither can a directory that
//     merely starts with "verify-overlay".
//  2. The process that made it must be gone. The slug embeds the pid, so a
//     fixture belonging to a vitest run happening RIGHT NOW -- a sibling
//     worktree, another session on this machine -- is skipped rather than
//     deleted out from under it. A recycled pid means an orphan survives
//     another day, which is the harmless direction to be wrong in.
import { readdir, rm } from "node:fs/promises";
import { join } from "node:path";

/** `<suite>-<pid>-<8 hex>`, exactly, for the three suites that build fixtures
 * in the real stories root. Kept in one place so they cannot drift from the
 * generators in `makeStoryRoot()`, promote-overlay's `seed()` and
 * compile-story's own.
 *
 * Deliberately absent, each verified rather than assumed: `gated-*`,
 * `mutating-validator-*` and `linked-story-*` all resolve under a `mkdtemp`
 * directory, never here. `stable-story` and `example-saga` appear in
 * scaffold-story and config-data-dir only as expected path STRINGS that are
 * compared, never created -- and their fixed names are indistinguishable from
 * a real story, so they must never be swept even if that changes. */
const FIXTURE_SLUG =
  /^(?:verify-overlay|promote-overlay|compile-story)-(\d+)-[0-9a-f]{8}$/;

/** True when a pid is still on the machine. `kill(pid, 0)` sends no signal; it
 * throws ESRCH when there is no such process, and EPERM when one exists that
 * we may not signal -- which still means ALIVE, so only ESRCH counts as gone. */
function processIsRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? (error as { code?: unknown }).code
        : undefined;
    return code !== "ESRCH";
  }
}

/**
 * Delete every orphaned fixture directory under `storiesRoot` whose owning
 * process has exited, and return the slugs removed.
 *
 * `isRunning` is injectable so a test can drive both branches without spawning
 * real processes; production callers pass nothing.
 */
export async function sweepStaleStoryFixtures(
  storiesRoot: string,
  isRunning: (pid: number) => boolean = processIsRunning,
): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(storiesRoot, { withFileTypes: true });
  } catch {
    // No stories root yet (a fresh clone, or a suite that has not created one).
    // Nothing to sweep, and nothing worth failing a test run over.
    return [];
  }

  const removed: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const match = FIXTURE_SLUG.exec(entry.name);
    if (!match) continue;
    if (isRunning(Number(match[1]))) continue;
    await rm(join(storiesRoot, entry.name), { recursive: true, force: true });
    removed.push(entry.name);
  }
  return removed.sort();
}
