// Phase C-2: validator pure tests + integration smoke.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { OcClient } from "../src/oc-client.js";
import { OllamaProvider } from "../src/llm.js";
import { saveEntity } from "../src/entities.js";
import { gatherContext } from "../src/prompt.js";
import { parseValidatorJson, validateContent } from "../src/validator.js";
import { setupTestStory, teardownStory } from "./helpers.js";

describe("validator — pure", () => {
  it("parses plain JSON", () => {
    const out = parseValidatorJson<{ ok: boolean }>('{"ok": true}');
    expect(out.ok).toBe(true);
  });

  it("strips ```json fences", () => {
    const raw = '```json\n{"issues": [], "summary": "fine"}\n```';
    const out = parseValidatorJson<{ issues: unknown[]; summary: string }>(raw);
    expect(out.issues).toEqual([]);
    expect(out.summary).toBe("fine");
  });

  it("strips bare ``` fences", () => {
    const raw = '```\n{"x": 1}\n```';
    const out = parseValidatorJson<{ x: number }>(raw);
    expect(out.x).toBe(1);
  });

  it("tolerates leading/trailing whitespace", () => {
    const raw = '   \n  {"x": 1}  \n  ';
    const out = parseValidatorJson<{ x: number }>(raw);
    expect(out.x).toBe(1);
  });

  it("throws on unparseable input", () => {
    expect(() => parseValidatorJson("not json at all")).toThrow();
  });
});

const OC_URL = process.env.OC_URL;
const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_GENERATOR_MODEL;

const suite = OC_URL && OLLAMA_MODEL ? describe : describe.skip;

suite("Phase C-2 — validation (real OC + real Ollama)", () => {
  let oc: OcClient;
  let storyId: string;
  let validator: OllamaProvider;

  beforeAll(async () => {
    ({ oc, storyId } = await setupTestStory(OC_URL!, "validate"));
    validator = new OllamaProvider({
      url: OLLAMA_URL,
      defaultModel: OLLAMA_MODEL!,
    });

    await saveEntity(oc, storyId, {
      type: "rule",
      name: "POV",
      body: "All scenes are written in third-person past tense from Aria's perspective. Never first-person.",
    });
    await saveEntity(oc, storyId, {
      type: "character",
      name: "Aria Voss",
      body: "A weathered cartographer with a missing left ear.",
    });
  }, 60_000);

  afterAll(async () => {
    await teardownStory(oc, storyId);
  });

  it(
    "returns a structured verdict for compliant content",
    async () => {
      const ctx = await gatherContext(oc, storyId, "Aria walks home.");
      const compliant =
        "Aria walked the long way home, the wind biting at the side of her head where her ear should have been.";
      const report = await validateContent(validator, ctx, compliant);
      expect(Array.isArray(report.issues)).toBe(true);
      expect(typeof report.summary).toBe("string");
    },
    5 * 60 * 1000,
  );
});
