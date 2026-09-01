import type {
  EntityCatalogPort,
  StoryCatalogPort,
} from "../application/ports/catalog.js";
import { listAllEntities } from "../entities.js";
import type { OcClient } from "../oc-client.js";
import { listStories } from "../stories.js";

export function createStoryCatalogAdapter(oc: OcClient): StoryCatalogPort {
  return { listStories: () => listStories(oc) };
}

export function createEntityCatalogAdapter(oc: OcClient): EntityCatalogPort {
  return {
    listEntities: (storyId, markerMemoryId) =>
      listAllEntities(oc, storyId, markerMemoryId),
  };
}
