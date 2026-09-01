// Shared story-catalog read use case for inbound drivers.

import { toStorySummary, type StorySummary } from "../stories.js";
import type { StoryCatalogPort } from "./ports/catalog.js";

export interface StoryCatalogResult {
  stories: StorySummary[];
  count: number;
}

export async function listStoryCatalog(
  catalog: StoryCatalogPort,
): Promise<StoryCatalogResult> {
  const stories = (await catalog.listStories()).map(toStorySummary);
  return { stories, count: stories.length };
}

export type ListStoryCatalog = () => Promise<StoryCatalogResult>;

export function createListStoryCatalog(
  catalog: StoryCatalogPort,
): ListStoryCatalog {
  return () => listStoryCatalog(catalog);
}
