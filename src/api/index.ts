// Orchestrator: wires every /api route group, mirroring
// src/tools/index.ts's registerTools() pattern for the MCP tool surface.

import { Router } from "express";
import type { OcClient } from "../oc-client.js";
import type { LlmProvider } from "../llm.js";
import type { ApplicationUseCases } from "../application/use-cases.js";
import {
  DEFAULT_SCENE_CONTEXT_STRATEGY,
  type SceneContextStrategy,
} from "../prompt.js";
import { registerStoryRoutes } from "./stories.js";
import { registerEntityRoutes } from "./entities.js";
import { registerInteractiveRoutes } from "./interactive.js";
import { apiErrorHandler, asyncRoute } from "./helpers.js";
import { createReadinessProber } from "../readiness.js";
import { resolveCapabilities } from "../capabilities.js";

export interface ApiRouterOptions {
  useCases: ApplicationUseCases;
  generator?: LlmProvider;
  validator?: LlmProvider;
  sceneContextStrategy?: SceneContextStrategy;
  sceneContextFallbackStrategy?: SceneContextStrategy;
}

export function createApiRouter(
  oc: OcClient,
  options: ApiRouterOptions,
): Router {
  const router = Router();
  const sceneContextStrategy =
    options.sceneContextStrategy ?? DEFAULT_SCENE_CONTEXT_STRATEGY;
  const sceneContextFallbackStrategy =
    options.sceneContextFallbackStrategy ?? sceneContextStrategy;

  registerStoryRoutes(router, oc, options.useCases.listStoryCatalog);
  registerEntityRoutes(router, oc, options.useCases.listEntityCatalog);

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

    // Capability projection (GENERATOR_CAPABILITIES_DESIGN, ratified):
    // TWO descriptors -- the generator instance's and the validator
    // instance's (distinct even when both are Ollama: different models
    // and window caps). Consumers must render "unknown" as unknown,
    // never as unsupported.
    router.get(
      "/capabilities",
      asyncRoute(async (_req, res) => {
        const [gen, val] = await Promise.all([
          resolveCapabilities(generator),
          resolveCapabilities(validator),
        ]);
        res.json({ generator: gen, validator: val });
      }),
    );

    registerInteractiveRoutes(
      router,
      oc,
      options.useCases.continueScene,
      options.useCases.validateStory,
      options.useCases.revalidateScenes,
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
