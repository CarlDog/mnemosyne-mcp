// MCP client wrapper around OpenChronicle (OC). OC v3 is a remote HTTP MCP
// server — Mnemosyne is one of its clients, not embedded into it.
//
// Surfaces only the OC tools Mnemosyne actually uses. We add wrappers as
// new phases need them — three similar lines is better than a premature
// abstraction. Phase A: project_create, project_list, memory_save,
// memory_search. Phase B adds: memory_update, memory_pin.

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { log } from "./log.js";

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

export interface OcMemorySaveOptions {
  content: string;
  projectId: string;
  tags?: string[];
  pinned?: boolean;
}

export interface OcMemorySearchOptions {
  query: string;
  projectId?: string;
  tags?: string[];
  topK?: number;
}

const MAX_RATE_LIMIT_RETRIES = 2;
const RATE_LIMIT_BACKOFF_MS = 1000;

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
      { name: "mnemosyne-mcp", version: "0.0.1" },
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

      // Prefer structuredContent when present (MCP spec >= 2024-11): it's the
      // raw JSON value, not stringified, and not subject to FastMCP's text
      // wrapping convention.
      const structured = (result as { structuredContent?: unknown })
        .structuredContent;
      if (structured !== undefined) {
        return unwrapResult<T>(structured);
      }

      const content = (result.content ?? []) as Array<{
        type: string;
        text?: string;
      }>;
      const textBlock = content.find((c) => c.type === "text" && c.text);
      if (!textBlock?.text) {
        throw new Error(`OC tool ${name} returned no text content`);
      }
      return unwrapResult<T>(JSON.parse(textBlock.text));
    } catch (err) {
      const msg = (err as Error).message;
      // OC v3 has a per-window rate limiter that legitimate burst usage
      // (e.g., gatherContext's 7 sequential reads, or several tests running
      // back-to-back) can trip. Linear backoff: 1s, then 2s. Total worst
      // case: ~3s of waiting before giving up.
      if (retriesLeft > 0 && /rate limit/i.test(msg)) {
        const attempt = MAX_RATE_LIMIT_RETRIES - retriesLeft + 1;
        const delayMs = attempt * RATE_LIMIT_BACKOFF_MS;
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

  async projectList(): Promise<OcProject[]> {
    return this.callTool<OcProject[]>("project_list", {});
  }

  async projectCreate(
    name: string,
    metadata?: Record<string, unknown>,
  ): Promise<OcProject> {
    const args: Record<string, unknown> = { name };
    if (metadata) args.metadata = metadata;
    return this.callTool<OcProject>("project_create", args);
  }

  async memorySave(opts: OcMemorySaveOptions): Promise<OcMemory> {
    const args: Record<string, unknown> = {
      content: opts.content,
      project_id: opts.projectId,
    };
    if (opts.tags) args.tags = opts.tags;
    if (opts.pinned !== undefined) args.pinned = opts.pinned;
    return this.callTool<OcMemory>("memory_save", args);
  }

  async memorySearch(opts: OcMemorySearchOptions): Promise<OcMemory[]> {
    const args: Record<string, unknown> = { query: opts.query };
    if (opts.projectId) args.project_id = opts.projectId;
    if (opts.tags) args.tags = opts.tags;
    if (opts.topK !== undefined) args.top_k = opts.topK;
    return this.callTool<OcMemory[]>("memory_search", args);
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
}
