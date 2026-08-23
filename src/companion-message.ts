// Shared message construction for companion-chat providers (Kindroid,
// Botify) — services whose only channel is the message text itself: no
// system prompt, no temperature, no per-call model. Both need the same
// mechanic: scan the direction for a character/location/lore/worldbuilding
// entity NAME mention, fold in only the matching entries plus the
// already-relevance-filtered recent scenes, and never surface rules/style
// (the companion's own persona carries tone/voice — mnemosyne's
// prescriptive constraints would fight it). Extracted from
// kindroid-provider.ts when Botify became the second consumer: the
// word-boundary matching and scene-inclusion rules are correctness
// contracts that must not drift between providers.
//
// Every outgoing message is also unconditionally marked as an automated
// note (2026-08-23) -- the API writes it into the chat as a user turn, so
// without a marker it reads as the operator themselves typing, silently
// poisoning the companion's own memory of who said what. Bracket wording
// and rationale (square brackets over parens/OOC, descriptive not
// imperative framing) are researched, not guessed -- see the commit this
// landed in. Mirrors plex-companion's own `[Plex Companion -- automated
// ... note, not ${userName} typing]` convention, already live there.

import type { ContextBundle } from "./prompt.js";

/** Fallback when no operator name is configured (MNEMO_USER_NAME). */
export const DEFAULT_USER_NAME = "Carl";

interface ParsedEntry {
  name: string;
  body: string;
}

// gatherContext's entries are pre-flattened to "${name}\n${body}" (see
// prompt.ts's pullByType) -- split back out rather than changing that
// existing, tested shape.
function parseFlattened(entries: string[]): ParsedEntry[] {
  return entries.map((entry) => {
    const nl = entry.indexOf("\n");
    return nl === -1
      ? { name: entry, body: "" }
      : { name: entry.slice(0, nl), body: entry.slice(nl + 1) };
  });
}

// Word-boundary match, not a bare substring -- avoids e.g. a location named
// "Aria" false-matching inside an unrelated word like "Arial". Still a
// simple keyphrase match, same class of imprecision Kindroid's own Journal
// feature has (per its UI copy: "when a keyphrase comes up... the entry
// will be recalled") -- not trying to out-engineer the feature it mirrors.
//
// Lookaround, not \b: \b only fires at a transition between a word char and
// a non-word char, so it silently fails to match when the NAME's own edge
// character is itself non-word (e.g. "Prof. Whitfield Jr." ends in ".";
// the "." then a trailing space is a non-word-to-non-word transition, and
// \b never fires there even though the text is literally present).
// Lookaround instead checks "is the adjacent character (if any) a word
// char", which is correct regardless of what the name itself starts/ends
// with, and is vacuously true at the start/end of the message.
function nameMentioned(message: string, name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed) return false;
  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![A-Za-z0-9_])${escaped}(?![A-Za-z0-9_])`, "i").test(
    message,
  );
}

const REFERENCE_TYPES = [
  "characters",
  "locations",
  "lore",
  "worldbuilding",
] as const;

export interface CompanionMessageOptions {
  /** When set, appended as a final paragraph — built from the character
   * names the direction keyphrase-matched (may be empty). Kindroid's
   * group targets use this for the @-mention turn-handoff nudge;
   * single-target providers leave it unset. */
  groupNote?: (matchedCharacterNames: string[]) => string;
}

/**
 * Builds the message actually sent to a companion-chat service: an
 * unconditional provenance header (this is an automated note, not the
 * operator typing), then a story-context block when the direction
 * name-mentions a character/location/lore/worldbuilding entity or when
 * there are recent scenes, then the raw direction, then optionally a group
 * note (see CompanionMessageOptions). Recent scenes are always included
 * (already relevance-filtered by gatherContext, capped at 5) -- reference
 * entities are keyphrase-gated so an unrelated direction doesn't drag in
 * the whole cast list every call. Pure function (no I/O) so it's
 * unit-testable without a live client.
 */
export function buildCompanionMessage(
  userMessage: string,
  context?: ContextBundle,
  opts?: CompanionMessageOptions,
  userName: string = DEFAULT_USER_NAME,
): string {
  const matched = context
    ? REFERENCE_TYPES.flatMap((key) =>
        parseFlattened(context[key]).filter((entry) =>
          nameMentioned(userMessage, entry.name),
        ),
      )
    : [];
  const scenes = context ? parseFlattened(context.scenes) : [];
  const hasContextBlock = matched.length > 0 || scenes.length > 0;
  // Characters specifically (not locations/lore/worldbuilding) -- the only
  // reference type that makes sense to address as "talk to each other" in
  // a group note. A second, narrower pass over the same matching logic
  // rather than tagging types onto `matched`, to avoid restructuring the
  // already-tested block-building loop below.
  const matchedCharacterNames = context
    ? parseFlattened(context.characters)
        .filter((entry) => nameMentioned(userMessage, entry.name))
        .map((entry) => entry.name)
    : [];

  const parts: string[] = [
    `[Mnemosyne — automated scene direction, not ${userName} typing]`,
  ];
  if (hasContextBlock) {
    const lines = [
      "[Story context -- background knowledge, not something to quote verbatim:",
    ];
    for (const entry of matched) {
      lines.push(`- ${entry.name}: ${entry.body}`);
    }
    if (scenes.length > 0) {
      if (matched.length > 0) lines.push("");
      lines.push("Recent scenes:");
      for (const scene of scenes) {
        lines.push(`- ${scene.body || scene.name}`);
      }
    }
    lines.push("]");
    parts.push(lines.join("\n"));
  }
  parts.push(userMessage);
  if (opts?.groupNote) parts.push(opts.groupNote(matchedCharacterNames));

  return parts.join("\n\n");
}
