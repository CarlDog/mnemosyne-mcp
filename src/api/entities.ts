// Entity routes for the web UI's entity library (WEBUI_NOTES §9 slice 1):
// GET /stories/:storyId/entities (roster, filterable/searchable),
// GET /stories/:storyId/entities/:memoryId (single entity, full body),
// PATCH /stories/:storyId/entities/:memoryId (edit body/pinned/tags),
// DELETE /stories/:storyId/entities/:memoryId.
//
// The two GET routes are thin JSON adapters over the same application read
// use case as mnemo_list_entities. PATCH/DELETE call saveEntity/
// deleteEntityByMemoryId in src/entities.ts directly -- no application-layer
// write use case exists yet, and the single-entity GET route already sets
// this precedent (getEntityByMemoryId, also called directly).
// includeBody is hard-false on the roster route -- never exposed as a
// query param here -- matching filterListedEntities' own stated intent
// that a browse response should stay light, not a content dump.

import type { Router } from "express";
import { z } from "zod";
import type { OcClient } from "../oc-client.js";
import type { ListEntityCatalog } from "../application/list-entities.js";
import {
  ENTITY_TYPES,
  FlaggedContentError,
  deleteEntityByMemoryId,
  getEntityByMemoryId,
  saveEntity,
} from "../entities.js";
import { asyncRoute, parseOr400, requireStory } from "./helpers.js";

const rosterQuerySchema = z.object({
  type: z.enum(ENTITY_TYPES).optional(),
  q: z.string().min(1).optional(),
});

// Every field optional: this is a partial update (PATCH, not PUT). A field
// the caller omits is echoed back from the existing entity, never blanked
// -- see the route below, and api-integration.md's "PUT is a full replace"
// lesson applied here even though the verb is PATCH: saveEntity itself has
// no partial-merge concept (it always rebuilds the full tag set from
// extraTags), so the route is what has to supply "unchanged" values.
const editBodySchema = z.object({
  body: z.string().min(1).optional(),
  pinned: z.boolean().optional(),
  extra_tags: z.array(z.string()).optional(),
  override_flagged_content: z.boolean().optional(),
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

  router.patch(
    "/stories/:storyId/entities/:memoryId",
    asyncRoute(async (req, res) => {
      const { storyId, memoryId } = req.params as {
        storyId: string;
        memoryId: string;
      };
      const existing = await getEntityByMemoryId(oc, storyId, memoryId);
      if (!existing) {
        res.status(404).json({
          error: "entity_not_found",
          message: `No entity "${memoryId}" in story "${storyId}".`,
        });
        return;
      }

      const edit = parseOr400(editBodySchema, req.body, res);
      if (!edit) return;

      // Echo every field the caller didn't touch back from the existing
      // record. saveEntity rebuilds the FULL tag set from extraTags on
      // every call (it has no partial-merge concept), so omitting this
      // would silently drop any custom tag not covered by its own
      // validation:* preservation.
      const existingExtraTags = existing.tags.filter(
        (tag) =>
          !["mnemosyne", "story", existing.type].includes(tag) &&
          !tag.startsWith("validation:"),
      );

      try {
        await saveEntity(oc, storyId, {
          type: existing.type,
          name: existing.name,
          body: edit.body ?? existing.body,
          pinned: edit.pinned ?? existing.pinned,
          extraTags: edit.extra_tags ?? existingExtraTags,
          allowFlagged: edit.override_flagged_content,
          existing: {
            memoryId,
            tags: existing.tags,
            pinned: existing.pinned,
          },
        });
      } catch (err) {
        if (err instanceof FlaggedContentError) {
          res.status(422).json({
            error: "flagged_content",
            message: err.message,
            signals: err.signals.map((s) => ({
              label: s.label,
              excerpt: s.excerpt,
            })),
          });
          return;
        }
        throw err;
      }

      // Re-fetch rather than hand-assemble the response from
      // SaveEntityResult: that type carries no created_at/updated_at (OC's
      // job, not saveEntity's), so the accurate post-write state is
      // whatever a fresh read reports -- exactly what GET would show.
      const refreshed = await getEntityByMemoryId(oc, storyId, memoryId);
      if (!refreshed) {
        throw new Error(
          `Entity "${memoryId}" vanished immediately after a successful write -- this should be unreachable.`,
        );
      }
      res.json({ entity: refreshed });
    }),
  );

  router.delete(
    "/stories/:storyId/entities/:memoryId",
    asyncRoute(async (req, res) => {
      const { storyId, memoryId } = req.params as {
        storyId: string;
        memoryId: string;
      };
      const deleted = await deleteEntityByMemoryId(oc, storyId, memoryId);
      if (!deleted) {
        res.status(404).json({
          error: "entity_not_found",
          message: `No entity "${memoryId}" in story "${storyId}".`,
        });
        return;
      }
      res.json({ ...deleted, deleted: true });
    }),
  );
}
