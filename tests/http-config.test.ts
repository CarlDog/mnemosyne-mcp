// HTTP transport configuration. Pure/local -- direct process.env
// mutation (this repo's established style, see config-data-dir.test.ts),
// not an injected-env parameter (kindroid-mcp's own style) -- see
// http-config.ts's header comment for why.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadHttpConfig } from "../src/http-config.js";

const VARS = [
  "MCP_PORT",
  "MCP_BIND_HOST",
  "MCP_ALLOWED_HOSTS",
  "MCP_AUTH_TOKEN",
  "MCP_SESSION_IDLE_MS",
] as const;

const savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of VARS) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of VARS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

describe("loadHttpConfig", () => {
  it("defaults to stdio transport (port undefined) when MCP_PORT is unset", () => {
    const cfg = loadHttpConfig();
    expect(cfg.port).toBeUndefined();
    expect(cfg.bindHost).toBe("127.0.0.1");
    expect(cfg.allowedHosts).toBeUndefined();
    expect(cfg.authToken).toBeUndefined();
    expect(cfg.sessionIdleMs).toBe(30 * 60_000);
  });

  it("parses MCP_PORT and rejects non-positive/non-integer values", () => {
    process.env.MCP_PORT = "3010";
    expect(loadHttpConfig().port).toBe(3010);

    process.env.MCP_PORT = "0";
    expect(() => loadHttpConfig()).toThrow(/MCP_PORT/);

    process.env.MCP_PORT = "abc";
    expect(() => loadHttpConfig()).toThrow(/MCP_PORT/);

    process.env.MCP_PORT = "3010.5";
    expect(() => loadHttpConfig()).toThrow(/MCP_PORT/);
  });

  it("treats an empty-string MCP_PORT as unset (stdio), not port 0", () => {
    process.env.MCP_PORT = "  ";
    expect(loadHttpConfig().port).toBeUndefined();
  });

  it("respects MCP_BIND_HOST override", () => {
    process.env.MCP_BIND_HOST = "0.0.0.0";
    expect(loadHttpConfig().bindHost).toBe("0.0.0.0");
  });

  it("parses a comma-separated MCP_ALLOWED_HOSTS, trimming entries", () => {
    process.env.MCP_ALLOWED_HOSTS = "localhost, example-nas ,127.0.0.1";
    expect(loadHttpConfig().allowedHosts).toEqual([
      "localhost",
      "example-nas",
      "127.0.0.1",
    ]);
  });

  it("throws when MCP_ALLOWED_HOSTS is set but parses to nothing usable", () => {
    process.env.MCP_ALLOWED_HOSTS = " , , ";
    expect(() => loadHttpConfig()).toThrow(/MCP_ALLOWED_HOSTS/);
  });

  it("rejects a host:port MCP_ALLOWED_HOSTS entry outright (matching is hostname-only, port-independent)", () => {
    // Delegated to shared/mcp-environment.ts's parseAllowedHosts, which
    // treats a colon-bearing entry (other than a bare IPv6 literal) as
    // invalid syntax rather than silently stripping it -- the old
    // port-stripping regex here could never safely handle a bracketed
    // IPv6 entry, so it left those permanently unmatchable. A hard error
    // at startup replaces that silent gap.
    process.env.MCP_ALLOWED_HOSTS = "example-nas:3010";
    expect(() => loadHttpConfig()).toThrow(/MCP_ALLOWED_HOSTS/);
  });

  it("normalizes bracketed and bare IPv6 MCP_ALLOWED_HOSTS entries, deduplicated", () => {
    process.env.MCP_ALLOWED_HOSTS = "::1,[::1]";
    expect(loadHttpConfig().allowedHosts).toEqual(["::1"]);
  });

  it("treats an empty-string MCP_AUTH_TOKEN as unset (auth disabled)", () => {
    process.env.MCP_AUTH_TOKEN = "   ";
    expect(loadHttpConfig().authToken).toBeUndefined();
  });

  it("respects a real MCP_AUTH_TOKEN", () => {
    process.env.MCP_AUTH_TOKEN = "s3cret";
    expect(loadHttpConfig().authToken).toBe("s3cret");
  });

  it("rejects a non-positive or non-finite MCP_SESSION_IDLE_MS", () => {
    process.env.MCP_SESSION_IDLE_MS = "0";
    expect(() => loadHttpConfig()).toThrow(/MCP_SESSION_IDLE_MS/);

    process.env.MCP_SESSION_IDLE_MS = "abc";
    expect(() => loadHttpConfig()).toThrow(/MCP_SESSION_IDLE_MS/);
  });
});
