// Central service-URL validation (NEMOCLAW_ADOPTION_ASSESSMENT §4,
// ratified as a mechanical item). Every configured service endpoint --
// OC_URL, OLLAMA_URL, KINDROID/BOTIFY_MCP_URL, OPENAI_BASE_URL -- passes
// through one parser so the rejection rules cannot drift per site:
//   - http(s) only (a service endpoint is never file:, ftp:, etc.);
//   - no embedded credentials (secrets don't belong in URLs -- they leak
//     into logs and error messages; this repo's security rules forbid it);
//   - no fragment (meaningless on a service base and usually a paste
//     error);
//   - no query string unless the caller opts in (base URLs don't carry
//     them; a stray ?key=... is the credentials rule wearing a disguise).
// Deliberately NOT adopted: blanket private-address/SSRF rejection --
// loopback and RFC1918 endpoints are first-class deployments here (the
// assessment says so explicitly).

export function parseServiceUrl(
  name: string,
  raw: string,
  opts?: { allowQuery?: boolean },
): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`${name} is not a valid URL`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(
      `${name} must be an http(s) URL (got protocol "${url.protocol}")`,
    );
  }
  if (url.username || url.password) {
    throw new Error(
      `${name} must not embed credentials in the URL -- pass tokens via ` +
        "their dedicated env var (they leak into logs from URLs)",
    );
  }
  if (url.hash) {
    throw new Error(`${name} must not carry a #fragment`);
  }
  if (url.search && !opts?.allowQuery) {
    throw new Error(
      `${name} must not carry a query string -- a service base URL takes ` +
        "none, and a stray ?key=... is a credential in disguise",
    );
  }
  return url;
}

/** The representation service logs use: origin + path, never userinfo or
 * query -- safe by construction once parseServiceUrl accepted it, but
 * kept as one named helper so log sites don't re-derive it. */
export function describeServiceUrl(url: URL): string {
  return `${url.origin}${url.pathname === "/" ? "" : url.pathname}`;
}
