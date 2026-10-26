// Offline OC client authentication and error-boundary regressions. SDK methods
// are stubbed: no real endpoint, credential, story or application data is used.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { OcClient } from "../src/oc-client.js";
import * as ocTransport from "../src/oc-transport.js";
import { continueScene } from "./helpers/application.js";
import type { LlmProvider } from "../src/llm.js";

const TOKEN = "test-only.oc+/fake-token==";
const ENCODED_TOKEN = encodeURIComponent(TOKEN);
const REMOTE_PROSE = "untrusted-upstream-detail-marker";
const endpoint = () => new URL("https://oc.example.invalid/mcp");
const REQUIRED_TOOLS = [
  "project_create",
  "project_delete",
  "memory_save",
  "memory_search",
  "memory_list",
  "memory_get",
  "memory_update",
  "memory_pin",
  "memory_delete",
];

function stubSdk() {
  return {
    connect: vi.spyOn(Client.prototype, "connect").mockResolvedValue(undefined),
    listTools: vi.spyOn(Client.prototype, "listTools").mockResolvedValue({
      tools: REQUIRED_TOOLS.map((name) => ({
        name,
        inputSchema: { type: "object" as const },
      })),
    }),
    callTool: vi.spyOn(Client.prototype, "callTool"),
    close: vi.spyOn(Client.prototype, "close").mockResolvedValue(undefined),
    transport: vi.spyOn(ocTransport, "createOcTransport"),
    stderr: vi.spyOn(console, "error").mockImplementation(() => {}),
  };
}

let sdk: ReturnType<typeof stubSdk>;
beforeEach(() => {
  sdk = stubSdk();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function leakingError(prefix: string): Error {
  return Object.assign(
    new Error(
      `${prefix}; prose=${REMOTE_PROSE}; raw=${TOKEN}; encoded=${ENCODED_TOKEN}`,
      {
        cause: new Error(`untrusted cause ${TOKEN}`),
      },
    ),
    { authorization: `Bearer ${TOKEN}`, responseBody: ENCODED_TOKEN },
  );
}

async function rejectedError(promise: Promise<unknown>): Promise<Error> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(Error);
    return error as Error;
  }
  throw new Error("Expected the offline operation to reject");
}

function expectSafeError(
  error: Error,
  expectedMessage = "OpenChronicle request failed",
): void {
  expect(error.message).toBe(expectedMessage);
  expect(error.message).not.toContain(REMOTE_PROSE);
  expect(error.message).not.toContain(TOKEN);
  expect(error.message).not.toContain(ENCODED_TOKEN);
  expect(error.stack).not.toContain(TOKEN);
  expect(error.stack).not.toContain(ENCODED_TOKEN);
  expect(error.stack).not.toContain(REMOTE_PROSE);
  expect(error.cause).toBeUndefined();
  expect(error).not.toHaveProperty("authorization");
  expect(error).not.toHaveProperty("responseBody");
}

function expectSafeStderr(): void {
  const output = sdk.stderr.mock.calls.map((args) =>
    args.map(String).join(" "),
  );
  expect(output.join("\n")).not.toContain(TOKEN);
  expect(output.join("\n")).not.toContain(ENCODED_TOKEN);
  expect(output.join("\n")).not.toContain(REMOTE_PROSE);
}

