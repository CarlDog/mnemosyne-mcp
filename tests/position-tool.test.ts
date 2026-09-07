// mnemo_position_get / mnemo_position_set over the real MCP wire, against a
// real OC instance (docs/POSITION_TRACKING_DESIGN.md). Skipped unless
// OC_URL is set. Exercises the tool-layer wiring pure tests can't:
// resolveStoryId/findStory plumbing, location-entity-type validation, name
// resolution via getEntityByMemoryId, and the not-started refusal as it
// actually surfaces through the protocol (isError + message).

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { OcClient } from "../src/oc-client.js";
import { createStory, findStory } from "../src/stories.js";
import { saveEntity } from "../src/entities.js";
import { registerPositionTool } from "../src/tools/position.js";
import { mountMcpHttp } from "../src/shared/http-transport.js";
import { extractStructuredOrParsed } from "../src/mcp-result.js";
import { teardownStory, testStoryName } from "./helpers.js";

const OC_URL = process.env.OC_URL;
const suite = OC_URL ? describe : describe.skip;

interface PositionReport {
  epoch_date: string;
  epoch_location: { memory_id: string; name: string; spot?: string };
  elapsed_hours: number;
  current_story_datetime: string;
  current_location: { memory_id: string; name: string; spot?: string };
}

async function newMcpClient(url: string): Promise<Client> {
  const client = new Client(
    { name: "position-tool-test", version: "0.0.0" },
    { capabilities: {} },
  );
  await client.connect(new StreamableHTTPClientTransport(new URL(url)));
  return client;
}

