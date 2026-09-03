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
}

export interface StorySummary {
  id: string;
  name: string;
  created_at: string;
  kindroid_kin?: string;
  kindroid_group_id?: string;
  narrator_profile?: string;
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

export interface ContextBundle {
  rules: string[];
  style: string[];
  characters: string[];
  locations: string[];
  scenes: string[];
  lore: string[];
  worldbuilding: string[];
  entries?: ContextEntry[];
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
