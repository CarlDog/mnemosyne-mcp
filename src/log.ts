// Structured logger. Writes to stderr in the format:
//   <ISO-timestamp> <LEVEL> [<scope>] <message> key=value key2=value2
//
// Level controlled by LOG_LEVEL env var (default: info). Order:
// trace < debug < info < warn < error.
//
// Always writes to stderr (not stdout) because the stdio MCP transport
// uses stdout for the wire protocol — writing logs there corrupts it.
// Stays on stderr in HTTP mode for consistency.

type Level = "trace" | "debug" | "info" | "warn" | "error";

const LEVEL_PRIORITY: Record<Level, number> = {
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
};

const envLevel = (process.env.LOG_LEVEL ?? "info").toLowerCase() as Level;
const minPriority = LEVEL_PRIORITY[envLevel] ?? LEVEL_PRIORITY.info;

// Final-sink redaction (OpenClaw assessment §7's defense-in-depth
// placement, ratified as a mechanical item): sensitive-named keys are
// redacted RECURSIVELY at the one point every log line passes through, and
// URL userinfo is scrubbed out of string values -- so a future call site
// that logs a config object or a URL with embedded credentials leaks
// nothing even though it should not have logged it in the first place.
const SENSITIVE_KEY_RE =
  /(?:^|_|-)(token|secret|password|passwd|credential|authorization|auth|api[-_]?key|apikey|bearer)(?:$|_|-)/i;
const URL_USERINFO_RE = /(\w+:\/\/)[^/\s@]+@/g;

function redactValue(key: string, value: unknown): unknown {
  if (SENSITIVE_KEY_RE.test(key)) return "<redacted>";
  if (typeof value === "string") {
    return value.replace(URL_USERINFO_RE, "$1<redacted>@");
  }
  if (Array.isArray(value)) return value.map((v) => redactValue("", v));
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = redactValue(k, v);
    return out;
  }
  return value;
}

function formatMeta(meta?: Record<string, unknown>): string {
  if (!meta) return "";
  const parts: string[] = [];
  for (const [k, raw] of Object.entries(meta)) {
    const v = redactValue(k, raw);
    let val: string;
    if (v === null || v === undefined) {
      val = String(v);
    } else if (typeof v === "string") {
      val = /\s/.test(v) ? JSON.stringify(v) : v;
    } else {
      val = JSON.stringify(v);
    }
    parts.push(`${k}=${val}`);
  }
  return parts.length ? " " + parts.join(" ") : "";
}

function emit(
  level: Level,
  scope: string,
  msg: string,
  meta?: Record<string, unknown>,
): void {
  if (LEVEL_PRIORITY[level] < minPriority) return;
  const ts = new Date().toISOString();
  console.error(
    `${ts} ${level.toUpperCase()} [${scope}] ${msg}${formatMeta(meta)}`,
  );
}

export const log = {
  trace: (scope: string, msg: string, meta?: Record<string, unknown>) =>
    emit("trace", scope, msg, meta),
  debug: (scope: string, msg: string, meta?: Record<string, unknown>) =>
    emit("debug", scope, msg, meta),
  info: (scope: string, msg: string, meta?: Record<string, unknown>) =>
    emit("info", scope, msg, meta),
  warn: (scope: string, msg: string, meta?: Record<string, unknown>) =>
    emit("warn", scope, msg, meta),
  error: (scope: string, msg: string, meta?: Record<string, unknown>) =>
    emit("error", scope, msg, meta),
};
