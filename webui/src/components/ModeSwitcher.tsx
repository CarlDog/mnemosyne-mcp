import { MODES, type Mode } from "../api/types";
import { MODE_COPY } from "./mode-copy";

export default function ModeSwitcher({
  value,
  onChange,
}: {
  value: Mode;
  onChange: (mode: Mode) => void;
}) {
  return (
    <div className="mode-switcher" role="group" aria-label="Story posture">
      {MODES.map((mode) => (
        <button
          key={mode}
          type="button"
          className={`mode-switch${value === mode ? " is-active" : ""}`}
          data-short={MODE_COPY[mode].short}
          aria-label={MODE_COPY[mode].label}
          aria-pressed={value === mode}
          title={MODE_COPY[mode].description}
          onClick={() => onChange(mode)}
        >
          {MODE_COPY[mode].label}
        </button>
      ))}
    </div>
  );
}
