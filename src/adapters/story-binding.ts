// Shared outbound helpers for the two use cases that read a story's marker
// binding and save a scene (continuation, session break). One implementation
// so the binding shape and the scene-save tag path cannot drift between them.

import type {
  SavedScene,
  StoryBinding,
} from "../application/ports/continuation.js";
import { saveEntity } from "../entities.js";
import type { OcClient } from "../oc-client.js";
import { findStory } from "../stories.js";

export async function readStoryBinding(
  oc: OcClient,
  storyId: string,
): Promise<StoryBinding> {
  const story = await findStory(oc, storyId);
  return {
    kindroidTarget: story?.kindroid_target,
    narratorProfile: story?.narrator_profile,
  };
}

export async function saveSceneEntity(
  oc: OcClient,
  storyId: string,
  name: string,
  body: string,
  extraTags?: string[],
): Promise<SavedScene> {
  const saved = await saveEntity(oc, storyId, {
    type: "scene",
    name,
    body,
    extraTags,
  });
  return { memory_id: saved.memory_id, tags: saved.tags };
}
