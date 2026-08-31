// Story routes for the web UI: GET /stories, GET /stories/:storyId.
// Thin JSON adapters over shared application use cases and domain lookups.

import type { Router } from "express";
import type { OcClient } from "../oc-client.js";
import { listStoryCatalog } from "../application/list-stories.js";
import { toStorySummary } from "../stories.js";
import { asyncRoute, requireStory } from "./helpers.js";

export function registerStoryRoutes(router: Router, oc: OcClient): void {
  router.get(
    "/stories",
    asyncRoute(async (_req, res) => {
      res.json(await listStoryCatalog(oc));
    }),
  );

  router.get(
    "/stories/:storyId",
    asyncRoute(async (req, res) => {
      const { storyId } = req.params as { storyId: string };
      const story = await requireStory(oc, storyId, res);
      if (!story) return;
      res.json({ story: toStorySummary(story) });
    }),
  );
}
