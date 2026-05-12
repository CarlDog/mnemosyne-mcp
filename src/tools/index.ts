// Orchestrator: registers every tool group on the MCP server.
// Phase A: story tools. Phase B: entity tools.
// Phase C will add the continuation tool.

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { OcClient } from "../oc-client.js";
import { registerEntityTools } from "./entities.js";
import { registerStoryTools } from "./stories.js";

export function registerTools(server: McpServer, oc: OcClient): void {
  registerStoryTools(server, oc);
  registerEntityTools(server, oc);
}
