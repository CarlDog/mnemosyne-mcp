import { describe, expect, it, vi } from "vitest";
import {
  createValidateStory,
  validateStoryContent,
} from "../src/application/validate-story.js";
import type {
  StoryConstraintReader,
  StoryContentValidator,
} from "../src/application/ports/story-validation.js";
import type { ContextBundle } from "../src/prompt.js";

const context: ContextBundle = {
  rules: ["Keep the door locked."],
  style: [],
  characters: [],
  locations: [],
  scenes: [],
  lore: [],
  worldbuilding: [],
};

describe("standalone validation outbound ports", () => {
  it("loads constraints before passing the same context and content to validation", async () => {
    const read = vi.fn(async () => context);
    const validate = vi.fn(async () => ({ issues: [], summary: "Clean" }));
    const constraints: StoryConstraintReader = { read };
    const validator: StoryContentValidator = { validate };

    await expect(
      validateStoryContent(constraints, validator, "story-1", {
        content: "The door stays locked.",
      }),
    ).resolves.toEqual({ issues: [], summary: "Clean" });

    expect(read).toHaveBeenCalledWith("story-1", "The door stays locked.");
    expect(validate).toHaveBeenCalledWith(context, "The door stays locked.");
  });

  it("binds ports once for transport-neutral driver injection", async () => {
    const validateStory = createValidateStory({
      constraints: { read: async () => context },
      validator: {
        validate: async () => ({ issues: [], summary: "Bound" }),
      },
    });

    await expect(
      validateStory("story-2", { content: "A candidate beat." }),
    ).resolves.toEqual({ issues: [], summary: "Bound" });
  });
});
