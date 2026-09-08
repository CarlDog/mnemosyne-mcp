import type {
  AdmissionMode,
  ContentRating,
  ContextBundle,
  GatherContextOptions,
  GenerateBeatOptions,
  GeneratedBeat,
  KindroidTarget,
  Mode,
  ModelUsage,
  ValidationReport,
} from "../model.js";

export type ContinuationBeat = GeneratedBeat;
export type ContinuationUsage = ModelUsage;

export interface SavedScene {
  memory_id: string;
  tags: string[];
  /** Present only when the injection-provenance scan (src/injection-scan.ts)
   * found a signal and an explicit override let the save proceed anyway --
   * the matched pattern labels, kept as an audit trail. */
  flagged_content_override?: string[];
}

/** See src/entities.ts's SaveEntityArgs -- the same skipInjectionScan/
 * allowFlagged pair, one level up at the saveScene port boundary. */
export interface SaveSceneOptions {
  skipInjectionScan?: boolean;
  allowFlagged?: boolean;
}

/** Outbound capabilities required by the continuation use case. */
/** What the story marker binds a story to: its Kindroid target and the
 * narrator label (S2), read together so one lookup serves both. */
export interface StoryBinding {
  kindroidTarget?: KindroidTarget;
  narratorProfile?: string;
}

/** mnemo_continue's position convenience params
 * (docs/POSITION_TRACKING_DESIGN.md slice 4) -- a narrower shape than
 * mnemo_position_set's own, since mnemo_continue cannot bootstrap tracking
 * (no epoch_date/epoch_location here) and has no set_elapsed_hours. */
export interface ContinuePositionUpdate {
  advance?: { hours?: number; days?: number; weeks?: number };
  setDate?: string;
  moveTo?: { location: string; spot?: string };
}

export interface ContinuationPort {
  readonly generatorName: string;
  /** The configured generator's declared content-generation capability
   * (docs/CONTENT_ROUTING_DESIGN.md, ratified 2026-09-08) -- mirrors
   * generatorName, sourced from the same LlmProvider. */
  readonly contentCapability: ContentRating;
  readonly admissionMode: AdmissionMode;
  readonly defaultMaxTokens: number;
  readonly contextMarginTokens: number;
  gatherContext(
    storyId: string,
    direction: string,
    options: GatherContextOptions,
  ): Promise<ContextBundle>;
  effectiveContextWindow(model?: string): Promise<number | undefined>;
  buildSystemPrompt(mode: Mode, context: ContextBundle): string;
  renderAdmittedContext(
    context: ContextBundle,
    admittedIds: ReadonlySet<string>,
  ): ContextBundle;
  capabilityWarnings(options: {
    temperature?: number;
    maxTokens?: number;
    model?: string;
  }): string[];
  /** The story marker's provider binding: its Kindroid target and narrator
   * label, read together so one marker lookup serves both. */
  storyBinding(storyId: string): Promise<StoryBinding>;
  /** Applies mnemo_continue's advance/set_date/move_to convenience params
   * (docs/POSITION_TRACKING_DESIGN.md slice 4) to the story's position
   * before generation. Throws (uninitialized tracking, invalid location,
   * mutually-exclusive params) before anything is dispatched -- see
   * continueScene's call site for how that's classified. Not called at all
   * when none of the three params is given. */
  applyPosition(storyId: string, update: ContinuePositionUpdate): Promise<void>;
  generate(options: GenerateBeatOptions): Promise<GeneratedBeat>;
  saveScene(
    storyId: string,
    name: string,
    body: string,
    extraTags?: string[],
    opts?: SaveSceneOptions,
  ): Promise<SavedScene>;
  validate(
    context: ContextBundle,
    content: string,
  ): Promise<{ report: ValidationReport; usage?: ModelUsage }>;
  retagValidation(
    memoryId: string,
    tags: string[],
    verdict: "clean" | "errors",
  ): Promise<void>;
  nowIso(): string;
  calibration(estimatedTokens: number, reportedTokens?: number): void;
  warn(event: string, message: string, fields?: Record<string, unknown>): void;
}
