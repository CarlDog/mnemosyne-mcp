// HTTP transport configuration. Env-driven, read directly from
// process.env (not via an injected env parameter, unlike kindroid-mcp's
// own loadConfig) -- tests/env-schema.test.ts regex-matches every literal
// "process.env." reference in src/**/*.ts against .env.example, and an
// injected-env signature would make these vars invisible to that drift
// check.
//
// Semantics mirror kindroid-mcp's src/config.ts (the fleet-canonical HTTP
// transport's own config half) for the fields the two servers share.

export interface HttpConfig {
  /** Streamable HTTP port. Undefined means stdio transport -- this is the
   * switch between the two modes, so it must distinguish unset from 0. */
  port: number | undefined;
  /** Bind host for the HTTP transport. Loopback by default: a container
   * that binds 0.0.0.0 with no auth is reachable by anything on the Docker
   * network, so wider exposure is opt-in via MCP_BIND_HOST. */
  bindHost: string;
  /** Host/Origin allowlist for the HTTP transport. Undefined means
   * unconfigured (open) -- never an empty array, which would mean the same
   * thing by accident (see parseAllowedHosts below). */
  allowedHosts: string[] | undefined;
  /** Bearer token required on the HTTP transport. Undefined disables auth. */
  authToken: string | undefined;
  /** Idle-session eviction cutoff for the HTTP transport, ms. */
  sessionIdleMs: number;
}

const DEFAULT_BIND_HOST = "127.0.0.1";
const DEFAULT_SESSION_IDLE_MS = 30 * 60_000;

/**
 * Comma-separated allowlist backing a safety control: a value that IS set
 * but parses to zero usable entries throws rather than yielding [].
 * hostAllowed() in shared/http-transport.ts treats an empty array as "not
 * configured: open" -- so a typo that empties the list would otherwise
 * silently disable the exact control it was meant to enable. Matching there
 * is hostname-only (the Host header's port is split off, Origin's
 * URL.hostname carries none), so a host:port entry could never match --
 * strip one trailing :<digits> suffix per entry, but only when the
 * remainder holds no other colon, so an IPv6 literal is never mangled into
 * a different (still unmatchable) entry.
 */
function parseAllowedHosts(raw: string | undefined): string[] | undefined {
  if (raw === undefined) return undefined;
  const items = raw
    .split(",")
    .map((s) => s.trim())
    .map((s) => s.replace(/^([^:]*):\d+$/, "$1"))
    .filter(Boolean);
  if (items.length === 0) {
    throw new Error(
      "MCP_ALLOWED_HOSTS is set but contains no usable entries. Leave it " +
        "unset to allow any host, or an empty value would disable this " +
        "safety control by accident.",
    );
  }
  return items;
}

/**
 * Read and validate HTTP transport configuration from the environment.
 * Throws a clear Error (not a raw traceback) when a value is malformed, so
 * the bootstrap can exit cleanly.
 */
export function loadHttpConfig(): HttpConfig {
  // Unset MCP_PORT means stdio transport. An explicit trim-then-check (not
  // the usual `?.trim() || default` idiom) so a configured-but-empty value
  // doesn't get read as "port 0".
  const rawPort = process.env.MCP_PORT?.trim();
  const port = rawPort ? Number(rawPort) : undefined;
  if (port !== undefined && (!Number.isInteger(port) || port <= 0)) {
    throw new Error(`MCP_PORT must be a positive integer (got: ${rawPort})`);
  }

  const bindHost = process.env.MCP_BIND_HOST?.trim() || DEFAULT_BIND_HOST;
  const allowedHosts = parseAllowedHosts(
    process.env.MCP_ALLOWED_HOSTS?.trim() || undefined,
  );
  const authToken = process.env.MCP_AUTH_TOKEN?.trim() || undefined;

  const rawSessionIdle = process.env.MCP_SESSION_IDLE_MS?.trim();
  const sessionIdleMs = rawSessionIdle
    ? Number(rawSessionIdle)
    : DEFAULT_SESSION_IDLE_MS;
  if (!Number.isFinite(sessionIdleMs) || sessionIdleMs <= 0) {
    throw new Error(
      `MCP_SESSION_IDLE_MS must be a positive number (got: ${rawSessionIdle})`,
    );
  }

  return { port, bindHost, allowedHosts, authToken, sessionIdleMs };
}
