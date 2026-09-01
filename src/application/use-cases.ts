import type { ContinueScene } from "./continue-scene.js";
import type { ListEntityCatalog } from "./list-entities.js";
import type { ListStoryCatalog } from "./list-stories.js";
import type { RevalidateScenes } from "./revalidate-scenes.js";
import type { ValidateStory } from "./validate-story.js";

/** The complete inbound application contract assembled at the composition root. */
export interface ApplicationUseCases {
  continueScene: ContinueScene;
  listEntityCatalog: ListEntityCatalog;
  listStoryCatalog: ListStoryCatalog;
  revalidateScenes: RevalidateScenes;
  validateStory: ValidateStory;
}
