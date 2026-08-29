// Bounded, non-mutating required-tool discovery for sibling MCP services
// (docs/NEMOCLAW_ADOPTION_ASSESSMENT.md §2). Each client's connect() used to
// perform only the MCP initialization handshake and then trust that the
// tools it calls exist -- an upstream rename surfaced as a confusing
// mid-operation error (or, for a companion provider, only after the
// direction had already been posted to a real conversation).
//
// verifyRequiredTools paginates `tools/list` -- and ONLY tools/list; it
// never invokes a discovered tool -- under hard bounds, then checks that
// every required tool name is advertised. It fails closed on the abuse
// shapes NemoClaw's discovery contract enumerates: unbounded pagination,
// repeated cursors, oversized pages, duplicate or oversized tool names.
//
// Who calls it and what failure means:
//  - OcClient.connect() -- awaited at startup, so a missing OC contract
//    fails startup (OC is mandatory).
//  - Kindroid/Botify connect() -- lazy, on first generation, so a missing
//    companion contract surfaces as "provider unavailable" while story
//    browsing (OC-only) keeps working. Because discovery runs before the
//    first mutating call, a renamed upstream tool now fails BEFORE a
//    direction is posted to a real conversation.

import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { log } from "./log.js";

export interface DiscoveryBounds {
  /** Max tools/list pages fetched before failing closed. */
  maxPages: number;
  /** Max total advertised tools accepted before failing closed. */
  maxTools: number;
  /** Max accepted tool-name length. */
  maxNameLength: number;
  /** Max accepted pagination-cursor length. */
  maxCursorLength: number;
  /** Per-page request timeout (ms). */
  requestTimeoutMs: number;
}

export const DEFAULT_DISCOVERY_BOUNDS: DiscoveryBounds = {
  maxPages: 10,
  maxTools: 500,
  maxNameLength: 200,
  maxCursorLength: 4096,
  requestTimeoutMs: 15_000,
};

/** The slice of the SDK Client this module uses -- listTools only, which is
 * also the testable seam (a fake with a throwing callTool proves discovery
 * performs zero tool invocations). */
export type ToolLister = Pick<Client, "listTools">;

function fail(service: string, reason: string): never {
  throw new Error(
    `${service} tool discovery failed: ${reason}. Refusing to use this ` +
      "service until its advertised tool contract is sane.",
  );
}

/**
 * Enumerate the service's advertised tool names under bounds and throw if
 * any required name is missing. Non-mutating: only `tools/list` is sent.
 */
export async function verifyRequiredTools(
  client: ToolLister,
  service: string,
  required: readonly string[],
  bounds: DiscoveryBounds = DEFAULT_DISCOVERY_BOUNDS,
): Promise<void> {
  const seen = new Set<string>();
  const seenCursors = new Set<string>();
  let cursor: string | undefined;
  let pages = 0;

  do {
    if (pages >= bounds.maxPages) {
      fail(service, `more than ${bounds.maxPages} tools/list pages`);
    }
    pages += 1;
    const page = await client.listTools(
      cursor === undefined ? undefined : { cursor },
      { timeout: bounds.requestTimeoutMs },
    );

    for (const tool of page.tools) {
      if (typeof tool.name !== "string" || tool.name.length === 0) {
        fail(service, "an advertised tool has no name");
      }
      if (tool.name.length > bounds.maxNameLength) {
        fail(
          service,
          `an advertised tool name exceeds ${bounds.maxNameLength} chars`,
        );
      }
      if (seen.has(tool.name)) {
        fail(service, `duplicate advertised tool name "${tool.name}"`);
      }
      seen.add(tool.name);
      if (seen.size > bounds.maxTools) {
        fail(service, `more than ${bounds.maxTools} advertised tools`);
      }
    }

    cursor = page.nextCursor;
    if (cursor !== undefined) {
      if (cursor.length > bounds.maxCursorLength) {
        fail(service, "pagination cursor exceeds the accepted length");
      }
      if (seenCursors.has(cursor)) {
        fail(service, "pagination cursor repeated (loop)");
      }
      seenCursors.add(cursor);
    }
  } while (cursor !== undefined);

  const missing = required.filter((name) => !seen.has(name));
  if (missing.length > 0) {
    throw new Error(
      `${service} does not advertise required tool(s) ` +
        `${missing.map((m) => `"${m}"`).join(", ")} ` +
        `(${seen.size} tools advertised). The deployed ${service} version ` +
        "may be older or newer than this client expects -- align the " +
        "deployments before using this provider.",
    );
  }
  log.info("mcp-discovery", "required tools verified", {
    service,
    required: required.length,
    advertised: seen.size,
    pages,
  });
}
