// Story routes for the web UI: GET /stories, GET /stories/:storyId.
// Thin JSON adapters over the same domain functions mnemo_story_list /
// mnemo_story_use already wrap (src/tools/stories.ts) -- see
// docs/ARCHITECTURE.md's "thin adapters over the same core" rule.

import type { Router } from "express";
import type { OcClient } from "../oc-client.js";
import { listStories, toStorySummary } from "../stories.js";
import { asyncRoute, requireStory } from "./helpers.js";

export function registerStoryRoutes(router: Router, oc: OcClient): void {
  router.get(
    "/stories",
    asyncRoute(async (_req, res) => {
      const stories = await listStories(oc);
      const summaries = stories.map(toStorySummary);
      res.json({ stories: summaries, count: summaries.length });
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
