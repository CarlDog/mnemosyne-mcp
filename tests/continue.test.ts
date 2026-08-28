// Phase C-1 integration test: end-to-end story continuation.
// Requires both OC_URL and OLLAMA_GENERATOR_MODEL in the environment;
// skips otherwise. Uses a small/fast model for iteration speed
// (override OLLAMA_GENERATOR_MODEL in the env if you want to test
// against the storytelling default).

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { OcClient } from "../src/oc-client.js";
import { OllamaProvider } from "../src/llm.js";
import { saveEntity, recall, retagValidation } from "../src/entities.js";
import { buildSystemPrompt, gatherContext } from "../src/prompt.js";
import { validateContent, classifyVerdict } from "../src/validator.js";
import { setupTestStory, teardownStory } from "./helpers.js";

const OC_URL = process.env.OC_URL;
const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_GENERATOR_MODEL;

const suite = OC_URL && OLLAMA_MODEL ? describe : describe.skip;

suite("Phase C-1 — continue (real OC + real Ollama)", () => {
  let oc: OcClient;
  let storyId: string;
  let generator: OllamaProvider;
  let validator: OllamaProvider;

  beforeAll(async () => {
    ({ oc, storyId } = await setupTestStory(OC_URL!, "continue"));
    generator = new OllamaProvider({
      url: OLLAMA_URL,
      defaultModel: OLLAMA_MODEL!,
    });
    // Same model as the generator, matching this repo's test convention
    // (see validate-tool.test.ts) of reusing OLLAMA_GENERATOR_MODEL for
    // the validator in tests rather than requiring a second env var.
    validator = new OllamaProvider({
      url: OLLAMA_URL,
      defaultModel: OLLAMA_MODEL!,
    });

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

  it("can request a query-ranked scene ordering strategy per call", async () => {
    const ctx = await gatherContext(
      oc,
      storyId,
      "Aria walks into the tavern.",
      { sceneStrategy: "query-ranked" },
    );
    expect(ctx.characters.length).toBeGreaterThanOrEqual(1);
    expect(ctx.rules.length).toBeGreaterThanOrEqual(1);
    expect(ctx.scenes.length).toBeLessThanOrEqual(5);
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
      const { text: beatText } = await generator.generate({
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

  // v0.1.3 step 4: validator-gated scene inclusion tagging, exercised via
  // the underlying functions (gatherContext / generator.generate /
  // saveEntity / validateContent / retagValidation) rather than the
  // mnemo_continue MCP tool wrapper, matching this file's existing style.
  it(
    "tags a validated beat with its verdict while preserving base tags",
    async () => {
      const direction =
        "Aria steps out onto the dock at dawn, Holt nowhere in sight.";
      const context = await gatherContext(oc, storyId, direction);
      const { text: beatText } = await generator.generate({
        systemPrompt: buildSystemPrompt("director", context),
        userMessage: direction,
        maxTokens: 256,
      });

      const beatName = `Scene ${new Date().toISOString()}`;
      const saved = await saveEntity(oc, storyId, {
        type: "scene",
        name: beatName,
        body: beatText,
      });

      // Same tagging step mnemo_continue performs after a validate=true save.
      const report = await validateContent(validator, context, beatText);
      const verdict = classifyVerdict(report);
      await retagValidation(oc, saved.memory_id, saved.tags, verdict);

      const scenes = await recall(oc, storyId, { type: "scene" });
      const found = scenes.find((s) => s.name === beatName);
      expect(found).toBeDefined();
      expect(found!.tags).toEqual(
        expect.arrayContaining(["mnemosyne", "story", "scene"]),
      );
      expect(
        found!.tags.includes("validation:clean") ||
          found!.tags.includes("validation:errors"),
      ).toBe(true);
    },
    5 * 60 * 1000,
  );

  it(
    "does not add a validation tag when validation is skipped",
    async () => {
      const direction = "Aria lights a lantern against the coming fog.";
      const context = await gatherContext(oc, storyId, direction);
      const { text: beatText } = await generator.generate({
        systemPrompt: buildSystemPrompt("director", context),
        userMessage: direction,
        maxTokens: 256,
      });

      const beatName = `Scene ${new Date().toISOString()}`;
      const saved = await saveEntity(oc, storyId, {
        type: "scene",
        name: beatName,
        body: beatText,
      });
      expect(saved.created).toBe(true);
      // No validateContent / retagValidation call here -- mirrors
      // mnemo_continue with validate=false (or validate omitted), which
      // never tags the scene.

      const scenes = await recall(oc, storyId, { type: "scene" });
      const found = scenes.find((s) => s.name === beatName);
      expect(found).toBeDefined();
      expect(found!.tags.some((t) => t.startsWith("validation:"))).toBe(false);
    },
    5 * 60 * 1000,
  );
});
