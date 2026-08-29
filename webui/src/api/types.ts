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

export const MODES = ["participant", "director", "audience"] as const;
export type Mode = (typeof MODES)[number];
export const SCENE_CONTEXT_STRATEGIES = [
  "recency-first",
  "query-ranked",
] as const;
export type SceneContextStrategy = (typeof SCENE_CONTEXT_STRATEGIES)[number];

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

export interface ContinueRequest {
  direction: string;
  mode?: Mode;
  scene_context_strategy?: SceneContextStrategy;
  scene_context_fallback_strategy?: SceneContextStrategy;
  max_tokens?: number;
  temperature?: number;
  model?: string;
  kindroid_kin?: string;
  kindroid_group_id?: string;
  group_max_turns?: number;
  allow_user?: boolean;
  validate?: boolean;
}

export interface ValidationReport {
  issues: Array<{
    severity: "info" | "warning" | "error";
    rule: string;
    violating_text: string;
    explanation: string;
  }>;
  summary: string;
}

export interface ContinueResponse {
  // beat_name and context_summary are absent on the yielded_to_user
  // response (a Kindroid group handing the floor straight back) -- the
  // server sends only beat_text:"", saved:false, message, mode, and
  // stages_ms in that case, so both must be optional here.
  beat_name?: string;
  beat_text: string;
  memory_id?: string;
  save_error?: string;
  saved?: boolean;
  mode: Mode;
  context_summary?: {
    rules: number;
    style: number;
    characters: number;
    locations: number;
    scenes: number;
    lore: number;
    worldbuilding: number;
  };
  validation?: ValidationReport;
  validation_error?: string;
  stages_ms: {
    gather_ms: number;
    generate_ms: number;
    save_ms: number;
    validate_ms: number;
  };
  yielded_to_user?: boolean;
  /** The beat was cut off at the generator's token budget: text present,
   * NOT saved, NOT validated -- message says how to proceed. */
  incomplete?: boolean;
  finish_reason?: string;
  message?: string;
  group_ended?: "user_turn" | "max_turns";
  group_turns?: number;
}
