// Shared story-catalog read use case for inbound drivers.

import type { OcClient } from "../oc-client.js";
import { listStories, toStorySummary, type StorySummary } from "../stories.js";

export interface StoryCatalogResult {
  stories: StorySummary[];
  count: number;
}

export async function listStoryCatalog(
  oc: OcClient,
): Promise<StoryCatalogResult> {
  const stories = (await listStories(oc)).map(toStorySummary);
  return { stories, count: stories.length };
}
