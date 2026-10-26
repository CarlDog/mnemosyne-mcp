import { afterEach, describe, expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPError } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { OcClient } from "../src/oc-client.js";
import { z } from "zod";
import {
  createOcTransport,
  parseOcAuthToken,
  sanitizeOcError,
} from "../src/oc-transport.js";

const ENDPOINT = new URL("https://oc.invalid/mcp");
const TOKEN = "synthetic.token+/=";
const SESSION = "mock-session";
const VERSION = "2025-11-25";
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

interface RpcRequest {
  id?: string | number;
  method: string;
  params?: { name?: string };
}

interface RequestRecord {
  url: string;
  method: string;
  headers: Headers;
  redirect?: RequestRedirect;
  rpcMethod?: string;
}

function createClient() {
  return new Client(
    { name: "oc-auth-test", version: "0.0.0" },
    { capabilities: {} },
  );
}

function rpcResponse(id: unknown, result: unknown, sse = false): Response {
  const message = { jsonrpc: "2.0", id, result };
  return new Response(
    sse
      ? `event: message\ndata: ${JSON.stringify(message)}\n\n`
      : JSON.stringify(message),
    {
      headers: {
        "content-type": sse ? "text/event-stream" : "application/json",
        "mcp-session-id": SESSION,
      },
    },
  );
}

function mockMcp(opts?: {
  sseResponses?: boolean;
  get?: (headers: Headers) => Response;
  deleteStatus?: number;
  requiredToken?: string;
  tools?: string[];
  post?: (message: RpcRequest) => Response | undefined;
}) {
  const requests: RequestRecord[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL, init?: RequestInit) => {
      const method = init?.method?.toUpperCase() ?? "GET";
      const headers = new Headers(init?.headers);
      const record: RequestRecord = {
        url: String(input),
        method,
        headers,
        redirect: init?.redirect,
      };
      requests.push(record);
      if (
        opts?.requiredToken &&
        headers.get("Authorization") !== `Bearer ${opts.requiredToken}`
      ) {
        return new Response("Unauthorized", {
          status: headers.has("Authorization") ? 403 : 401,
        });
      }
      if (method === "GET") {
        return opts?.get?.(headers) ?? new Response(null, { status: 405 });
      }
      if (method === "DELETE") {
        return new Response(null, { status: opts?.deleteStatus ?? 204 });
      }
      const message = JSON.parse(String(init?.body)) as RpcRequest;
      record.rpcMethod = message.method;
      const override = opts?.post?.(message);
      if (override) return override;
      if (message.method === "initialize") {
        return rpcResponse(
          message.id,
          {
            protocolVersion: VERSION,
            capabilities: { tools: {} },
            serverInfo: { name: "mock-oc", version: "0.0.0" },
          },
          opts?.sseResponses,
        );
      }
      if (message.method === "tools/list") {
        return rpcResponse(
          message.id,
          {
            tools: (opts?.tools ?? ["memory_search"]).map((name) => ({
              name,
              inputSchema: { type: "object" },
            })),
          },
          opts?.sseResponses,
        );
      }
      return new Response(null, { status: 202 });
    }),
  );
  return requests;
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function assertSecretAbsent(value: string | undefined, token: string) {
  expect(value).not.toContain(token);
  expect(value).not.toContain(encodeURIComponent(token));
  expect(value).not.toContain(token.replaceAll("/", "\\/"));
}

async function rejected(promise: Promise<unknown>): Promise<Error> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(Error);
    return error as Error;
  }
  throw new Error("Expected the offline request to fail");
}

