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

import { describe, it, expect } from "vitest";
import express from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createReadinessProber } from "../src/readiness.js";
import { createApiRouter } from "../src/api/index.js";
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
  generate: async () => ({ text: "x" }),
  checkReady: async () => {},
});

const cloudProvider: LlmProvider = {
  name: "anthropic",
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
        generator: cloudProvider,
        validator: readyProvider("ollama"),
        validateStory: async () => {
          throw new Error("validation is not exercised by this test");
        },
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
});
