// Data-dir resolution + legacy-config migration. Pure/local — exercises
// src/config.ts against temp directories via the MNEMO_DATA_DIR and
// MNEMOSYNE_CONFIG_DIR overrides; no OC/Ollama/Kindroid required.

import { describe, it, expect } from "vitest";
import { isolateDataDirs } from "./helpers.js";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  getCurrentStoryId,
  setCurrentStoryId,
  storyDataDir,
} from "../src/config.js";

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));

const dirs = isolateDataDirs("mnemo-data");

async function writeConfigFile(dir: string, storyId: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(
    join(dir, "config.json"),
    JSON.stringify({ current_story_id: storyId }, null, 2) + "\n",
    "utf8",
  );
}

describe("data dir resolution", () => {
  it("storyDataDir lives under MNEMO_DATA_DIR when set, organized by storyline", () => {
    expect(storyDataDir("chaos-saga")).toBe(
      join(dirs.data, "stories", "chaos-saga"),
    );
  });

  it("empty-string MNEMO_DATA_DIR is treated as unset (repo-local default)", () => {
    process.env.MNEMO_DATA_DIR = "";
    expect(storyDataDir("chaos-saga")).toBe(
      join(REPO_ROOT, "data", "stories", "chaos-saga"),
    );
  });
});

describe("legacy config migration", () => {
  it("copies a legacy config.json into the data dir on first read", async () => {
    await writeConfigFile(dirs.legacy, "legacy-story");

    expect(await getCurrentStoryId()).toBe("legacy-story");

    // Migrated copy exists in the data dir…
    const migrated = JSON.parse(
      await fs.readFile(join(dirs.data, "config.json"), "utf8"),
    ) as { current_story_id?: string };
    expect(migrated.current_story_id).toBe("legacy-story");
    // …and the legacy original is left in place (copy, not move).
    await expect(
      fs.access(join(dirs.legacy, "config.json")),
    ).resolves.toBeUndefined();
  });

  it("does not consult the legacy location when the data dir already has a config", async () => {
    await writeConfigFile(dirs.data, "current-story");
    await writeConfigFile(dirs.legacy, "stale-legacy-story");

    expect(await getCurrentStoryId()).toBe("current-story");
  });

  it("returns undefined when neither location has a config", async () => {
    expect(await getCurrentStoryId()).toBeUndefined();
  });

  it("fails soft on a corrupt legacy config — reads keep working and a fresh write escapes", async () => {
    // Adversarial-review regression: throwing here would wedge every
    // config operation (setCurrentStoryId reads first), with no way out.
    await fs.mkdir(dirs.legacy, { recursive: true });
    await fs.writeFile(join(dirs.legacy, "config.json"), "{not json", "utf8");

    expect(await getCurrentStoryId()).toBeUndefined();

    await setCurrentStoryId("fresh-story");
    expect(await getCurrentStoryId()).toBe("fresh-story");
  });
});
