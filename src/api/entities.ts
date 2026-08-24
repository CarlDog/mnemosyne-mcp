// Entity routes for the web UI's read-only entity library (WEBUI_NOTES §9
// slice 1): GET /stories/:storyId/entities (roster, filterable/searchable),
// GET /stories/:storyId/entities/:memoryId (single entity, full body).
//
// Thin JSON adapters over the same domain functions mnemo_list_entities
// already wraps (listAllEntities/filterListedEntities, src/entities.ts).
// includeBody is hard-false on the roster route -- never exposed as a
// query param here -- matching filterListedEntities' own stated intent
// that a browse response should stay light, not a content dump.

import type { Router } from "express";
import { z } from "zod";
import type { OcClient } from "../oc-client.js";
import { findStory } from "../stories.js";
import {
  ENTITY_TYPES,
  filterListedEntities,
  getEntityByMemoryId,
  listAllEntities,
} from "../entities.js";
import { asyncRoute } from "./helpers.js";

const rosterQuerySchema = z.object({
  type: z.enum(ENTITY_TYPES).optional(),
  q: z.string().min(1).optional(),
});

export function registerEntityRoutes(router: Router, oc: OcClient): void {
  router.get(
    "/stories/:storyId/entities",
    asyncRoute(async (req, res) => {
      const { storyId } = req.params as { storyId: string };
      const story = await findStory(oc, storyId);
      if (!story) {
        res.status(404).json({
          error: "story_not_found",
          message: `No story matches "${storyId}".`,
        });
        return;
      }

      const parsedQuery = rosterQuerySchema.safeParse(req.query);
      if (!parsedQuery.success) {
        res.status(400).json({
          error: "invalid_query",
          message: parsedQuery.error.issues
            .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
            .join("; "),
        });
        return;
      }

      const result = await listAllEntities(
        oc,
        story.id,
        story.marker_memory_id,
      );
      const entities = filterListedEntities(result.entities, {
        type: parsedQuery.data.type,
        query: parsedQuery.data.q,
        includeBody: false,
      });
      res.json({
        entities,
        count: entities.length,
        skipped_memory_ids: result.skipped_memory_ids,
      });
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
