// MCP client wrapper around kindroid-mcp. kindroid-mcp is a remote
// Streamable HTTP MCP server (deployed on the NAS) -- Mnemosyne is one of
// its clients, not embedded into it. Mirrors oc-client.ts's shape.
//
// Surfaces only the one tool the KindroidProvider generator path needs.
// Add more as new call sites need them -- three similar lines is better
// than a premature abstraction.

import { randomUUID } from "node:crypto";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { log } from "./log.js";
import { describeServiceUrl } from "./service-url.js";
import { RunOutcomeError } from "./run-outcome.js";
import { MNEMOSYNE_VERSION } from "./version.js";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { extractText, extractStructuredOrParsed } from "./mcp-result.js";
import { verifyRequiredTools } from "./mcp-discovery.js";

// Minimal shape of a kindroid_advance_group reply -- only the fields
// formatGroupReplies() in kindroid-provider.ts actually uses. kindroid-mcp's
// own message shape carries more (id, timestamp, image_urls, sender_type);
// add fields here only when a real call site needs them. Runtime schemas
// per docs/NEMOCLAW_ADOPTION_ASSESSMENT.md §2 -- this was a compile-time
// cast at a network boundary. Extra fields are tolerated (additive upstream
// evolution); optional fields are .nullish().
const KindroidGroupReplySchema = z.object({
  /** "ai" or "user". */
  sender: z.string(),
  message: z.string(),
  display_name: z.string().nullish(),
});
export type KindroidGroupReply = z.infer<typeof KindroidGroupReplySchema>;

const AdvanceGroupResultSchema = z.object({
  /** AI replies generated this call, oldest-first. */
  replies: z.array(KindroidGroupReplySchema),
  ended: z.enum(["user_turn", "max_turns"]),
  turns: z.number(),
  /** Set by kindroid-mcp when the turns ran but reading them back failed.
   * `replies` is empty while `turns` is not -- the generations DID happen
   * upstream, so this is never a retry signal. */
  read_back_error: z.string().nullish(),
});
export type AdvanceGroupResult = z.infer<typeof AdvanceGroupResultSchema>;

/** Every kindroid-mcp tool this client calls. Verified (bounded, name-only
 * tools/list) at connect(), which runs lazily before the FIRST mutating
 * call -- so a renamed upstream tool fails before a direction is ever
 * posted to a real conversation, and a contract mismatch surfaces as
 * "provider unavailable" while OC-backed story browsing keeps working. */
export const KINDROID_REQUIRED_TOOLS = [
  "kindroid_send_message",
  "kindroid_advance_group",
  "kindroid_chat_break",
] as const;

/**
 * Default per-request timeout for kindroid-mcp calls, overridable with
 * KINDROID_MCP_TIMEOUT_MS.
 *
 * Deliberately well above the MCP SDK's own 60s default. A group beat chains
 * maxTurns SEQUENTIAL model generations before returning, live-measured at
 * ~13s each, so the documented ceiling of 8 turns needs ~105s of generation
 * alone. Erring long is the safe direction here specifically because a
 * mid-flight timeout does not mean "nothing happened" (see callMutatingTool)
 * -- a too-short timeout manufactures exactly the ambiguous, retry-hazardous
 * failure we are trying to avoid, while a too-long one only delays an error
 * on a call that was already lost.
 */
//
// Raised from 180s on 2026-09-03: kindroid-mcp's single-AI send now rides out
// its own upstream timeout by re-sending under the same idempotency key, and
// its worst case for one send is its 60s request timeout plus its 120s
// re-send budget. Waiting 240s here lets that resolve inside ONE tool call
// instead of timing out first and re-sending with the same token, which
// works but burns a whole cycle.
export const DEFAULT_TIMEOUT_MS = 240_000;

/**
 * Extra attempts a timed-out kindroid_send_message gets under the SAME
 * idempotency token before the unknown-outcome error is thrown.
 *
 * kindroid-mcp (since 2026-09-03) composes every send's idempotency_token
 * into Kindroid's idempotency_key and itself re-sends after an upstream
 * timeout. Live-verified against Kindroid: the same key answers
 * "409 Request already in progress" while the reply is still generating and
 * replays the ORIGINAL reply afterwards, never a second exchange -- even when
 * the first request was abandoned mid-flight. So a timeout reaching this
 * client means kindroid-mcp's own re-send budget ran out or the MCP transport
 * dropped, and re-sending with the same token is safe either way. Kept small:
 * each attempt can wait the full KINDROID_MCP_TIMEOUT_MS. Group advances stay
 * on the no-retry rule; nothing about a group turn loop is idempotent.
 */
export const SEND_TIMEOUT_RETRIES = 2;

export class KindroidClient {
  private client: Client;
  private connected = false;

  constructor(
    private readonly url: URL,
    private readonly authToken?: string,
    private readonly timeoutMs: number = DEFAULT_TIMEOUT_MS,
  ) {
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
    const transport = new StreamableHTTPClientTransport(this.url, {
      requestInit: this.authToken
        ? { headers: { Authorization: `Bearer ${this.authToken}` } }
        : undefined,
    });
    await this.client.connect(transport);
    await verifyRequiredTools(
      this.client,
      "kindroid-mcp",
      KINDROID_REQUIRED_TOOLS,
    );
    this.connected = true;
    log.info("kindroid-client", "connected", {
      url: describeServiceUrl(this.url),
    });
  }

  async close(): Promise<void> {
    if (!this.connected) return;
    await this.client.close();
    this.connected = false;
  }

