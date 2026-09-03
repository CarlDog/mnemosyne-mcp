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
// (any distinctive word of a multi-word name counts) and fold in only the
// matching entries, plus every location and the already-relevance-filtered
// recent scenes -- never the full assembled context (that's still a poor
// fit for a chat companion, and most of it would go unused per call
// anyway). Applies identically to both target types -- what changes per
// target is only which underlying kindroid-mcp call sends the message.
//
// The only channel available is the message text itself (Kindroid has no
// separate context channel), so a match becomes a visible prefix block in
// what's sent -- and thus in the AI's (or group's) own chat history.
// Confirmed acceptable trade-off (operator, 2026-08-01).

import {
  buildCompanionMessage,
  DEFAULT_USER_NAME,
} from "./companion-message.js";
import type { KindroidClient, KindroidGroupReply } from "./kindroid-client.js";
import { RunOutcomeError } from "./run-outcome.js";
import { selectCompanionMemoryIds } from "./companion-message.js";
import type { GeneratedBeat, LlmGenerateOptions, LlmProvider } from "./llm.js";
import type { ContextBundle } from "./prompt.js";
import type { KindroidTarget } from "./stories.js";

export interface KindroidProviderConfig {
  /** The dedicated storytelling target (a single AI or a group chat) used
   * when no story-bound or per-call override applies. */
  defaultTarget: KindroidTarget;
  /** Server-wide default AI turns per group beat (KINDROID_GROUP_MAX_TURNS).
   * Falls back to DEFAULT_GROUP_MAX_TURNS when unset. */
  groupMaxTurns?: number;
  /** Operator display name for the outgoing-message provenance header
   * (MNEMO_USER_NAME). Falls back to DEFAULT_USER_NAME when unset. */
  userName?: string;
}

// Matches kindroid-mcp's own kindroid_advance_group default -- a "beat"
// against a group naturally involves a few characters exchanging lines,
// not just one. Overridable server-wide via KINDROID_GROUP_MAX_TURNS, and
// per call via mnemo_continue's group_max_turns.
export const DEFAULT_GROUP_MAX_TURNS = 4;

// kindroid_advance_group's own schema bound (z.number().int().min(1).max(8)).
// Mirrored rather than invented so an out-of-range value fails local zod /
// startup validation with a useful message, instead of surfacing as an
// opaque MCP error from upstream.
export const MIN_GROUP_MAX_TURNS = 1;
export const MAX_GROUP_MAX_TURNS = 8;

// Group chats default to funneling every reaction at the direction/situation
// rather than at each other -- discovered via cross-repo comparison with
// watch-companion's KindroidBackend, which found and fixed the identical
// behavior for its own group-chat "watch party" use case (its
// groupConversationNote(), src/backends/kindroid.ts). Without an explicit
// nudge, kins tend to each independently react to the same input rather than
// building on one another's replies -- live-observed on 2026-08-12 as one
// kin taking two of four turns in a row against a real group. Appended
// unconditionally to every group-target message; single-AI targets never
// see it (there's no "each other" to talk to).
//
// mnemosyne can do one better than watch-companion's static version: it
// already keyphrase-matches which characters the direction actually names
// (see `matched` below), so the nudge can name them specifically rather than
// gesture at "each other" -- a concrete instruction beats a vague one. Falls
// back to the generic phrasing when no character was matched (a cold-open
// direction that doesn't name anyone yet).
//
// The @-mention line is not a guess -- confirmed against Kindroid's own
// groupchats documentation (kindroid.ai/docs/article/groupchats/, checked
// 2026-08-12): "@Name mentions... lets the mentioned Kindroid speak next...
// Kindroids can also mention other Kindroids to hand off the baton if you
// inform them to use @Name mentions". Turn-selection is otherwise an opaque
// model decision (confirmed by reading kindroid-mcp's own get-turn
// implementation -- max_turns is never passed to it), so @-mention is the
// only actual lever a message can pull on who speaks next; naming it
// explicitly beats hoping the model infers it from "talk to each other."
function groupConversationNote(matchedCharacterNames: string[]): string {
  const who =
    matchedCharacterNames.length > 0
      ? ` -- ${matchedCharacterNames.join(", ")} included`
      : "";
  return (
    `There's more than one of you in this scene${who}. Talk to each ` +
    "other, not just to the situation -- react to what someone else just " +
    "said, agree, disagree, or build on it. Don't wait for a cue to keep " +
    "going. If you want a specific person to pick up next, @mention them " +
    "by name."
  );
}

