// HTTP transport configuration. Env-driven, read directly from
// process.env (not via an injected env parameter, unlike kindroid-mcp's
// own loadConfig) -- tests/env-schema.test.ts regex-matches every literal
// "process.env." reference in src/**/*.ts against .env.example, and an
// injected-env signature would make these vars invisible to that drift
// check.
//
// Semantics mirror kindroid-mcp's src/config.ts (the fleet-canonical HTTP
// transport's own config half) for the fields the two servers share.

import { parseAllowedHosts as parseAllowedHostsCanonical } from "./shared/mcp-environment.js";

export interface HttpConfig {
  /** Streamable HTTP port. Undefined means stdio transport -- this is the
   * switch between the two modes, so it must distinguish unset from 0. */
  port: number | undefined;
  /** Bind host for the HTTP transport. Loopback by default: a container
   * that binds 0.0.0.0 with no auth is reachable by anything on the Docker
   * network, so wider exposure is opt-in via MCP_BIND_HOST. */
  bindHost: string;
  /** Host/Origin allowlist for the HTTP transport. Undefined means
   * unconfigured here -- never an empty array, which would mean the same
   * thing by accident (see parseAllowedHosts below). NOT the same as
   * "open": hostAllowed()/apiSecurity() fall back to
   * shared/mcp-environment.ts's safe default
   * (localhost,127.0.0.1,[::1],host.docker.internal) when this is
   * undefined, rather than accepting any host. */
  allowedHosts: string[] | undefined;
  /** Bearer token required on the HTTP transport. Undefined disables auth. */
  authToken: string | undefined;
  /** Idle-session eviction cutoff for the HTTP transport, ms. */
  sessionIdleMs: number;
}

const DEFAULT_BIND_HOST = "127.0.0.1";
const DEFAULT_SESSION_IDLE_MS = 30 * 60_000;

/**
 * Comma-separated allowlist backing a safety control. Delegates to
 * shared/mcp-environment.ts's parseAllowedHosts (the same validated parser
 * shared/http-transport.ts's hostAllowed() and api-security.ts's
 * apiSecurity() use for matching), rather than a local ad hoc parser --
 * three independent parsers of the same env var was the actual bug class:
 * this one used to strip a trailing `:<port>` suffix per entry to
 * compensate for hostAllowed()'s now-fixed hostname-only match, but the
 * regex could never safely strip a bracketed IPv6 entry (`[::1]:3000`),
 * so those stayed permanently unmatchable. The canonical parser normalizes
 * (case, bracket-stripping, trailing dot) and validates properly instead
 * of pattern-matching around the request-time matcher's old limitation --
 * a `host:port` entry is now a hard error at startup (visible immediately)
 * rather than a silent, incomplete strip.
 */
function parseAllowedHosts(raw: string | undefined): string[] | undefined {
  if (raw === undefined) return undefined;
  return parseAllowedHostsCanonical(raw);
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
