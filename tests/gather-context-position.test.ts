// gatherContext's position resolution against real OC
// (docs/POSITION_TRACKING_DESIGN.md): the ContextBundle.position field is
// populated only for generation contexts, resolves the current location's
// name fresh, and costs zero extra reads when validationOnly or when the
// story never opted in. Skipped unless OC_URL is set.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { OcClient } from "../src/oc-client.js";
import { createStory } from "../src/stories.js";
import { saveEntity } from "../src/entities.js";
import { registerPositionTool } from "../src/tools/position.js";
import { gatherContext } from "../src/prompt.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { mountMcpHttp } from "../src/shared/http-transport.js";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import { teardownStory, testStoryName } from "./helpers.js";

const OC_URL = process.env.OC_URL;
const suite = OC_URL ? describe : describe.skip;

suite("gatherContext position resolution (real OC)", () => {
  let oc: OcClient;
  let storyId: string;
  let porchId: string;

  beforeAll(async () => {
    oc = new OcClient(new URL(OC_URL!));
    await oc.connect();
    const story = await createStory(oc, testStoryName("gather-position"));
    storyId = story.id;
    const porch = await saveEntity(oc, storyId, {
      type: "location",
      name: "The Porch",
      body: "A weathered porch.",
    });
    porchId = porch.memory_id;
  });

  afterAll(async () => {
    await teardownStory(oc, storyId);
  });

  it("position is absent when the story has no position tracking", async () => {
    const context = await gatherContext(oc, storyId, "Continue.");
    expect(context.position).toBeUndefined();
  });

  it("resolves position once tracking is started, with the location name resolved fresh", async () => {
    // Set position via the real tool wiring (same wire path mnemo_position_set
    // uses), not a direct stories.ts call, so this test exercises the full
    // seam gatherContext depends on.
    const app = express();
    app.use(express.json());
    const mcp = mountMcpHttp(app, "/mcp", {
      createServer: () => {
        const server = new McpServer({
          name: "gather-position-test-server",
          version: "0.0.0",
        });
        registerPositionTool(server, oc);
        return server;
      },
      sessionIdleMs: 60_000,
    });
    const httpServer: Server = await new Promise((resolve) => {
      const s = app.listen(0, "127.0.0.1", () => resolve(s));
    });
    const { port } = httpServer.address() as AddressInfo;
    const client = new Client(
      { name: "gather-position-test", version: "0.0.0" },
      { capabilities: {} },
    );
    try {
      await client.connect(
        new StreamableHTTPClientTransport(
          new URL(`http://127.0.0.1:${port}/mcp`),
        ),
      );
      await client.callTool({
        name: "mnemo_position_set",
        arguments: {
          story: storyId,
          epoch_date: "2026-10-01T00:00:00Z",
          epoch_location: porchId,
          advance: { days: 3, hours: 6 },
        },
      });
    } finally {
      await client.close();
      await mcp.dispose();
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    }

    const context = await gatherContext(oc, storyId, "Continue.");
    expect(context.position).toEqual({
      current_story_datetime: "2026-10-04T06:00:00.000Z",
      current_location: { name: "The Porch" },
    });

    // Rename the location; the very next gatherContext call resolves the
    // new name -- never cached in the marker.
    await oc.memoryUpdate({
      memoryId: porchId,
      content: "[Location] The Porch (Rebuilt)\n\nA weathered porch, rebuilt.",
    });
    const afterRename = await gatherContext(oc, storyId, "Continue.");
    expect(afterRename.position?.current_location.name).toBe(
      "The Porch (Rebuilt)",
    );
  });

  it("validationOnly skips position entirely -- absent even though the story has tracking on", async () => {
    const context = await gatherContext(oc, storyId, "Continue.", {
      validationOnly: true,
    });
    expect(context.position).toBeUndefined();
  });
});
