// Kindroid-backed LlmProvider -- generator only (see ARCHITECTURE.md /
// STATUS.md: the validator role always stays on Ollama, since a
// companion-chat model is a poor fit for "return JSON matching this
// schema").
//
// Targets either a single AI (kindroid_send_message) or a group chat
// (kindroid_advance_group's turn loop) -- see KindroidTarget in stories.ts.
// Unlike OllamaProvider, Kindroid has no system-prompt, temperature, or
// max_tokens concept: both are stateful chats tied to Kindroid-server-side
// persona/memory, not a stateless completion call -- so those three are
// still ignored here. But that persona/memory doesn't know story-specific
// facts (characters, locations, lore, worldbuilding), and Kindroid's own
// equivalent feature for that (keyphrase-triggered "Journal" entries) isn't
// exposed by the public API at all. So this provider does the same thing
// Kindroid's Journal would: scan the direction for an entity NAME mention
// and fold in only the matching entries, plus the already-relevance-filtered
// recent scenes -- never the full assembled context (that's still a poor
// fit for a chat companion, and most of it would go unused per call
// anyway). Applies identically to both target types -- what changes per
// target is only which underlying kindroid-mcp call sends the message.
//
// The only channel available is the message text itself (Kindroid has no
// separate context channel), so a match becomes a visible prefix block in
// what's sent -- and thus in the AI's (or group's) own chat history.
// Confirmed acceptable trade-off (operator, 2026-08-01).

import type { KindroidClient, KindroidGroupReply } from "./kindroid-client.js";
import type { LlmGenerateOptions, LlmProvider } from "./llm.js";
import type { ContextBundle } from "./prompt.js";
import type { KindroidTarget } from "./stories.js";

export interface KindroidProviderConfig {
  /** The dedicated storytelling target (a single AI or a group chat) used
   * when no story-bound or per-call override applies. */
  defaultTarget: KindroidTarget;
}

// Matches kindroid-mcp's own kindroid_advance_group default -- a "beat"
// against a group naturally involves a few characters exchanging lines,
// not just one. Not yet configurable; a cheap follow-up if that's needed.
const DEFAULT_GROUP_MAX_TURNS = 4;

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

/**
 * Builds the message actually sent to Kindroid: the raw direction, prefixed
 * with a story-context block when the direction name-mentions a character/
 * location/lore/worldbuilding entity, or when there are recent scenes.
 * Recent scenes are always included (already relevance-filtered by
 * gatherContext, capped at 5) -- reference entities are keyphrase-gated so
 * an unrelated direction doesn't drag in the whole cast list every call.
 * Pure function (no I/O) so it's unit-testable without a live client.
 */
export function buildKindroidMessage(
  userMessage: string,
  context?: ContextBundle,
): string {
  if (!context) return userMessage;

  const matched = REFERENCE_TYPES.flatMap((key) =>
    parseFlattened(context[key]).filter((entry) =>
      nameMentioned(userMessage, entry.name),
    ),
  );
  const scenes = parseFlattened(context.scenes);

  if (matched.length === 0 && scenes.length === 0) return userMessage;

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

  return `${lines.join("\n")}\n\n${userMessage}`;
}

/**
 * Resolves which target mnemo_continue should generate against for a given
 * call: an explicit per-call override (kindroid_kin / kindroid_group_id on
 * the call itself) always wins; otherwise the active story's own bound
 * target applies (see stories.ts's setKindroidTarget) -- but only when the
 * generator actually is Kindroid, since a story-bound target is meaningless
 * to any other provider. Returns undefined when neither applies, which
 * falls through to KindroidProvider's own configured defaultTarget. Pure so
 * it's unit-testable without a live story or provider.
 */
export function resolveKindroidTarget(
  explicitTarget: KindroidTarget | undefined,
  generatorName: string,
  storyTarget: KindroidTarget | undefined,
): KindroidTarget | undefined {
  if (explicitTarget !== undefined) return explicitTarget;
  return generatorName === "kindroid" ? storyTarget : undefined;
}

/**
 * Formats a group's turn-loop replies into a single beat: one line per
 * speaker, "Name: message", in the order Kindroid generated them --
 * multiple characters exchanging lines within one story beat is the whole
 * point of targeting a group rather than a single AI. Pure so it's
 * unit-testable without a live client.
 */
export function formatGroupReplies(replies: KindroidGroupReply[]): string {
  return replies
    .map((reply) => `${reply.display_name ?? reply.sender}: ${reply.message}`)
    .join("\n\n");
}

export class KindroidProvider implements LlmProvider {
  readonly name = "kindroid";

  constructor(
    private readonly client: KindroidClient,
    private readonly config: KindroidProviderConfig,
  ) {}

  async generate(opts: LlmGenerateOptions): Promise<string> {
    const target = opts.kindroidTarget ?? this.config.defaultTarget;
    const message = buildKindroidMessage(opts.userMessage, opts.context);

    if (target.type === "group") {
      // allowUser forced false: mnemosyne is generating a story beat, not
      // waiting on a live human's real-time turn in the group -- letting
      // the loop hand the turn back to "the user" would just mean zero AI
      // replies for a caller with no way to take that turn.
      const result = await this.client.advanceGroup(target.id, message, {
        maxTurns: DEFAULT_GROUP_MAX_TURNS,
        allowUser: false,
      });
      if (result.replies.length === 0) {
        throw new Error(
          `Kindroid group ${target.id} produced no AI replies for this beat.`,
        );
      }
      return formatGroupReplies(result.replies);
    }

    return this.client.sendMessage(target.id, message);
  }
}
