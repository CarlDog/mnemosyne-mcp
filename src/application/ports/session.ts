import type { KindroidTarget } from "../model.js";
import type { SavedScene, StoryBinding } from "./continuation.js";

/**
 * Outbound capabilities required by the session-break use case
 * (docs/KINDROID_NARRATOR_DESIGN.md S3). Deliberately narrow: a session break
 * is one mutation against one kin plus one scene save, nothing more.
 */
export interface SessionPort {
  readonly generatorName: string;
  /** The story marker's Kindroid target and narrator label, read together. */
  storyBinding(storyId: string): Promise<StoryBinding>;
  /**
   * Reset the target kin's short-term context and seed `greeting` as its
   * newest message. Cascaded (long-term) memory is never touched through this
   * port; the adapter pins that off. A timeout is reported by the adapter as
   * possibly-already-applied and is never retried automatically: chat break
   * has no idempotency key (live-verified 2026-09-03).
   */
  chatBreak(target: KindroidTarget, greeting: string): Promise<void>;
  saveScene(
    storyId: string,
    name: string,
    body: string,
    extraTags?: string[],
  ): Promise<SavedScene>;
  nowIso(): string;
  warn(event: string, message: string, fields?: Record<string, unknown>): void;
}
