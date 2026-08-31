// Shared entity-catalog read use case for inbound drivers.

import type { OcClient } from "../oc-client.js";
import {
  filterListedEntities,
  listAllEntities,
  type EntitySummary,
  type ListEntitiesFilter,
  type RecalledEntity,
} from "../entities.js";
import type { MnemoStory } from "../stories.js";

export interface EntityCatalogResult {
  entities: RecalledEntity[] | EntitySummary[];
  count: number;
  skipped_memory_ids: string[];
}

export async function listEntityCatalog(
  oc: OcClient,
  story: Pick<MnemoStory, "id" | "marker_memory_id">,
  filter: ListEntitiesFilter,
): Promise<EntityCatalogResult> {
  const result = await listAllEntities(oc, story.id, story.marker_memory_id);
  const entities = filterListedEntities(result.entities, filter);
  return {
    entities,
    count: entities.length,
    skipped_memory_ids: result.skipped_memory_ids,
  };
}
