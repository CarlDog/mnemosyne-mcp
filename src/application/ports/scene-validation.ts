export type SceneValidationVerdict = "clean" | "errors";

export interface SceneValidationTarget {
  name: string;
  body: string;
  memory_id: string;
  tags: string[];
}

/** Outbound port for enumerating and retagging canonical scenes. */
export interface SceneValidationStore {
  list(storyId: string): Promise<SceneValidationTarget[]>;
  tag(
    scene: SceneValidationTarget,
    verdict: SceneValidationVerdict,
  ): Promise<void>;
}

/** Optional observability port for isolated per-scene failures. */
export interface RevalidationObserver {
  sceneFailed(scene: SceneValidationTarget, error: string): void;
}
