// Phase v0.1.2 integration test for mnemo_validate's underlying
// validateContent path used standalone (no generator pass).

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { OcClient } from "../src/oc-client.js";
import { OllamaProvider } from "../src/llm.js";
import { saveEntity } from "../src/entities.js";
import { gatherContext } from "../src/prompt.js";
import { validateContent } from "../src/validator.js";
import { setupTestStory, teardownStory } from "./helpers.js";

const OC_URL = process.env.OC_URL;
const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_GENERATOR_MODEL;

const suite = OC_URL && OLLAMA_MODEL ? describe : describe.skip;

suite("v0.1.2 — mnemo_validate (standalone validation)", () => {
  let oc: OcClient;
  let storyId: string;
  let validator: OllamaProvider;

  beforeAll(async () => {
    ({ oc, storyId } = await setupTestStory(OC_URL!, "validate-standalone"));
    validator = new OllamaProvider({
      url: OLLAMA_URL,
      defaultModel: OLLAMA_MODEL!,
    });

    // Compound rule with multiple constraints — the v0.1.1 dogfood case.
    await saveEntity(oc, storyId, {
      type: "rule",
      name: "POV: Third-person past, Aria-only",
      body: "All scenes are written in third-person past tense, from Aria Voss's perspective only. Never use present tense for action narration. Other characters' thoughts may only be inferred through what Aria observes.",
    });
  }, 60_000);

  afterAll(async () => {
    await teardownStory(oc, storyId);
  });

  it(
    "returns a structured report when run standalone",
    async () => {
      const ctx = await gatherContext(oc, storyId, "diagnostic");
      const compliant =
        "Aria walked into the tavern. The bartender looked up, then back down to his glass.";
      const report = await validateContent(validator, ctx, compliant);
      expect(Array.isArray(report.issues)).toBe(true);
      expect(typeof report.summary).toBe("string");
    },
    5 * 60 * 1000,
  );
});
