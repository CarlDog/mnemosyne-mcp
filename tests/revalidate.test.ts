// v0.1.3 step 4 integration test for mnemo_revalidate_scenes.
// Requires both OC_URL and OLLAMA_GENERATOR_MODEL in the environment;
// skips otherwise (same env-gating pattern as every other integration file
// in this repo).
//
// Seeds scenes directly via saveEntity (skips mnemo_continue / the
// generator entirely -- this tool only reads and retags existing scenes,
// so there's no need to burn generator calls to produce fixture content).
// Mirrors the Dovecoast smoke-test fixture pattern documented in
// STATUS.md: a seeded "third-person past tense" rule, one scene that
// complies with it, and one that clearly violates it (present-tense
// prose).

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { OcClient } from "../src/oc-client.js";
import { OllamaProvider } from "../src/llm.js";
import { saveEntity, recall } from "../src/entities.js";
import { revalidateScenes } from "../src/tools/revalidate.js";
import { setupTestStory, teardownStory } from "./helpers.js";

const OC_URL = process.env.OC_URL;
const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_GENERATOR_MODEL;

const suite = OC_URL && OLLAMA_MODEL ? describe : describe.skip;

suite("v0.1.3 step 4 — mnemo_revalidate_scenes (real OC + real Ollama)", () => {
  let oc: OcClient;
  let storyId: string;
  let validator: OllamaProvider;

  beforeAll(async () => {
    ({ oc, storyId } = await setupTestStory(OC_URL!, "revalidate"));
    validator = new OllamaProvider({
      url: OLLAMA_URL,
      defaultModel: OLLAMA_MODEL!,
    });

    // Compound rule with multiple constraints -- same fixture shape as
    // validate-tool.test.ts's v0.1.1 dogfood case.
    await saveEntity(oc, storyId, {
      type: "rule",
      name: "POV: Third-person past, Aria-only",
      body: "All scenes are written in third-person past tense, from Aria Voss's perspective only. Never use present tense for action narration.",
    });

    await saveEntity(oc, storyId, {
      type: "scene",
      name: "Compliant scene",
      body: "Aria walked into the tavern. She looked around and sat by the fire, watching the door.",
    });

    await saveEntity(oc, storyId, {
      type: "scene",
      name: "Violating scene",
      body: "Aria walks into the tavern. She looks around and sits by the fire, watching the door, present tense throughout this whole scene.",
    });
  }, 60_000);

  afterAll(async () => {
    await teardownStory(oc, storyId);
  });

  it(
    "tags the violating scene validation:errors and the compliant scene validation:clean",
    async () => {
      const result = await revalidateScenes(oc, validator, storyId);

      expect(result.scenes_checked).toBe(2);
      expect(result.failures).toEqual([]);

      const scenes = await recall(oc, storyId, { type: "scene" });
      const compliant = scenes.find((s) => s.name === "Compliant scene");
      const violating = scenes.find((s) => s.name === "Violating scene");
      expect(compliant).toBeDefined();
      expect(violating).toBeDefined();
      expect(compliant!.tags).toContain("validation:clean");
      expect(violating!.tags).toContain("validation:errors");
    },
    5 * 60 * 1000,
  );
});
