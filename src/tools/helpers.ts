// Shared helpers used by every tool registration.

import { log } from "../log.js";

export const asText = (data: unknown, opts?: { isError?: boolean }) => ({
  content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  ...(opts?.isError && { isError: opts.isError }),
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

/**
 * Refuses a caller-supplied filesystem path when the server is not reachable
 * only by its local operator.
 *
 * `mnemo_export_story(out_path)` and `mnemo_import_story(file_path)` resolve
 * whatever they are given and read or write it with the server process's full
 * authority. Under stdio that is a local operator capability and is fine. The
 * HTTP transport registers the SAME tool surface, so without this an HTTP
 * caller could read or write anywhere the process can.
 *
 * Deliberately a flat rejection rather than an allowed-root facility: the
 * assessment that raised this (docs/NEMOCLAW_ADOPTION_ASSESSMENT.md §1) argues
 * a confinement facility is both larger and easier to get subtly wrong, and
 * nothing needs caller-chosen paths over HTTP. The server-owned default
 * destinations still work on both transports, as does import's `entities`
 * mode -- only the path-bearing variants are refused.
 */
export function assertFilesystemPathAllowed(
  allowFilesystemPaths: boolean,
  field: string,
): void {
  if (allowFilesystemPaths) return;
  throw new Error(
    `\`${field}\` is refused over the HTTP transport: it resolves to a path on the ` +
      "server's filesystem, which is a local-operator capability. Omit it to use the " +
      "server-owned default location, or run the server over stdio.",
  );
}
