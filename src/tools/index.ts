// Orchestrator: registers every tool group on the MCP server.

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { OcClient } from "../oc-client.js";
import type { LlmProvider } from "../llm.js";
import type { ValidateStory } from "../application/validate-story.js";
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
  validateStory: ValidateStory,
  sceneContextStrategy: SceneContextStrategy = DEFAULT_SCENE_CONTEXT_STRATEGY,
  sceneContextFallbackStrategy: SceneContextStrategy = sceneContextStrategy,
  // Caller-supplied filesystem paths are a local-operator capability. Default
  // true keeps stdio -- every current deployment -- unchanged; index.ts passes
  // false when serving HTTP.
  allowFilesystemPaths = true,
): void {
  registerStoryTools(server, oc);
  registerEntityTools(server, oc);
  registerExportTool(server, oc, allowFilesystemPaths);
  registerImportTool(server, oc, allowFilesystemPaths);
  registerContinueTool(
    server,
    oc,
    generator,
    validator,
    sceneContextStrategy,
    sceneContextFallbackStrategy,
  );
  // Validate/revalidate take no strategy config: their contexts are
  // validation-only (no scene pull -- see gatherContext's
  // validationOnly), so scene-context strategy has nothing to control
  // there.
  registerValidateTool(server, oc, validateStory);
  registerRevalidateTool(server, oc, validator);
}
