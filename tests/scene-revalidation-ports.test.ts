import { describe, expect, it } from "vitest";
import { revalidateScenes } from "../src/application/revalidate-scenes.js";
import type {
  SceneValidationStore,
  SceneValidationTarget,
} from "../src/application/ports/scene-validation.js";
import type { ContextBundle } from "../src/prompt.js";

const context: ContextBundle = {
  rules: [],
  style: [],
  characters: [],
  locations: [],
  scenes: [],
  lore: [],
  worldbuilding: [],
};

function scene(name: string): SceneValidationTarget {
  return {
    name,
    body: `${name} body`,
    memory_id: `${name}-id`,
    tags: ["mnemosyne", "story", "scene"],
  };
}

describe("scene revalidation outbound ports", () => {
  it("walks sequentially, isolates failures, and continues retagging", async () => {
    const scenes = [scene("clean"), scene("broken"), scene("errors")];
    const events: string[] = [];
    const store: SceneValidationStore = {
      list: async (storyId) => {
        events.push(`list:${storyId}`);
        return scenes;
      },
      tag: async (target, verdict) => {
        events.push(`tag:${target.name}:${verdict}`);
      },
    };

    const result = await revalidateScenes(
      {
        scenes: store,
        constraints: {
          read: async (_storyId, content) => {
            events.push(`read:${content}`);
            return context;
          },
        },
        validator: {
          validate: async (_context, content) => {
            events.push(`validate:${content}`);
            if (content.startsWith("broken")) throw new Error("bad response");
            return content.startsWith("errors")
              ? {
                  issues: [
                    {
                      severity: "error" as const,
                      rule: "rule",
                      violating_text: "text",
                      explanation: "explanation",
                    },
                  ],
                  summary: "Errors",
                }
              : { issues: [], summary: "Clean" };
          },
        },
        observer: {
          sceneFailed: (target, error) => {
            events.push(`failed:${target.name}:${error}`);
          },
        },
      },
      "story-1",
    );

    expect(result).toEqual({
      scenes_checked: 3,
      tagged_clean: 1,
      tagged_errors: 1,
      failures: [{ name: "broken", error: "bad response" }],
    });
    expect(events).toEqual([
      "list:story-1",
      "read:clean body",
      "validate:clean body",
      "tag:clean:clean",
      "read:broken body",
      "validate:broken body",
      "failed:broken:bad response",
      "read:errors body",
      "validate:errors body",
      "tag:errors:errors",
    ]);
  });
});
