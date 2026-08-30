import { MODES, type Mode } from "../api/types";

const MODE_COPY: Record<
  Mode,
  { label: string; short: string; description: string }
> = {
  participant: {
    label: "Participant",
    short: "Play",
    description: "Step into the scene and answer from inside it.",
  },
  director: {
    label: "Director",
    short: "Stage",
    description: "Stage the next beat from above the scene.",
  },
  audience: {
    label: "Audience",
    short: "Read",
    description: "Read first and offer only light guidance.",
  },
};

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

export { MODE_COPY };
