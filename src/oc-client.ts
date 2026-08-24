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
import { log } from "./log.js";
import { MNEMOSYNE_VERSION } from "./version.js";
import { extractStructuredOrParsed } from "./mcp-result.js";

export interface OcProject {
  id: string;
  name: string;
  created_at?: string;
  metadata?: Record<string, unknown>;
}

export interface OcMemory {
  id: string;
  content: string;
  project_id: string;
  tags: string[];
  pinned: boolean;
  created_at: string;
  updated_at?: string;
  source?: string;
}

// The confirmed shape of project_delete's response ({status:"ok", ...}).
// See the `confirm` note on OcClient.projectDelete for why the preview
// shape ({status:"preview", memory_count}) never reaches a caller here.
export interface OcProjectDeleteResult {
  status: string;
  name?: string;
  deleted_memories?: number;
}

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

  async connect(): Promise<void> {
    if (this.connected) return;
    const transport = new StreamableHTTPClientTransport(this.url);
    await this.client.connect(transport);
    this.connected = true;
    log.info("oc-client", "connected", { url: this.url.toString() });
  }

  async close(): Promise<void> {
    if (!this.connected) return;
    await this.client.close();
    this.connected = false;
  }

  private async callTool<T>(
    name: string,
    args: Record<string, unknown>,
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
      // else parse the text content block). unwrapResult<T> is a separate,
      // OC-specific step that peels FastMCP's {result:[...]} list-wrapping.
      return unwrapResult<T>(extractStructuredOrParsed<unknown>(result, name));
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
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        return this.callTool(name, args, retriesLeft - 1);
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
    return this.callTool<OcProject>("project_create", args);
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
    return this.callTool<OcProjectDeleteResult>("project_delete", {
      project_id: projectId,
      confirm: true,
    });
  }

  async memorySave(opts: OcMemorySaveOptions): Promise<OcMemory> {
    const args: Record<string, unknown> = {
      content: opts.content,
      project_id: opts.projectId,
    };
    if (opts.tags) args.tags = opts.tags;
    if (opts.pinned !== undefined) args.pinned = opts.pinned;
    if (opts.createdAt) args.created_at = opts.createdAt;
    return this.callTool<OcMemory>("memory_save", args);
  }

  async memorySearch(opts: OcMemorySearchOptions): Promise<OcMemory[]> {
    const args: Record<string, unknown> = { query: opts.query };
    if (opts.projectId) args.project_id = opts.projectId;
    if (opts.tags) args.tags = opts.tags;
    if (opts.topK !== undefined) args.top_k = opts.topK;
    return this.callTool<OcMemory[]>("memory_search", args);
  }

  // Complete project enumeration, unlike memorySearch's ranked window.
  // OC's memory_list treats an omitted limit as "no limit" and project_id
  // as a strict filter (its own docs: "Use project_id rather than a limit
  // when you want completeness") — which is the export contract: a story
  // export that silently truncated at a search cap would be quiet data
  // loss.
  async memoryList(opts: { projectId: string }): Promise<OcMemory[]> {
    return this.callTool<OcMemory[]>("memory_list", {
      project_id: opts.projectId,
    });
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
  async memoryGet(memoryId: string): Promise<OcMemory | null> {
    try {
      return await this.callTool<OcMemory>("memory_get", {
        memory_id: memoryId,
      });
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
    return this.callTool<OcMemory>("memory_update", args);
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
