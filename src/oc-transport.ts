import {
  StreamableHTTPClientTransport,
  StreamableHTTPError,
} from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";
import { ZodError } from "zod";
import { parseServiceUrl } from "./service-url.js";

// Only this module can mark diagnostics as authored. Remote messages never
// acquire this marker merely by imitating an error name, code or message.
class OcSafeError extends Error {}
class OcSafeHttpError extends StreamableHTTPError {}

/** Static bearer tokens use RFC 6750's b64token grammar. Blank stays optional,
 * matching the other sibling-client token settings; invalid values never echo. */
export function parseOcAuthToken(raw?: string): string | undefined {
  const token = raw?.trim();
  if (!token) return undefined;
  if (!/^[A-Za-z0-9._~+/-]+=*$/.test(token)) {
    throw new Error("OC_MCP_AUTH_TOKEN must be a valid bearer token");
  }
  return token;
}

/** Authenticated upstream prose is untrusted in every encoding. Keep only
 * authored diagnostics or typed categories, never the original payload/stack. */
export function sanitizeOcError(error: unknown, authToken?: string): Error {
  const token = authToken?.trim();
  if (!token) return error instanceof Error ? error : new Error(String(error));
  if (error instanceof OcSafeError || error instanceof OcSafeHttpError)
    return error;

  // JSON parsers and schema validators can include arbitrary response snippets,
  // keys or escaped values. Do not try to redact those diagnostic formats.
  if (
    error instanceof SyntaxError ||
    error instanceof ZodError ||
    (error instanceof StreamableHTTPError && error.code === -1)
  ) {
    return new OcSafeError("OpenChronicle returned an invalid MCP response");
  }
  if (error instanceof McpError) {
    return new OcSafeError(
      Number.isSafeInteger(error.code)
        ? `OpenChronicle MCP request failed (code ${error.code})`
        : "OpenChronicle MCP request failed",
    );
  }
  return new OcSafeError("OpenChronicle request failed");
}

/** The bearer is scoped to one configured endpoint. The SDK's GET/SSE path
 * does not spread requestInit, so a fetch wrapper protects every HTTP method.
 * Without a token, retain the SDK's existing unauthenticated behavior exactly. */
export function createOcTransport(
  url: URL,
  authToken?: string,
): StreamableHTTPClientTransport {
  const token = parseOcAuthToken(authToken);
  if (!token) return new StreamableHTTPClientTransport(url);

  let endpoint: URL;
  try {
    endpoint = parseServiceUrl("OC_URL", url.href);
  } catch {
    throw new OcSafeError(
      "OC_URL must be an http(s) URL without credentials, query string or fragment",
    );
  }
  const endpointHref = endpoint.href;
  const baseFetch = globalThis.fetch;
  return new StreamableHTTPClientTransport(endpoint, {
    fetch: async (input, init) => {
      let requestHref: string;
      try {
        requestHref = new URL(input).href;
      } catch {
        throw new OcSafeError(
          "OpenChronicle authenticated request has an invalid endpoint",
        );
      }
      if (requestHref !== endpointHref) {
        throw new OcSafeError(
          "OpenChronicle authenticated requests must use the configured OC_URL",
        );
      }
      let response: Response;
      try {
        const headers = new Headers(init?.headers);
        headers.set("Authorization", `Bearer ${token}`);
        response = await baseFetch(input, {
          ...init,
          headers,
          redirect: "error",
        });
      } catch {
        // Fetch errors (including redirect failures) may carry reflected
        // request data in their message/cause. Preserve none of that payload.
        throw new OcSafeError(
          "OpenChronicle HTTP request failed; check OC_URL and connectivity (redirects are refused)",
        );
      }
      const method = init?.method?.toUpperCase() ?? "GET";
      const expectedMethodNotAllowed =
        response.status === 405 && (method === "GET" || method === "DELETE");
      if (!response.ok && !expectedMethodNotAllowed) {
        try {
          await response.body?.cancel();
        } catch {
          // Cleanup failures must not replace the authored, secret-safe error.
        }
        // The SDK otherwise includes POST response bodies and GET/DELETE
        // statusText in errors. Neither is trusted to be free of credentials.
        throw new OcSafeHttpError(
          response.status,
          response.status === 429
            ? "OpenChronicle rate limit (HTTP 429)"
            : `OpenChronicle request failed (HTTP ${response.status})`,
        );
      }
      return response;
    },
  });
}
