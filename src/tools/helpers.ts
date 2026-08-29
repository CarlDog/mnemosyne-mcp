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
/** The slice of the SDK's RequestHandlerExtra tools consume. The SDK's
 * `signal` is required and fires when the caller cancels the request --
 * withLogging used to drop the whole extra context, which is why no MCP
 * cancellation ever reached a provider call (RUN_OUTCOMES_DESIGN). */
export interface ToolExtra {
  signal: AbortSignal;
}
type ToolHandler<A extends ToolArgs> = (
  args: A,
  extra: ToolExtra,
) => Promise<ToolResult>;

// Narrative prose is NOT normal telemetry (OpenClaw assessment §7 -- this is
// a private storytelling server designed for mature material). The old
// invoke line logged the first 200 characters of every long string and the
// FULL args at debug, so entity bodies and scene directions were default log
// content. Now:
//  - Known prose fields (content, direction) log only their length, always
//    -- even a short direction is story content.
//  - Any other string past the threshold logs only its length (a long value
//    in a non-prose field is prose we didn't anticipate, e.g. a pasted
//    excerpt in `query`). Short identifiers (names, ids, modes, tags) pass
//    through -- they're the diagnostic value of the line.
//  - Arrays log only their element count (import's `entities` carries whole
//    bodies).
//  - The full-args debug line requires the explicit MNEMO_LOG_CONTENT=true
//    opt-in (plus LOG_LEVEL=debug); it exists for short-lived content
//    debugging, not as a default.
const PROSE_FIELDS = new Set(["content", "direction"]);
const INFO_ARG_MAX_CHARS = 200;

export function sanitizeToolArgsForLog(args: ToolArgs): ToolArgs {
  const out: ToolArgs = {};
  for (const [k, v] of Object.entries(args)) {
    if (
      typeof v === "string" &&
      (PROSE_FIELDS.has(k) || v.length > INFO_ARG_MAX_CHARS)
    ) {
      out[k] = `(${v.length} chars)`;
    } else if (Array.isArray(v)) {
      out[k] = `(${v.length} items)`;
    } else {
      out[k] = v;
    }
  }
  return out;
}

function contentLoggingOptedIn(): boolean {
  return process.env.MNEMO_LOG_CONTENT === "true";
}

/**
 * Wrap a tool handler with structured logging:
 * - Logs an `invoke` line at info with sanitized args -- prose fields and
 *   long strings as lengths, arrays as counts (see sanitizeToolArgsForLog).
 * - Logs an `ok` line at info with elapsed ms.
 * - Logs an `error` line at error with elapsed ms + the error message,
 *   then re-throws so the MCP framework still surfaces an error result.
 * - Full args appear ONLY with MNEMO_LOG_CONTENT=true at debug level.
 *
 * Story names and ids are not secrets and stay in the line -- the point is
 * keeping narrative prose out of default telemetry, not hiding identifiers.
 */
export function withLogging<A extends ToolArgs>(
  name: string,
  handler: ToolHandler<A>,
): ToolHandler<A> {
  return async (args: A, extra: ToolExtra) => {
    const start = Date.now();
    log.info(`tool:${name}`, "invoke", sanitizeToolArgsForLog(args));
    if (contentLoggingOptedIn()) {
      log.debug(`tool:${name}`, "invoke args (full, MNEMO_LOG_CONTENT)", args);
    }
    try {
      const result = await handler(args, extra);
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
