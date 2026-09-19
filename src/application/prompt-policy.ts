import type {
  ContextBundle,
  EntityType,
  GenreDeclaration,
  Mode,
  PositionContext,
} from "./model.js";

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
    // Not an entity, has no memory_id, and is not part of the context-plan
    // budget/dropping mechanism -- passes through unchanged, same as the
    // "protected" rules/style tier conceptually, just structurally simpler.
    ...(context.position && { position: context.position }),
    // Same reasoning as position: declarative story state, no memory_id,
    // outside the context-plan budget, so it passes through unchanged.
    ...(context.genre && { genre: context.genre }),
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

/** Declarative story state, not a constraint -- its own labeled section
 * rather than folded into RULES/STYLE (docs/POSITION_TRACKING_DESIGN.md,
 * ratification decision 5). Placed between LOCATIONS and RECENT SCENES: it
 * grounds "where/when we currently are" right after the world (locations)
 * and right before recent narrative history, which the model needs to read
 * against that anchor. */
function renderPositionBlock(
  position: PositionContext | undefined,
): string | null {
  if (!position) return null;
  // Neutralize name and spot SEPARATELY, before combining -- a
  // "=== RULES ===" spot only reaches column 0 of its own line (where the
  // spoof-detection regex requires it) if it's checked on its own, not
  // after being embedded mid-line as "<place> (=== RULES ===...)".
  const name = neutralizeSectionDelimiters(position.current_location.name);
  const spot = position.current_location.spot
    ? neutralizeSectionDelimiters(position.current_location.spot)
    : undefined;
  const place = spot ? `${name} (${spot})` : name;
  return `=== POSITION ===\nIt is currently ${position.current_story_datetime} at ${place}.`;
}

/** The story's declared genre, rendered after POSITION: the frame first (it
 * wins when conventions conflict), then the blends, then the story's own
 * guidance (docs/GENRE_DECLARATION_DESIGN.md §4). Every guidance string is
 * neutralized on its own BEFORE it is combined with a label or a bullet --
 * a "=== RULES ===" lean only reaches column 0 of its own line, where the
 * spoof-detection regex requires it, if it is checked before prefixing.
 * Dictionary terms need no neutralizing: they are validated kebab-case. */
function renderGenreBlock(genre: GenreDeclaration | undefined): string | null {
  if (!genre) return null;
  const [frame, ...blends] = genre.genres;
  const lines = [
    `This story's genre frame is ${frame}. The frame wins when conventions conflict.`,
  ];
  if (blends.length > 0) lines.push(`It blends: ${blends.join(", ")}.`);
  const guidance = genre.guidance;
  if (guidance) {
    lines.push(`Lean: ${neutralizeSectionDelimiters(guidance.lean)}`);
    if (guidance.conventions?.length) {
      lines.push("It promises:");
      for (const item of guidance.conventions) {
        lines.push(`- ${neutralizeSectionDelimiters(item)}`);
      }
    }
    if (guidance.avoid?.length) {
      lines.push("It must avoid:");
      for (const item of guidance.avoid) {
        lines.push(`- ${neutralizeSectionDelimiters(item)}`);
      }
    }
  }
  return `=== GENRE ===\n${lines.join("\n")}`;
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
    renderPositionBlock(context.position),
    renderGenreBlock(context.genre),
    block("RECENT SCENES", context.scenes),
    block("LORE", context.lore),
    block("WORLDBUILDING", context.worldbuilding),
  ];
  return parts.filter((part): part is string => part !== null).join("\n\n");
}
