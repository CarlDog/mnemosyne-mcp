import type { ListAllEntitiesResult, MnemoStory } from "../model.js";

export interface StoryCatalogPort {
  listStories(): Promise<MnemoStory[]>;
}

export interface EntityCatalogPort {
  listEntities(
    storyId: string,
    markerMemoryId: string,
  ): Promise<ListAllEntitiesResult>;
}
