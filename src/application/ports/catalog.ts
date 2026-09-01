import type { ListAllEntitiesResult } from "../../entities.js";
import type { MnemoStory } from "../../stories.js";

export interface StoryCatalogPort {
  listStories(): Promise<MnemoStory[]>;
}

export interface EntityCatalogPort {
  listEntities(
    storyId: string,
    markerMemoryId: string,
  ): Promise<ListAllEntitiesResult>;
}
