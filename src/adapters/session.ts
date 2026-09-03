import type { SessionPort } from "../application/ports/session.js";
import { KindroidProvider } from "../kindroid-provider.js";
import type { LlmProvider } from "../llm.js";
import { log } from "../log.js";
import type { OcClient } from "../oc-client.js";
import { readStoryBinding, saveSceneEntity } from "./story-binding.js";

/** Bind the session-break use case to OC and the configured generator. */
export function createSessionAdapter(
  oc: OcClient,
  generator: LlmProvider,
): SessionPort {
  return {
    generatorName: generator.name,
    storyBinding: (storyId) => readStoryBinding(oc, storyId),
    chatBreak: async (target, greeting) => {
      // The use case already refuses non-Kindroid generators; this is the
      // type-level guard that lets the provider's own method be called.
      if (!(generator instanceof KindroidProvider)) {
        throw new Error(
          `session break needs the Kindroid generator (got "${generator.name}")`,
        );
      }
      await generator.chatBreak(target.id, greeting);
    },
    saveScene: (storyId, name, body, extraTags) =>
      saveSceneEntity(oc, storyId, name, body, extraTags),
    nowIso: () => new Date().toISOString(),
    warn: (event, message, fields) => log.warn(event, message, fields),
  };
}
