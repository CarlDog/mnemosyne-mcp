// Typed fetch wrapper for the /api routes. Plain fetch, no data-fetching
// library -- three read-only screens with at most two concurrent requests
// each don't justify react-query/SWR. Mirrors the server's own posture of
// small typed wrapper functions (src/oc-client.ts) on the client side.

import type {
  EntityDetail,
  EntitySummary,
  EntityType,
  StorySummary,
} from "./types";

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: { error?: string; message?: string } | undefined,
  ) {
    super(body?.message ?? `API error ${status}`);
    this.name = "ApiError";
  }
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`/api${path}`);
  if (!res.ok) {
    const body = await res.json().catch(() => undefined);
    throw new ApiError(res.status, body);
  }
  return res.json() as Promise<T>;
}

export function listStories(): Promise<{
  stories: StorySummary[];
  count: number;
}> {
  return get("/stories");
}

export function getStory(storyId: string): Promise<{ story: StorySummary }> {
  return get(`/stories/${encodeURIComponent(storyId)}`);
}

export function listEntities(
  storyId: string,
  params: { type?: EntityType; q?: string },
): Promise<{
  entities: EntitySummary[];
  count: number;
  skipped_memory_ids: string[];
}> {
  const search = new URLSearchParams();
  if (params.type) search.set("type", params.type);
  if (params.q) search.set("q", params.q);
  const qs = search.toString();
  return get(
    `/stories/${encodeURIComponent(storyId)}/entities${qs ? `?${qs}` : ""}`,
  );
}

export function getEntity(
  storyId: string,
  memoryId: string,
): Promise<{ entity: EntityDetail }> {
  return get(
    `/stories/${encodeURIComponent(storyId)}/entities/${encodeURIComponent(memoryId)}`,
  );
}
