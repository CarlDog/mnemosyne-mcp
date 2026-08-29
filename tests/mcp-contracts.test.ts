// Sibling-MCP contract validation + bounded required-tool discovery
// (docs/NEMOCLAW_ADOPTION_ASSESSMENT.md §2). extractStructuredOrParsed used
// to be a compile-time cast at a runtime network boundary, and no client
// verified that the tools it calls are actually advertised. Pinned here:
//   1. The chokepoint rejects malformed results from BOTH paths
//      (structuredContent and text-fallback JSON), naming the tool and the
//      field paths but never the payload's values.
//   2. Discovery enumerates tool names under hard bounds, fails closed on
//      the abuse shapes (missing tools, duplicates, cursor loops, page and
//      tool caps, oversized names), and performs ZERO tool invocations.
//   3. Botify's load-bearing null-vs-absent bot_message distinction
//      survives schema parsing.

import { describe, it, expect } from "vitest";
import { z } from "zod";
import { extractStructuredOrParsed } from "../src/mcp-result.js";
import {
  verifyRequiredTools,
  DEFAULT_DISCOVERY_BOUNDS,
  type ToolLister,
} from "../src/mcp-discovery.js";
import { extractBotReply } from "../src/botify-client.js";

const schema = z.object({
  id: z.string(),
  ended: z.enum(["user_turn", "max_turns"]),
  count: z.number(),
});

describe("extractStructuredOrParsed with a runtime schema", () => {
  const good = { id: "a", ended: "max_turns", count: 2 };

  it("validates the structuredContent path", () => {
    expect(
      extractStructuredOrParsed({ structuredContent: good }, "t", schema),
    ).toEqual(good);
  });

  it("validates the text-fallback path through the SAME schema", () => {
    const result = {
      content: [{ type: "text", text: JSON.stringify(good) }],
    };
    expect(extractStructuredOrParsed(result, "t", schema)).toEqual(good);
  });

  it("rejects a wrong field type", () => {
    expect(() =>
      extractStructuredOrParsed(
        { structuredContent: { ...good, count: "2" } },
        "some_tool",
        schema,
      ),
    ).toThrow(/some_tool returned a result that does not match/);
  });

  it("rejects a missing field and an invalid enum value", () => {
    expect(() =>
      extractStructuredOrParsed(
        { structuredContent: { id: "a", ended: "max_turns" } },
        "t",
        schema,
      ),
    ).toThrow(/count/);
    expect(() =>
      extractStructuredOrParsed(
        { structuredContent: { ...good, ended: "maybe" } },
        "t",
        schema,
      ),
    ).toThrow(/ended/);
  });

  it("rejects a wrapper-shaped result (array where object expected)", () => {
    expect(() =>
      extractStructuredOrParsed({ structuredContent: [good] }, "t", schema),
    ).toThrow(/\(root\)/);
  });

  it("the error names field paths, never the payload's values", () => {
    const secretive = { ...good, id: 12345, count: "SECRET-CANON-TEXT" };
    let message = "";
    try {
      extractStructuredOrParsed({ structuredContent: secretive }, "t", schema);
    } catch (err) {
      message = (err as Error).message;
    }
    expect(message).toMatch(/does not match/);
    expect(message).not.toContain("SECRET-CANON-TEXT");
    expect(message).not.toContain("12345");
  });

  it("tolerates extra fields (additive upstream evolution)", () => {
    expect(
      extractStructuredOrParsed(
        { structuredContent: { ...good, brand_new_field: true } },
        "t",
        schema,
      ),
    ).toEqual(good);
  });
});

describe("botify bot_message null-vs-absent survives schema parsing", () => {
  const botifySchema = z.object({
    bot_message: z.object({ text: z.string().nullish() }).nullish(),
    trigger_warning: z.string().nullish(),
  });

  it("null stays null (inference ran, no text) and absent stays absent (never attempted)", () => {
    const nullParsed = botifySchema.parse({ bot_message: null });
    expect(nullParsed.bot_message).toBeNull();
    const absentParsed = botifySchema.parse({});
    expect(
      "bot_message" in absentParsed && absentParsed.bot_message,
    ).toBeFalsy();
    expect(absentParsed.bot_message).toBeUndefined();

    // And the downstream discrimination still lands the right message.
    expect(() => extractBotReply({ bot_message: null })).toThrow(
      /produced no text/,
    );
    expect(() => extractBotReply({})).toThrow(/BOTIFY_APP_TOKEN/);
  });
});

