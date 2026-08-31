// Concrete outbound adapters for the standalone validation use case.

import type {
  StoryConstraintReader,
  StoryContentValidator,
} from "../application/ports/story-validation.js";
import {
  createValidateStory,
  type ValidateStory,
} from "../application/validate-story.js";
import type { LlmProvider } from "../llm.js";
import type { OcClient } from "../oc-client.js";
import { gatherContext, type ContextBundle } from "../prompt.js";
import { validateContent, type ValidationReport } from "../validator.js";

export class OpenChronicleStoryConstraintReader implements StoryConstraintReader {
  constructor(private readonly oc: OcClient) {}

  async read(storyId: string, content: string): Promise<ContextBundle> {
    return await gatherContext(this.oc, storyId, content, {
      validationOnly: true,
    });
  }
}

export class LlmStoryContentValidator implements StoryContentValidator {
  constructor(private readonly validator: LlmProvider) {}

  async validate(
    context: ContextBundle,
    content: string,
  ): Promise<ValidationReport> {
    return await validateContent(this.validator, context, content);
  }
}

export function createStoryValidationAdapter(
  oc: OcClient,
  validator: LlmProvider,
): ValidateStory {
  return createValidateStory({
    constraints: new OpenChronicleStoryConstraintReader(oc),
    validator: new LlmStoryContentValidator(validator),
  });
}
