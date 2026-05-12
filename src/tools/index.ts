// Orchestrator: registers every tool group on the MCP server.
// Phase A registers story tools only. Phase B will add entity tools,
// Phase C will add the continuation tool.

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { OcClient } from "../oc-client.js";
import { registerStoryTools } from "./stories.js";

export function registerTools(server: McpServer, oc: OcClient): void {
  registerStoryTools(server, oc);
}
