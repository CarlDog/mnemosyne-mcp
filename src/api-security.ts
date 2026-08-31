// Host/Origin allowlist + bearer-auth for everything EXCEPT /mcp (self-
// protected by shared/http-transport.ts's mountMcpHttp) and /health (left
// open, matching the fleet's own convention of an unauthenticated
// healthcheck endpoint). Mounted via app.use() in src/index.ts AFTER
// /health and /mcp are registered -- both fully end the request-response
// cycle on a match, so this middleware never runs for either and needs no
// path-exclusion logic of its own; registration order is the exclusion
// mechanism.
//
// Deliberately duplicates tokenMatches()/the host-check wiring from
// shared/http-transport.ts rather than importing them -- that file is a
// byte-verbatim, hash-compared copy of kindroid-mcp's fleet-canonical
// module (see its own header comment) and must not gain mnemosyne-only
// exports. This is a small, accepted, deliberate duplication against the
// canonical file, not accidental drift. The actual host-matching primitive
// (parseAllowedHosts/requestAuthorityAllowed) lives in the separate,
// already-shared shared/mcp-environment.ts, so importing that does not
// touch http-transport.ts's byte-verbatim status.

import { createHash, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { HttpConfig } from "./http-config.js";
import {
  parseAllowedHosts,
  requestAuthorityAllowed,
} from "./shared/mcp-environment.js";

/** Constant-time bearer comparison over SHA-256 digests. */
function tokenMatches(provided: string, expected: string): boolean {
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

function hostAllowed(req: Request, allowed: string[] | undefined): boolean {
  const headers: { host?: string; origin?: string } = {};
  if (typeof req.headers.host === "string") headers.host = req.headers.host;
  if (typeof req.headers.origin === "string")
    headers.origin = req.headers.origin;
  return requestAuthorityAllowed(
    headers,
    allowed ?? parseAllowedHosts(undefined),
  );
}

export function apiSecurity(
  config: Pick<HttpConfig, "allowedHosts" | "authToken">,
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!hostAllowed(req, config.allowedHosts)) {
      res.status(403).json({ error: "Forbidden: host not allowed" });
      return;
    }
    if (config.authToken) {
      const header = req.headers.authorization ?? "";
      const provided = header.startsWith("Bearer ") ? header.slice(7) : "";
      if (!provided || !tokenMatches(provided, config.authToken)) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
    }
    next();
  };
}
