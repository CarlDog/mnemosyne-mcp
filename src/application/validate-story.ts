// Shared use case for standalone validation against story constraints.

import type {
  StoryConstraintReader,
  StoryContentValidator,
  StoryValidationResult,
} from "./ports/story-validation.js";

export interface ValidateStoryContentOptions {
  content: string;
}

/**
 * Validate a standalone text payload against the active story constraints
 * (rules, style, characters, and locations) without generation.
 *
 * This is the shared policy layer behind mnemo_validate and any equivalent
 * REST endpoint so both surfaces keep the same constraints and parse contract.
 */
export async function validateStoryContent(
  constraints: StoryConstraintReader,
  validator: StoryContentValidator,
  storyId: string,
  { content }: ValidateStoryContentOptions,
): Promise<StoryValidationResult> {
  const context = await constraints.read(storyId, content);
  return await validator.validate(context, content);
}

export type ValidateStory = (
  storyId: string,
  options: ValidateStoryContentOptions,
) => Promise<StoryValidationResult>;

export function createValidateStory(dependencies: {
  constraints: StoryConstraintReader;
  validator: StoryContentValidator;
}): ValidateStory {
  return async (storyId, options) =>
    await validateStoryContent(
      dependencies.constraints,
      dependencies.validator,
      storyId,
      options,
    );
}
