// Shared use case: start a new session for a story's Kindroid narrator.
//
// docs/KINDROID_NARRATOR_DESIGN.md S3 (ratified 2026-09-03). A session break
// is an explicit, typed action, never something prose can trigger: it resets
// the bound kin's short-term context through kindroid_chat_break with the
// cascaded-memory wipe pinned off, seeds the greeting as the kin's newest
// message, and saves the same greeting as a scene so OC's recent scenes and
// the kin's context start the new session in step.
//
// It is its own use case rather than a parameter on continueScene because a
// break plus a direction would put two non-idempotent mutations behind one
// timeout, and chat break has no idempotency key to make a retry safe. Order
// inside is fixed: the break first, the save second. A break that succeeded
// with a failed save is recoverable (re-save the greeting); a saved greeting
// the kin never received would seed OC with continuity the kin does not have.

import type { KindroidTarget } from "./model.js";
import type { SessionPort } from "./ports/session.js";
import { narratorTag } from "./narrator-policy.js";
import { makeRunContext, type RunContext } from "../run-context.js";
import { RunOutcomeError } from "../run-outcome.js";

export const SESSION_BREAK_TAG = "session-break";

export interface SessionBreakOptions {
  /** The kin's opening message for the new session; also saved as a scene. */
  greeting: string;
  /** Per-call single-AI override (a raw ai_id or a kindroid-mcp registered
   * name); wins over the story's bound target for this call only. */
  explicitKin?: string;
  /** How the caller should continue afterwards, quoted in the message. */
  reinvokeHint: string;
}

export interface SessionBreakResult {
  run_id: string;
  target: KindroidTarget;
  greeting_scene: {
    name: string;
    memory_id?: string;
    save_error?: string;
  };
  narrator_profile?: string;
  message: string;
}

function rejected(message: string): RunOutcomeError {
  return new RunOutcomeError("rejected_before_dispatch", message);
}

export async function sessionBreak(
  port: SessionPort,
  storyId: string,
  opts: SessionBreakOptions,
  run: RunContext = makeRunContext("mcp", { storyId }),
): Promise<SessionBreakResult> {
  if (port.generatorName !== "kindroid") {
    throw rejected(
      `mnemo_session_break applies to the Kindroid generator only ` +
        `(GENERATOR_PROVIDER is "${port.generatorName}"); nothing was changed.`,
    );
  }
  const greeting = opts.greeting.trim();
  if (!greeting) {
    throw rejected(
      "greeting must not be empty: Kindroid requires one, and it becomes " +
        "the first message of the new session; nothing was changed.",
    );
  }

  const binding = await port.storyBinding(storyId);
  const target: KindroidTarget | undefined = opts.explicitKin
    ? { type: "ai", id: opts.explicitKin }
    : binding.kindroidTarget;
  if (!target) {
    throw rejected(
      "This story has no Kindroid target bound and no kindroid_kin was " +
        "given. Bind one with mnemo_story_use(kindroid_kin=...) or pass " +
        "kindroid_kin; nothing was changed.",
    );
  }
  if (target.type !== "ai") {
    throw rejected(
      "Session breaks apply to single-AI targets only; this story is bound " +
        "to a group chat. A group's reset is a different, subscriber-only " +
        "operation and is out of scope for the narrator; nothing was changed.",
    );
  }

  // The one mutation. A timeout surfaces from the client as
  // provider_dispatch_unknown with its own "do NOT retry" instruction.
  await port.chatBreak(target, greeting);

  const name = `Session break ${port.nowIso()}`;
  const tags = [
    SESSION_BREAK_TAG,
    ...(binding.narratorProfile ? [narratorTag(binding.narratorProfile)] : []),
  ];
  let memoryId: string | undefined;
  let saveError: string | undefined;
  try {
    const saved = await port.saveScene(storyId, name, greeting, tags);
    memoryId = saved.memory_id;
  } catch (err) {
    saveError = (err as Error).message;
    port.warn("sessionBreak", "greeting scene save failed", { msg: saveError });
  }

  return {
    run_id: run.runId,
    target,
    greeting_scene: {
      name,
      ...(memoryId !== undefined && { memory_id: memoryId }),
      ...(saveError !== undefined && { save_error: saveError }),
    },
    ...(binding.narratorProfile !== undefined && {
      narrator_profile: binding.narratorProfile,
    }),
    message: saveError
      ? `The chat break was applied and the greeting is the kin's newest ` +
        `message, but saving it as a scene failed: ${saveError}. Re-save ` +
        `the same greeting with mnemo_save_entity (type 'scene') so OC's ` +
        `recent scenes match the kin, then continue.`
      : `Chat break applied: the greeting is the kin's newest message and ` +
        `is saved as scene "${name}". Continue from it with ` +
        `${opts.reinvokeHint}; do not re-send the greeting.`,
  };
}

export type SessionBreak = (
  storyId: string,
  options: SessionBreakOptions,
  run?: RunContext,
) => Promise<SessionBreakResult>;

export function createSessionBreak(port: SessionPort): SessionBreak {
  return (storyId, options, run) => sessionBreak(port, storyId, options, run);
}
