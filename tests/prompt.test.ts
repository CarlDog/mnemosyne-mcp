// Pure tests for prompt assembly. No OC, no Ollama required.

import { describe, it, expect } from "vitest";
import { buildSystemPrompt, type ContextBundle } from "../src/prompt.js";

const empty: ContextBundle = {
  rules: [],
  style: [],
  characters: [],
  locations: [],
  scenes: [],
  lore: [],
  worldbuilding: [],
};

describe("prompt — buildSystemPrompt", () => {
  it("emits only the mode directive when context is empty", () => {
    const prompt = buildSystemPrompt("director", empty);
    expect(prompt).toContain("scene director");
    expect(prompt).not.toContain("===");
  });

  it("emits each populated block in the documented order", () => {
    const prompt = buildSystemPrompt("audience", {
      rules: ["POV constraint\nThird-limited from Aria's perspective."],
      style: ["Tone\nMelancholic; restrained prose."],
      characters: ["Aria Voss\nA weathered cartographer."],
      locations: ["Dovecoast\nA fog-choked port town."],
      scenes: ["Scene 2026-05-11T00:00:00Z\nAria walks into the tavern."],
      lore: ["Cartographers' Guild\nFounded centuries ago."],
      worldbuilding: ["Magic\nWoven into maps; rare and dangerous."],
    });

    expect(prompt).toContain("narrator telling a story"); // audience directive
    const idxRules = prompt.indexOf("=== RULES ===");
    const idxStyle = prompt.indexOf("=== STYLE ===");
    const idxChar = prompt.indexOf("=== CHARACTERS ===");
    const idxLoc = prompt.indexOf("=== LOCATIONS ===");
    const idxScenes = prompt.indexOf("=== RECENT SCENES ===");
    const idxLore = prompt.indexOf("=== LORE ===");
    const idxWorld = prompt.indexOf("=== WORLDBUILDING ===");

    expect(idxRules).toBeGreaterThan(-1);
    expect(idxStyle).toBeGreaterThan(idxRules);
    expect(idxChar).toBeGreaterThan(idxStyle);
    expect(idxLoc).toBeGreaterThan(idxChar);
    expect(idxScenes).toBeGreaterThan(idxLoc);
    expect(idxLore).toBeGreaterThan(idxScenes);
    expect(idxWorld).toBeGreaterThan(idxLore);
  });

  it("omits empty blocks entirely (no header without entries)", () => {
    const prompt = buildSystemPrompt("director", {
      ...empty,
      characters: ["Aria\nA cartographer."],
    });
    expect(prompt).toContain("=== CHARACTERS ===");
    expect(prompt).not.toContain("=== RULES ===");
    expect(prompt).not.toContain("=== STYLE ===");
    expect(prompt).not.toContain("=== LOCATIONS ===");
  });

  it("uses participant directive when mode is participant", () => {
    const prompt = buildSystemPrompt("participant", empty);
    expect(prompt).toContain("character in this story");
  });
});
