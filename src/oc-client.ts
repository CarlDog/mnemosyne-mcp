// MCP client wrapper around OpenChronicle (OC). OC v3 is a remote HTTP MCP
// server — Mnemosyne is one of its clients, not embedded into it.
//
// Surfaces only the OC tools Mnemosyne actually uses. We add wrappers as
// new phases need them — three similar lines is better than a premature
// abstraction. Phase A: project_create, memory_save, memory_search.
// Phase B adds: memory_update, memory_pin. memory_list arrived with
// mnemo_export_story (complete-enumeration semantics that memory_search's
// ranked window can't provide). project_delete exists for the
// integration suite's teardown (no product tool deletes a story — that
// stays a deliberate OC-side action).

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { z } from "zod";
import { log } from "./log.js";
import { MNEMOSYNE_VERSION } from "./version.js";
import { extractStructuredOrParsed } from "./mcp-result.js";
import { verifyRequiredTools } from "./mcp-discovery.js";
import { RunOutcomeError } from "./run-outcome.js";

/** Backoff sleep that rejects promptly when the run aborts -- a caller
 * disconnect or shutdown must not sit out up to 31s of retry sleeps
 * (RUN_OUTCOMES_DESIGN slice 3). */
function sleepUnlessAborted(
  delayMs: number,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      reject(
        new RunOutcomeError(
          "rejected_before_dispatch",
          "run aborted during OpenChronicle rate-limit backoff; the pending " +
            "call was never dispatched -- safe to retry",
        ),
      );
    };
    if (signal?.aborted) return abort();
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", abort);
      resolve();
    }, delayMs);
    signal?.addEventListener("abort", abort, { once: true });
  });
}

// Runtime result schemas (docs/NEMOCLAW_ADOPTION_ASSESSMENT.md §2): these
// were compile-time interfaces cast at a network boundary, so an OC schema
// change entered story logic before failing. Optional fields are .nullish()
// -- OC is Python, and a None serializes as null, which a bare .optional()
// would reject. Unknown extra fields are tolerated (zod strips them):
// sibling services evolve additively, and rejecting a new field would turn
// every upstream release into an outage.
const OcProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  created_at: z.string().nullish(),
  metadata: z.record(z.unknown()).nullish(),
});
export type OcProject = z.infer<typeof OcProjectSchema>;

const OcMemorySchema = z.object({
  id: z.string(),
  content: z.string(),
  project_id: z.string(),
  tags: z.array(z.string()),
  pinned: z.boolean(),
  created_at: z.string(),
  updated_at: z.string().nullish(),
  source: z.string().nullish(),
});
export type OcMemory = z.infer<typeof OcMemorySchema>;

/** memory_search rows additionally carry ranking metadata. Captured live
 * per mode (2026-08-28): hybrid {channel, rrf_score, semantic_similarity},
 * keyword {channel, keyword_rank}, semantic {channel, semantic_similarity}
 * -- an OBJECT, not a bare score, with rrf_score present ONLY in hybrid
 * mode, and pinned-floated rows omitting relevance entirely. Search gets
 * its own extended schema; memory_get/list/save/update results never carry
 * relevance and keep the base schema. */
const OcSearchRelevanceSchema = z.object({
  channel: z.string().nullish(),
  rrf_score: z.number().nullish(),
  semantic_similarity: z.number().nullish(),
  keyword_rank: z.number().nullish(),
});
const OcMemorySearchResultSchema = OcMemorySchema.extend({
  relevance: OcSearchRelevanceSchema.nullish(),
});
export type OcMemorySearchResult = z.infer<typeof OcMemorySearchResultSchema>;

/** memory_list's compact:true row shape — content swapped for a preview.
 * Field names verified against a live OC response (2026-08-27). */
const OcMemoryCompactSchema = z.object({
  id: z.string(),
  content_preview: z.string(),
  content_length: z.number(),
  project_id: z.string(),
  tags: z.array(z.string()),
  pinned: z.boolean(),
  created_at: z.string(),
  updated_at: z.string().nullish(),
  source: z.string().nullish(),
});
export type OcMemoryCompact = z.infer<typeof OcMemoryCompactSchema>;

