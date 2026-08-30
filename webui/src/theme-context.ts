import { createContext, useContext } from "react";
import type { ThemeId } from "./theme";

export interface ThemeContextValue {
  themeId: ThemeId;
  setTheme: (themeId: ThemeId) => void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return value;
}