describe("optional OC bearer configuration", () => {
  it("forwards the normalized optional token to the transport", async () => {
    const url = endpoint();
    const oc = new OcClient(url, `  ${TOKEN}  `);
    await oc.connect();
    expect(sdk.transport).toHaveBeenCalledExactlyOnceWith(url, TOKEN);
    expect(sdk.listTools).toHaveBeenCalledTimes(1);
    expect(sdk.callTool).not.toHaveBeenCalled();
    expectSafeStderr();
  });

  it.each([undefined, "", "   "])(
    "keeps an unset or blank token unauthenticated (%j)",
    async (token) => {
      const url = endpoint();
      await new OcClient(url, token).connect();
      expect(sdk.transport).toHaveBeenCalledExactlyOnceWith(url, undefined);
    },
  );

  it.each([
    "Bearer fake-value",
    "fake value",
    "fake\nInjected: value",
    "fake\u0000value",
  ])("rejects malformed bearer values without echoing them (%#)", (token) => {
    let error: unknown;
    try {
      new OcClient(endpoint(), token);
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain("OC_MCP_AUTH_TOKEN");
    expect((error as Error).message).not.toContain(token);
    expect(sdk.connect).not.toHaveBeenCalled();
    expect(sdk.stderr).not.toHaveBeenCalled();
  });
});

describe("authenticated connection boundaries", () => {
  it("does not log a configured token embedded in a successful endpoint path", async () => {
    const url = new URL(`https://oc.example.invalid/${TOKEN}/mcp`);
    await new OcClient(url, TOKEN).connect();
    expect(sdk.connect).toHaveBeenCalledTimes(1);
    expect(sdk.stderr).toHaveBeenCalled();
    expectSafeStderr();
  });

  it("keeps endpoint logging compatible for unauthenticated connections", async () => {
    const url = new URL("https://oc.example.invalid/compatibility/mcp");
    await new OcClient(url).connect();
    const output = sdk.stderr.mock.calls.map((args) =>
      args.map(String).join(" "),
    );
    expect(output.join("\n")).toContain(`${url.origin}${url.pathname}`);
  });

  it("sanitizes asynchronous SDK transport errors before stderr logging", () => {
    const oc = new OcClient(endpoint(), TOKEN);
    const internal = (oc as unknown as { client: Client }).client;
    expect(internal.onerror).toBeTypeOf("function");
    internal.onerror?.(leakingError("async transport failure"));
    expect(sdk.stderr).toHaveBeenCalled();
    expectSafeStderr();
  });

  it("redacts connect rejection text, stack and arbitrary error fields", async () => {
    sdk.connect.mockRejectedValueOnce(leakingError("HTTP 401"));
    const error = await rejectedError(
      new OcClient(endpoint(), TOKEN).connect(),
    );
    expectSafeError(error);
    expectSafeStderr();
    expect(sdk.listTools).not.toHaveBeenCalled();
  });

  it("uses an authored category for MCP errors instead of remote prose", async () => {
    sdk.connect.mockRejectedValueOnce(
      new McpError(ErrorCode.InternalError, `${REMOTE_PROSE}; token=${TOKEN}`),
    );
    const error = await rejectedError(
      new OcClient(endpoint(), TOKEN).connect(),
    );
    expectSafeError(
      error,
      `OpenChronicle MCP request failed (code ${ErrorCode.InternalError})`,
    );
    expectSafeStderr();
  });

  it("retains the invalid-response category through nested readiness sanitization", async () => {
    sdk.connect.mockRejectedValueOnce(
      new SyntaxError(`${REMOTE_PROSE}; invalid JSON containing ${TOKEN}`),
    );
    const error = await rejectedError(
      new OcClient(endpoint(), TOKEN).checkReady(),
    );
    expectSafeError(error, "OpenChronicle returned an invalid MCP response");
    expectSafeStderr();
  });

  it("redacts discovery rejection before marking the client connected", async () => {
    sdk.listTools.mockRejectedValueOnce(leakingError("discovery failed"));
    const oc = new OcClient(endpoint(), TOKEN);
    expectSafeError(await rejectedError(oc.connect()));
    expectSafeStderr();
    await oc.connect();
    expect(sdk.connect).toHaveBeenCalledTimes(2);
    expect(sdk.listTools).toHaveBeenCalledTimes(2);
  });

  it("redacts readiness rejection after an established connection", async () => {
    const oc = new OcClient(endpoint(), TOKEN);
    await oc.connect();
    sdk.listTools.mockRejectedValueOnce(leakingError("readiness failed"));
    expectSafeError(await rejectedError(oc.checkReady()));
    expectSafeStderr();
    expect(sdk.connect).toHaveBeenCalledTimes(1);
  });

  it("redacts close rejection without exposing an unsafe cause", async () => {
    const oc = new OcClient(endpoint(), TOKEN);
    await oc.connect();
    sdk.close.mockRejectedValueOnce(leakingError("close failed"));
    expectSafeError(await rejectedError(oc.close()));
    expectSafeStderr();
  });

  it("shares one first connection and discovery across concurrent callers", async () => {
    let release: (() => void) | undefined;
    sdk.connect.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const oc = new OcClient(endpoint(), TOKEN);
    const first = oc.connect();
    const second = oc.connect();
    expect(sdk.connect).toHaveBeenCalledTimes(1);
    expect(release).toBeTypeOf("function");
    release!();
    await Promise.all([first, second]);
    await oc.connect();
    expect(sdk.connect).toHaveBeenCalledTimes(1);
    expect(sdk.listTools).toHaveBeenCalledTimes(1);
  });

  it("clears a failed shared attempt so a later caller can reconnect", async () => {
    let rejectAttempt: ((error: Error) => void) | undefined;
    sdk.connect.mockImplementationOnce(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectAttempt = reject;
        }),
    );
    const oc = new OcClient(endpoint(), TOKEN);
    const attempts = Promise.allSettled([oc.connect(), oc.connect()]);
    rejectAttempt!(leakingError("HTTP 401"));
    const results = await attempts;
    for (const result of results) {
      expect(result.status).toBe("rejected");
      if (result.status === "rejected") expectSafeError(result.reason as Error);
    }
    await oc.connect();
    expect(sdk.connect).toHaveBeenCalledTimes(2);
    expect(sdk.listTools).toHaveBeenCalledTimes(1);
  });
});

