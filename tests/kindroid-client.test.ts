// KindroidClient's mutating-call guard. Pure/local: the SDK Client is stubbed,
// no kindroid-mcp required.
//
// Every tool this client calls mutates a real conversation, so a failed call
// leaves "did anything happen?" unanswerable and a blind retry duplicates real
// messages. These tests pin the two halves of the guard: the timeout is
// configurable, and a timeout (unlike other failures) is reported as
// possibly-already-mutated.

import { describe, it, expect, vi } from "vitest";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import {
  DEFAULT_TIMEOUT_MS,
  KindroidClient,
  SEND_TIMEOUT_RETRIES,
} from "../src/kindroid-client.js";
import { RunOutcomeError } from "../src/run-outcome.js";

/** A client whose SDK transport is a stub and which believes it is connected. */
function stubbedClient(
  callTool: ReturnType<typeof vi.fn>,
  timeoutMs?: number,
): KindroidClient {
  const client = new KindroidClient(
    new URL("http://kindroid.invalid/mcp"),
    undefined,
    timeoutMs,
  );
  Object.assign(client as unknown as Record<string, unknown>, {
    client: { callTool },
    connected: true,
  });
  return client;
}

const timeout = () =>
  new McpError(ErrorCode.RequestTimeout, "Request timed out");

const okGroup = () => ({
  structuredContent: { replies: [], ended: "max_turns", turns: 0 },
});

describe("per-request timeout", () => {
  it("passes the configured timeout to every tool call", async () => {
    const callTool = vi.fn().mockResolvedValue(okGroup());
    await stubbedClient(callTool, 5_000).advanceGroup("g", "hi");
    expect(callTool.mock.calls[0]![2]).toEqual({ timeout: 5_000 });
  });

  it("falls back to the default when none is configured", async () => {
    const callTool = vi.fn().mockResolvedValue(okGroup());
    await stubbedClient(callTool).advanceGroup("g", "hi");
    expect(callTool.mock.calls[0]![2]).toEqual({ timeout: DEFAULT_TIMEOUT_MS });
  });

  it("defaults well above the SDK's own 60s, since a group chains sequential generations", () => {
    expect(DEFAULT_TIMEOUT_MS).toBeGreaterThan(60_000);
  });
});

describe("timeout is reported as possibly-already-mutated", () => {
  it("tells an advanceGroup caller not to retry blindly", async () => {
    const callTool = vi.fn().mockRejectedValue(timeout());
    await expect(
      stubbedClient(callTool).advanceGroup("g", "hi"),
    ).rejects.toThrow(/do NOT retry/);
  });

  it("names the tool, the elapsed time and the knob to turn", async () => {
    const callTool = vi.fn().mockRejectedValue(timeout());
    await expect(
      stubbedClient(callTool, 5_000).advanceGroup("g", "hi"),
    ).rejects.toThrow(/kindroid_advance_group timed out after \d+ms/);
    await expect(
      stubbedClient(callTool, 5_000).advanceGroup("g", "hi"),
    ).rejects.toThrow(/KINDROID_MCP_TIMEOUT_MS=5000/);
  });

  it("applies to the single-AI path too", async () => {
    const callTool = vi.fn().mockRejectedValue(timeout());
    await expect(
      stubbedClient(callTool).sendMessage("kin", "hi"),
    ).rejects.toThrow(/kindroid_send_message timed out/);
  });

  it("keeps the original error as `cause`", async () => {
    const callTool = vi.fn().mockRejectedValue(timeout());
    const err = await stubbedClient(callTool)
      .advanceGroup("g", "hi")
      .catch((e: unknown) => e);
    expect((err as Error).cause).toBeInstanceOf(McpError);
  });

  it("leaves a NON-timeout failure alone", async () => {
    // The warning has to stay scarce to stay meaningful: a genuine
    // "group not found" is not a maybe-mutated call, and dressing it up as
    // one would teach the caller to ignore the real thing.
    const callTool = vi
      .fn()
      .mockRejectedValue(
        new McpError(ErrorCode.InvalidParams, "no such group"),
      );
    const err = await stubbedClient(callTool)
      .advanceGroup("g", "hi")
      .catch((e: unknown) => e);
    expect((err as Error).message).toContain("no such group");
    expect((err as Error).message).not.toMatch(/do NOT retry/);
  });

  it("leaves a plain transport failure alone", async () => {
    const callTool = vi.fn().mockRejectedValue(new Error("fetch failed"));
    const err = await stubbedClient(callTool)
      .advanceGroup("g", "hi")
      .catch((e: unknown) => e);
    expect((err as Error).message).toBe("fetch failed");
  });
});

describe("kindroid_send_message re-sends under the same idempotency token", () => {
  const reply = (text: string) => ({ content: [{ type: "text", text }] });
  const tokenOf = (call: unknown[]) =>
    (call[0] as { arguments: { idempotency_token?: string } }).arguments
      .idempotency_token;

  it("passes a fresh idempotency_token with every send", async () => {
    const callTool = vi.fn().mockResolvedValue(reply("ok"));
    await stubbedClient(callTool).sendMessage("kin", "hi");
    const args = (callTool.mock.calls[0]![0] as { arguments: object })
      .arguments;
    expect(args).toMatchObject({ ai_id: "kin", message: "hi" });
    expect(tokenOf(callTool.mock.calls[0]!)).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("retries a timeout with the SAME token and returns the eventual reply", async () => {
    const callTool = vi
      .fn()
      .mockRejectedValueOnce(timeout())
      .mockRejectedValueOnce(timeout())
      .mockResolvedValueOnce(reply("late"));
    await expect(
      stubbedClient(callTool).sendMessage("kin", "hi"),
    ).resolves.toBe("late");
    expect(callTool).toHaveBeenCalledTimes(3);
    expect(new Set(callTool.mock.calls.map(tokenOf)).size).toBe(1);
  });

  it("gives up after SEND_TIMEOUT_RETRIES re-sends and says the direction was posted at most once", async () => {
    const callTool = vi.fn().mockRejectedValue(timeout());
    const err = await stubbedClient(callTool)
      .sendMessage("kin", "hi")
      .catch((e: unknown) => e);
    expect(callTool).toHaveBeenCalledTimes(1 + SEND_TIMEOUT_RETRIES);
    expect(err).toBeInstanceOf(RunOutcomeError);
    expect((err as RunOutcomeError).outcome).toBe("provider_dispatch_unknown");
    expect((err as Error).message).toMatch(/at most once/);
    expect((err as Error).message).toMatch(/kindroid_send_message timed out/);
  });

  it("does not re-send on a non-timeout failure", async () => {
    const callTool = vi
      .fn()
      .mockRejectedValue(new McpError(ErrorCode.InvalidParams, "no such kin"));
    await expect(
      stubbedClient(callTool).sendMessage("kin", "hi"),
    ).rejects.toThrow(/no such kin/);
    expect(callTool).toHaveBeenCalledTimes(1);
  });

  it("never re-sends a group advance", async () => {
    const callTool = vi.fn().mockRejectedValue(timeout());
    await expect(
      stubbedClient(callTool).advanceGroup("g", "hi"),
    ).rejects.toThrow(/do NOT retry/);
    expect(callTool).toHaveBeenCalledTimes(1);
  });
});
