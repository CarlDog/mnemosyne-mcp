// Shared helpers used by every tool registration.

import { log } from "../log.js";

export const asText = (data: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
});

type ToolArgs = Record<string, unknown>;
type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};
type ToolHandler<A extends ToolArgs> = (args: A) => Promise<ToolResult>;

// String arg values longer than this are truncated in the info-level
// invoke line. Entity content and direction prose can run to whole
// scenes; the full values are still available at debug level.
const INFO_ARG_MAX_CHARS = 200;

function truncateArgsForInfo(args: ToolArgs): ToolArgs {
  const out: ToolArgs = {};
  for (const [k, v] of Object.entries(args)) {
    out[k] =
      typeof v === "string" && v.length > INFO_ARG_MAX_CHARS
        ? `${v.slice(0, INFO_ARG_MAX_CHARS)}… (${v.length} chars)`
        : v;
  }
  return out;
}

/**
 * Wrap a tool handler with structured logging:
 * - Logs an `invoke` line at info with the tool's args (long string
 *   values truncated — full args are logged at debug level).
 * - Logs an `ok` line at info with elapsed ms.
 * - Logs an `error` line at error with elapsed ms + the error message,
 *   then re-throws so the MCP framework still surfaces an error result.
 *
 * Story names and ids are not secrets; truncation is about keeping
 * whole-scene prose (entity content, direction) out of default-level
 * logs, not about redaction.
 */
export function withLogging<A extends ToolArgs>(
  name: string,
  handler: ToolHandler<A>,
): ToolHandler<A> {
  return async (args: A) => {
    const start = Date.now();
    log.info(`tool:${name}`, "invoke", truncateArgsForInfo(args));
    log.debug(`tool:${name}`, "invoke args (full)", args);
    try {
      const result = await handler(args);
      log.info(`tool:${name}`, "ok", { ms: Date.now() - start });
      return result;
    } catch (err) {
      log.error(`tool:${name}`, "error", {
        ms: Date.now() - start,
        msg: (err as Error).message,
      });
      throw err;
    }
  };
}
