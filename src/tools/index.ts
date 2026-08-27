// Orchestrator: registers every tool group on the MCP server.

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { OcClient } from "../oc-client.js";
import type { LlmProvider } from "../llm.js";
import {
  DEFAULT_SCENE_CONTEXT_STRATEGY,
  type SceneContextStrategy,
} from "../prompt.js";
import { registerContinueTool } from "./continue.js";
import { registerEntityTools } from "./entities.js";
import { registerExportTool } from "./export.js";
import { registerImportTool } from "./import.js";
import { registerStoryTools } from "./stories.js";
import { registerValidateTool } from "./validate.js";
import { registerRevalidateTool } from "./revalidate.js";

export function registerTools(
  server: McpServer,
  oc: OcClient,
  generator: LlmProvider,
  validator: LlmProvider,
  sceneContextStrategy: SceneContextStrategy = DEFAULT_SCENE_CONTEXT_STRATEGY,
): void {
  registerStoryTools(server, oc);
  registerEntityTools(server, oc);
  registerExportTool(server, oc);
  registerImportTool(server, oc);
  registerContinueTool(
    server,
    oc,
    generator,
    validator,
    sceneContextStrategy,
  );
  registerValidateTool(server, oc, validator, sceneContextStrategy);
  registerRevalidateTool(server, oc, validator, sceneContextStrategy);
}
