// Orchestrator: registers every tool group on the MCP server.

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { OcClient } from "../oc-client.js";
import type { LlmProvider } from "../llm.js";
import { registerContinueTool } from "./continue.js";
import { registerEntityTools } from "./entities.js";
import { registerStoryTools } from "./stories.js";
import { registerValidateTool } from "./validate.js";

export function registerTools(
  server: McpServer,
  oc: OcClient,
  generator: LlmProvider,
  validator: LlmProvider,
): void {
  registerStoryTools(server, oc);
  registerEntityTools(server, oc);
  registerContinueTool(server, oc, generator, validator);
  registerValidateTool(server, oc, validator);
}
