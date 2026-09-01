import type {
  EntitySummary,
  ListEntitiesFilter,
  MnemoStory,
  RecalledEntity,
  StorySummary,
} from "./model.js";

export function toStorySummary(story: MnemoStory): StorySummary {
  return {
    id: story.id,
    name: story.name,
    created_at: story.created_at,
    ...(story.kindroid_target?.type === "ai" && {
      kindroid_kin: story.kindroid_target.id,
    }),
    ...(story.kindroid_target?.type === "group" && {
      kindroid_group_id: story.kindroid_target.id,
    }),
  };
}

export function filterListedEntities(
  entities: RecalledEntity[],
  filter: ListEntitiesFilter,
): RecalledEntity[] | EntitySummary[] {
  let filtered = filter.type
    ? entities.filter((entity) => entity.type === filter.type)
    : entities;
  if (filter.query) {
    const query = filter.query.toLowerCase();
    filtered = filtered.filter(
      (entity) =>
        entity.name.toLowerCase().includes(query) ||
        entity.body.toLowerCase().includes(query),
    );
  }
  if (filter.includeBody) return filtered;
  return filtered.map((entity) => ({
    memory_id: entity.memory_id,
    type: entity.type,
    name: entity.name,
    pinned: entity.pinned,
    tags: entity.tags,
    created_at: entity.created_at,
    updated_at: entity.updated_at,
  }));
}
