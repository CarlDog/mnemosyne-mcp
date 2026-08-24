// Shared helpers for the /api route handlers.

import type {
  ErrorRequestHandler,
  NextFunction,
  Request,
  RequestHandler,
  Response,
} from "express";
import { log } from "../log.js";

/**
 * Express 4 has no built-in handling for a rejected promise thrown from an
 * async route handler -- an unhandled rejection, not a 500, is the default
 * outcome. Wrap every async handler in this so a thrown/rejected error
 * reaches Express's error-handling middleware (apiErrorHandler below) the
 * same way a synchronous throw already would.
 */
export function asyncRoute(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}

/**
 * Final error-handling middleware for the /api router. Must be registered
 * LAST (Express identifies error middleware by arity -- four params) --
 * see createApiRouter in ./index.ts. `next` is required in the signature
 * for Express to recognize this as error middleware at all, even though
 * it's never called (there's nothing further in the chain to hand off to).
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const apiErrorHandler: ErrorRequestHandler = (err, req, res, next) => {
  log.error("api", "unhandled route error", {
    path: req.path,
    msg: (err as Error).message,
  });
  res.status(500).json({ error: "internal_error" });
};