/**
 * Builds the message actually sent to Kindroid: the shared companion-
 * message construction (see companion-message.ts — provenance header +
 * story-context block + direction), suffixed with the group-conversation
 * nudge when `isGroup` is true. Kept as the public entry point so callers
 * and tests are insulated from the shared-builder extraction.
 */
export function buildKindroidMessage(
  userMessage: string,
  context?: ContextBundle,
  isGroup = false,
  userName: string = DEFAULT_USER_NAME,
): string {
  return buildCompanionMessage(
    userMessage,
    context,
    isGroup ? { groupNote: groupConversationNote } : undefined,
    userName,
  );
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

  /** Non-mutating readiness probe: connect() performs the MCP handshake
   * plus bounded required-tool discovery -- it never posts a message to a
   * conversation (docs/NEMOCLAW_ADOPTION_ASSESSMENT.md §3). */
  async checkReady(): Promise<void> {
    await this.client.connect();
  }

  /** Reset the target kin's short-term context, seeding `greeting` as its
   * newest message (docs/KINDROID_NARRATOR_DESIGN.md S3). Single-AI only;
   * a group's reset is a different subscriber-only operation that stays out
   * of scope. Cascaded memory is never wiped from here. */
  async chatBreak(aiId: string, greeting: string): Promise<void> {
    await this.client.chatBreak(aiId, greeting);
  }

  async generate(opts: LlmGenerateOptions): Promise<GeneratedBeat> {
    const target = opts.kindroidTarget ?? this.config.defaultTarget;
    const message = buildKindroidMessage(
      opts.userMessage,
      opts.context,
      target.type === "group",
      this.config.userName,
    );
    // The TRUE companion payload, for the context-plan manifest.
    const selection = selectCompanionMemoryIds(opts.userMessage, opts.context);

    if (target.type === "group") {
      // allowUser defaults false -- AI-only turns, the right shape for a
      // caller that can't take a turn (a scheduled or webhook-driven one).
      // A conversational caller CAN take it, and passes allowUser: true to
      // let the loop hand the floor back mid-scene. See LlmGenerateOptions
      // for why this is per-call with no env counterpart.
      const result = await this.client.advanceGroup(target.id, message, {
        maxTurns:
          opts.groupMaxTurns ??
          this.config.groupMaxTurns ??
          DEFAULT_GROUP_MAX_TURNS,
        allowUser: opts.allowUser ?? false,
      });

      // Keyed on `turns`, not on replies or allowUser, because the two
      // zero-reply cases are opposites and only `turns` separates them.
      // turns === 0: the group yielded before anyone spoke (reachable only
      // when allowUser is true -- kindroid-mcp's get-turn can only come
      // back empty in that case). A legitimate outcome, not an error.
      // turns > 0 with no replies: the turns WERE generated and persisted
      // upstream, and only the read-back failed. Never retry that -- it
      // would generate duplicates against a real conversation.
      if (result.turns > 0 && result.replies.length === 0) {
        const cause = result.read_back_error
          ? `: ${result.read_back_error}`
          : "";
        throw new RunOutcomeError(
          "completed_but_readback_failed",
          `Kindroid group ${target.id} generated ${result.turns} ` +
            `turn(s) but they could not be read back${cause}. Those turns ` +
            `exist in the conversation -- do NOT retry this beat, that ` +
            `would generate duplicates. Read the group's recent history ` +
            `instead.`,
        );
      }

      return {
        text: formatGroupReplies(result.replies),
        groupEnded: result.ended,
        groupTurns: result.turns,
        ...(selection !== undefined && { context_selection: selection }),
      };
    }

    return {
      text: await this.client.sendMessage(target.id, message),
      ...(selection !== undefined && { context_selection: selection }),
    };
  }
}
