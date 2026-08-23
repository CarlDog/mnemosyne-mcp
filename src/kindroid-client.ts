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
import { extractText, extractStructuredOrParsed } from "./mcp-result.js";

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
  /** Set by kindroid-mcp when the turns ran but reading them back failed.
   * `replies` is empty while `turns` is not -- the generations DID happen
   * upstream, so this is never a retry signal. */
  read_back_error?: string;
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
      const text = extractText(result, "kindroid_send_message");
      log.debug("kindroid-client", "tool ok", {
        tool: "kindroid_send_message",
        ms: Date.now() - start,
      });
      return text;
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

      const parsed = extractStructuredOrParsed<AdvanceGroupResult>(
        result,
        "kindroid_advance_group",
      );

      log.debug("kindroid-client", "tool ok", {
        tool: "kindroid_advance_group",
        ms: Date.now() - start,
      });
      return parsed;
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
