// Typed fetch wrapper for the /api routes. Plain fetch, no data-fetching
// library -- three read-only screens with at most two concurrent requests
// each don't justify react-query/SWR. Mirrors the server's own posture of
// small typed wrapper functions (src/oc-client.ts) on the client side.

import type {
  GeneratorCapabilities,
  DeleteEntityResponse,
  EditEntityRequest,
  EntityDetail,
  EntitySummary,
  ContinueRequest,
  ContinueResponse,
  EntityType,
  FlaggedContentSignal,
  RunOutcomeErrorResponse,
  StorySummary,
} from "./types.js";

export type { ContinueResponse };

export type ApiErrorBody = {
  error?: string;
  message?: string;
  /** Present only on a flagged_content (422) body -- see
   * FlaggedContentErrorResponse. */
  signals?: FlaggedContentSignal[];
} & Partial<Omit<RunOutcomeErrorResponse, "error" | "message">>;

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: ApiErrorBody | undefined,
  ) {
    super(body?.message ?? `API error ${status}`);
    this.name = "ApiError";
  }
}

// One fetch wrapper for every verb -- get/post/patch/del all share the
// same error-handling rule (a non-ok response's JSON body, best-effort
// parsed, becomes an ApiError), and that rule has already drifted once
// between get/post before this existed.
async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    ...(body !== undefined && {
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  });
  if (!res.ok) {
    const responseBody = await res.json().catch(() => undefined);
    throw new ApiError(res.status, responseBody);
  }
  return res.json() as Promise<T>;
}

const get = <T>(path: string): Promise<T> => request<T>("GET", path);
const post = <T>(path: string, body: unknown): Promise<T> =>
  request<T>("POST", path, body);
const patch = <T>(path: string, body: unknown): Promise<T> =>
  request<T>("PATCH", path, body);
const del = <T>(path: string): Promise<T> => request<T>("DELETE", path);

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

export function editEntity(
  storyId: string,
  memoryId: string,
  body: EditEntityRequest,
): Promise<{ entity: EntityDetail }> {
  return patch(
    `/stories/${encodeURIComponent(storyId)}/entities/${encodeURIComponent(memoryId)}`,
    body,
  );
}

export function deleteEntity(
  storyId: string,
  memoryId: string,
): Promise<DeleteEntityResponse> {
  return del(
    `/stories/${encodeURIComponent(storyId)}/entities/${encodeURIComponent(memoryId)}`,
  );
}

export function getCapabilities(): Promise<{
  generator: GeneratorCapabilities;
  validator: GeneratorCapabilities;
}> {
  return get("/capabilities");
}

export function continueStory(
  storyId: string,
  body: ContinueRequest,
): Promise<ContinueResponse> {
  return post(`/stories/${encodeURIComponent(storyId)}/continue`, body);
}
