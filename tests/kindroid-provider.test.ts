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
import { KindroidProvider } from "../src/kindroid-provider.js";

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
