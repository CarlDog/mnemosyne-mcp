// mnemo_validate: standalone validation pass.
//
// Counterpart to mnemo_continue's validate=true mode. Takes raw content
// (a hand-written paragraph, a previously-generated beat being audited,
// etc.) and runs the validator LLM against the active story's
// rules / style / characters / locations. Returns the same
// ValidationReport shape mnemo_continue does.
//
// Use cases:
//   - Diagnostic: feed a known-violating beat back through the validator
//     to see whether a given (rule, model, prompt) combination catches
//     the violation. Splits "did the generator violate?" from "did the
//     validator catch the violation?" cleanly.
//   - Hand-written content: the user wrote a paragraph in their editor
//     and wants to check it against the story's constraints before
//     accepting it.

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { OcClient } from "../oc-client.js";
import type { LlmProvider } from "../llm.js";
import { gatherContext } from "../prompt.js";
import { validateContent } from "../validator.js";
import { requireCurrentStoryId } from "../config.js";
import { log } from "../log.js";
import { asText, withLogging } from "./helpers.js";

export function registerValidateTool(
  server: McpServer,
  oc: OcClient,
  validator: LlmProvider,
): void {
  server.registerTool(
    "mnemo_validate",
    {
      title: "Validate Content Against Story Constraints",
      description:
        "Run the LLM validation pass against arbitrary content (a hand-written paragraph, a previously-generated beat being re-audited, etc.). Pulls rules, style, characters, and locations from the active story; returns the same ValidationReport shape as mnemo_continue's validate=true mode. Useful for diagnostic A/B work — feed a known-violating beat back through to verify (model + prompt + rule) actually catches the violation.",
      inputSchema: {
        content: z
          .string()
          .min(1)
          .describe(
            "The text to validate. Can be a paragraph, a full scene, or any prose excerpt.",
          ),
      },
    },
    withLogging("mnemo_validate", async (args: { content: string }) => {
      const storyId = await requireCurrentStoryId();
      // Reuse continue's gatherContext so the validator sees the same
      // shape of context. The validator only consumes rules / style /
      // characters / locations; the rest of the bundle is harmlessly
      // ignored by validateContent.
      const context = await gatherContext(oc, storyId, args.content);
      // Guard the validator pass: a validator-LLM failure or non-JSON
      // output degrades to a structured error instead of a raw MCP tool
      // error — symmetric with mnemo_continue's validation_error field.
      try {
        const report = await validateContent(validator, context, args.content);
        return asText(report);
      } catch (err) {
        const msg = (err as Error).message;
        log.warn("mnemo_validate", "validation pass failed", { msg });
        return asText({ validation_error: msg });
      }
    }),
  );
}
