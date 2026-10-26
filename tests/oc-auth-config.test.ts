import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { errors } = vi.hoisted(() => ({ errors: vi.fn() }));
vi.mock("../src/log.js", () => ({
  log: { error: errors, info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

beforeEach(() => {
  vi.resetModules();
  errors.mockReset();
  vi.stubEnv("OC_URL", "https://oc.invalid/mcp");
  vi.stubEnv("GENERATOR_PROVIDER", "ollama");
  vi.stubEnv("OLLAMA_GENERATOR_MODEL", "synthetic-model");
  vi.stubEnv("OLLAMA_VALIDATOR_MODEL", "synthetic-model");
  vi.spyOn(process, "exit").mockImplementation(() => {
    throw new Error("synthetic startup exit");
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("optional OpenChronicle authentication configuration", () => {
  it.each([
    "https://oc.invalid/mcp?token=synthetic-oc-token",
    "https://oc.invalid/mcp#synthetic-oc-token",
    "https://synthetic-oc-token@oc.invalid/mcp",
    "synthetic-oc-token://oc.invalid/mcp",
    "synthetic-oc-token",
  ])(
    "rejects a credential-bearing URL without logging it (%#)",
    async (url) => {
      vi.stubEnv("OC_MCP_AUTH_TOKEN", "synthetic-oc-token");
      vi.stubEnv("OC_URL", url);
      await expect(import("../src/generator-config.js")).rejects.toThrow(
        "synthetic startup exit",
      );
      expect(process.exit).toHaveBeenCalledWith(1);
      expect(errors).toHaveBeenCalledOnce();
      expect(errors.mock.calls[0]).toEqual([
        "startup",
        expect.stringContaining("OC_URL must be an http(s) endpoint"),
      ]);
      expect(JSON.stringify(errors.mock.calls)).not.toContain(
        "synthetic-oc-token",
      );
      expect(JSON.stringify(errors.mock.calls)).not.toContain(url);
    },
  );

  it("exports the outbound token separately from inbound MCP authentication", async () => {
    vi.stubEnv("OC_MCP_AUTH_TOKEN", "  synthetic-oc-token+/=  ");
    vi.stubEnv("MCP_AUTH_TOKEN", "different-inbound-token");
    const config = await import("../src/generator-config.js");
    expect(config.ocAuthToken).toBe("synthetic-oc-token+/=");
    expect(config.ocUrl.href).toBe("https://oc.invalid/mcp");
    expect(errors).not.toHaveBeenCalled();
    expect(process.exit).not.toHaveBeenCalled();
  });

  it.each([undefined, "", " \t "])(
    "keeps an absent or blank token unauthenticated (%j)",
    async (value) => {
      vi.stubEnv("OC_MCP_AUTH_TOKEN", value);
      const config = await import("../src/generator-config.js");
      expect(config.ocAuthToken).toBeUndefined();
      expect(errors).not.toHaveBeenCalled();
    },
  );

  it.each([
    "Bearer synthetic-oc-token",
    "synthetic-oc-token\r\nX-Injected: value",
    "synthetic-oc-token\u00e9",
  ])("fails startup without logging a malformed token (%#)", async (value) => {
    vi.stubEnv("OC_MCP_AUTH_TOKEN", value);
    await expect(import("../src/generator-config.js")).rejects.toThrow(
      "synthetic startup exit",
    );
    expect(process.exit).toHaveBeenCalledWith(1);
    expect(errors).toHaveBeenCalledOnce();
    expect(errors.mock.calls[0]).toEqual([
      "startup",
      expect.stringContaining("OC_MCP_AUTH_TOKEN"),
    ]);
    expect(JSON.stringify(errors.mock.calls)).not.toContain(
      "synthetic-oc-token",
    );
  });
});
