// First test in this repo to exercise the real tool-registration + MCP
// wire protocol (every other suite calls domain functions directly). Two
// things only an end-to-end harness can actually prove:
//   1. The HTTP transport wiring in src/index.ts (makeServer() factory +
//      mountMcpHttp) works against a real client, and two concurrent
//      sessions don't collide -- the specific failure mode a shared
//      McpServer instance (instead of a fresh one per session) produces.
//   2. The story-pointer override (`story` param, resolveStoryId) actually
//      bypasses the active-story pointer over the wire, not just through
//      the helper function directly (already covered in stories.test.ts).
//   3. Caller-supplied filesystem paths are refused over the HTTP transport
//      (docs/NEMOCLAW_ADOPTION_ASSESSMENT.md §1 acceptance proof). The
//      factory below passes allowFilesystemPaths: false exactly as
//      index.ts's makeServer() does when serving HTTP, so a refactor that
//      drops that wiring shows up here, not only in the guard's unit tests
//      (tests/filesystem-path-authority.test.ts).
//
// Env-gated on OC_URL only -- none of the tools exercised here
// (mnemo_story_list, mnemo_save_entity, mnemo_recall) touch the
// generator/validator LLM, so a stub LlmProvider that throws if ever
// called is sufficient and no Ollama/cloud-provider key is needed.

import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { mountMcpHttp } from "../src/shared/http-transport.js";
import { registerTools } from "../src/tools/index.js";
import { createStoryValidationAdapter } from "../src/adapters/story-validation.js";
import type { LlmProvider } from "../src/llm.js";
import { createStory } from "../src/stories.js";
import { setCurrentStoryId } from "../src/config.js";
import { extractStructuredOrParsed } from "../src/mcp-result.js";
import { setupTestStory, teardownStory, testStoryName } from "./helpers.js";

const OC_URL = process.env.OC_URL;
const suite = OC_URL ? describe : describe.skip;

// Neither tool exercised here calls generate() -- a throwing stub is
// sufficient and keeps this suite gated on OC_URL alone.
const stubProvider: LlmProvider = {
  name: "stub",
  generate: () => {
    throw new Error("stub provider: generate() must not be called");
  },
};

async function newClient(url: string): Promise<Client> {
  const client = new Client(
    { name: "http-integration-test", version: "0.0.0" },
    { capabilities: {} },
  );
  await client.connect(new StreamableHTTPClientTransport(new URL(url)));
  return client;
}