suite("mnemo_position_get / mnemo_position_set (MCP tool, real wire)", () => {
  let oc: OcClient;
  let storyId: string;
  let porchId: string;
  let kitchenId: string;
  let client: Client;
  let httpServer: Server;
  let mcp: { dispose: () => Promise<void> };

  beforeAll(async () => {
    oc = new OcClient(new URL(OC_URL!));
    await oc.connect();

    const story = await createStory(oc, testStoryName("position-tool"));
    storyId = story.id;

    const porch = await saveEntity(oc, storyId, {
      type: "location",
      name: "The Porch",
      body: "A weathered porch overlooking the yard.",
    });
    porchId = porch.memory_id;

    const kitchen = await saveEntity(oc, storyId, {
      type: "location",
      name: "The Kitchen",
      body: "A warm, cluttered kitchen.",
    });
    kitchenId = kitchen.memory_id;

    const app = express();
    app.use(express.json());
    mcp = mountMcpHttp(app, "/mcp", {
      createServer: () => {
        const server = new McpServer({
          name: "position-tool-test-server",
          version: "0.0.0",
        });
        registerPositionTool(server, oc);
        return server;
      },
      sessionIdleMs: 60_000,
    });
    httpServer = await new Promise((resolve) => {
      const s = app.listen(0, "127.0.0.1", () => resolve(s));
    });
    const { port } = httpServer.address() as AddressInfo;
    client = await newMcpClient(`http://127.0.0.1:${port}/mcp`);
  });

  afterAll(async () => {
    await client?.close();
    await mcp?.dispose();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    await teardownStory(oc, storyId);
  });

  it("advertises both tools", async () => {
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name);
    expect(names).toContain("mnemo_position_get");
    expect(names).toContain("mnemo_position_set");
  });

  it("mnemo_position_get on a fresh story refuses with the not-started message", async () => {
    const result = await client.callTool({
      name: "mnemo_position_get",
      arguments: { story: storyId },
    });
    expect(result.isError).toBe(true);
    const text = (result.content as Array<{ type: string; text?: string }>)[0]
      ?.text;
    expect(text).toMatch(/isn't started/i);
  });

  it("epoch_location must resolve to a type:location entity", async () => {
    const notALocation = await saveEntity(oc, storyId, {
      type: "character",
      name: "Not A Location",
      body: "A person, not a place.",
    });
    const result = await client.callTool({
      name: "mnemo_position_set",
      arguments: {
        story: storyId,
        epoch_date: "2026-10-01T00:00:00Z",
        epoch_location: notALocation.memory_id,
      },
    });
    expect(result.isError).toBe(true);
    const text = (result.content as Array<{ type: string; text?: string }>)[0]
      ?.text;
    expect(text).toMatch(/not a location/i);
  });

  it("bootstraps, advances, moves, and resolves location names fresh on every read", async () => {
    const bootstrap = await client.callTool({
      name: "mnemo_position_set",
      arguments: {
        story: storyId,
        epoch_date: "2026-10-01T00:00:00Z",
        epoch_location: porchId,
        epoch_spot: "the porch swing",
      },
    });
    expect(bootstrap.isError).not.toBe(true);
    const bootstrapped = extractStructuredOrParsed<PositionReport>(
      bootstrap,
      "mnemo_position_set",
    );
    expect(bootstrapped.epoch_location).toEqual({
      memory_id: porchId,
      name: "The Porch",
      spot: "the porch swing",
    });
    expect(bootstrapped.elapsed_hours).toBe(0);
    expect(bootstrapped.current_location.memory_id).toBe(porchId);

    const advanced = await client.callTool({
      name: "mnemo_position_set",
      arguments: { story: storyId, advance: { days: 3, hours: 6 } },
    });
    const advancedReport = extractStructuredOrParsed<PositionReport>(
      advanced,
      "mnemo_position_set",
    );
    expect(advancedReport.elapsed_hours).toBe(78);
    // Location-only field untouched by a time-only update.
    expect(advancedReport.current_location.memory_id).toBe(porchId);

    const moved = await client.callTool({
      name: "mnemo_position_set",
      arguments: {
        story: storyId,
        current_location: kitchenId,
        current_spot: "by the stove",
      },
    });
    const movedReport = extractStructuredOrParsed<PositionReport>(
      moved,
      "mnemo_position_set",
    );
    // Time-only untouched by a location-only update.
    expect(movedReport.elapsed_hours).toBe(78);
    expect(movedReport.current_location).toEqual({
      memory_id: kitchenId,
      name: "The Kitchen",
      spot: "by the stove",
    });

    const got = await client.callTool({
      name: "mnemo_position_get",
      arguments: { story: storyId },
    });
    expect(got.isError).not.toBe(true);
    const gotReport = extractStructuredOrParsed<PositionReport>(
      got,
      "mnemo_position_get",
    );
    expect(gotReport).toEqual(movedReport);

    // Rename the location entity IN PLACE (same memory_id, new name) --
    // saveEntity overwrites by (type, name), so a different name would
    // create a second entity instead of renaming this one. Then confirm
    // the very next get reflects it without re-setting position -- names
    // are resolved fresh, never cached in the marker.
    await oc.memoryUpdate({
      memoryId: kitchenId,
      content:
        "[Location] The Kitchen (Renovated)\n\nA warm, cluttered kitchen -- freshly renovated.",
    });
    const afterRename = await client.callTool({
      name: "mnemo_position_get",
      arguments: { story: storyId },
    });
    const afterRenameReport = extractStructuredOrParsed<PositionReport>(
      afterRename,
      "mnemo_position_get",
    );
    expect(afterRenameReport.current_location.name).toBe(
      "The Kitchen (Renovated)",
    );

    // findStory confirms the position genuinely persisted to the marker,
    // not just an in-memory response shape.
    const persisted = await findStory(oc, storyId);
    expect(persisted?.position?.elapsedHours).toBe(78);
    expect(persisted?.position?.currentLocationId).toBe(kitchenId);
  });

  it("advance and set_date are mutually exclusive in one call", async () => {
    const result = await client.callTool({
      name: "mnemo_position_set",
      arguments: {
        story: storyId,
        advance: { hours: 1 },
        set_date: "2026-11-01T00:00:00Z",
      },
    });
    expect(result.isError).toBe(true);
    const text = (result.content as Array<{ type: string; text?: string }>)[0]
      ?.text;
    expect(text).toMatch(/at most one/i);
  });

  it("set_date predating the epoch is refused over the wire, with the marker unchanged", async () => {
    const before = await findStory(oc, storyId);
    const result = await client.callTool({
      name: "mnemo_position_set",
      arguments: { story: storyId, set_date: "2020-01-01T00:00:00Z" },
    });
    expect(result.isError).toBe(true);
    const text = (result.content as Array<{ type: string; text?: string }>)[0]
      ?.text;
    expect(text).toMatch(/predates the story's epoch/i);
    const after = await findStory(oc, storyId);
    expect(after?.position).toEqual(before?.position);
  });
});