describe("authenticated OC tool failures", () => {
  it("redacts rejected SDK calls before stderr logging and rethrowing", async () => {
    sdk.callTool.mockRejectedValueOnce(leakingError("tool request failed"));
    const error = await rejectedError(
      new OcClient(endpoint(), TOKEN).projectCreate("offline-example"),
    );
    expectSafeError(error);
    expect(sdk.stderr).toHaveBeenCalled();
    expectSafeStderr();
  });

  it("redacts isError tool-result prose before logging and rethrowing", async () => {
    sdk.callTool.mockResolvedValueOnce({
      isError: true,
      content: [
        {
          type: "text",
          text: `${REMOTE_PROSE}; rejected ${TOKEN} ${ENCODED_TOKEN}`,
        },
      ],
    });
    const error = await rejectedError(
      new OcClient(endpoint(), TOKEN).projectCreate("offline-example"),
    );
    expectSafeError(error);
    expect(sdk.stderr).toHaveBeenCalled();
    expectSafeStderr();
  });

  it("keeps Memory-not-found results null after redaction", async () => {
    sdk.callTool.mockResolvedValueOnce({
      isError: true,
      content: [
        { type: "text", text: `Memory not found: absent; echo=${TOKEN}` },
      ],
    });
    await expect(
      new OcClient(endpoint(), TOKEN).memoryGet("absent"),
    ).resolves.toBeNull();
    expectSafeStderr();
  });

  it("keeps not-found semantics when a short token overlaps the error phrase", async () => {
    sdk.callTool.mockResolvedValueOnce({
      isError: true,
      content: [{ type: "text", text: "Memory not found: absent" }],
    });
    await expect(
      new OcClient(endpoint(), "Memory").memoryGet("absent"),
    ).resolves.toBeNull();
  });

  it("retries a rate-limit rejection with the existing one-second backoff", async () => {
    vi.useFakeTimers();
    sdk.callTool
      .mockRejectedValueOnce(leakingError("rate limit"))
      .mockResolvedValueOnce({
        content: [],
        structuredContent: { id: "p", name: "offline-example" },
      });
    const result = expect(
      new OcClient(endpoint(), TOKEN).projectCreate("offline-example"),
    ).resolves.toEqual({ id: "p", name: "offline-example" });
    await vi.advanceTimersByTimeAsync(999);
    expect(sdk.callTool).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await result;
    expect(sdk.callTool).toHaveBeenCalledTimes(2);
    expectSafeStderr();
  });

  it("retains rate-limit retry when the token overlaps the classification", async () => {
    vi.useFakeTimers();
    sdk.callTool
      .mockRejectedValueOnce(new Error("rate limit"))
      .mockResolvedValueOnce({
        content: [],
        structuredContent: { id: "p", name: "offline-example" },
      });
    const result = expect(
      new OcClient(endpoint(), "rate").projectCreate("offline-example"),
    ).resolves.toEqual({ id: "p", name: "offline-example" });
    await vi.advanceTimersByTimeAsync(1000);
    await result;
    expect(sdk.callTool).toHaveBeenCalledTimes(2);
  });

  it.each(["MCP", "tool"])(
    "preserves an authored rate-limit rejection after all %s retries are exhausted",
    async (kind) => {
      vi.useFakeTimers();
      const message = `rate limit; ${REMOTE_PROSE}; ${TOKEN}; ${ENCODED_TOKEN}`;
      if (kind === "MCP") {
        sdk.callTool.mockRejectedValue(
          new McpError(ErrorCode.InternalError, message),
        );
      } else {
        sdk.callTool.mockResolvedValue({
          isError: true,
          content: [{ type: "text", text: message }],
        });
      }
      const result = rejectedError(
        new OcClient(endpoint(), TOKEN).projectCreate("offline-example"),
      );
      for (const [index, delay] of [1000, 2000, 4000, 8000, 16000].entries()) {
        await vi.advanceTimersByTimeAsync(delay - 1);
        expect(sdk.callTool).toHaveBeenCalledTimes(index + 1);
        await vi.advanceTimersByTimeAsync(1);
        expect(sdk.callTool).toHaveBeenCalledTimes(index + 2);
      }
      const error = await result;
      expectSafeError(error, "OpenChronicle rate limit");
      expect(ocTransport.sanitizeOcError(error, TOKEN)).toBe(error);
      expectSafeStderr();
      await vi.advanceTimersByTimeAsync(60_000);
      expect(sdk.callTool).toHaveBeenCalledTimes(6);
    },
  );

  it("keeps the original exhausted rate-limit error without authentication", async () => {
    vi.useFakeTimers();
    const original = new Error("rate limit: ordinary offline rejection");
    sdk.callTool.mockRejectedValue(original);
    const result = rejectedError(
      new OcClient(endpoint()).projectCreate("offline-example"),
    );
    await vi.advanceTimersByTimeAsync(31_000);
    expect(await result).toBe(original);
    expect(sdk.callTool).toHaveBeenCalledTimes(6);
  });

  it.each(["rate limit", "socket hang up"])(
    "preserves saveBeat write-outcome semantics for an authenticated %s failure",
    async (failure) => {
      vi.useFakeTimers();
      sdk.callTool.mockRejectedValue(leakingError(failure));
      const oc = new OcClient(endpoint(), TOKEN);
      // Keep the real authenticated memorySave/callTool boundary. Context and
      // generation stay synthetic, so no story, provider or remote write runs.
      const contextOc = {
        memorySearch: async () => [],
        memoryList: async () => [],
        memorySave: oc.memorySave.bind(oc),
      } as unknown as OcClient;
      const generate = vi.fn(async () => ({
        text: "Synthetic completed beat.",
      }));
      const generator: LlmProvider = {
        name: "offline-generator",
        contentCapability: "sfw",
        generate,
      };
      const resultPromise = continueScene(
        contextOc,
        generator,
        generator,
        "offline-project",
        {
          direction: "go on",
          sceneStrategy: "query-ranked",
          reinvokeHint: "call again",
        },
      );
      await vi.advanceTimersByTimeAsync(31_000);
      const result = await resultPromise;
      const rateLimited = failure === "rate limit";
      expect(result.beat_text).toBe("Synthetic completed beat.");
      expect(result.save_error).toBe(
        rateLimited
          ? "OpenChronicle rate limit"
          : "OpenChronicle request failed",
      );
      expect(result.canon_write_outcome).toBe(
        rateLimited ? undefined : "unknown",
      );
      expect(generate).toHaveBeenCalledTimes(1);
      expect(sdk.callTool).toHaveBeenCalledTimes(rateLimited ? 6 : 1);
      expect(
        sdk.callTool.mock.calls.every(
          ([request]) => request.name === "memory_save",
        ),
      ).toBe(true);
      expect(JSON.stringify(result)).not.toContain(TOKEN);
      expect(JSON.stringify(result)).not.toContain(ENCODED_TOKEN);
      expect(JSON.stringify(result)).not.toContain(REMOTE_PROSE);
      expectSafeStderr();
      await vi.advanceTimersByTimeAsync(60_000);
      expect(sdk.callTool).toHaveBeenCalledTimes(rateLimited ? 6 : 1);
    },
  );

  it("preserves prompt abort and replay-safety during rate-limit backoff", async () => {
    vi.useFakeTimers();
    sdk.callTool.mockRejectedValueOnce(leakingError("rate limit"));
    const abort = new AbortController();
    const result = expect(
      new OcClient(endpoint(), TOKEN).memorySearch({
        query: "offline-example",
        projectId: "offline-project",
        signal: abort.signal,
      }),
    ).rejects.toMatchObject({
      outcome: "rejected_before_dispatch",
      retry_safe: true,
    });
    await vi.advanceTimersByTimeAsync(50);
    abort.abort();
    await result;
    expect(sdk.callTool).toHaveBeenCalledTimes(1);
    expectSafeStderr();
  });
});

describe("unauthenticated error compatibility", () => {
  it.each(["connect", "discovery", "readiness", "tool", "close"] as const)(
    "retains the original Error identity for %s failures",
    async (boundary) => {
      const original = new Error("ordinary offline failure");
      const oc = new OcClient(endpoint());
      let operation: Promise<unknown>;
      switch (boundary) {
        case "connect":
          sdk.connect.mockRejectedValueOnce(original);
          operation = oc.connect();
          break;
        case "discovery":
          sdk.listTools.mockRejectedValueOnce(original);
          operation = oc.connect();
          break;
        case "readiness":
          await oc.connect();
          sdk.listTools.mockRejectedValueOnce(original);
          operation = oc.checkReady();
          break;
        case "tool":
          sdk.callTool.mockRejectedValueOnce(original);
          operation = oc.projectCreate("offline-example");
          break;
        case "close":
          await oc.connect();
          sdk.close.mockRejectedValueOnce(original);
          operation = oc.close();
          break;
      }
      expect(await rejectedError(operation)).toBe(original);
    },
  );
});
