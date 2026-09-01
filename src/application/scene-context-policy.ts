import type { SceneContextStrategy } from "./model.js";

export const SCENE_CONTEXT_STRATEGIES = [
  "recency-first",
  "query-ranked",
] as const satisfies readonly SceneContextStrategy[];

export const DEFAULT_SCENE_CONTEXT_STRATEGY: SceneContextStrategy =
  "recency-first";

export const SCENE_CONTEXT_STRATEGY_DESCRIPTION =
  "When selecting RECENT SCENES for context, choose either recency-first " +
  "(project-scoped created-at order) or query-ranked (query-ranked " +
  "memory_search). Overrides the server default " +
  "MNEMO_SCENE_CONTEXT_STRATEGY for this call only. If unset, the server " +
  "default applies.";

export const SCENE_CONTEXT_FALLBACK_DESCRIPTION =
  "Optional fallback strategy tried when the primary yields no eligible " +
  "scenes. If unset while scene_context_strategy IS set on this call, no " +
  "fallback occurs (the chosen strategy runs pure); if both are unset, " +
  "the server's MNEMO_SCENE_CONTEXT_FALLBACK_STRATEGY applies.";

/** Resolve per-call overrides against server defaults in one policy function. */
export function resolveSceneContextStrategies(
  perCall: {
    strategy?: SceneContextStrategy;
    fallback?: SceneContextStrategy;
  },
  server: {
    strategy: SceneContextStrategy;
    fallback: SceneContextStrategy;
  },
): { strategy: SceneContextStrategy; fallback?: SceneContextStrategy } {
  const strategy = perCall.strategy ?? server.strategy;
  let fallback: SceneContextStrategy | undefined;
  if (perCall.fallback !== undefined) {
    fallback = perCall.fallback;
  } else if (perCall.strategy === undefined) {
    fallback = server.fallback;
  }
  if (fallback === strategy) fallback = undefined;
  return { strategy, ...(fallback !== undefined && { fallback }) };
}
