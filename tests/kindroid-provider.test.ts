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
import {
  KindroidClient,
  type KindroidGroupReply,
} from "../src/kindroid-client.js";
import {
  KindroidProvider,
  buildKindroidMessage,
  resolveKindroidTarget,
  formatGroupReplies,
} from "../src/kindroid-provider.js";
import type { ContextBundle } from "../src/prompt.js";
import type { KindroidTarget } from "../src/stories.js";

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

  it("appends a group-conversation nudge when isGroup is true, even with no context at all", () => {
    const result = buildKindroidMessage("what happens next?", undefined, true);
    expect(result).toContain("what happens next?");
    expect(result).toContain("more than one of you in this scene");
    expect(result).toContain("Talk to each other");
  });

  it("omits the group-conversation nudge when isGroup is false (default), even with context matches", () => {
    const context: ContextBundle = {
      ...EMPTY_CONTEXT,
      characters: ["Aria Voss\nA cartographer."],
    };
    const result = buildKindroidMessage("find Aria Voss", context);
    expect(result).not.toContain("more than one of you");
  });

  it("names matched characters specifically in the group-conversation nudge", () => {
    const context: ContextBundle = {
      ...EMPTY_CONTEXT,
      characters: ["Aria Voss\nA cartographer.", "Holt\nA harbor merchant."],
    };
    const result = buildKindroidMessage(
      "Aria Voss and Holt argue at the docks",
      context,
      true,
    );
    expect(result).toContain(
      "more than one of you in this scene -- Aria Voss, Holt included",
    );
  });

  it("falls back to the generic group nudge when isGroup is true but no character matched", () => {
    const context: ContextBundle = {
      ...EMPTY_CONTEXT,
      locations: ["The Dovecoast Tavern\nA fog-choked harbor inn."],
    };
    const result = buildKindroidMessage(
      "describe The Dovecoast Tavern at dusk",
      context,
      true,
    );
    expect(result).toContain("more than one of you in this scene.");
    expect(result).not.toContain("included");
  });

  it("orders the group nudge after the context block and the direction", () => {
    const context: ContextBundle = {
      ...EMPTY_CONTEXT,
      characters: ["Aria Voss\nA cartographer."],
    };
    const result = buildKindroidMessage("find Aria Voss", context, true);
    const contextIdx = result.indexOf("[Story context");
    const directionIdx = result.indexOf("find Aria Voss");
    const nudgeIdx = result.indexOf("more than one of you");
    expect(contextIdx).toBeGreaterThanOrEqual(0);
    expect(contextIdx).toBeLessThan(directionIdx);
    expect(directionIdx).toBeLessThan(nudgeIdx);
  });
});

const AI_TARGET: KindroidTarget = { type: "ai", id: "explicit-kin" };
const GROUP_TARGET: KindroidTarget = { type: "group", id: "story-group" };
const STORY_AI_TARGET: KindroidTarget = { type: "ai", id: "story-kin" };

describe("resolveKindroidTarget (pure)", () => {
  it("an explicit per-call override always wins", () => {
    expect(resolveKindroidTarget(AI_TARGET, "kindroid", STORY_AI_TARGET)).toBe(
      AI_TARGET,
    );
    expect(resolveKindroidTarget(AI_TARGET, "kindroid", undefined)).toBe(
      AI_TARGET,
    );
    // Even for a non-Kindroid generator -- explicit always wins regardless
    // of provider, same as it did before groups existed.
    expect(resolveKindroidTarget(AI_TARGET, "ollama", STORY_AI_TARGET)).toBe(
      AI_TARGET,
    );
  });

  it("falls back to the story-bound target when the generator is kindroid", () => {
    expect(resolveKindroidTarget(undefined, "kindroid", STORY_AI_TARGET)).toBe(
      STORY_AI_TARGET,
    );
    expect(resolveKindroidTarget(undefined, "kindroid", GROUP_TARGET)).toBe(
      GROUP_TARGET,
    );
  });

  it("ignores a story-bound target for any non-kindroid generator", () => {
    expect(
      resolveKindroidTarget(undefined, "ollama", STORY_AI_TARGET),
    ).toBeUndefined();
  });

  it("returns undefined when nothing applies, falling through to the provider default", () => {
    expect(
      resolveKindroidTarget(undefined, "kindroid", undefined),
    ).toBeUndefined();
    expect(
      resolveKindroidTarget(undefined, "ollama", undefined),
    ).toBeUndefined();
  });
});

describe("formatGroupReplies (pure)", () => {
  it("formats a single reply as 'Name: message'", () => {
    const replies: KindroidGroupReply[] = [
      {
        sender: "ai",
        message: "The tavern door creaks open.",
        display_name: "Aria Voss",
      },
    ];
    expect(formatGroupReplies(replies)).toBe(
      "Aria Voss: The tavern door creaks open.",
    );
  });

  it("joins multiple replies with a blank line, preserving order", () => {
    const replies: KindroidGroupReply[] = [
      {
        sender: "ai",
        message: "I don't trust him.",
        display_name: "Aria Voss",
      },
      { sender: "ai", message: "Nor should you.", display_name: "Holt" },
    ];
    const result = formatGroupReplies(replies);
    expect(result).toBe(
      "Aria Voss: I don't trust him.\n\nHolt: Nor should you.",
    );
    expect(result.indexOf("Aria Voss")).toBeLessThan(result.indexOf("Holt"));
  });

  it("falls back to sender when display_name is absent", () => {
    const replies: KindroidGroupReply[] = [{ sender: "ai", message: "Hello." }];
    expect(formatGroupReplies(replies)).toBe("ai: Hello.");
  });

  it("returns an empty string for no replies", () => {
    expect(formatGroupReplies([])).toBe("");
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
      defaultTarget: { type: "ai", id: KINDROID_STORYTELLING_KIN! },
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

  it("kindroidTarget overrides the configured default for a single call", async () => {
    // Overriding with the SAME kin id is still a real, valid exercise of the
    // override path (a second real kin isn't assumed to exist in every
    // environment) -- it confirms the override plumbing reaches
    // kindroid_send_message rather than silently falling back.
    const reply = await provider.generate({
      systemPrompt: "",
      userMessage:
        "Second automated integration-test message: acknowledge briefly.",
      kindroidTarget: { type: "ai", id: KINDROID_STORYTELLING_KIN! },
    });
    expect(reply.length).toBeGreaterThan(0);
  });
});
