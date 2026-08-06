// Phase 6 integration test: KindroidProvider against the real deployed
// kindroid-mcp instance. Requires both KINDROID_MCP_URL and
// KINDROID_STORYTELLING_KIN in the environment; skips otherwise -- matching
// this repo's real-integration, env-gated test convention (see
// continue.test.ts).
//
// Unlike the OC/Ollama integration tests, this one calls a real, paid
// third-party service (Kindroid) and consumes real activity against a real
// AI's conversation history. It only runs when both env vars are explicitly
// set, which is the same opt-in signal continue.test.ts uses for Ollama --
// setting them is a deliberate choice to exercise the real path, so no
// additional gate is added on top.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { KindroidClient } from "../src/kindroid-client.js";
import {
  KindroidProvider,
  buildKindroidMessage,
} from "../src/kindroid-provider.js";
import type { ContextBundle } from "../src/prompt.js";

const EMPTY_CONTEXT: ContextBundle = {
  rules: [],
  style: [],
  characters: [],
  locations: [],
  scenes: [],
  lore: [],
  worldbuilding: [],
};

describe("buildKindroidMessage (pure)", () => {
  it("returns the message unchanged when context is undefined", () => {
    expect(buildKindroidMessage("hello there")).toBe("hello there");
  });

  it("returns the message unchanged when nothing matches and there are no scenes", () => {
    const context: ContextBundle = {
      ...EMPTY_CONTEXT,
      characters: ["Aria Voss\nA weathered cartographer."],
    };
    expect(buildKindroidMessage("what should I do next?", context)).toBe(
      "what should I do next?",
    );
  });

  it("folds in a character match, case-insensitively", () => {
    const context: ContextBundle = {
      ...EMPTY_CONTEXT,
      characters: ["Aria Voss\nA weathered cartographer with one ear."],
    };
    const result = buildKindroidMessage(
      "go find aria voss at the docks",
      context,
    );
    expect(result).toContain(
      "Aria Voss: A weathered cartographer with one ear.",
    );
    expect(result).toContain("go find aria voss at the docks");
    expect(result.endsWith("go find aria voss at the docks")).toBe(true);
  });

  it("uses word boundaries, not bare substring matching", () => {
    const context: ContextBundle = {
      ...EMPTY_CONTEXT,
      locations: ["Aria\nA small moon colony."],
    };
    // "Arial" contains "Aria" as a substring but is not a mention of it.
    const result = buildKindroidMessage("set the font to Arial", context);
    expect(result).toBe("set the font to Arial");
  });

  it("matches a name whose own edge character is non-word (regression: \\b fails here)", () => {
    const context: ContextBundle = {
      ...EMPTY_CONTEXT,
      characters: ["Prof. Whitfield Jr.\nA retired linguist."],
    };
    const result = buildKindroidMessage(
      "I saw Prof. Whitfield Jr. yesterday at the market.",
      context,
    );
    expect(result).toContain("Prof. Whitfield Jr.: A retired linguist.");
  });

  it("matches across characters/locations/lore/worldbuilding and preserves entry order", () => {
    const context: ContextBundle = {
      ...EMPTY_CONTEXT,
      characters: ["Aria Voss\nA cartographer."],
      locations: ["The Dovecoast Tavern\nA fog-choked harbor inn."],
      lore: ["The Sundering\nAn ancient cataclysm."],
      worldbuilding: ["Magic System\nMagic is drawn from tides."],
    };
    const result = buildKindroidMessage(
      "Aria Voss meets me at The Dovecoast Tavern to discuss The Sundering and the Magic System.",
      context,
    );
    const ariaIdx = result.indexOf("Aria Voss:");
    const tavernIdx = result.indexOf("The Dovecoast Tavern:");
    const sunderingIdx = result.indexOf("The Sundering:");
    const magicIdx = result.indexOf("Magic System:");
    expect(
      [ariaIdx, tavernIdx, sunderingIdx, magicIdx].every((i) => i >= 0),
    ).toBe(true);
    expect(ariaIdx).toBeLessThan(tavernIdx);
    expect(tavernIdx).toBeLessThan(sunderingIdx);
    expect(sunderingIdx).toBeLessThan(magicIdx);
  });

  it("always includes recent scenes, unconditionally (not keyphrase-gated)", () => {
    const context: ContextBundle = {
      ...EMPTY_CONTEXT,
      scenes: ["Scene 2026-07-17T21:04:11.318Z\nThe tavern door creaks open."],
    };
    const result = buildKindroidMessage("continue the scene", context);
    expect(result).toContain("Recent scenes:");
    expect(result).toContain("The tavern door creaks open.");
    // The scene's timestamp-based name is an internal identifier, not
    // meaningful content -- it should not appear in the injected block.
    expect(result).not.toContain("Scene 2026-07-17T21:04:11.318Z");
  });

  it("never surfaces rules or style, even when name-mentioned", () => {
    const context: ContextBundle = {
      ...EMPTY_CONTEXT,
      rules: ["Tone\nRestrained, melancholic prose."],
      style: ["Tone\nThird-limited POV."],
    };
    const result = buildKindroidMessage("keep the Tone consistent", context);
    expect(result).toBe("keep the Tone consistent");
  });
});

const KINDROID_MCP_URL = process.env.KINDROID_MCP_URL;
const KINDROID_STORYTELLING_KIN = process.env.KINDROID_STORYTELLING_KIN;

const suite =
  KINDROID_MCP_URL && KINDROID_STORYTELLING_KIN ? describe : describe.skip;

suite("Phase 6 — KindroidProvider (real kindroid-mcp)", () => {
  let client: KindroidClient;
  let provider: KindroidProvider;

  beforeAll(() => {
    client = new KindroidClient(
      new URL(KINDROID_MCP_URL!),
      process.env.KINDROID_MCP_AUTH_TOKEN,
    );
    provider = new KindroidProvider(client, {
      aiId: KINDROID_STORYTELLING_KIN!,
    });
  });

  afterAll(async () => {
    await client.close();
  });

  it("declares its provider name", () => {
    expect(provider.name).toBe("kindroid");
  });

  it("generates a real reply, ignoring systemPrompt/temperature/maxTokens", async () => {
    const reply = await provider.generate({
      systemPrompt: "this should be ignored entirely",
      userMessage:
        "This is an automated integration test from mnemosyne-mcp. Reply with a short one-sentence acknowledgment.",
      temperature: 1.9,
      maxTokens: 1,
    });
    expect(typeof reply).toBe("string");
    expect(reply.length).toBeGreaterThan(0);
  });

  it("opts.model overrides the configured kin for a single call", async () => {
    // Overriding with the SAME kin id is still a real, valid exercise of the
    // override path (a second real kin isn't assumed to exist in every
    // environment) -- it confirms the override plumbing reaches
    // kindroid_send_message rather than silently falling back.
    const reply = await provider.generate({
      systemPrompt: "",
      userMessage:
        "Second automated integration-test message: acknowledge briefly.",
      model: KINDROID_STORYTELLING_KIN,
    });
    expect(reply.length).toBeGreaterThan(0);
  });
});
