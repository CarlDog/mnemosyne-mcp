import type { ContextBundle, ValidationReport } from "../model.js";

export type StoryValidationResult = ValidationReport;

/** Outbound port for loading the constraint context needed by validation. */
export interface StoryConstraintReader {
  read(storyId: string, content: string): Promise<ContextBundle>;
}

/** Outbound port for evaluating content against a resolved story context. */
export interface StoryContentValidator {
  validate(
    context: ContextBundle,
    content: string,
  ): Promise<StoryValidationResult>;
}
