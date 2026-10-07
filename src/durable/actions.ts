import type { Logger } from "@bluelibs/runner";
import z from "zod";
import type { DashboardRuntime } from "./runtime";
import { requireWorkflow, resolveSignal } from "./runtime";
import { bodyRecord, DurableHttpError, nonEmpty } from "./errors";
import { requireActive, requireExecution } from "./executions";

export async function startExecution(
  runtime: DashboardRuntime,
  input: unknown
): Promise<{ executionId: string }> {
  const body = bodyRecord(input);
  const task = requireWorkflow(runtime, nonEmpty(body.workflow));
  return { executionId: await runtime.durable.start(task.id, body.input) };
}

export async function executionAction(
  runtime: DashboardRuntime,
  id: string,
  action: string,
  input: unknown,
  logger?: Pick<Logger, "info">
): Promise<Record<string, unknown>> {
  const execution = await requireExecution(runtime, id);
  const body = bodyRecord(input);
  const durable = runtime.durable;
  if (action === "signals") {
    requireActive(execution);
    const task = requireWorkflow(runtime, execution.workflowKey);
    const signal = resolveSignal(runtime, task, nonEmpty(body.signal));
    await durable.signal(id, signal, body.payload);
    return { delivered: true };
  }
  if (action === "cancel") {
    requireActive(execution);
    await durable.cancelExecution(id, "Cancelled from durable dashboard");
    return { cancelled: true };
  }
  if (action === "retry") {
    // Store-level retry retains cancellation metadata, so cancelled runs require restart.
    if (!["failed", "compensation_failed"].includes(execution.status)) {
      throw new DurableHttpError(
        409,
        "Only failed or compensation_failed executions can be retried."
      );
    }
    await durable.operator.retryRollback(id);
    await durable.recover();
    return { retried: true };
  }
  if (
    action === "pause" &&
    "pauseExecution" in durable &&
    typeof durable.pauseExecution === "function"
  ) {
    requireActive(execution);
    await durable.pauseExecution(id);
    return { paused: true };
  }
  if (
    action === "resume" &&
    "resumeExecution" in durable &&
    typeof durable.resumeExecution === "function"
  ) {
    if (String(execution.status) !== "paused")
      throw new DurableHttpError(409, "Only paused executions can be resumed.");
    await durable.resumeExecution(id);
    return { resumed: true };
  }
  if (
    action === "restart" &&
    "restartExecution" in durable &&
    typeof durable.restartExecution === "function"
  ) {
    if (
      ![
        "paused",
        "completed",
        "failed",
        "cancelled",
        "compensation_failed",
      ].includes(execution.status)
    ) {
      throw new DurableHttpError(
        409,
        "Only terminal or paused executions can be restarted."
      );
    }
    requireWorkflow(runtime, execution.workflowKey);
    return {
      executionId: z
        .string()
        .parse(
          await durable.restartExecution(
            id,
            body.input === undefined ? undefined : { input: body.input }
          )
        ),
    };
  }
  if (
    action === "force-fail" ||
    action === "skip-step" ||
    action === "edit-state"
  ) {
    const reason = nonEmpty(body.reason);
    if (action === "force-fail") {
      requireActive(execution);
      await durable.operator.forceFail(id, reason);
    } else {
      const stepId = nonEmpty(body.stepId);
      if (action === "skip-step") await durable.operator.skipStep(id, stepId);
      else {
        if (!("result" in body))
          throw new DurableHttpError(400, "Provide the replacement 'result'.");
        await durable.operator.editState(id, stepId, body.result);
      }
    }
    // The public operator has no append-audit API. Reasons are server log entries,
    // not persisted durable audit notes; do not access private backend stores.
    logger?.info(`Durable dashboard ${action}: ${reason}`, {
      data: {
        runtimeId: runtime.descriptor.id,
        executionId: id,
        stepId: body.stepId,
      },
    });
    return { accepted: true };
  }
  throw new DurableHttpError(
    409,
    `Action '${action}' is unavailable with this Runner version.`
  );
}
