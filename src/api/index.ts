// Orchestrator: wires every /api route group, mirroring
// src/tools/index.ts's registerTools() pattern for the MCP tool surface.

import { Router } from "express";
import type { OcClient } from "../oc-client.js";
import type { LlmProvider } from "../llm.js";
import {
  DEFAULT_SCENE_CONTEXT_STRATEGY,
  type SceneContextStrategy,
} from "../prompt.js";
import { registerStoryRoutes } from "./stories.js";
import { registerEntityRoutes } from "./entities.js";
import { registerInteractiveRoutes } from "./interactive.js";
import { apiErrorHandler } from "./helpers.js";

export interface ApiRouterOptions {
  validator?: LlmProvider;
  sceneContextStrategy?: SceneContextStrategy;
}

export function createApiRouter(
  oc: OcClient,
  options: ApiRouterOptions = {},
): Router {
  const router = Router();
  const sceneContextStrategy =
    options.sceneContextStrategy ?? DEFAULT_SCENE_CONTEXT_STRATEGY;

  registerStoryRoutes(router, oc);
  registerEntityRoutes(router, oc);

  if (options.validator) {
    registerInteractiveRoutes(
      router,
      oc,
      options.validator,
      sceneContextStrategy,
    );
  }

  // JSON 404 tail: an unmatched /api/* path must not fall through to the
  // SPA catch-all registered after this router in src/index.ts.
  router.use((_req, res) => {
    res.status(404).json({ error: "not_found" });
  });

  // Error middleware last, per Express's arity-based error-handler
  // detection (must be exactly 4 params).
  router.use(apiErrorHandler);

  return router;
}