  /**
   * Call a kindroid-mcp tool that MUTATES a real conversation, and make a
   * failure say so.
   *
   * Every tool this client calls has side effects that outlive the request:
   * a message is posted, replies are generated by a paid model and persisted
   * to a chat a human will read. So when one of these calls fails, "did
   * anything actually happen?" is not answerable from here -- the request may
   * have been completed server-side after we stopped waiting. A caller that
   * treats the error as "nothing happened" and retries duplicates real
   * messages in someone's chat history.
   *
   * A TIMEOUT is the case where mutation is likely rather than merely
   * possible: the request was sent, accepted, and was still being worked on
   * when we gave up. Observed live on 2026-08-23 -- a group advance timed out
   * at 60s having already generated and persisted both AI turns, and from
   * mnemosyne's side that was indistinguishable from a total failure.
   *
   * Note this is a DIFFERENT failure from the one KindroidProvider's
   * read-back guard covers. That one fires when kindroid-mcp caught its own
   * read-back error and returned it as data. A timeout throws at the
   * transport layer, before any result exists to inspect, so it never
   * reaches that check.
   */
  private async callMutatingTool(name: string, args: Record<string, unknown>) {
    await this.connect();
    const start = Date.now();
    try {
      const result = await this.client.callTool(
        { name, arguments: args },
        undefined,
        {
          timeout: this.timeoutMs,
        },
      );
      log.debug("kindroid-client", "tool ok", {
        tool: name,
        ms: Date.now() - start,
      });
      return result;
    } catch (err) {
      const ms = Date.now() - start;
      const timedOut =
        err instanceof McpError && err.code === ErrorCode.RequestTimeout;
      log.error("kindroid-client", "tool error", {
        tool: name,
        ms,
        timed_out: timedOut,
        msg: (err as Error).message,
      });
      if (timedOut) {
        throw new RunOutcomeError(
          "provider_dispatch_unknown",
          `${name} timed out after ${ms}ms (KINDROID_MCP_TIMEOUT_MS=` +
            `${this.timeoutMs}). The request was accepted, so it may have ` +
            `ALREADY posted a message and generated replies -- do NOT retry ` +
            `blindly, that would duplicate them in a real conversation. ` +
            `Read the target's recent history to see what landed, then ` +
            `continue from there. If beats legitimately need longer than ` +
            `this (a long group turn loop can), raise ` +
            `KINDROID_MCP_TIMEOUT_MS rather than retrying.`,
          { cause: err },
        );
      }
      throw err;
    }
  }

  /** Send a message to a Kindroid AI and return its plain-text reply.
   * `aiId` accepts a raw ai_id or a kindroid-mcp registered friendly name --
   * kindroid_send_message resolves the name server-side. */
  async sendMessage(aiId: string, message: string): Promise<string> {
    // One token for the whole call, however many attempts it takes: that is
    // what makes the retry safe (see SEND_TIMEOUT_RETRIES). An older
    // kindroid-mcp ignores the unknown argument and behaves as before.
    const args = {
      ai_id: aiId,
      message,
      idempotency_token: randomUUID(),
    };
    for (let attempt = 1; ; attempt++) {
      try {
        const result = await this.callMutatingTool(
          "kindroid_send_message",
          args,
        );
        return extractText(result, "kindroid_send_message");
      } catch (err) {
        const timedOut =
          err instanceof RunOutcomeError &&
          err.outcome === "provider_dispatch_unknown";
        if (!timedOut) throw err;
        if (attempt > SEND_TIMEOUT_RETRIES) {
          throw new RunOutcomeError(
            "provider_dispatch_unknown",
            `kindroid_send_message timed out ${attempt} time(s), including ` +
              `${SEND_TIMEOUT_RETRIES} re-send(s) under the same idempotency ` +
              `token. The direction is posted at most once upstream (Kindroid ` +
              `replays the reply for a repeated token rather than generating ` +
              `again), so do not send it again: read the target's recent ` +
              `history to see whether the reply landed, then continue from there.`,
            { cause: err },
          );
        }
        log.warn(
          "kindroid-client",
          "kindroid_send_message timed out; re-sending under the same idempotency token",
          { attempt, max_attempts: 1 + SEND_TIMEOUT_RETRIES },
        );
      }
    }
  }

  /**
   * Reset a kin's short-term context via kindroid_chat_break, seeding
   * `greeting` as its newest message, with wipe_cascaded pinned to false:
   * no caller of this client can reach the permanent long-term wipe.
   * Goes through callMutatingTool, so a timeout is reported as
   * possibly-already-applied and is never retried here -- chat break has
   * no idempotency key (live-verified 2026-09-03: the field is rejected).
   */
  async chatBreak(aiId: string, greeting: string): Promise<void> {
    const result = await this.callMutatingTool("kindroid_chat_break", {
      ai_id: aiId,
      greeting,
      wipe_cascaded: false,
    });
    extractText(result, "kindroid_chat_break");
  }

  /** Drive a group chat's turn loop via kindroid_advance_group and return
   * the AI replies generated. `groupId` accepts a raw group_id or a
   * kindroid-mcp registered friendly name, same as `sendMessage`'s `aiId`. */
  async advanceGroup(
    groupId: string,
    message: string,
    opts?: { maxTurns?: number; allowUser?: boolean },
  ): Promise<AdvanceGroupResult> {
    const args: Record<string, unknown> = { group_id: groupId, message };
    if (opts?.maxTurns !== undefined) args.max_turns = opts.maxTurns;
    if (opts?.allowUser !== undefined) args.allow_user = opts.allowUser;
    const result = await this.callMutatingTool("kindroid_advance_group", args);
    return extractStructuredOrParsed(
      result,
      "kindroid_advance_group",
      AdvanceGroupResultSchema,
    );
  }
}
