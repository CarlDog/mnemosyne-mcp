// Local config + data directory. Stores operational state only — see
// ARCHITECTURE.md §2. v0 holds just the current_story_id pointer.
//
// Location: <repo>/data (gitignored) by default, overridable with
// MNEMO_DATA_DIR. Repo-local so a Docker deployment can bind-mount the
// same path as persistent storage. Organized by storyline:
//   <data dir>/config.json                 — current-story pointer
//   <data dir>/stories/<slug>/exports/     — mnemo_export_story default
//   <data dir>/stories/<slug>/references/  — operator-curated assets
//                                            (e.g. character photos);
//                                            not written by the server
//
// Legacy location (pre-data-dir): the OS config dir —
// %APPDATA%\mnemosyne-mcp (Windows), $XDG_CONFIG_HOME/mnemosyne-mcp or
// ~/.config/mnemosyne-mcp (POSIX), MNEMOSYNE_CONFIG_DIR override. A
// config.json found there is migrated (copied, not moved) into the data
// dir on first read.

import { promises as fs } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { log } from "./log.js";

interface MnemoConfig {
  current_story_id?: string;
}

/** Data root: MNEMO_DATA_DIR (empty string treated as unset, per the
 * empty-string env-var convention) or <repo>/data. Resolved relative to
 * this module — one level up from src/ and dist/ alike — so tsx and
 * compiled runs land on the same directory. An npm-INSTALLED copy would
 * resolve this into node_modules (wiped on reinstall) — non-checkout
 * runs must set MNEMO_DATA_DIR explicitly. */
function dataDir(): string {
  const override = process.env.MNEMO_DATA_DIR;
  if (override) return override;
  return fileURLToPath(new URL("../data", import.meta.url));
}

function configPath(): string {
  return join(dataDir(), "config.json");
}

/** Per-storyline data root: <data dir>/stories/<slug>. Exports write to
 * its exports/ subfolder; references/ holds operator-curated assets. */
export function storyDataDir(slug: string): string {
  return join(dataDir(), "stories", slug);
}

/** Pre-data-dir config location, consulted only for one-time migration. */
function legacyConfigPath(): string {
  const override = process.env.MNEMOSYNE_CONFIG_DIR;
  if (override) return join(override, "config.json");
  if (process.platform === "win32") {
    const appdata = process.env.APPDATA;
    if (appdata) return join(appdata, "mnemosyne-mcp", "config.json");
  }
  const xdg = process.env.XDG_CONFIG_HOME;
  if (xdg) return join(xdg, "mnemosyne-mcp", "config.json");
  return join(homedir(), ".config", "mnemosyne-mcp", "config.json");
}

/** If the data dir has no config.json but the legacy OS config dir does,
 * copy it into the data dir and return its contents. Returns null when
 * there is nothing to migrate. The legacy file is left in place.
 *
 * Fail-soft on a corrupt or unreadable legacy file: throwing here would
 * wedge EVERY config operation (setCurrentStoryId reads first, so not
 * even mnemo_story_use could write a fresh config to escape) behind an
 * error that never names the forgotten legacy path. Warn and treat it
 * as nothing-to-migrate instead — the next write self-heals. */
async function migrateLegacyConfig(): Promise<MnemoConfig | null> {
  const from = legacyConfigPath();
  let config: MnemoConfig;
  try {
    config = JSON.parse(await fs.readFile(from, "utf8")) as MnemoConfig;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      log.warn("config", "ignoring unreadable legacy config", {
        from,
        error: String(err),
      });
    }
    return null;
  }
  await writeConfig(config);
  log.info("config", "migrated legacy config into data dir", {
    from,
    to: configPath(),
  });
  return config;
}

async function readConfig(): Promise<MnemoConfig> {
  try {
    const text = await fs.readFile(configPath(), "utf8");
    return JSON.parse(text) as MnemoConfig;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    return (await migrateLegacyConfig()) ?? {};
  }
}

async function writeConfig(config: MnemoConfig): Promise<void> {
  const path = configPath();
  await fs.mkdir(dirname(path), { recursive: true });
  await fs.writeFile(path, JSON.stringify(config, null, 2) + "\n", "utf8");
}

export async function setCurrentStoryId(storyId: string): Promise<void> {
  const cfg = await readConfig();
  cfg.current_story_id = storyId;
  await writeConfig(cfg);
}

export async function getCurrentStoryId(): Promise<string | undefined> {
  const cfg = await readConfig();
  return cfg.current_story_id;
}

export async function requireCurrentStoryId(): Promise<string> {
  const id = await getCurrentStoryId();
  if (!id) {
    throw new Error(
      "No active story. Call mnemo_story_use to set one before using this tool.",
    );
  }
  return id;
}
