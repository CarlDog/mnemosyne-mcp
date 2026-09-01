import type { Mode } from "../api/types";

export const MODE_COPY: Record<
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