// The confirmed shape of project_delete's response ({status:"ok", ...}).
// See the `confirm` note on OcClient.projectDelete for why the preview
// shape ({status:"preview", memory_count}) never reaches a caller here.
const OcProjectDeleteResultSchema = z.object({
  status: z.string(),
  name: z.string().nullish(),
  deleted_memories: z.number().nullish(),
});
export type OcProjectDeleteResult = z.infer<typeof OcProjectDeleteResultSchema>;

/** Every OC tool this client calls. Verified as advertised (bounded,
 * name-only tools/list -- zero tools/call) at connect(), which index.ts
 * awaits at startup: a deployed OC missing part of this contract fails
 * startup instead of surfacing as a confusing mid-story error. */
export const OC_REQUIRED_TOOLS = [
  "project_create",
  "project_delete",
  "memory_save",
  "memory_search",
  "memory_list",
  "memory_get",
  "memory_update",
  "memory_pin",
  "memory_delete",
] as const;

export interface OcMemorySaveOptions {
  content: string;
  projectId: string;
  tags?: string[];
  pinned?: boolean;
  /** ISO datetime to backdate the memory (OC supports this natively —
   * "created_at: ISO datetime to backdate (e.g. for git-onboard
   * imports)"). Used by mnemo_import_story to restore original entity
   * timestamps on round-trip. */
  createdAt?: string;
}

export interface OcMemorySearchOptions {
  query: string;
  projectId?: string;
  tags?: string[];
  topK?: number;
  /** Search channel. Default (omitted) is OC's hybrid FTS+semantic RRF. */
  mode?: "hybrid" | "keyword" | "semantic";
  /** Exact-phrase matching on the query. */
  phrase?: boolean;
  /** Caps the pinned FLOAT (how many pinned rows are lifted ahead of the
   * ranked results). Zero disables the float; pinned rows still rank
   * normally. An RRF score is not a probability. */
  pinnedLimit?: number;
  /** Optional run-abort signal: aborts the rate-limit backoff sleep
   * promptly (RUN_OUTCOMES_DESIGN slice 3). Never interrupts an in-flight
   * request. */
  signal?: AbortSignal;
}

// OC v3's rate limit is 120 RPM per client IP (configurable via
// OC_API_RATE_LIMIT_RPM on the OC side). Burst usage from legitimate
// flows like gatherContext + a test suite running back-to-back saturates
// the window. Exponential backoff: 1s, 2s, 4s, 8s, 16s (~31s total
// max). The window itself is 60s, so 31s of backoff usually clears it.
const MAX_RATE_LIMIT_RETRIES = 5;
const RATE_LIMIT_BASE_BACKOFF_MS = 1000;

// FastMCP wraps list-returning tools as { result: [...] } in their text
// content payload, while dict-returning tools land unwrapped. Strip the
// single-key "result" wrapper transparently so callers see the natural type.
// Conservative: only unwrap when the inner value is an array, so we don't
// accidentally peel a legitimate single-key dict.
function unwrapResult<T>(value: unknown): T {
  if (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value as object).length === 1 &&
    "result" in (value as object) &&
    Array.isArray((value as { result: unknown }).result)
  ) {
    return (value as { result: T }).result;
  }
  return value as T;
}

export class OcClient {
  private client: Client;
  private connected = false;

  constructor(private readonly url: URL) {
    this.client = new Client(
      { name: "mnemosyne-mcp", version: MNEMOSYNE_VERSION },
      { capabilities: {} },
    );
  }

  /** Single-flight (RUN_OUTCOMES_DESIGN slice 3): concurrent first calls
   * share one connection attempt instead of racing the SDK. A failed
   * attempt clears the latch so the next call retries. */
  private connecting?: Promise<void>;

  async connect(): Promise<void> {
    if (this.connected) return;
    if (this.connecting) return this.connecting;
    this.connecting = this.doConnect().finally(() => {
      this.connecting = undefined;
    });
    return this.connecting;
  }

  private async doConnect(): Promise<void> {
    if (this.connected) return;
    const transport = new StreamableHTTPClientTransport(this.url);
    await this.client.connect(transport);
    await verifyRequiredTools(this.client, "OpenChronicle", OC_REQUIRED_TOOLS);
    this.connected = true;
    log.info("oc-client", "connected", { url: this.url.toString() });
  }

  async close(): Promise<void> {
    if (!this.connected) return;
    await this.client.close();
    this.connected = false;
  }

