import { createContinuationAdapter } from "../../src/adapters/continuation.js";
import { createSessionAdapter } from "../../src/adapters/session.js";
import {
  createEntityCatalogAdapter,
  createStoryCatalogAdapter,
} from "../../src/adapters/catalog.js";
import {
  continueScene as runContinueScene,
  createContinueScene,
  type ContinueSceneOptions,
  type ContinueSceneResult,
} from "../../src/application/continue-scene.js";
import { createListEntityCatalog } from "../../src/application/list-entities.js";
import { createListStoryCatalog } from "../../src/application/list-stories.js";
import { createSessionBreak } from "../../src/application/session-break.js";
import type { ApplicationUseCases } from "../../src/application/use-cases.js";
import type { RevalidateScenes } from "../../src/application/revalidate-scenes.js";
import type { ValidateStory } from "../../src/application/validate-story.js";
import type { LlmProvider } from "../../src/llm.js";
import type { OcClient } from "../../src/oc-client.js";
import type { RunContext } from "../../src/run-context.js";

/** Legacy-shaped test seam; production callers receive the bound use case. */
export function continueScene(
  oc: OcClient,
  generator: LlmProvider,
  validator: LlmProvider,
  storyId: string,
  options: ContinueSceneOptions,
  run?: RunContext,
): Promise<ContinueSceneResult> {
  return runContinueScene(
    createContinuationAdapter(oc, generator, validator),
    storyId,
    options,
    run,
  );
}

export function testUseCases(
  oc: OcClient,
  generator: LlmProvider,
  validator: LlmProvider,
  validateStory: ValidateStory,
  revalidateScenes: RevalidateScenes,
): ApplicationUseCases {
  return {
    continueScene: createContinueScene(
      createContinuationAdapter(oc, generator, validator),
    ),
    listEntityCatalog: createListEntityCatalog(createEntityCatalogAdapter(oc)),
    listStoryCatalog: createListStoryCatalog(createStoryCatalogAdapter(oc)),
    revalidateScenes,
    sessionBreak: createSessionBreak(createSessionAdapter(oc, generator)),
    validateStory,
  };
}
