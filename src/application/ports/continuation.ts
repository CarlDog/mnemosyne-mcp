import type { AdmissionMode } from "../../context-plan.js";
import type {
  GeneratedBeat,
  LlmGenerateOptions,
  ModelUsage,
} from "../../llm.js";
import type {
  ContextBundle,
  GatherContextOptions,
  Mode,
} from "../../prompt.js";
import type { KindroidTarget } from "../../stories.js";
import type { ValidationReport } from "../../validator.js";

export type ContinuationBeat = GeneratedBeat;
export type ContinuationUsage = ModelUsage;

export interface SavedScene {
  memory_id: string;
  tags: string[];
}

/** Outbound capabilities required by the continuation use case. */
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
  storyKindroidTarget(storyId: string): Promise<KindroidTarget | undefined>;
  generate(options: LlmGenerateOptions): Promise<GeneratedBeat>;
  saveScene(storyId: string, name: string, body: string): Promise<SavedScene>;
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
