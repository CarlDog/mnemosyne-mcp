// Semantic readiness (docs/NEMOCLAW_ADOPTION_ASSESSMENT.md §3): /health is
// liveness-only and always ok, so the protected /api/status surface answers
// the semantic question. Pinned here:
//   1. ready / unavailable / not_probed mapping -- a failed probe is
//      unavailable with a reason, an absent probe is not_probed, and
//      neither is ever coerced to ready.
//   2. The TTL cache: repeated polls reuse one probe run (a load balancer
//      cannot cause probe storms), and the cached report keeps its original
//      observation time.
//   3. The route is wired behind the /api router.
//   4. mnemo_status (src/tools/status.ts) -- the stdio-side counterpart,
//      since a stdio host has no HTTP endpoint to poll -- is wired to the
//      SAME prober contract, and is only registered when one is provided.

import { describe, it, expect } from "vitest";
import express from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createReadinessProber } from "../src/readiness.js";
import { createApiRouter } from "../src/api/index.js";
import { registerTools } from "../src/tools/index.js";
import { mountMcpHttp } from "../src/shared/http-transport.js";
import { extractStructuredOrParsed } from "../src/mcp-result.js";
import { testUseCases } from "./helpers/application.js";
import type { OcClient } from "../src/oc-client.js";
import type { LlmProvider } from "../src/llm.js";

function fakeOc(behavior: () => Promise<void>): OcClient & { calls: number } {
  const oc = {
    calls: 0,
    checkReady: async () => {
      oc.calls += 1;
      return behavior();
    },
  };
  return oc as unknown as OcClient & { calls: number };
}

const readyProvider = (name: string): LlmProvider => ({
  name,
  contentCapability: "sfw",
  generate: async () => ({ text: "x" }),
  checkReady: async () => {},
});

const cloudProvider: LlmProvider = {
  name: "anthropic",
  contentCapability: "sfw",
  generate: async () => ({ text: "x" }),
  // no checkReady -- a real probe would be billable
};

describe("createReadinessProber", () => {
  it("maps ready / unavailable / not_probed honestly", async () => {
    const prober = createReadinessProber({
      oc: fakeOc(async () => {
        throw new Error("OpenChronicle does not advertise required tool(s)");
      }),
      generator: cloudProvider,
      validator: readyProvider("ollama"),
    });
    const report = await prober.probe();
    expect(report.openchronicle.status).toBe("unavailable");
    expect(report.openchronicle.reason).toMatch(/required tool/);
    expect(report.generator).toMatchObject({
      provider: "anthropic",
      status: "not_probed",
    });
    expect(report.generator.reason).toMatch(/billable/);
    expect(report.validator.status).toBe("ready");
  });

  it("a live process with disconnected OC is not ready", async () => {
    const prober = createReadinessProber({
      oc: fakeOc(async () => {
        throw new Error("fetch failed: connect ECONNREFUSED");
      }),
      generator: readyProvider("ollama"),
      validator: readyProvider("ollama"),
    });
    const report = await prober.probe();
    expect(report.openchronicle.status).toBe("unavailable");
  });

  it("caches for the TTL: repeated polls run one probe and keep the observation time", async () => {
    const oc = fakeOc(async () => {});
    const prober = createReadinessProber({
      oc,
      generator: readyProvider("ollama"),
      validator: readyProvider("ollama"),
    });
    const first = await prober.probe();
    const second = await prober.probe();
    expect(oc.calls).toBe(1);
    expect(second.checked_at).toBe(first.checked_at);
  });
});

