import { CronParser } from "@bluelibs/runner/node";
import type {
  Schedule,
  ScheduleOptions,
  UpdateScheduleOptions,
} from "@bluelibs/runner/node";
import z from "zod";
import type { DashboardRuntime } from "./runtime";
import { requireWorkflow } from "./runtime";
import { bodyRecord, DurableHttpError, nonEmpty, requireValue } from "./errors";
import { jsonSafe } from "./projection";
import type { StudioSchedule } from "./shared/types";

function parseCadence(body: Record<string, unknown>): ScheduleOptions {
  if (
    [body.cron, body.interval, body.at, body.delay].filter(
      (value) => value !== undefined
    ).length !== 1
  ) {
    throw new DurableHttpError(
      400,
      "Provide exactly one of cron, interval, at or delay."
    );
  }
  if (body.timezone !== undefined && body.cron === undefined) {
    throw new DurableHttpError(400, "Timezone is only valid with cron.");
  }
  if (body.cron !== undefined) {
    const cron = nonEmpty(body.cron);
    const timezone =
      body.timezone === undefined ? undefined : nonEmpty(body.timezone);
    if (!CronParser.isValid(cron, timezone))
      throw new DurableHttpError(400, "Invalid cron expression or timezone.");
    return { cron, timezone };
  }
  if (body.interval !== undefined)
    return { interval: z.number().int().positive().parse(body.interval) };
  if (body.delay !== undefined)
    return { delay: z.number().int().nonnegative().parse(body.delay) };
  const at = z.coerce.date().parse(body.at);
  if (at.getTime() <= Date.now())
    throw new DurableHttpError(
      400,
      "One-time schedules must be in the future."
    );
  return { at };
}

export function toSchedule(
  runtime: DashboardRuntime,
  schedule: Schedule
): StudioSchedule {
  return {
    id: schedule.id,
    workflowKey: schedule.workflowKey,
    workflowTitle:
      runtime.workflows.get(schedule.workflowKey)?.meta?.title ??
      schedule.workflowKey,
    type: schedule.type,
    pattern: schedule.pattern,
    timezone: schedule.timezone,
    input: jsonSafe(schedule.input),
    status: schedule.status,
    lastRun: schedule.lastRun?.toISOString() ?? null,
    nextRun: schedule.nextRun?.toISOString() ?? null,
    createdAt: schedule.createdAt.toISOString(),
    updatedAt: schedule.updatedAt.toISOString(),
  };
}

export async function createSchedule(
  runtime: DashboardRuntime,
  input: unknown
): Promise<{ scheduleId: string }> {
  const body = bodyRecord(input);
  const task = requireWorkflow(runtime, nonEmpty(body.workflow));
  const options = parseCadence(body);
  if (body.id !== undefined) {
    const id = nonEmpty(body.id);
    if (options.cron !== undefined)
      return {
        scheduleId: await runtime.durable.ensureSchedule(task.id, body.input, {
          ...options,
          id,
        }),
      };
    if (options.interval !== undefined)
      return {
        scheduleId: await runtime.durable.ensureSchedule(task.id, body.input, {
          ...options,
          id,
        }),
      };
    throw new DurableHttpError(400, "One-time schedules cannot specify an id.");
  }
  return {
    scheduleId: await runtime.durable.schedule(task.id, body.input, options),
  };
}

export function previewSchedule(input: unknown): { fires: string[] } {
  const options = parseCadence(bodyRecord(input));
  const fires: string[] = [];
  let next = new Date();
  for (let index = 0; index < 5; index++) {
    if (options.cron !== undefined)
      next = CronParser.getNextRun(options.cron, next, options.timezone);
    else if (options.interval !== undefined)
      next = new Date(next.getTime() + options.interval);
    else next = options.at ?? new Date(next.getTime() + (options.delay ?? 0));
    fires.push(next.toISOString());
    if (options.cron === undefined && options.interval === undefined) break;
  }
  return { fires };
}

export async function scheduleAction(
  runtime: DashboardRuntime,
  id: string,
  action: string,
  input?: unknown
): Promise<{ accepted: true }> {
  const existing = requireValue(
    await runtime.durable.getSchedule(id),
    `Unknown schedule '${id}'.`
  );
  if (action === "pause") await runtime.durable.pauseSchedule(id);
  else if (action === "resume") await runtime.durable.resumeSchedule(id);
  else if (action === "delete") await runtime.durable.removeSchedule(id);
  else {
    const body = bodyRecord(input);
    if (
      body.workflow !== undefined ||
      body.at !== undefined ||
      body.delay !== undefined
    ) {
      throw new DurableHttpError(
        400,
        "A recurring schedule can update input, cron or interval only."
      );
    }
    const task = requireWorkflow(runtime, existing.workflowKey);
    if (
      "input" in body &&
      task.inputSchema &&
      typeof task.inputSchema === "object" &&
      "parse" in task.inputSchema
    ) {
      task.inputSchema.parse(body.input);
    }
    let updates: UpdateScheduleOptions;
    if (body.cron !== undefined || body.interval !== undefined) {
      const options = parseCadence(body);
      if (options.cron !== undefined)
        updates = {
          cron: options.cron,
          timezone: options.timezone,
          ...("input" in body ? { input: body.input } : {}),
        };
      else if (options.interval !== undefined)
        updates = {
          interval: options.interval,
          ...("input" in body ? { input: body.input } : {}),
        };
      else throw new DurableHttpError(400, "Expected recurring cadence.");
    } else {
      if (body.timezone !== undefined)
        throw new DurableHttpError(400, "Provide cron when changing timezone.");
      if (!("input" in body))
        throw new DurableHttpError(400, "Provide input, cron or interval.");
      updates = { input: body.input };
    }
    await runtime.durable.updateSchedule(id, updates);
  }
  return { accepted: true };
}