  /** Non-mutating readiness probe: a fresh bounded tools/list round-trip
   * proving OC is still reachable AND still advertises the required
   * contract -- the startup check does not prove continued availability
   * (docs/NEMOCLAW_ADOPTION_ASSESSMENT.md §3). */
  async checkReady(): Promise<void> {
    await this.connect();
    await verifyRequiredTools(this.client, "OpenChronicle", OC_REQUIRED_TOOLS);
  }

  private async callTool<T>(
    name: string,
    args: Record<string, unknown>,
    schema?: z.ZodType<T>,
    signal?: AbortSignal,
    retriesLeft = MAX_RATE_LIMIT_RETRIES,
  ): Promise<T> {
    const start = Date.now();
    try {
      const result = await this.client.callTool({ name, arguments: args });
      log.debug("oc-client", "tool ok", {
        tool: name,
        ms: Date.now() - start,
      });

      // extractStructuredOrParsed handles the "how do I get the raw parsed
      // value out of the MCP result" step (structuredContent when present,
      // else parse the text content block). unwrapResult is a separate,
      // OC-specific step that peels FastMCP's {result:[...]} list-wrapping
      // -- it runs BEFORE schema validation so the schema describes the
      // natural value, not FastMCP's envelope.
      const raw = unwrapResult<unknown>(
        extractStructuredOrParsed<unknown>(result, name),
      );
      if (schema === undefined) return raw as T;
      const parsed = schema.safeParse(raw);
      if (!parsed.success) {
        const detail = parsed.error.issues
          .slice(0, 3)
          .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
          .join("; ");
        throw new Error(
          `OpenChronicle ${name} returned a result that does not match its ` +
            `expected contract (${detail}) -- the deployed OC version may ` +
            "have changed its schema",
        );
      }
      return parsed.data;
    } catch (err) {
      const msg = (err as Error).message;
      if (retriesLeft > 0 && /rate limit/i.test(msg)) {
        const attempt = MAX_RATE_LIMIT_RETRIES - retriesLeft + 1;
        const delayMs = RATE_LIMIT_BASE_BACKOFF_MS * 2 ** (attempt - 1);
        log.warn("oc-client", "rate limited; backing off", {
          tool: name,
          attempt,
          delay_ms: delayMs,
        });
        // Retrying is safe for EVERY tool here -- including mutating ones
        // -- only because OC's rate limiting rejects the request BEFORE
        // handler dispatch (verified in the pinned OC source: the
        // middleware runs ahead of the tool handler). If OC ever rate
        // limits mid-handler, this retry becomes a duplicate-write hazard.
        await sleepUnlessAborted(delayMs, signal);
        return this.callTool(name, args, schema, signal, retriesLeft - 1);
      }
      log.error("oc-client", "tool error", {
        tool: name,
        ms: Date.now() - start,
        msg,
      });
      throw err;
    }
  }

  async projectCreate(
    name: string,
    metadata?: Record<string, unknown>,
  ): Promise<OcProject> {
    const args: Record<string, unknown> = { name };
    if (metadata) args.metadata = metadata;
    return this.callTool("project_create", args, OcProjectSchema);
  }

  // Hard delete — the project and every memory in it. No soft-delete, no
  // recovery path on the OC side.
  //
  // OC's delete tools take a `confirm` flag defaulting to false, which
  // returns a preview instead of deleting. That two-step is a guard for a
  // human at a prompt; a programmatic caller that reached this method has
  // already decided. So `confirm: true` is passed here rather than exposed
  // as a parameter no caller would ever set to false. (Omitting it is what
  // silently no-op'd memoryDelete below.)
  async projectDelete(projectId: string): Promise<OcProjectDeleteResult> {
    return this.callTool(
      "project_delete",
      { project_id: projectId, confirm: true },
      OcProjectDeleteResultSchema,
    );
  }

  async memorySave(opts: OcMemorySaveOptions): Promise<OcMemory> {
    const args: Record<string, unknown> = {
      content: opts.content,
      project_id: opts.projectId,
    };
    if (opts.tags) args.tags = opts.tags;
    if (opts.pinned !== undefined) args.pinned = opts.pinned;
    if (opts.createdAt) args.created_at = opts.createdAt;
    return this.callTool("memory_save", args, OcMemorySchema);
  }

