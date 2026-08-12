// Local config file. Stores operational state only — see ARCHITECTURE.md §2.
// v0 holds just the current_story_id pointer.
//
// Location:
//   Windows: %APPDATA%\mnemosyne-mcp\config.json
//   POSIX:   $XDG_CONFIG_HOME/mnemosyne-mcp/config.json or ~/.config/mnemosyne-mcp/config.json
//   Override: $MNEMOSYNE_CONFIG_DIR

import { promises as fs } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

interface MnemoConfig {
  current_story_id?: string;
}

function configDir(): string {
  const override = process.env.MNEMOSYNE_CONFIG_DIR;
  if (override) return override;
  if (process.platform === "win32") {
    const appdata = process.env.APPDATA;
    if (appdata) return join(appdata, "mnemosyne-mcp");
  }
  const xdg = process.env.XDG_CONFIG_HOME;
  if (xdg) return join(xdg, "mnemosyne-mcp");
  return join(homedir(), ".config", "mnemosyne-mcp");
}

function configPath(): string {
  return join(configDir(), "config.json");
}

async function readConfig(): Promise<MnemoConfig> {
  try {
    const text = await fs.readFile(configPath(), "utf8");
    return JSON.parse(text) as MnemoConfig;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw err;
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