describe("OC bearer configuration", () => {
  it("keeps absent/blank optional and trims valid tokens", () => {
    expect(parseOcAuthToken()).toBeUndefined();
    expect(parseOcAuthToken("  \t ")).toBeUndefined();
    expect(parseOcAuthToken(`  ${TOKEN}  `)).toBe(TOKEN);
  });

  it.each([
    "Bearer secret",
    "bad token",
    "bad\r\nheader",
    "bad:token",
    "bad=middle",
  ])("rejects malformed input without including its value", (value) => {
    let message = "";
    try {
      parseOcAuthToken(value);
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toBe("OC_MCP_AUTH_TOKEN must be a valid bearer token");
    expect(message).not.toContain(value);
  });

  it.each([
    "https://user:synthetic@oc.invalid/mcp",
    "https://oc.invalid/mcp?token=synthetic",
    "https://oc.invalid/mcp#synthetic",
    "file:///synthetic",
  ])("validates an authenticated endpoint before fetching", (url) => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    expect(() => createOcTransport(new URL(url), TOKEN)).toThrow();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("redacts a token reflected in the URL parser's invalid-protocol error", () => {
    let failure: Error | undefined;
    try {
      createOcTransport(
        new URL("synthetic-token://oc.invalid/mcp"),
        "synthetic-token",
      );
    } catch (error) {
      failure = error as Error;
    }
    expect(failure).toBeInstanceOf(Error);
    expect(failure?.message).toContain("must be an http(s) URL");
    expect(failure?.stack).not.toContain("synthetic-token");
  });
});

describe("real SDK transport with offline fetch", () => {
  it.each([false, true])(
    "retains unauthenticated JSON/SSE initialization and discovery (SSE=%s)",
    async (sseResponses) => {
      const requests = mockMcp({ sseResponses });
      const client = createClient();
      try {
        await client.connect(createOcTransport(ENDPOINT));
        expect((await client.listTools()).tools[0]?.name).toBe("memory_search");
        await vi.waitFor(() =>
          expect(requests.some((r) => r.method === "GET")).toBe(true),
        );
        expect(requests.every((r) => !r.headers.has("Authorization"))).toBe(
          true,
        );
      } finally {
        await client.close();
      }
    },
  );

  it.each([false, true])(
    "authenticates JSON/SSE POST, GET and DELETE without replacing SDK headers (SSE=%s)",
    async (sseResponses) => {
      const requests = mockMcp({ sseResponses });
      const client = createClient();
      const transport = createOcTransport(ENDPOINT, TOKEN);
      try {
        await client.connect(transport);
        expect((await client.listTools()).tools[0]?.name).toBe("memory_search");
        await vi.waitFor(() =>
          expect(requests.some((r) => r.method === "GET")).toBe(true),
        );
        await transport.terminateSession();
        expect(new Set(requests.map((r) => r.method))).toEqual(
          new Set(["POST", "GET", "DELETE"]),
        );
        for (const request of requests) {
          expect(request.url).toBe(ENDPOINT.href);
          expect(request.headers.get("Authorization")).toBe(`Bearer ${TOKEN}`);
          expect(request.redirect).toBe("error");
        }
        expect(requests[0]?.headers.get("accept")).toBe(
          "application/json, text/event-stream",
        );
        for (const request of requests.slice(1)) {
          expect(request.headers.get("mcp-session-id")).toBe(SESSION);
          expect(request.headers.get("mcp-protocol-version")).toBe(VERSION);
        }
        expect(
          requests.find((r) => r.method === "GET")?.headers.get("accept"),
        ).toBe("text/event-stream");
      } finally {
        await client.close();
      }
    },
  );

  it("preserves bearer and resumption headers on an automatic GET/SSE reconnect", async () => {
    let gets = 0;
    let streamController:
      ReadableStreamDefaultController<Uint8Array> | undefined;
    const requests = mockMcp({
      get: () => {
        gets++;
        if (gets === 1) {
          return new Response("id: resume-1\nretry: 1\ndata:\n\n", {
            headers: { "content-type": "text/event-stream" },
          });
        }
        return new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              streamController = controller;
            },
          }),
          { headers: { "content-type": "text/event-stream" } },
        );
      },
    });
    const client = createClient();
    try {
      await client.connect(createOcTransport(ENDPOINT, TOKEN));
      await vi.waitFor(() => expect(gets).toBe(2));
      const resumed = requests.filter((r) => r.method === "GET")[1];
      expect(resumed?.headers.get("last-event-id")).toBe("resume-1");
      expect(resumed?.headers.get("Authorization")).toBe(`Bearer ${TOKEN}`);
      expect(resumed?.headers.get("mcp-session-id")).toBe(SESSION);
      expect(resumed?.headers.get("mcp-protocol-version")).toBe(VERSION);
      expect(resumed?.redirect).toBe("error");
    } finally {
      await client.close();
      streamController?.close();
    }
  });

  it("accepts unsupported DELETE and close itself sends no DELETE", async () => {
    const requests = mockMcp({ deleteStatus: 405 });
    const client = createClient();
    const transport = createOcTransport(ENDPOINT, TOKEN);
    await client.connect(transport);
    await expect(transport.terminateSession()).resolves.toBeUndefined();
    const deletesBeforeClose = requests.filter(
      (r) => r.method === "DELETE",
    ).length;
    await client.close();
    expect(requests.filter((r) => r.method === "DELETE")).toHaveLength(
      deletesBeforeClose,
    );
  });

  it.each([302, 401, 403, 429, 500])(
    "discards reflected HTTP error body/statusText (HTTP %s)",
    async (status) => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response(TOKEN, { status, statusText: TOKEN })),
      );
      const client = createClient();
      try {
        const error = await client
          .connect(createOcTransport(ENDPOINT, TOKEN))
          .catch((err: unknown) => err);
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain(`HTTP ${status}`);
        expect((error as Error).stack).not.toContain(TOKEN);
        expect((error as Error).cause).toBeUndefined();
        expect(sanitizeOcError(sanitizeOcError(error, TOKEN), TOKEN)).toBe(
          error,
        );
      } finally {
        await client.close();
      }
    },
  );

  it("discards network/redirect exception payloads", async () => {
    const cause = new Error(TOKEN);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string | URL, init?: RequestInit) => {
        expect(init?.redirect).toBe("error");
        throw new Error(`reflected ${TOKEN}`, { cause });
      }),
    );
    const client = createClient();
    try {
      const error = await client
        .connect(createOcTransport(ENDPOINT, TOKEN))
        .catch((err: unknown) => err);
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain("redirects are refused");
      expect((error as Error).stack).not.toContain(TOKEN);
      expect((error as Error).cause).toBeUndefined();
      expect(sanitizeOcError(sanitizeOcError(error, TOKEN), TOKEN)).toBe(error);
    } finally {
      await client.close();
    }
  });
});

