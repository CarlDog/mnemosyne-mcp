// Shared helpers for the env-gated integration suites.
//
// Every integration file creates its own OC project (one Mnemosyne story)
// and is responsible for deleting it again. OC's `project_delete` is a
// hard delete with no recovery path — exactly right for throwaway test
// data, and the reason teardown lives here rather than being copy-pasted
// five times.

import { OcClient } from "../src/oc-client.js";
import { createStory } from "../src/stories.js";
import { log } from "../src/log.js";
import { afterEach, beforeEach } from "vitest";
import fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Shared prefix so any story that does survive a teardown failure is
// still identifiable as test cruft on the OC side.
const TEST_STORY_PREFIX = "mnemosyne-test-";

// Unique per-suite story name, e.g. `mnemosyne-test-entities-1750...`.
// The label keeps concurrent leftovers attributable to a suite.
export function testStoryName(label?: string): string {
  return `${TEST_STORY_PREFIX}${label ? `${label}-` : ""}${Date.now()}`;
}

// Connect to OC and create this suite's throwaway test story, so it's not
// copy-pasted across every integration file's `beforeAll`. Each suite still
// owns whatever it does next (constructing its own provider(s), seeding
// entities) -- this only covers the connect-then-create sequence common to
// all of them.
export async function setupTestStory(
  ocUrl: string,
  label?: string,
): Promise<{ oc: OcClient; storyId: string }> {
  const oc = new OcClient(new URL(ocUrl));
  await oc.connect();
  const story = await createStory(oc, testStoryName(label));
  return { oc, storyId: story.id };
}

// Delete the suite's test project, then close the OC connection.
//
// Safe to call unconditionally from `afterAll`: it tolerates a suite that
// failed before the story was created (`storyId` undefined) and never
// throws. A teardown error is logged, not surfaced — a failed cleanup must
// not mask the real failure or turn a passing suite red.
export async function teardownStory(
  oc: OcClient | undefined,
  storyId: string | undefined,
): Promise<void> {
  if (!oc) return;

  if (storyId) {
    try {
      const res = await oc.projectDelete(storyId);
      log.info("test-teardown", "deleted test project", {
        project_id: storyId,
        deleted_memories: res.deleted_memories,
      });
    } catch (err) {
      log.warn("test-teardown", "failed to delete test project", {
        project_id: storyId,
        msg: (err as Error).message,
      });
    }
  }

  try {
    await oc.close();
  } catch (err) {
    log.warn("test-teardown", "failed to close OC client", {
      msg: (err as Error).message,
    });
  }
}

// Isolates the two directories src/config.ts reads, for the duration of each
// test in the calling scope. Registers its own beforeEach/afterEach.
//
// Isolating MNEMO_DATA_DIR alone is NOT enough, and that is the whole reason
// this is shared: readConfig() auto-migrates from the legacy OS config dir (a
// real feature -- see config.ts), so a suite that leaves MNEMOSYNE_CONFIG_DIR
// pointing at the developer's actual machine silently populates its "fresh"
// temp dir with a leftover current_story_id. That rule was previously stated
// in a prose comment in one suite and reimplemented by hand in three others.
//
// Returns a live object; read `.data` / `.legacy` inside a test, not at
// module scope -- both are empty until beforeEach runs.
export function isolateDataDirs(prefix: string): {
  data: string;
  legacy: string;
} {
  const dirs = { data: "", legacy: "" };
  const saved: Record<string, string | undefined> = {};

  beforeEach(async () => {
    saved.MNEMO_DATA_DIR = process.env.MNEMO_DATA_DIR;
    saved.MNEMOSYNE_CONFIG_DIR = process.env.MNEMOSYNE_CONFIG_DIR;
    dirs.data = await fs.mkdtemp(join(tmpdir(), `${prefix}-`));
    dirs.legacy = await fs.mkdtemp(join(tmpdir(), `${prefix}-legacy-`));
    process.env.MNEMO_DATA_DIR = dirs.data;
    process.env.MNEMOSYNE_CONFIG_DIR = dirs.legacy;
  });

  afterEach(async () => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await fs.rm(dirs.data, { recursive: true, force: true });
    await fs.rm(dirs.legacy, { recursive: true, force: true });
  });

  return dirs;
}
