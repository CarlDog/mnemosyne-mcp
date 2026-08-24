// Hand-kept mirror of the /api response shapes (src/api/*.ts in the
// server). No codegen -- the surface is small and stable; see
// src/entities.ts's ENTITY_TYPES / RecalledEntity / EntitySummary and
// src/stories.ts's StorySummary on the server for the source of truth.

export const ENTITY_TYPES = [
  "character",
  "location",
  "rule",
  "style",
  "scene",
  "lore",
  "worldbuilding",
] as const;

export type EntityType = (typeof ENTITY_TYPES)[number];

export interface StorySummary {
  id: string;
  name: string;
  created_at: string;
  kindroid_kin?: string;
  kindroid_group_id?: string;
}

export interface EntitySummary {
  memory_id: string;
  type: EntityType;
  name: string;
  pinned: boolean;
  tags: string[];
  created_at: string;
  updated_at?: string | null;
}

export interface EntityDetail extends EntitySummary {
  body: string;
}
