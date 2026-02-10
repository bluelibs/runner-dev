import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "node:crypto";
import { runContext } from "../telemetry.chain";

/**
 * Express middleware that wraps each incoming request in an AsyncLocalStorage
 * context carrying a fresh `correlationId`. This ensures all logs, emissions,
 * errors, and runs recorded during the request automatically inherit a traceId
 * — even when the code is not inside a task/hook execution.
 *
 * If a context already exists (e.g. a task triggered the request internally),
 * the existing correlationId is preserved.
 */
export function createRequestCorrelationMiddleware() {
  return (req: Request, _res: Response, next: NextFunction) => {
    const existing = runContext.getStore();
    if (existing) {
      // Already inside a run context — don't override
      return next();
    }

    const raw = req.headers["x-correlation-id"];
    const correlationId = (Array.isArray(raw) ? raw[0] : raw) || randomUUID();

    runContext.run({ chain: [], correlationId }, () => {
      next();
    });
  };
}
