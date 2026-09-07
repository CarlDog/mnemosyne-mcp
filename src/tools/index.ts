// Orchestrator: registers every tool group on the MCP server.

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { OcClient } from "../oc-client.js";
import type { ApplicationUseCases } from "../application/use-cases.js";
import type { ReadinessProber } from "../readiness.js";
import {
  DEFAULT_SCENE_CONTEXT_STRATEGY,
  type SceneContextStrategy,
} from "../prompt.js";
import { registerContinueTool } from "./continue.js";
import { registerEntityTools } from "./entities.js";
import { registerExportTool } from "./export.js";
import { registerImportTool } from "./import.js";
import { registerStoryTools } from "./stories.js";
import { registerStatusTool } from "./status.js";
import { registerValidateTool } from "./validate.js";
import { registerRevalidateTool } from "./revalidate.js";
import { registerSessionTool } from "./session.js";

export function registerTools(
  server: McpServer,
  oc: OcClient,
  useCases: ApplicationUseCases,
  sceneContextStrategy: SceneContextStrategy = DEFAULT_SCENE_CONTEXT_STRATEGY,
  sceneContextFallbackStrategy: SceneContextStrategy = sceneContextStrategy,
  // Caller-supplied filesystem paths are a local-operator capability. Default
  // true keeps stdio -- every current deployment -- unchanged; index.ts passes
  // false when serving HTTP.
  allowFilesystemPaths = true,
  // Optional so call sites that don't care about readiness (most tests)
  // don't need to construct a prober just to register the other tools.
  // index.ts always passes one, constructed ONCE at the composition root
  // and shared across every session -- constructing it per-session (inside
  // this function, which HTTP's makeServer() factory calls once per
  // session) would give each session its own TTL cache, defeating the
  // prober's whole "repeated polls can't storm the dependencies" point.
  readinessProber?: ReadinessProber,
): void {
  registerStoryTools(server, oc, useCases.listStoryCatalog);
  registerEntityTools(server, oc, useCases.listEntityCatalog);
  registerExportTool(server, oc, allowFilesystemPaths);
  registerImportTool(server, oc, allowFilesystemPaths);
  registerContinueTool(
    server,
    oc,
    useCases.continueScene,
    sceneContextStrategy,
    sceneContextFallbackStrategy,
  );
  // Validate/revalidate take no strategy config: their contexts are
  // validation-only (no scene pull -- see gatherContext's
  // validationOnly), so scene-context strategy has nothing to control
  // there.
  registerValidateTool(server, oc, useCases.validateStory);
  registerRevalidateTool(server, oc, useCases.revalidateScenes);
  registerSessionTool(server, oc, useCases.sessionBreak);
  if (readinessProber) registerStatusTool(server, readinessProber);
}