// --- discovery -------------------------------------------------------------

type Page = { tools: { name: string }[]; nextCursor?: string };

function lister(pages: Page[]): ToolLister & { callToolInvoked: boolean } {
  let index = 0;
  const fake = {
    callToolInvoked: false,
    listTools: async (params?: { cursor?: string }) => {
      // Cursor-driven: page 0 for no cursor, else the page whose index the
      // cursor encodes ("c<N>"). Lets tests replay/loop cursors.
      if (params?.cursor !== undefined) {
        index = Number(params.cursor.slice(1));
      }
      const page = pages[Math.min(index, pages.length - 1)];
      index += 1;
      return page as Awaited<ReturnType<ToolLister["listTools"]>>;
    },
    callTool: async () => {
      fake.callToolInvoked = true;
      throw new Error("discovery must never invoke a tool");
    },
  };
  return fake as unknown as ToolLister & { callToolInvoked: boolean };
}

describe("verifyRequiredTools", () => {
  it("passes when every required tool is advertised across pages, calling zero tools", async () => {
    const fake = lister([
      { tools: [{ name: "memory_save" }], nextCursor: "c1" },
      { tools: [{ name: "memory_search" }] },
    ]);
    await verifyRequiredTools(fake, "svc", ["memory_save", "memory_search"]);
    expect(fake.callToolInvoked).toBe(false);
  });

  it("fails naming the missing tools and the service", async () => {
    const fake = lister([{ tools: [{ name: "memory_save" }] }]);
    await expect(
      verifyRequiredTools(fake, "OpenChronicle", [
        "memory_save",
        "memory_get",
        "memory_pin",
      ]),
    ).rejects.toThrow(/OpenChronicle.*"memory_get", "memory_pin"/s);
  });

  it("fails closed on a duplicate advertised name", async () => {
    const fake = lister([{ tools: [{ name: "a" }, { name: "a" }] }]);
    await expect(verifyRequiredTools(fake, "svc", ["a"])).rejects.toThrow(
      /duplicate advertised tool name/,
    );
  });

  it("fails closed on a repeated pagination cursor", async () => {
    const fake = lister([
      { tools: [{ name: "a" }], nextCursor: "c1" },
      { tools: [{ name: "b" }], nextCursor: "c1" },
    ]);
    await expect(verifyRequiredTools(fake, "svc", ["a"])).rejects.toThrow(
      /cursor repeated/,
    );
  });

  it("fails closed past the page cap", async () => {
    // Every page advances to a fresh cursor forever.
    const fake = {
      listTools: async (params?: { cursor?: string }) => ({
        tools: [{ name: `t${params?.cursor ?? "0"}` }],
        nextCursor: `c${Math.random()}`,
      }),
    } as unknown as ToolLister;
    await expect(
      verifyRequiredTools(fake, "svc", ["t0"], {
        ...DEFAULT_DISCOVERY_BOUNDS,
        maxPages: 3,
      }),
    ).rejects.toThrow(/more than 3 tools\/list pages/);
  });

  it("fails closed past the tool-count cap and on an oversized name", async () => {
    const many = Array.from({ length: 6 }, (_, i) => ({ name: `t${i}` }));
    await expect(
      verifyRequiredTools(lister([{ tools: many }]), "svc", ["t0"], {
        ...DEFAULT_DISCOVERY_BOUNDS,
        maxTools: 5,
      }),
    ).rejects.toThrow(/more than 5 advertised tools/);

    await expect(
      verifyRequiredTools(
        lister([{ tools: [{ name: "x".repeat(300) }] }]),
        "svc",
        ["a"],
      ),
    ).rejects.toThrow(/exceeds 200 chars/);
  });
});
