import type {
  AdmissionMode,
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

export interface ContinuationPort {
  readonly generatorName: string;
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
