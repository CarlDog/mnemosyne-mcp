// mnemo_status: the stdio-side counterpart to GET /api/status
// (src/readiness.ts, docs/NEMOCLAW_ADOPTION_ASSESSMENT.md §3). HTTP callers
// have the protected REST route; a stdio host (Claude Desktop, Claude Code)
// has no HTTP endpoint to poll at all, so it had no way to ask "is OC
// reachable, does the generator have a free probe, is the validator ready"
// short of trying a real tool call and reading the failure. Same prober,
// same non-mutating/non-billable/never-coerced-to-ready contract, same TTL
// cache -- registered on both transports (nothing here is stdio-specific
// beyond the motivation), so an HTTP host gets it too, at no extra cost.

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ReadinessProber } from "../readiness.js";
import { asText, withLogging } from "./helpers.js";

export function registerStatusTool(
  server: McpServer,
  readinessProber: ReadinessProber,
): void {
  server.registerTool(
    "mnemo_status",
    {
      title: "Server Readiness",
      description:
        "Semantic readiness for this server's dependencies: OpenChronicle, the generator, and the validator. Each reports ready, unavailable (with a reason), or not_probed (a cloud generator has no free probe, so readiness is never guessed). Every probe is non-mutating and non-billable; results are cached briefly so repeated calls don't storm the dependencies. This is the stdio-side counterpart to GET /api/status -- a stdio host has no HTTP endpoint to poll, so this tool is the only way to ask.",
      inputSchema: {},
    },
    withLogging("mnemo_status", async () => {
      const report = await readinessProber.probe();
      return asText(report);
    }),
  );
}
