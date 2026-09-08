export type EntityType =
  | "character"
  | "location"
  | "rule"
  | "style"
  | "scene"
  | "lore"
  | "worldbuilding";

export interface RecalledEntity {
  type: EntityType;
  name: string;
  body: string;
  memory_id: string;
  pinned: boolean;
  tags: string[];
  created_at: string;
  updated_at?: string;
  relevance?: number;
}

export type EntitySummary = Omit<RecalledEntity, "body">;

export interface ListEntitiesFilter {
  type?: EntityType;
  query?: string;
  includeBody?: boolean;
}

export interface ListAllEntitiesResult {
  entities: RecalledEntity[];
  skipped_memory_ids: string[];
}

export type KindroidTargetType = "ai" | "group";

/** A story's declared content-generation requirement, or a provider's
 * declared capability (docs/CONTENT_ROUTING_DESIGN.md, ratified
 * 2026-09-08). Shared between MnemoStory/StorySummary and (slice 2/3) the
 * generator port's capability descriptor. */
export type ContentRating = "sfw" | "nsfw";

export interface KindroidTarget {
  type: KindroidTargetType;
  id: string;
}

export interface MnemoStory {
  id: string;
  name: string;
  created_at: string;
  marker_memory_id: string;
  kindroid_target?: KindroidTarget;
  narrator_profile?: string;
  content_rating?: ContentRating;
}

export interface StorySummary {
  id: string;
  name: string;
  created_at: string;
  kindroid_kin?: string;
  kindroid_group_id?: string;
  narrator_profile?: string;
  content_rating?: ContentRating;
}

export type Mode = "participant" | "director" | "audience";
export type SceneContextStrategy = "recency-first" | "query-ranked";
export type AdmissionMode = "warn" | "enforce";

export interface ContextEntry {
  memory_id: string;
  entity_type: EntityType;
  name: string;
  tags: string[];
  pinned: boolean;
  created_at: string;
  relevance?: number;
  chars: number;
  est_tokens: number;
  admission: "included" | "dropped";
  reason: string;
}

/** The rendering-ready projection of a story's position (stories.ts's
 * PositionState), populated by gatherContext -- generation contexts only,
 * see GatherContextOptions.validationOnly. Deliberately narrower than
 * PositionState: epoch bookkeeping isn't narratively relevant, only the
 * derived current datetime/place is. */
export interface PositionContext {
  current_story_datetime: string;
  current_location: { name: string; spot?: string };
}

export interface ContextBundle {
  rules: string[];
  style: string[];
  characters: string[];
  locations: string[];
  scenes: string[];
  lore: string[];
  worldbuilding: string[];
  entries?: ContextEntry[];
  /** Absent when the story has no position tracking on, or the context is
   * validation-only. See PositionContext. */
  position?: PositionContext;
  /** The story's declared content-generation requirement
   * (docs/CONTENT_ROUTING_DESIGN.md, ratified 2026-09-08), resolved by the
   * same story-marker fetch as `position` -- zero extra cost. Absent when
   * undeclared, or the context is validation-only. */
  content_rating?: ContentRating;
}

export interface GatherContextOptions {
  sceneStrategy: SceneContextStrategy;
  sceneFallbackStrategy?: SceneContextStrategy;
  validationOnly?: boolean;
  signal?: AbortSignal;
}

export interface ValidationIssue {
  severity: "error" | "warning" | "info";
  rule: string;
  violating_text: string;
  explanation: string;
}

export interface ValidationReport {
  issues: ValidationIssue[];
  summary: string;
}

export interface ModelUsage {
  provider: string;
  model?: string;
  source: "reported";
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  cached_input_tokens?: number;
  cache_creation_input_tokens?: number;
  load_ms?: number;
  prompt_eval_ms?: number;
  generation_ms?: number;
}

export interface GeneratedBeat {
  text: string;
  complete?: boolean;
  finishReason?: "stop" | "length" | "unknown";
  usage?: ModelUsage;
  context_selection?: string[];
  groupEnded?: "user_turn" | "max_turns";
  groupTurns?: number;
}

export interface GenerateBeatOptions {
  systemPrompt: string;
  userMessage: string;
  temperature?: number;
  maxTokens?: number;
  model?: string;
  context?: ContextBundle;
  kindroidTarget?: KindroidTarget;
  groupMaxTurns?: number;
  allowUser?: boolean;
}
