export const THEME_STORAGE_KEY = "mnemosyne.webui.theme.v1";
export const DEFAULT_THEME_ID = "archivist" as const;

export const THEMES = [
  {
    id: DEFAULT_THEME_ID,
    name: "Archivist’s Light Table",
    shortName: "Archivist",
    description: "Warm ink, amber indexing, and a night-desk manuscript.",
    colorScheme: "dark",
    swatches: ["#110e0c", "#d9913b", "#8fa3b8"],
  },
  {
    id: "white-garden",
    name: "White Garden Courtesy",
    shortName: "White Garden",
    description: "Shadowless porcelain order, interrupted by one bruised rose.",
    colorScheme: "light",
    swatches: ["#f7f6f0", "#744d70", "#2f6f8d"],
  },
  {
    id: "blackwood",
    name: "Blackwood Glass Plate",
    shortName: "Blackwood",
    description: "Darkroom evidence chrome around a pale photographic plate.",
    colorScheme: "dark",
    swatches: ["#0e161a", "#d7dcd6", "#d97078"],
  },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];
export type ThemeDefinition = (typeof THEMES)[number];

export interface ThemeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface ThemeRoot {
  dataset: { theme?: string };
  style?: { colorScheme: string };
}

const THEME_IDS = new Set<string>(THEMES.map((theme) => theme.id));

function browserStorage(): ThemeStorage | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function browserRoot(): ThemeRoot | undefined {
  return typeof document === "undefined" ? undefined : document.documentElement;
}

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && THEME_IDS.has(value);
}

export function resolveThemeId(value: unknown): ThemeId {
  return isThemeId(value) ? value : DEFAULT_THEME_ID;
}

export function getThemeDefinition(themeId: ThemeId): ThemeDefinition {
  return THEMES.find((theme) => theme.id === themeId) ?? THEMES[0];
}

export function readStoredTheme(
  storage: ThemeStorage | undefined = browserStorage(),
): ThemeId {
  if (!storage) return DEFAULT_THEME_ID;
  try {
    return resolveThemeId(storage.getItem(THEME_STORAGE_KEY));
  } catch {
    return DEFAULT_THEME_ID;
  }
}

export function readAppliedTheme(
  root: ThemeRoot | undefined = browserRoot(),
): ThemeId {
  return resolveThemeId(root?.dataset.theme);
}

export function applyTheme(
  value: unknown,
  root: ThemeRoot | undefined = browserRoot(),
): ThemeId {
  const themeId = resolveThemeId(value);
  if (root) {
    root.dataset.theme = themeId;
    if (root.style) {
      root.style.colorScheme = getThemeDefinition(themeId).colorScheme;
    }
  }
  return themeId;
}

export function persistTheme(
  value: unknown,
  storage: ThemeStorage | undefined = browserStorage(),
): ThemeId {
  const themeId = resolveThemeId(value);
  try {
    storage?.setItem(THEME_STORAGE_KEY, themeId);
  } catch {
    // Storage can be unavailable in locked-down or private browser contexts.
    // Theme switching remains useful for the current page regardless.
  }
  return themeId;
}

export function selectTheme(
  value: unknown,
  options: { root?: ThemeRoot; storage?: ThemeStorage } = {},
): ThemeId {
  const themeId = applyTheme(value, options.root ?? browserRoot());
  persistTheme(themeId, options.storage ?? browserStorage());
  return themeId;
}

export function initializeTheme(
  options: { root?: ThemeRoot; storage?: ThemeStorage } = {},
): ThemeId {
  const storage = options.storage ?? browserStorage();
  const themeId = readStoredTheme(storage);
  return applyTheme(themeId, options.root ?? browserRoot());
}
