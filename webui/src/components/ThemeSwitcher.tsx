import { useId } from "react";
import { useTheme } from "../theme-context";
import { getThemeDefinition, THEMES, type ThemeId } from "../theme";

export default function ThemeSwitcher() {
  const { themeId, setTheme } = useTheme();
  const selectId = useId();
  const descriptionId = useId();
  const selectedTheme = getThemeDefinition(themeId);

  return (
    <div className="theme-switcher">
      <div className="theme-switcher-heading">
        <label htmlFor={selectId}>Appearance</label>
        <span className="theme-swatches" aria-hidden="true">
          {selectedTheme.swatches.map((swatch) => (
            <span key={swatch} style={{ backgroundColor: swatch }} />
          ))}
        </span>
      </div>
      <select
        id={selectId}
        className="theme-select"
        value={themeId}
        aria-describedby={descriptionId}
        onChange={(event) => setTheme(event.target.value as ThemeId)}
      >
        {THEMES.map((theme) => (
          <option key={theme.id} value={theme.id}>
            {theme.shortName}
          </option>
        ))}
      </select>
      <p id={descriptionId}>{selectedTheme.description}</p>
    </div>
  );
}
