// Shared entity-catalog read use case for inbound drivers.

import type {
  EntitySummary,
  ListEntitiesFilter,
  RecalledEntity,
} from "../entities.js";
import type { MnemoStory } from "../stories.js";
import { filterListedEntities } from "./catalog-policy.js";
import type { EntityCatalogPort } from "./ports/catalog.js";

export interface EntityCatalogResult {
  entities: RecalledEntity[] | EntitySummary[];
  count: number;
  skipped_memory_ids: string[];
}

export async function listEntityCatalog(
  catalog: EntityCatalogPort,
  story: Pick<MnemoStory, "id" | "marker_memory_id">,
  filter: ListEntitiesFilter,
): Promise<EntityCatalogResult> {
  const result = await catalog.listEntities(story.id, story.marker_memory_id);
  const entities = filterListedEntities(result.entities, filter);
  return {
    entities,
    count: entities.length,
    skipped_memory_ids: result.skipped_memory_ids,
  };
}

export type ListEntityCatalog = (
  story: Pick<MnemoStory, "id" | "marker_memory_id">,
  filter: ListEntitiesFilter,
) => Promise<EntityCatalogResult>;

export function createListEntityCatalog(
  catalog: EntityCatalogPort,
): ListEntityCatalog {
  return (story, filter) => listEntityCatalog(catalog, story, filter);
}
