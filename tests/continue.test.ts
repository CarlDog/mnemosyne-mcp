// Phase C-1 integration test: end-to-end story continuation.
// Requires both OC_URL and OLLAMA_GENERATOR_MODEL in the environment;
// skips otherwise. Uses a small/fast model for iteration speed
// (override OLLAMA_GENERATOR_MODEL in the env if you want to test
// against the storytelling default).

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { OcClient } from "../src/oc-client.js";
import { OllamaProvider } from "../src/llm.js";
import { createStory } from "../src/stories.js";
import { saveEntity, recall } from "../src/entities.js";
import { buildSystemPrompt, gatherContext } from "../src/prompt.js";
import { teardownStory, testStoryName } from "./helpers.js";

const OC_URL = process.env.OC_URL;
const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_GENERATOR_MODEL;

const suite = OC_URL && OLLAMA_MODEL ? describe : describe.skip;

suite("Phase C-1 — continue (real OC + real Ollama)", () => {
  let oc: OcClient;
  let storyId: string;
  let generator: OllamaProvider;

  beforeAll(async () => {
    oc = new OcClient(new URL(OC_URL!));
    await oc.connect();
    generator = new OllamaProvider({
      url: OLLAMA_URL,
      defaultModel: OLLAMA_MODEL!,
    });
    const story = await createStory(oc, testStoryName("continue"));
    storyId = story.id;

    // Seed minimal context so the prompt has something to ground in.
    await saveEntity(oc, storyId, {
      type: "character",
      name: "Aria Voss",
      body: "A weathered cartographer with a missing left ear and a quiet voice.",
    });
    await saveEntity(oc, storyId, {
      type: "location",
      name: "The Dovecoast Tavern",
      body: "A fog-choked harbor inn; salt-warped tables, low ceilings, smell of pipe smoke.",
    });
    await saveEntity(oc, storyId, {
      type: "rule",
      name: "Tone",
      body: "Restrained, melancholic prose. No purple flourishes. Third-limited POV.",
    });
  }, 60_000);

  afterAll(async () => {
    await teardownStory(oc, storyId);
  });

  it("gathers context from the active story", async () => {
    const ctx = await gatherContext(oc, storyId, "Aria walks into the tavern.");
    expect(ctx.characters.length).toBeGreaterThanOrEqual(1);
    expect(ctx.locations.length).toBeGreaterThanOrEqual(1);
    expect(ctx.rules.length).toBeGreaterThanOrEqual(1);
    expect(ctx.characters.some((c) => c.includes("Aria Voss"))).toBe(true);
  });

  it("builds a system prompt with the populated blocks", async () => {
    const ctx = await gatherContext(oc, storyId, "Aria walks into the tavern.");
    const prompt = buildSystemPrompt("director", ctx);
    expect(prompt).toContain("scene director");
    expect(prompt).toContain("=== CHARACTERS ===");
    expect(prompt).toContain("Aria Voss");
    expect(prompt).toContain("=== LOCATIONS ===");
    expect(prompt).toContain("The Dovecoast Tavern");
    expect(prompt).toContain("=== RULES ===");
  });

  it(
    "generates a beat end-to-end and persists it as a scene",
    async () => {
      const ctx = await gatherContext(
        oc,
        storyId,
        "Aria walks into the Dovecoast Tavern looking for a man named Holt.",
      );
      const systemPrompt = buildSystemPrompt("director", ctx);
      const beatText = await generator.generate({
        systemPrompt,
        userMessage:
          "Aria walks into the Dovecoast Tavern looking for a man named Holt.",
        maxTokens: 256, // keep test fast
      });
      expect(beatText.length).toBeGreaterThan(20);

      const beatName = `Scene ${new Date().toISOString()}`;
      const saved = await saveEntity(oc, storyId, {
        type: "scene",
        name: beatName,
        body: beatText,
      });
      expect(saved.created).toBe(true);
      expect(saved.entity.type).toBe("scene");

      const scenes = await recall(oc, storyId, { type: "scene" });
      expect(scenes.find((s) => s.name === beatName)).toBeDefined();
    },
    5 * 60 * 1000, // generation can be slow
  );
});
