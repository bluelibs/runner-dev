import z from "zod";
import { requireValue } from "./errors";
import { toSummary } from "./projection";
import type { DashboardRuntime } from "./runtime";
import type { StudioExecutionPage } from "./shared/types";

const paging = z.object({ cursor: z.string().min(1).optional() });

/** Runner assigns timer:sched:<schedule id>:<fire epoch ms> to each recurring tick. */
function isScheduleRun(executionId: string, scheduleId: string): boolean {
  const boundary = executionId.lastIndexOf(":");
  return (
    executionId.slice(0, boundary) === `timer:sched:${scheduleId}` &&
    /^\d+$/.test(executionId.slice(boundary + 1))
  );
}

export async function listScheduleRuns(
  runtime: DashboardRuntime,
  id: string,
  input: unknown
): Promise<StudioExecutionPage> {
  const schedule = requireValue(
    await runtime.durable.getSchedule(id),
    `Unknown schedule '${id}'.`
  );
  let { cursor } = paging.parse(input);
  // Runner indexes by workflow. Bound work for sparse schedules and let the
  // caller continue with the store's cursor, including after an empty page.
  for (let page = 0; ; page++) {
    const { states, nextCursor } =
      await runtime.durable.operator.listExecutionStates({
        workflowKey: schedule.workflowKey,
        cursor,
        limit: 50,
      });
    const executions = states
      .filter((state) => isScheduleRun(state.id, id))
      .map((state) => toSummary(runtime, state));
    if (executions.length || !nextCursor || page === 3)
      return {
        executions,
        nextCursor,
        hasMore: nextCursor !== null,
        nextOffset: null,
      };
    cursor = nextCursor;
  }
}
