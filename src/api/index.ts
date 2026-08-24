// Orchestrator: wires every /api route group, mirroring
// src/tools/index.ts's registerTools() pattern for the MCP tool surface.

import { Router } from "express";
import type { OcClient } from "../oc-client.js";
import { registerStoryRoutes } from "./stories.js";
import { registerEntityRoutes } from "./entities.js";
import { apiErrorHandler } from "./helpers.js";

export function createApiRouter(oc: OcClient): Router {
  const router = Router();

  registerStoryRoutes(router, oc);
  registerEntityRoutes(router, oc);

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
