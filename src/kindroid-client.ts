// MCP client wrapper around kindroid-mcp. kindroid-mcp is a remote
// Streamable HTTP MCP server (deployed on the NAS) -- Mnemosyne is one of
// its clients, not embedded into it. Mirrors oc-client.ts's shape.
//
// Surfaces only the one tool the KindroidProvider generator path needs.
// Add more as new call sites need them -- three similar lines is better
// than a premature abstraction.

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { log } from "./log.js";
import { MNEMOSYNE_VERSION } from "./version.js";

// Minimal shape of a kindroid_advance_group reply -- only the fields
// formatGroupReplies() in kindroid-provider.ts actually uses. kindroid-mcp's
// own message shape carries more (id, timestamp, image_urls, sender_type);
// add fields here only when a real call site needs them.
export interface KindroidGroupReply {
  /** "ai" or "user". */
  sender: string;
  message: string;
  display_name?: string;
}

export interface AdvanceGroupResult {
  /** AI replies generated this call, oldest-first. */
  replies: KindroidGroupReply[];
  ended: "user_turn" | "max_turns";
  turns: number;
}

export class KindroidClient {
  private client: Client;
  private connected = false;

  constructor(
    private readonly url: URL,
    private readonly authToken?: string,
  ) {
    this.client = new Client(
      { name: "mnemosyne-mcp", version: MNEMOSYNE_VERSION },
      { capabilities: {} },
    );
  }

  async connect(): Promise<void> {
    if (this.connected) return;
    const transport = new StreamableHTTPClientTransport(this.url, {
      requestInit: this.authToken
        ? { headers: { Authorization: `Bearer ${this.authToken}` } }
        : undefined,
    });
    await this.client.connect(transport);
    this.connected = true;
    log.info("kindroid-client", "connected", { url: this.url.toString() });
  }

  async close(): Promise<void> {
    if (!this.connected) return;
    await this.client.close();
    this.connected = false;
  }

  /** Send a message to a Kindroid AI and return its plain-text reply.
   * `aiId` accepts a raw ai_id or a kindroid-mcp registered friendly name --
   * kindroid_send_message resolves the name server-side. */
  async sendMessage(aiId: string, message: string): Promise<string> {
    await this.connect();
    const start = Date.now();
    try {
      const result = await this.client.callTool({
        name: "kindroid_send_message",
        arguments: { ai_id: aiId, message },
      });
      const content = (result.content ?? []) as Array<{
        type: string;
        text?: string;
      }>;
      const textBlock = content.find((c) => c.type === "text" && c.text);
      if (!textBlock?.text) {
        throw new Error("kindroid_send_message returned no text content");
      }
      log.debug("kindroid-client", "tool ok", {
        tool: "kindroid_send_message",
        ms: Date.now() - start,
      });
      return textBlock.text;
    } catch (err) {
      log.error("kindroid-client", "tool error", {
        tool: "kindroid_send_message",
        ms: Date.now() - start,
        msg: (err as Error).message,
      });
      throw err;
    }
  }

  /** Drive a group chat's turn loop via kindroid_advance_group and return
   * the AI replies generated. `groupId` accepts a raw group_id or a
   * kindroid-mcp registered friendly name, same as `sendMessage`'s `aiId`. */
  async advanceGroup(
    groupId: string,
    message: string,
    opts?: { maxTurns?: number; allowUser?: boolean },
  ): Promise<AdvanceGroupResult> {
    await this.connect();
    const start = Date.now();
    const args: Record<string, unknown> = { group_id: groupId, message };
    if (opts?.maxTurns !== undefined) args.max_turns = opts.maxTurns;
    if (opts?.allowUser !== undefined) args.allow_user = opts.allowUser;
    try {
      const result = await this.client.callTool({
        name: "kindroid_advance_group",
        arguments: args,
      });

      // Prefer structuredContent (MCP spec >= 2024-11): raw JSON, not
      // stringified. Falls back to parsing the text content block.
      const structured = (result as { structuredContent?: unknown })
        .structuredContent;
      let parsed: unknown;
      if (structured !== undefined) {
        parsed = structured;
      } else {
        const content = (result.content ?? []) as Array<{
          type: string;
          text?: string;
        }>;
        const textBlock = content.find((c) => c.type === "text" && c.text);
        if (!textBlock?.text) {
          throw new Error("kindroid_advance_group returned no content");
        }
        parsed = JSON.parse(textBlock.text);
      }

      log.debug("kindroid-client", "tool ok", {
        tool: "kindroid_advance_group",
        ms: Date.now() - start,
      });
      return parsed as AdvanceGroupResult;
    } catch (err) {
      log.error("kindroid-client", "tool error", {
        tool: "kindroid_advance_group",
        ms: Date.now() - start,
        msg: (err as Error).message,
      });
      throw err;
    }
  }
}
