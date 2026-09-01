// Entity routes for the web UI's read-only entity library (WEBUI_NOTES §9
// slice 1): GET /stories/:storyId/entities (roster, filterable/searchable),
// GET /stories/:storyId/entities/:memoryId (single entity, full body).
//
// Thin JSON adapters over the same application read use case as
// mnemo_list_entities.
// includeBody is hard-false on the roster route -- never exposed as a
// query param here -- matching filterListedEntities' own stated intent
// that a browse response should stay light, not a content dump.

import type { Router } from "express";
import { z } from "zod";
import type { OcClient } from "../oc-client.js";
import type { ListEntityCatalog } from "../application/list-entities.js";
import { ENTITY_TYPES, getEntityByMemoryId } from "../entities.js";
import { asyncRoute, parseOr400, requireStory } from "./helpers.js";

const rosterQuerySchema = z.object({
  type: z.enum(ENTITY_TYPES).optional(),
  q: z.string().min(1).optional(),
});

export function registerEntityRoutes(
  router: Router,
  oc: OcClient,
  listEntityCatalog: ListEntityCatalog,
): void {
  router.get(
    "/stories/:storyId/entities",
    asyncRoute(async (req, res) => {
      const { storyId } = req.params as { storyId: string };
      const story = await requireStory(oc, storyId, res);
      if (!story) return;

      const query = parseOr400(
        rosterQuerySchema,
        req.query,
        res,
        "invalid_query",
      );
      if (!query) return;

      res.json(
        await listEntityCatalog(story, {
          type: query.type,
          query: query.q,
          includeBody: false,
        }),
      );
    }),
  );

  router.get(
    "/stories/:storyId/entities/:memoryId",
    asyncRoute(async (req, res) => {
      const { storyId, memoryId } = req.params as {
        storyId: string;
        memoryId: string;
      };
      const entity = await getEntityByMemoryId(oc, storyId, memoryId);
      if (!entity) {
        res.status(404).json({
          error: "entity_not_found",
          message: `No entity "${memoryId}" in story "${storyId}".`,
        });
        return;
      }
      res.json({ entity });
    }),
  );
}
