// Shared helpers for the /api route handlers.

import type {
  ErrorRequestHandler,
  NextFunction,
  Request,
  RequestHandler,
  Response,
} from "express";
import type { z } from "zod";
import type { OcClient } from "../oc-client.js";
import { findStory, type MnemoStory } from "../stories.js";
import { log } from "../log.js";
import { OUTCOME_HTTP_STATUS, RunOutcomeError } from "../run-outcome.js";

/**
 * Resolve a story or write the 404 -- the not-found payload is part of
 * the web client's contract (ApiError surfaces body.message), so the
 * one copy here is what keeps every route's 404 identical. Returns
 * undefined after writing the response; callers return immediately on
 * undefined.
 */
export async function requireStory(
  oc: OcClient,
  storyId: string,
  res: Response,
): Promise<MnemoStory | undefined> {
  const story = await findStory(oc, storyId);
  if (!story) {
    res.status(404).json({
      error: "story_not_found",
      message: `No story matches "${storyId}".`,
    });
    return undefined;
  }
  return story;
}

/**
 * safeParse a request body/query or write the 400 with the joined zod
 * issues -- one copy of the issue formatting (and of the `value ?? {}`
 * normalization for requests with no JSON body), so every endpoint's
 * validation-error payload stays the same shape. Returns undefined
 * after writing the response.
 */
export function parseOr400<Schema extends z.ZodType>(
  schema: Schema,
  value: unknown,
  res: Response,
  errorName = "invalid_body",
): z.infer<Schema> | undefined {
  const parsed = schema.safeParse(value ?? {});
  if (!parsed.success) {
    res.status(400).json({
      error: errorName,
      message: parsed.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; "),
    });
    return undefined;
  }
  return parsed.data as z.infer<Schema>;
}

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
  // Typed run outcomes keep their replay-safety projection instead of
  // collapsing into internal_error -- losing e.g. Kindroid's "do NOT
  // retry, the message may already be posted" instruction was the defect
  // RUN_OUTCOMES_DESIGN exists to fix. Status codes per the ratified map:
  // nothing retry_safe:false returns a status generic clients auto-retry.
  if (err instanceof RunOutcomeError) {
    log.warn("api", "run outcome", {
      path: req.path,
      outcome: err.outcome,
      retry_safe: err.retry_safe,
    });
    res.status(OUTCOME_HTTP_STATUS[err.outcome]).json({
      error: err.outcome,
      retry_safe: err.retry_safe,
      dispatch_attempted: err.dispatch_attempted,
      provider_charge_possible: err.provider_charge_possible,
      external_conversation_mutation_possible:
        err.external_conversation_mutation_possible,
      message: err.message,
    });
    return;
  }
  log.error("api", "unhandled route error", {
    path: req.path,
    msg: (err as Error).message,
  });
  res.status(500).json({ error: "internal_error" });
};