describe("OC error boundary", () => {
  it("reports a valid remote invalid-params error by code without labeling it a malformed response", () => {
    const clean = sanitizeOcError(
      new McpError(ErrorCode.InvalidParams, TOKEN, { token: TOKEN }),
      TOKEN,
    );
    expect(clean.message).toBe(
      "OpenChronicle MCP request failed (code -32602)",
    );
    assertSecretAbsent(clean.stack, TOKEN);
    expect(clean).not.toHaveProperty("data");
  });

  it("preserves the original Error when no token is configured", () => {
    const original = new Error("existing rate limit");
    expect(sanitizeOcError(original)).toBe(original);
  });

  it("discards upstream prose and original stack, cause and extra properties", () => {
    const original = Object.assign(
      new Error(`rate limit: ${TOKEN}; encoded=${encodeURIComponent(TOKEN)}`, {
        cause: new Error(TOKEN),
      }),
      { response: TOKEN },
    );
    original.stack = `upstream stack ${TOKEN}`;
    const clean = sanitizeOcError(original, TOKEN);
    expect(clean.message).toBe("OpenChronicle request failed");
    expect(clean.message).not.toContain(TOKEN);
    expect(clean.message).not.toContain(encodeURIComponent(TOKEN));
    expect(clean.stack).not.toContain(TOKEN);
    expect(clean.stack).not.toContain("upstream stack");
    expect(clean.cause).toBeUndefined();
    expect(clean).not.toHaveProperty("response");
  });

  it("discards JSON slash-escaped tokens in unknown errors", () => {
    const token = "fake/token";
    const clean = sanitizeOcError(
      new Error(`upstream: ${token.replaceAll("/", "\\/")}`),
      token,
    );
    assertSecretAbsent(clean.stack, token);
  });

  it("replaces authenticated schema diagnostics with an authored message", () => {
    const token = "fake/token";
    const parsed = z
      .object({ value: z.string() })
      .safeParse({ value: { [token]: token } });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const clean = sanitizeOcError(parsed.error, token);
      expect(clean.message).toBe(
        "OpenChronicle returned an invalid MCP response",
      );
      assertSecretAbsent(clean.stack, token);
    }
  });
});

