// mnemo_session_break: MCP driver wrapper over the sessionBreak use case
// (docs/KINDROID_NARRATOR_DESIGN.md S3).

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { OcClient } from "../oc-client.js";
import type { SessionBreak } from "../application/session-break.js";
import { OVERRIDE_FLAGGED_CONTENT_PARAM } from "../injection-scan.js";
import { makeRunContext } from "../run-context.js";
import { resolveStoryId } from "../stories.js";
import { asText, withLogging } from "./helpers.js";

/** Kindroid's chat-break greeting editor caps at 4,000 characters. */
const MAX_GREETING_CHARS = 4000;

export function registerSessionTool(
  server: McpServer,
  oc: OcClient,
  sessionBreak: SessionBreak,
): void {
  server.registerTool(
    "mnemo_session_break",
    {
      title: "Start a New Narrator Session",
      description:
        "Explicit new-session boundary for a story's Kindroid narrator (GENERATOR_PROVIDER=kindroid, single-AI target only). Resets the bound kin's short-term context via kindroid_chat_break with the cascaded-memory wipe pinned OFF, seeds `greeting` as the kin's newest message, and saves that same greeting as a scene so the story's recent scenes and the kin start the session in step. Nothing in prose can trigger this; the call is the only way. A timeout means the break may already have applied -- do NOT call again blindly; read the kin's history first. " +
        "`greeting` matching instruction-shaped phrasing (a prompt-injection signal) is refused by default, before the chat break even fires -- nothing is changed, and the error quotes the exact matched excerpt; " +
        `${OVERRIDE_FLAGGED_CONTENT_PARAM}=true proceeds anyway, keeping the quote on the result as an audit trail.`,
      inputSchema: {
        greeting: z
          .string()
          .min(1)
          .max(MAX_GREETING_CHARS)
          .describe(
            "The kin's opening message for the new session, in the story's voice (narration in *asterisks*, dialogue plain). Becomes the first item of the kin's new context and is saved as a scene; the next direction should continue from it, not repeat it.",
          ),
        story: z
          .string()
          .min(1)
          .optional()
          .describe(
            "Story name or OC project UUID to operate on instead of the active story (this call only).",
          ),
        kindroid_kin: z
          .string()
          .min(1)
          .optional()
          .describe(
            "Per-call single-AI override (raw ai_id or kindroid-mcp registered name). Wins over the story's bound target for this call only.",
          ),
        override_flagged_content: z
          .boolean()
          .optional()
          .describe(
            "Proceed anyway when `greeting` matches instruction-shaped " +
              "phrasing. Default false: refused, nothing changed. Only " +
              "set true after reading the quoted excerpt in the error " +
              "and deciding it's a false positive or acceptable.",
          ),
      },
    },
    withLogging(
      "mnemo_session_break",
      async (
        args: {
          greeting: string;
          story?: string;
          kindroid_kin?: string;
          override_flagged_content?: boolean;
        },
        extra,
      ) => {
        const storyId = await resolveStoryId(oc, args.story);
        const run = makeRunContext("mcp", { storyId, signal: extra.signal });
        const result = await sessionBreak(
          storyId,
          {
            greeting: args.greeting,
            explicitKin: args.kindroid_kin,
            reinvokeHint: "mnemo_continue",
            overrideFlaggedContent: args.override_flagged_content,
          },
          run,
        );
        return asText(result);
      },
    ),
  );
}
