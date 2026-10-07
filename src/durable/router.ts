import type { Logger, Store } from "@bluelibs/runner";
import { errors } from "@bluelibs/runner";
import express from "express";
import type { ErrorRequestHandler, Request, Response } from "express";
import z from "zod";
import { discoverRuntimes, selectRuntime, workflowCatalog } from "./runtime";
import { DurableHttpError, requireValue } from "./errors";
import { getExecutionDetail, listExecutions } from "./executions";
import { toSummary } from "./projection";
import { executionAction, startExecution } from "./actions";
import {
  createSchedule,
  previewSchedule,
  scheduleAction,
  toSchedule,
} from "./schedules";
import { workflowPage } from "./shared/workflowPage";

const querySchema = z.object({ runtimeId: z.string().min(1).optional() });
const workflowQuerySchema = z.object({
  query: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

async function dispatch(
  store: Store,
  req: Request,
  res: Response,
  logger?: Pick<Logger, "info">
): Promise<void> {
  const method = req.method;
  const pathname = req.path;
  if (method === "GET" && pathname === "/runtimes") {
    res.json({
      runtimes: discoverRuntimes(store).map((runtime) => runtime.descriptor),
    });
    return;
  }
  const { runtimeId } = querySchema.parse(req.query);
  const runtime = selectRuntime(store, runtimeId);
  if (method === "GET" && pathname === "/workflows") {
    res.json(
      workflowPage(
        workflowCatalog(runtime),
        workflowQuerySchema.parse(req.query)
      )
    );
    return;
  }
  const workflowMatch = pathname.match(/^\/workflows\/([^/]+)$/);
  if (method === "GET" && workflowMatch) {
    const key = decodeURIComponent(workflowMatch[1]);
    res.json({
      workflow: requireValue(
        workflowCatalog(runtime).find((workflow) => workflow.key === key),
        `Unknown workflow '${key}'.`
      ),
    });
    return;
  }
  if (pathname === "/executions") {
    if (method === "GET") res.json(await listExecutions(runtime, req.query));
    else if (method === "POST")
      res.status(201).json(await startExecution(runtime, req.body));
    else throw new DurableHttpError(405, "Method not allowed.");
    return;
  }
  const executionMatch = pathname.match(
    /^\/executions\/([^/]+)(?:\/([^/]+))?$/
  );
  if (executionMatch) {
    const id = decodeURIComponent(executionMatch[1]);
    const action = executionMatch[2];
    if (method === "GET" && action === undefined)
      res.json({ execution: await getExecutionDetail(runtime, id) });
    else if (
      method === "POST" &&
      action &&
      [
        "signals",
        "cancel",
        "retry",
        "force-fail",
        "skip-step",
        "edit-state",
        "pause",
        "resume",
        "restart",
      ].includes(action)
    ) {
      res
        .status(202)
        .json(await executionAction(runtime, id, action, req.body, logger));
    } else throw new DurableHttpError(404, "Unknown execution route.");
    return;
  }
  if (pathname === "/schedules") {
    if (method === "GET")
      res.json({
        schedules: (await runtime.durable.listSchedules()).map((schedule) =>
          toSchedule(runtime, schedule)
        ),
      });
    else if (method === "POST")
      res.status(201).json(await createSchedule(runtime, req.body));
    else throw new DurableHttpError(405, "Method not allowed.");
    return;
  }
  if (pathname === "/schedules/preview" && method === "POST") {
    res.json(previewSchedule(req.body));
    return;
  }
  const scheduleMatch = pathname.match(
    /^\/schedules\/([^/]+)(?:\/(pause|resume))?$/
  );
  if (scheduleMatch) {
    const id = decodeURIComponent(scheduleMatch[1]);
    const action = scheduleMatch[2];
    if (method === "POST" && action)
      res.json(await scheduleAction(runtime, id, action));
    else if (method === "DELETE" && !action)
      res.json(await scheduleAction(runtime, id, "delete"));
    else if (method === "PATCH" && !action)
      res.json(await scheduleAction(runtime, id, "update", req.body));
    else throw new DurableHttpError(405, "Method not allowed.");
    return;
  }
  if (pathname === "/stuck" && method === "GET") {
    const page = await runtime.durable.operator.listExecutionStates({
      status: ["compensation_failed"],
      limit: 40,
    });
    res.json({
      executions: page.states.map((state) => toSummary(runtime, state)),
    });
    return;
  }
  if (pathname === "/recover" && method === "POST") {
    res.json({ report: await runtime.durable.recover() });
    return;
  }
  throw new DurableHttpError(404, "Unknown durable API route.");
}

/** Mount behind the server's host/password guards. No separate authentication. */
export function createDurableRouter(
  store: Store,
  logger?: Pick<Logger, "info">
): express.Router {
  const router = express.Router();
  router.use(express.json({ limit: "1mb" }));
  router.use(async (req, res, next) => {
    try {
      await dispatch(store, req, res, logger);
    } catch (error) {
      next(error);
    }
  });
  const handleError: ErrorRequestHandler = (
    error: unknown,
    _req,
    res,
    _next
  ) => {
    let status = 500;
    if (error instanceof DurableHttpError) status = error.status;
    else if (
      error instanceof z.ZodError ||
      error instanceof SyntaxError ||
      error instanceof URIError ||
      errors.matchError.is(error) ||
      errors.validationError.is(error) ||
      errors.durableExecutionInvariantError.is(error)
    )
      status = 400;
    else {
      const parsed = z
        .object({ status: z.number().int().min(400).max(499) })
        .safeParse(error);
      if (parsed.success) status = parsed.data.status;
    }
    res.status(status).json({
      error:
        error instanceof Error
          ? error.message
          : "Durable dashboard request failed.",
    });
  };
  router.use(handleError);
  return router;
}
