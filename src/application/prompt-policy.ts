import type { ContextBundle, EntityType, Mode } from "./model.js";

export const MODES = [
  "participant",
  "director",
  "audience",
] as const satisfies readonly Mode[];

const MODE_DIRECTIVES: Record<Mode, string> = {
  participant:
    "You are a character in this story. The user will tell you which character they are playing. Stay in character and respond naturally as their scene partner — perform other characters in the scene as supporting cast, but your primary voice is theirs.",
  director:
    "You are a scene director. The user will describe a scene setup or give direction. You perform ALL characters in the scene — give each their own voice, mannerisms, and dialogue. Narrate actions, describe the environment, and advance the scene based on the user's direction.",
  audience:
    "You are a narrator telling a story. The user is your audience. Write vivid, immersive narrative prose. Perform all characters with distinct voices. Advance the plot naturally. The user may offer light guidance but is primarily here to enjoy the story.",
};

/** Rebuild a gathered bundle so only context-plan admissions are rendered. */
export function renderAdmittedBundle(
  context: ContextBundle,
  admittedIds: ReadonlySet<string>,
): ContextBundle {
  const entries = context.entries ?? [];
  const filterType = (strings: string[], type: EntityType): string[] => {
    const typed = entries.filter((entry) => entry.entity_type === type);
    return strings.filter((_, index) => {
      const entry = typed[index];
      return entry === undefined || admittedIds.has(entry.memory_id);
    });
  };
  return {
    rules: filterType(context.rules, "rule"),
    style: filterType(context.style, "style"),
    characters: filterType(context.characters, "character"),
    locations: filterType(context.locations, "location"),
    scenes: filterType(context.scenes, "scene"),
    lore: filterType(context.lore, "lore"),
    worldbuilding: filterType(context.worldbuilding, "worldbuilding"),
    entries: entries.filter((entry) => admittedIds.has(entry.memory_id)),
  };
}

export function neutralizeSectionDelimiters(text: string): string {
  return text
    .split("\n")
    .map((line) =>
      /^\s*={3,}.*={3,}\s*$/.test(line) ? line.replace(/=/g, "-") : line,
    )
    .join("\n");
}

function block(header: string, entries: string[]): string | null {
  if (entries.length === 0) return null;
  const safe = entries.map(neutralizeSectionDelimiters);
  return `=== ${header} ===\n${safe.join("\n\n")}`;
}

const ACTION_FORMATTING_STATEMENT =
  "Physical actions are written in *asterisks*; spoken dialogue stays plain text.";
const RULE_PRECEDENCE_STATEMENT =
  "The RULES and STYLE blocks below are absolute. Follow them exactly. They override any narration conventions implied by the mode directive above (tense, voice, point of view, register).";

export function buildSystemPrompt(mode: Mode, context: ContextBundle): string {
  const hasConstraints = context.rules.length > 0 || context.style.length > 0;
  const parts: (string | null)[] = [
    `${MODE_DIRECTIVES[mode]} ${ACTION_FORMATTING_STATEMENT}`,
    hasConstraints ? RULE_PRECEDENCE_STATEMENT : null,
    block("RULES", context.rules),
    block("STYLE", context.style),
    block("CHARACTERS", context.characters),
    block("LOCATIONS", context.locations),
    block("RECENT SCENES", context.scenes),
    block("LORE", context.lore),
    block("WORLDBUILDING", context.worldbuilding),
  ];
  return parts.filter((part): part is string => part !== null).join("\n\n");
}