  async memorySearch(
    opts: OcMemorySearchOptions,
  ): Promise<OcMemorySearchResult[]> {
    const args: Record<string, unknown> = { query: opts.query };
    if (opts.projectId) args.project_id = opts.projectId;
    if (opts.tags) args.tags = opts.tags;
    if (opts.topK !== undefined) args.top_k = opts.topK;
    if (opts.mode !== undefined) args.mode = opts.mode;
    if (opts.phrase !== undefined) args.phrase = opts.phrase;
    if (opts.pinnedLimit !== undefined) args.pinned_limit = opts.pinnedLimit;
    return this.callTool(
      "memory_search",
      args,
      z.array(OcMemorySearchResultSchema),
      opts.signal,
    );
  }

  // Complete project enumeration, unlike memorySearch's ranked window.
  // OC's memory_list treats an omitted limit as "no limit" and project_id
  // as a strict filter (its own docs: "Use project_id rather than a limit
  // when you want completeness") — which is the export contract: a story
  // export that silently truncated at a search cap would be quiet data
  // loss.
  async memoryList(opts: {
    projectId: string;
    signal?: AbortSignal;
  }): Promise<OcMemory[]> {
    return this.callTool(
      "memory_list",
      { project_id: opts.projectId },
      z.array(OcMemorySchema),
      opts.signal,
    );
  }

  // Complete project enumeration in OC's compact form: content_preview +
  // content_length instead of full content (verified against a live
  // response 2026-08-27 — id/tags/pinned/created_at all present). The
  // cheap scan half of a scan-then-hydrate pull: callers that need only
  // tags/recency to pick winners fetch this, then memoryGet the few
  // rows they actually keep, instead of transferring every entity body
  // in the project. Note memory_list floats pinned rows above the
  // recency order, so a caller wanting strict recency must sort by
  // created_at itself (and must NOT pass a limit here — pinned rows
  // would consume the window).
  async memoryListCompact(opts: {
    projectId: string;
    signal?: AbortSignal;
  }): Promise<OcMemoryCompact[]> {
    return this.callTool(
      "memory_list",
      { project_id: opts.projectId, compact: true },
      z.array(OcMemoryCompactSchema),
      opts.signal,
    );
  }

  // Fetch one memory by id (unscoped by project -- callers that need a
  // per-story guarantee must check `project_id` on the result themselves;
  // see getEntityByMemoryId in entities.ts). Returns null on OC's own
  // NotFoundError rather than throwing -- "no such memory" is an expected,
  // routine outcome for a caller resolving a URL/query param, not an
  // exceptional one.
  //
  // The exact wrapped message was verified live against real OC (not
  // assumed from reading OC's source): OC's NotFoundError raises
  // "Memory not found: <id>", but FastMCP wraps that in its own
  // "Error executing tool memory_get: <message>" envelope before
  // extractText's "memory_get failed: <text>" wrapping is applied here --
  // so the actual thrown message is
  // "memory_get failed: Error executing tool memory_get: Memory not
  // found: <id>". Match on "Memory not found: " as a substring rather
  // than hardcoding the full wrapper chain, since that's the one part of
  // the message OC itself controls and guarantees.
  async memoryGet(
    memoryId: string,
    signal?: AbortSignal,
  ): Promise<OcMemory | null> {
    try {
      return await this.callTool(
        "memory_get",
        { memory_id: memoryId },
        OcMemorySchema,
        signal,
      );
    } catch (err) {
      if (/Memory not found: /.test((err as Error).message)) {
        return null;
      }
      throw err;
    }
  }

  async memoryUpdate(opts: {
    memoryId: string;
    content?: string;
    tags?: string[];
  }): Promise<OcMemory> {
    const args: Record<string, unknown> = { memory_id: opts.memoryId };
    if (opts.content !== undefined) args.content = opts.content;
    if (opts.tags !== undefined) args.tags = opts.tags;
    return this.callTool("memory_update", args, OcMemorySchema);
  }

  async memoryPin(memoryId: string, pinned = true): Promise<void> {
    await this.callTool("memory_pin", { memory_id: memoryId, pinned });
  }

  // `confirm: true` for the same reason as projectDelete. Without it OC
  // returns a preview and keeps the memory, which made mnemo_delete_entity
  // report success while deleting nothing.
  async memoryDelete(memoryId: string): Promise<void> {
    await this.callTool("memory_delete", {
      memory_id: memoryId,
      confirm: true,
    });
  }
}