suite("HTTP transport + story override (real OC, end to end)", () => {
  let oc: Awaited<ReturnType<typeof setupTestStory>>["oc"];
  let storyAId: string;
  let storyBId: string;
  let storyBName: string;
  let httpServer: Server;
  let mcp: { dispose: () => Promise<void> };
  let url: string;
  let dataDir: string;
  let legacyDir: string;
  const savedEnv: Record<string, string | undefined> = {};

  beforeAll(async () => {
    // Isolate the active-story pointer to a temp dir for this whole suite
    // -- setCurrentStoryId writes the real local config.json, and this
    // suite deliberately points the pointer at story A to prove the
    // override bypasses it.
    savedEnv.MNEMO_DATA_DIR = process.env.MNEMO_DATA_DIR;
    savedEnv.MNEMOSYNE_CONFIG_DIR = process.env.MNEMOSYNE_CONFIG_DIR;
    dataDir = await fs.mkdtemp(join(tmpdir(), "mnemo-http-it-"));
    legacyDir = await fs.mkdtemp(join(tmpdir(), "mnemo-http-it-legacy-"));
    process.env.MNEMO_DATA_DIR = dataDir;
    process.env.MNEMOSYNE_CONFIG_DIR = legacyDir;

    const setup = await setupTestStory(OC_URL!, "http-a");
    oc = setup.oc;
    storyAId = setup.storyId;
    storyBName = testStoryName("http-b");
    const storyB = await createStory(oc, storyBName);
    storyBId = storyB.id;
    await setCurrentStoryId(storyAId);

    const app = express();
    app.use(express.json());
    mcp = mountMcpHttp(app, "/mcp", {
      createServer: () => {
        const server = new McpServer({
          name: "http-integration-test-server",
          version: "0.0.0",
        });
        registerTools(
          server,
          oc,
          stubProvider,
          stubProvider,
          createStoryValidationAdapter(oc, stubProvider),
          undefined,
          undefined,
          // Serving HTTP -- same value index.ts's makeServer() passes
          // (httpConfig.port === undefined is false there).
          false,
        );
        return server;
      },
      sessionIdleMs: 60_000,
    });

    httpServer = await new Promise((resolve) => {
      const s = app.listen(0, "127.0.0.1", () => resolve(s));
    });
    const { port } = httpServer.address() as AddressInfo;
    url = `http://127.0.0.1:${port}/mcp`;
  });

  afterAll(async () => {
    await mcp?.dispose();
    if (httpServer) {
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    }
    if (storyBId) await oc?.projectDelete(storyBId).catch(() => undefined);
    await teardownStory(oc, storyAId);

    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await fs.rm(dataDir, { recursive: true, force: true });
    await fs.rm(legacyDir, { recursive: true, force: true });
  });

  it("lists tools and calls mnemo_story_list over the real wire", async () => {
    const client = await newClient(url);
    try {
      const { tools } = await client.listTools();
      expect(tools.map((t) => t.name)).toContain("mnemo_story_list");

      const result = await client.callTool({
        name: "mnemo_story_list",
        arguments: {},
      });
      const parsed = extractStructuredOrParsed<{
        stories: { id: string }[];
      }>(result, "mnemo_story_list");
      expect(parsed.stories.some((s) => s.id === storyAId)).toBe(true);
    } finally {
      await client.close();
    }
  });

  it("two concurrent sessions both succeed -- the per-session factory doesn't collide", async () => {
    const [clientA, clientB] = await Promise.all([
      newClient(url),
      newClient(url),
    ]);
    try {
      const [resA, resB] = await Promise.all([
        clientA.callTool({ name: "mnemo_story_list", arguments: {} }),
        clientB.callTool({ name: "mnemo_story_list", arguments: {} }),
      ]);
      expect(resA.isError).not.toBe(true);
      expect(resB.isError).not.toBe(true);
    } finally {
      await Promise.all([clientA.close(), clientB.close()]);
    }
  });

  it("refuses caller-supplied out_path/file_path over HTTP before touching the filesystem", async () => {
    const client = await newClient(url);
    const refusedPath = join(dataDir, "must-never-exist.json");
    try {
      const exportResult = await client.callTool({
        name: "mnemo_export_story",
        arguments: { story: storyAId, out_path: refusedPath },
      });
      expect(exportResult.isError).toBe(true);
      expect(JSON.stringify(exportResult.content)).toMatch(
        /refused over the HTTP transport/,
      );
      // Refused before any filesystem operation: nothing was written.
      await expect(fs.access(refusedPath)).rejects.toThrow();

      const importResult = await client.callTool({
        name: "mnemo_import_story",
        arguments: { file_path: refusedPath },
      });
      expect(importResult.isError).toBe(true);
      expect(JSON.stringify(importResult.content)).toMatch(
        /refused over the HTTP transport/,
      );
    } finally {
      await client.close();
    }
  });

  it("server-managed default export still works over HTTP", async () => {
    const client = await newClient(url);
    try {
      const result = await client.callTool({
        name: "mnemo_export_story",
        arguments: { story: storyAId },
      });
      expect(result.isError).not.toBe(true);
      const manifest = extractStructuredOrParsed<{ path: string }>(
        result,
        "mnemo_export_story",
      );
      // Lands under the suite's isolated data dir, at the server-owned
      // default destination.
      expect(resolve(manifest.path).startsWith(resolve(dataDir))).toBe(true);
      await expect(fs.access(manifest.path)).resolves.toBeUndefined();
    } finally {
      await client.close();
    }
  });

  it("story override bypasses the active-story pointer over the wire", async () => {
    const client = await newClient(url);
    try {
      const entityName = `http-it-entity-${Date.now()}`;

      // Written into story B via the explicit override -- the pointer is
      // set to story A (beforeAll), so this only lands in B if `story`
      // actually won.
      const saveResult = await client.callTool({
        name: "mnemo_save_entity",
        arguments: {
          type: "character",
          name: entityName,
          content: "A test character written via the story override.",
          story: storyBName,
        },
      });
      expect(saveResult.isError).not.toBe(true);

      // Recall WITH the override finds it.
      const withOverride = await client.callTool({
        name: "mnemo_recall",
        arguments: { query: entityName, type: "character", story: storyBId },
      });
      const withOverrideParsed = extractStructuredOrParsed<{
        entities: { name: string }[];
      }>(withOverride, "mnemo_recall");
      expect(
        withOverrideParsed.entities.some((e) => e.name === entityName),
      ).toBe(true);

      // Recall with NO override (pointer still on story A) does not.
      const withoutOverride = await client.callTool({
        name: "mnemo_recall",
        arguments: { query: entityName, type: "character" },
      });
      const withoutOverrideParsed = extractStructuredOrParsed<{
        entities: { name: string }[];
      }>(withoutOverride, "mnemo_recall");
      expect(
        withoutOverrideParsed.entities.some((e) => e.name === entityName),
      ).toBe(false);
    } finally {
      await client.close();
    }
  });
});