describe("real OC client against an offline authenticated endpoint", () => {
  it.each(["rpc-error", "tool-error"])(
    "discards remote HTTP200 error prose/data through the actual client (%s)",
    async (kind) => {
      const token = "fake/token";
      const variants = [
        token,
        encodeURIComponent(token),
        encodeURIComponent(token).toLowerCase(),
        token.replaceAll("/", "\\/"),
        "fake\\u002ftoken",
      ];
      const prose = `remote payload ${variants.join(" ")}`;
      const stderr = vi.spyOn(console, "error").mockImplementation(() => {});
      mockMcp({
        requiredToken: token,
        tools: REQUIRED_TOOLS,
        post: (message) => {
          if (message.method !== "tools/call") return undefined;
          if (kind === "tool-error")
            return rpcResponse(message.id, {
              isError: true,
              content: [{ type: "text", text: prose }],
            });
          return new Response(
            JSON.stringify({
              jsonrpc: "2.0",
              id: message.id,
              error: {
                code: -32603,
                message: prose,
                data: { authorization: token, cause: { message: prose } },
              },
            }),
            { headers: { "content-type": "application/json" } },
          );
        },
      });
      const client = new OcClient(ENDPOINT, token);
      try {
        await client.connect();
        const error = await rejected(client.memoryGet("offline-memory"));
        expect(error.message).toBe(
          kind === "rpc-error"
            ? "OpenChronicle MCP request failed (code -32603)"
            : "OpenChronicle request failed",
        );
        for (const variant of variants) {
          expect(error.stack).not.toContain(variant);
          expect(stderr.mock.calls.flat().join(" ")).not.toContain(variant);
        }
        expect(error.cause).toBeUndefined();
        expect(error).not.toHaveProperty("data");
        expect(error).not.toHaveProperty("authorization");
        expect(Object.getOwnPropertyNames(error).sort()).toEqual([
          "message",
          "stack",
        ]);
      } finally {
        await client.close();
      }
    },
  );

  it("reproduces401 without the token and completes initialization/discovery with it", async () => {
    const token = "fake/oc-token";
    const stderr = vi.spyOn(console, "error").mockImplementation(() => {});
    const requests = mockMcp({ requiredToken: token, tools: REQUIRED_TOOLS });
    const unauthenticated = new OcClient(ENDPOINT);
    const wrongToken = new OcClient(ENDPOINT, "fake-wrong-token");
    const authenticated = new OcClient(ENDPOINT, token);
    try {
      expect(await rejected(unauthenticated.connect())).toHaveProperty(
        "code",
        401,
      );
      expect(requests).toHaveLength(1);
      expect((await rejected(wrongToken.connect())).message).toContain(
        "HTTP 403",
      );
      expect(requests).toHaveLength(2);
      await authenticated.connect();
      await authenticated.checkReady();
      expect(requests.filter((r) => r.rpcMethod === "tools/list")).toHaveLength(
        2,
      );
      expect(requests.filter((r) => r.rpcMethod === "tools/call")).toHaveLength(
        0,
      );
      assertSecretAbsent(stderr.mock.calls.flat().join(" "), token);
    } finally {
      await Promise.all([
        unauthenticated.close(),
        wrongToken.close(),
        authenticated.close(),
      ]);
    }
  });

  it("retries a real HTTP429 rejection and recovers on the next synthetic memory read", async () => {
    const token = "fake/oc-token";
    const stderr = vi.spyOn(console, "error").mockImplementation(() => {});
    let memoryReads = 0;
    const requests = mockMcp({
      requiredToken: token,
      tools: REQUIRED_TOOLS,
      post: (message) => {
        if (message.method !== "tools/call") return undefined;
        expect(message.params?.name).toBe("memory_get");
        memoryReads++;
        if (memoryReads === 1) {
          return new Response(`reflected ${token}`, {
            status: 429,
            statusText: "untrusted",
          });
        }
        return rpcResponse(message.id, {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                id: "offline-memory",
                content: "synthetic only",
                project_id: "offline-project",
                tags: [],
                pinned: false,
                created_at: "2026-01-01T00:00:00Z",
              }),
            },
          ],
        });
      },
    });
    const client = new OcClient(ENDPOINT, token);
    try {
      await client.connect();
      expect((await client.memoryGet("offline-memory"))?.id).toBe(
        "offline-memory",
      );
      expect(memoryReads).toBe(2);
      expect(requests.filter((r) => r.rpcMethod === "tools/call")).toHaveLength(
        2,
      );
      expect(stderr.mock.calls.flat().join(" ")).toContain(
        "rate limited; backing off",
      );
      assertSecretAbsent(stderr.mock.calls.flat().join(" "), token);
    } finally {
      await client.close();
    }
  });

  it("preserves the authored HTTP429 status and backoff after retry exhaustion", async () => {
    const stderr = vi.spyOn(console, "error").mockImplementation(() => {});
    let calls = 0;
    const requests = mockMcp({
      requiredToken: TOKEN,
      tools: REQUIRED_TOOLS,
      post: (message) => {
        if (message.method !== "tools/call") return undefined;
        calls++;
        return new Response(`rate limit reflected ${TOKEN}`, { status: 429 });
      },
    });
    const client = new OcClient(ENDPOINT, TOKEN);
    try {
      await client.connect();
      vi.useFakeTimers();
      const result = rejected(client.memoryGet("offline-memory"));
      await vi.advanceTimersByTimeAsync(31_000);
      const error = await result;
      expect(error).toBeInstanceOf(StreamableHTTPError);
      expect(error).toHaveProperty("code", 429);
      expect(error.message).toContain("OpenChronicle rate limit (HTTP 429)");
      expect(sanitizeOcError(error, TOKEN)).toBe(error);
      expect(calls).toBe(6);
      expect(requests.filter((r) => r.rpcMethod === "tools/call")).toHaveLength(
        6,
      );
      expect(
        stderr.mock.calls
          .flat()
          .join(" ")
          .match(/backing off/g),
      ).toHaveLength(5);
      assertSecretAbsent(error.stack, TOKEN);
      assertSecretAbsent(stderr.mock.calls.flat().join(" "), TOKEN);
      await vi.advanceTimersByTimeAsync(60_000);
      expect(calls).toBe(6);
    } finally {
      await client.close();
    }
  });

  it.each([401, 403])(
    "does not retry HTTP%s even if the rejected body says rate limit",
    async (status) => {
      const token = "fake/oc-token";
      const stderr = vi.spyOn(console, "error").mockImplementation(() => {});
      let calls = 0;
      mockMcp({
        requiredToken: token,
        tools: REQUIRED_TOOLS,
        post: (message) => {
          if (message.method !== "tools/call") return undefined;
          calls++;
          return new Response(`rate limit ${token}`, { status });
        },
      });
      const client = new OcClient(ENDPOINT, token);
      try {
        await client.connect();
        const error = await rejected(client.memoryGet("offline-memory"));
        expect(error.message).toContain(`HTTP ${status}`);
        expect(calls).toBe(1);
        assertSecretAbsent(error.stack, token);
        assertSecretAbsent(stderr.mock.calls.flat().join(" "), token);
      } finally {
        await client.close();
      }
    },
  );

  it.each(["syntax", "schema", "content-type"])(
    "sanitizes malformed successful JSON initialization (%s)",
    async (kind) => {
      const token = "fake/token";
      const escaped = token.replaceAll("/", "\\/");
      const stderr = vi.spyOn(console, "error").mockImplementation(() => {});
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => {
          if (kind === "syntax")
            return new Response(`Bearer ${escaped}`, {
              headers: { "content-type": "application/json" },
            });
          if (kind === "schema")
            return new Response(
              JSON.stringify({
                jsonrpc: "2.0",
                id: { [escaped]: escaped },
                result: {},
              }),
              { headers: { "content-type": "application/json" } },
            );
          return new Response("synthetic", {
            headers: { "content-type": token },
          });
        }),
      );
      const client = new OcClient(ENDPOINT, token);
      try {
        const error = await rejected(client.connect());
        expect(error.message).toBe(
          "OpenChronicle returned an invalid MCP response",
        );
        assertSecretAbsent(error.stack, token);
        assertSecretAbsent(stderr.mock.calls.flat().join(" "), token);
      } finally {
        await client.close();
      }
    },
  );

  it.each(["syntax", "schema"])(
    "sanitizes asynchronous malformed GET/SSE messages at the real client log boundary (%s)",
    async (kind) => {
      const token = "fake/token";
      const escaped = token.replaceAll("/", "\\/");
      const stderr = vi.spyOn(console, "error").mockImplementation(() => {});
      mockMcp({
        requiredToken: token,
        tools: REQUIRED_TOOLS,
        get: () => {
          const data =
            kind === "syntax"
              ? `Bearer ${escaped}`
              : JSON.stringify({
                  jsonrpc: "2.0",
                  id: { [escaped]: escaped },
                  result: {},
                });
          return new Response(`event: message\ndata: ${data}\n\n`, {
            headers: { "content-type": "text/event-stream" },
          });
        },
      });
      const client = new OcClient(ENDPOINT, token);
      try {
        await client.connect();
        await vi.waitFor(() =>
          expect(stderr.mock.calls.flat().join(" ")).toContain(
            "invalid MCP response",
          ),
        );
        assertSecretAbsent(stderr.mock.calls.flat().join(" "), token);
      } finally {
        await client.close();
      }
    },
  );
});