describe("GET /api/status", () => {
  it("returns the report through the router", async () => {
    const app = express();
    app.use(
      "/api",
      createApiRouter(fakeOc(async () => {}) as unknown as OcClient, {
        useCases: testUseCases(
          fakeOc(async () => {}) as unknown as OcClient,
          cloudProvider,
          readyProvider("ollama"),
          async () => {
            throw new Error("validation is not exercised by this test");
          },
          async () => {
            throw new Error("revalidation is not exercised by this test");
          },
        ),
        generator: cloudProvider,
        validator: readyProvider("ollama"),
      }),
    );
    const server: Server = await new Promise((resolve) => {
      const s = app.listen(0, "127.0.0.1", () => resolve(s));
    });
    try {
      const { port } = server.address() as AddressInfo;
      const res = await fetch(`http://127.0.0.1:${port}/api/status`);
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        openchronicle: { status: string };
        generator: { provider: string; status: string };
        validator: { status: string };
      };
      expect(body.openchronicle.status).toBe("ready");
      expect(body.generator).toMatchObject({
        provider: "anthropic",
        status: "not_probed",
      });
      expect(body.validator.status).toBe("ready");
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("uses the SAME prober instance passed in, not a fresh one, so its TTL cache is actually shared", async () => {
    const oc = fakeOc(async () => {});
    const sharedProber = createReadinessProber({
      oc,
      generator: cloudProvider,
      validator: readyProvider("ollama"),
    });
    // Prime the cache directly, before the route ever runs.
    const primed = await sharedProber.probe();
    expect(oc.calls).toBe(1);

    const app = express();
    app.use(
      "/api",
      createApiRouter(oc, {
        useCases: testUseCases(
          oc,
          cloudProvider,
          readyProvider("ollama"),
          async () => {
            throw new Error("validation is not exercised by this test");
          },
          async () => {
            throw new Error("revalidation is not exercised by this test");
          },
        ),
        generator: cloudProvider,
        validator: readyProvider("ollama"),
        readinessProber: sharedProber,
      }),
    );
    const server: Server = await new Promise((resolve) => {
      const s = app.listen(0, "127.0.0.1", () => resolve(s));
    });
    try {
      const { port } = server.address() as AddressInfo;
      const res = await fetch(`http://127.0.0.1:${port}/api/status`);
      const body = (await res.json()) as { checked_at: string };
      // Same observation time as the direct probe() call above, and no
      // second OC call -- proves the route read the passed-in instance's
      // cache instead of constructing (and probing through) its own.
      expect(body.checked_at).toBe(primed.checked_at);
      expect(oc.calls).toBe(1);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});

async function newMcpClient(url: string): Promise<Client> {
  const client = new Client(
    { name: "readiness-test", version: "0.0.0" },
    { capabilities: {} },
  );
  await client.connect(new StreamableHTTPClientTransport(new URL(url)));
  return client;
}

describe("mnemo_status (MCP tool, real wire)", () => {
  it("returns the same report shape as GET /api/status, over the MCP wire", async () => {
    const oc = fakeOc(async () => {});
    const prober = createReadinessProber({
      oc,
      generator: cloudProvider,
      validator: readyProvider("ollama"),
    });
    const app = express();
    app.use(express.json());
    const mcp = mountMcpHttp(app, "/mcp", {
      createServer: () => {
        const server = new McpServer({
          name: "readiness-test-server",
          version: "0.0.0",
        });
        registerTools(
          server,
          oc,
          testUseCases(
            oc,
            cloudProvider,
            readyProvider("ollama"),
            async () => {
              throw new Error("validation is not exercised by this test");
            },
            async () => {
              throw new Error("revalidation is not exercised by this test");
            },
          ),
          undefined,
          undefined,
          true,
          prober,
        );
        return server;
      },
      sessionIdleMs: 60_000,
    });
    const httpServer: Server = await new Promise((resolve) => {
      const s = app.listen(0, "127.0.0.1", () => resolve(s));
    });
    try {
      const { port } = httpServer.address() as AddressInfo;
      const client = await newMcpClient(`http://127.0.0.1:${port}/mcp`);
      try {
        const { tools } = await client.listTools();
        expect(tools.map((t) => t.name)).toContain("mnemo_status");

        const result = await client.callTool({
          name: "mnemo_status",
          arguments: {},
        });
        expect(result.isError).not.toBe(true);
        const report = extractStructuredOrParsed<{
          openchronicle: { status: string };
          generator: { provider: string; status: string };
          validator: { status: string };
        }>(result, "mnemo_status");
        expect(report.openchronicle.status).toBe("ready");
        expect(report.generator).toMatchObject({
          provider: "anthropic",
          status: "not_probed",
        });
        expect(report.validator.status).toBe("ready");
      } finally {
        await client.close();
      }
    } finally {
      await mcp.dispose();
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    }
  });

  it("is not registered at all when registerTools is called without a readinessProber", async () => {
    const oc = fakeOc(async () => {});
    const app = express();
    app.use(express.json());
    const mcp = mountMcpHttp(app, "/mcp", {
      createServer: () => {
        const server = new McpServer({
          name: "readiness-test-server-no-prober",
          version: "0.0.0",
        });
        registerTools(
          server,
          oc,
          testUseCases(
            oc,
            cloudProvider,
            readyProvider("ollama"),
            async () => {
              throw new Error("validation is not exercised by this test");
            },
            async () => {
              throw new Error("revalidation is not exercised by this test");
            },
          ),
          // sceneContextStrategy, sceneContextFallbackStrategy,
          // allowFilesystemPaths, readinessProber -- all omitted.
        );
        return server;
      },
      sessionIdleMs: 60_000,
    });
    const httpServer: Server = await new Promise((resolve) => {
      const s = app.listen(0, "127.0.0.1", () => resolve(s));
    });
    try {
      const { port } = httpServer.address() as AddressInfo;
      const client = await newMcpClient(`http://127.0.0.1:${port}/mcp`);
      try {
        const { tools } = await client.listTools();
        expect(tools.map((t) => t.name)).not.toContain("mnemo_status");
      } finally {
        await client.close();
      }
    } finally {
      await mcp.dispose();
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    }
  });
});
