// Shared use case for standalone validation against story constraints.

import type { OcClient } from "../oc-client.js";
import type { LlmProvider } from "../llm.js";
import { gatherContext } from "../prompt.js";
import { validateContent, type ValidationReport } from "../validator.js";

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
  oc: OcClient,
  validator: LlmProvider,
  storyId: string,
  { content }: ValidateStoryContentOptions,
): Promise<ValidationReport> {
  const context = await gatherContext(oc, storyId, content, {
    validationOnly: true,
  });
  return await validateContent(validator, context, content);
}
