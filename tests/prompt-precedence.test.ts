// Pure tests for the v0.1.2 rule-precedence statement in
// buildSystemPrompt. The statement should appear when the story has
// rules or style entries, and only then.

import { describe, it, expect } from "vitest";
import { buildSystemPrompt, type ContextBundle } from "../src/prompt.js";

const PRECEDENCE_MARKER = "RULES and STYLE blocks below are absolute";

const empty: ContextBundle = {
  rules: [],
  style: [],
  characters: [],
  locations: [],
  scenes: [],
  lore: [],
  worldbuilding: [],
};

describe("prompt — rule-precedence statement", () => {
  it("includes the precedence statement when rules are present", () => {
    const prompt = buildSystemPrompt("director", {
      ...empty,
      rules: ["POV\nThird-person past tense from Aria's perspective."],
    });
    expect(prompt).toContain(PRECEDENCE_MARKER);
    // Precedence statement should land between mode directive and RULES
    const idxMode = prompt.indexOf("scene director");
    const idxPrec = prompt.indexOf(PRECEDENCE_MARKER);
    const idxRules = prompt.indexOf("=== RULES ===");
    expect(idxMode).toBeLessThan(idxPrec);
    expect(idxPrec).toBeLessThan(idxRules);
  });

  it("includes the precedence statement when only style is present", () => {
    const prompt = buildSystemPrompt("director", {
      ...empty,
      style: ["Tone\nMelancholic, restrained."],
    });
    expect(prompt).toContain(PRECEDENCE_MARKER);
  });

  it("omits the precedence statement when neither rules nor style exist", () => {
    const prompt = buildSystemPrompt("director", {
      ...empty,
      characters: ["Aria\nA cartographer."],
    });
    expect(prompt).not.toContain(PRECEDENCE_MARKER);
    expect(prompt).toContain("=== CHARACTERS ===");
  });
});
