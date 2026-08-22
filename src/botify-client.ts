// MCP client wrapper around botify-mcp. botify-mcp is a remote Streamable
// HTTP MCP server (deployed on the NAS) -- Mnemosyne is one of its
// clients, not embedded into it. Mirrors kindroid-client.ts's shape.
//
// Surfaces only the one tool the BotifyProvider generator path needs.
// Add more as new call sites need them -- three similar lines is better
// than a premature abstraction.

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { log } from "./log.js";
import { MNEMOSYNE_VERSION } from "./version.js";
import { extractStructuredOrParsed } from "./mcp-result.js";

// Minimal shape of botify-mcp's send_message result -- only the fields
// extractBotReply() actually uses. botify-mcp's own Message type carries
// more (id, type, senderId, createdAt); add fields here only when a real
// call site needs them. Verified against botify-mcp source
// (src/botify.ts: SendMessageResult / Message).
export interface BotifySendMessageResult {
  bot_message?: { text?: string } | null;
  /** Set by botify-mcp when the user message persisted but the bot-reply
   * inference step failed -- the message DID land in the chat. */
  trigger_warning?: string;
}

/** Pull the bot's reply text out of a send_message result, or throw with
 * the most actionable message available. Pure -- unit-testable without a
 * live client. botify-mcp only generates a reply inline when its
 * BOTIFY_APP_TOKEN is configured server-side; without it the user message
 * persists but no bot_message comes back, which for a generator is a
 * failure (there is no story beat), not a partial success. */
export function extractBotReply(result: BotifySendMessageResult): string {
  const text = result.bot_message?.text;
  if (text) return text;
  if (result.trigger_warning) {
    throw new Error(
      `Botify accepted the message but reply generation failed: ${result.trigger_warning}. ` +
        "The direction WAS posted to the chat -- do not blindly retry, that would double-post.",
    );
  }
  // null-vs-undefined is load-bearing (verified against botify-mcp
  // source): bot_message === null means the inference call RAN (the app
  // token is fine) but the response carried no text; the key being
  // absent entirely means botify-mcp never attempted inference, which
  // is what a missing server-side BOTIFY_APP_TOKEN looks like. Blaming
  // the token in the null case sends the operator chasing config that
  // is correct.
  if (result.bot_message !== undefined) {
    throw new Error(
      "Botify ran reply generation but produced no text. The direction WAS " +
        "posted to the chat -- do not blindly retry, that would double-post.",
    );
  }
  throw new Error(
    "Botify returned no bot reply and never attempted inference. botify-mcp " +
      "only generates replies inline when its BOTIFY_APP_TOKEN is configured " +
      "on that server -- check its deployment config. The direction WAS " +
      "posted to the chat.",
  );
}

export class BotifyClient {
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
    log.info("botify-client", "connected", { url: this.url.toString() });
  }

  async close(): Promise<void> {
    if (!this.connected) return;
    await this.client.close();
    this.connected = false;
  }

  /** Post a message to a Botify chat and return the bot's reply text.
   * `chatId` is a Botify chat UUID (an existing chat thread with the
   * bot -- from botify-mcp's list_chats). */
  async sendMessage(chatId: string, text: string): Promise<string> {
    await this.connect();
    const start = Date.now();
    try {
      const result = await this.client.callTool({
        name: "send_message",
        arguments: { chat_id: chatId, text },
      });
      const parsed = extractStructuredOrParsed<BotifySendMessageResult>(
        result,
        "send_message",
      );
      const reply = extractBotReply(parsed);
      log.debug("botify-client", "tool ok", {
        tool: "send_message",
        ms: Date.now() - start,
      });
      return reply;
    } catch (err) {
      log.error("botify-client", "tool error", {
        tool: "send_message",
        ms: Date.now() - start,
        msg: (err as Error).message,
      });
      throw err;
    }
  }
}
