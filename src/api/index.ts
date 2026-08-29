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
import { apiErrorHandler, asyncRoute } from "./helpers.js";
import { createReadinessProber } from "../readiness.js";

export interface ApiRouterOptions {
  generator?: LlmProvider;
  validator?: LlmProvider;
  sceneContextStrategy?: SceneContextStrategy;
  sceneContextFallbackStrategy?: SceneContextStrategy;
}

export function createApiRouter(
  oc: OcClient,
  options: ApiRouterOptions = {},
): Router {
  const router = Router();
  const sceneContextStrategy =
    options.sceneContextStrategy ?? DEFAULT_SCENE_CONTEXT_STRATEGY;
  const sceneContextFallbackStrategy =
    options.sceneContextFallbackStrategy ?? sceneContextStrategy;

  registerStoryRoutes(router, oc);
  registerEntityRoutes(router, oc);

  if (options.generator && options.validator) {
    // Protected semantic readiness (NEMOCLAW_ADOPTION_ASSESSMENT §3):
    // sits behind the same apiSecurity middleware as every /api route --
    // /health stays the only public surface, and stays liveness-only.
    // Every probe is non-mutating and non-billable; a cloud generator
    // reports not_probed rather than a guessed ready.
    const { generator, validator } = options;
    const prober = createReadinessProber({ oc, generator, validator });
    router.get(
      "/status",
      asyncRoute(async (_req, res) => {
        res.json(await prober.probe());
      }),
    );

    registerInteractiveRoutes(
      router,
      oc,
      options.generator,
      options.validator,
      sceneContextStrategy,
      sceneContextFallbackStrategy,
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
