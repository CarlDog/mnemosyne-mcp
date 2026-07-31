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

export class KindroidClient {
  private client: Client;
  private connected = false;

  constructor(
    private readonly url: URL,
    private readonly authToken?: string,
  ) {
    this.client = new Client(
      { name: "mnemosyne-mcp", version: "0.1.2" },
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
}
