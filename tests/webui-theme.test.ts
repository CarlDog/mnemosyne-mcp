import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  applyTheme,
  DEFAULT_THEME_ID,
  isThemeId,
  readStoredTheme,
  selectTheme,
  THEMES,
  THEME_STORAGE_KEY,
  type ThemeRoot,
  type ThemeStorage,
} from "../webui/src/theme.js";

function memoryStorage(initial?: string): ThemeStorage & {
  value: string | null;
} {
  return {
    value: initial ?? null,
    getItem() {
      return this.value;
    },
    setItem(_key, value) {
      this.value = value;
    },
  };
}

function themeRoot(): ThemeRoot {
  return { dataset: {}, style: { colorScheme: "" } };
}

describe("web UI themes", () => {
  it("keeps built-in ids unique and recognizes only the declared themes", () => {
    const ids = THEMES.map((theme) => theme.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain(DEFAULT_THEME_ID);
    expect(ids.every(isThemeId)).toBe(true);
    expect(isThemeId("<style>body{display:none}</style>")).toBe(false);
  });

  it("applies and persists a selected theme without touching route state", () => {
    const root = themeRoot();
    const storage = memoryStorage();

    expect(selectTheme("white-garden", { root, storage })).toBe("white-garden");
    expect(root.dataset.theme).toBe("white-garden");
    expect(root.style?.colorScheme).toBe("light");
    expect(storage.value).toBe("white-garden");
    expect(readStoredTheme(storage)).toBe("white-garden");
  });

  it("falls back to Archivist for missing, unknown, or malicious values", () => {
    const root = themeRoot();

    expect(readStoredTheme(memoryStorage())).toBe(DEFAULT_THEME_ID);
    expect(readStoredTheme(memoryStorage("future-theme"))).toBe(
      DEFAULT_THEME_ID,
    );
    expect(applyTheme("javascript:alert(1)", root)).toBe(DEFAULT_THEME_ID);
    expect(root.dataset.theme).toBe(DEFAULT_THEME_ID);
    expect(root.style?.colorScheme).toBe("dark");
  });

  it("remains usable when browser storage throws", () => {
    const unavailableStorage: ThemeStorage = {
      getItem() {
        throw new Error("storage blocked");
      },
      setItem() {
        throw new Error("storage blocked");
      },
    };
    const root = themeRoot();

    expect(readStoredTheme(unavailableStorage)).toBe(DEFAULT_THEME_ID);
    expect(
      selectTheme("blackwood", { root, storage: unavailableStorage }),
    ).toBe("blackwood");
    expect(root.dataset.theme).toBe("blackwood");
  });

  it("keeps the pre-paint bootstrap whitelist and storage key in sync", () => {
    const html = readFileSync(
      new URL("../webui/index.html", import.meta.url),
      "utf8",
    );

    expect(html).toContain(THEME_STORAGE_KEY);
    expect(html).toContain("Object.hasOwn(schemes, storedTheme)");
    for (const theme of THEMES) {
      expect(html).toMatch(new RegExp(`["']?${theme.id}["']?\\s*:`));
    }
  });

  it("keeps pane materials and portrait frames on semantic theme roles", () => {
    const globalCss = readFileSync(
      new URL("../webui/src/styles/global.css", import.meta.url),
      "utf8",
    );
    const themeCss = readFileSync(
      new URL("../webui/src/styles/themes.css", import.meta.url),
      "utf8",
    );
    const allCss = `${globalCss}\n${themeCss}`;

    for (const pane of ["scenes", "cast", "assembly", "media", "watch"]) {
      expect(globalCss).toContain(`.pane-window[data-pane="${pane}"]`);
      expect(
        allCss.match(new RegExp(`--pane-${pane}-background:`, "g")),
      ).toHaveLength(THEMES.length);
    }

    for (const role of [
      "--portrait-frame-radius:",
      "--portrait-frame-border:",
      "--portrait-frame-background:",
      "--portrait-frame-shadow:",
    ]) {
      expect(allCss.match(new RegExp(role, "g"))).toHaveLength(THEMES.length);
    }
  });
});
