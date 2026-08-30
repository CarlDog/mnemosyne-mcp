import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  applyTheme,
  readAppliedTheme,
  readStoredTheme,
  selectTheme,
  THEME_STORAGE_KEY,
  type ThemeId,
} from "../theme";
import { ThemeContext } from "../theme-context";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeId] = useState<ThemeId>(() => readAppliedTheme());

  const setTheme = useCallback((nextTheme: ThemeId) => {
    setThemeId(selectTheme(nextTheme));
  }, []);

  useEffect(() => {
    const syncTheme = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY && event.key !== null) return;
      const nextTheme = readStoredTheme();
      applyTheme(nextTheme);
      setThemeId(nextTheme);
    };
    window.addEventListener("storage", syncTheme);
    return () => window.removeEventListener("storage", syncTheme);
  }, []);

  const value = useMemo(() => ({ themeId, setTheme }), [setTheme, themeId]);

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}
