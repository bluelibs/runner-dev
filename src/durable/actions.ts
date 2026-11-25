import type { Logger } from "@bluelibs/runner";
import { errors } from "@bluelibs/runner";
import z from "zod";
import {
  type DashboardRuntime,
  findWorkflowForExecution,
  requireWorkflow,
  resolveCommand,
  resolveSignal,
  safeGetOperator,
} from "./runtime";
import { bodyRecord, DurableHttpError, nonEmpty } from "./errors";
import { requireActive, requireExecution } from "./executions";
import { isTerminal, jsonSafe } from "./projection";

const optionalVersionSchema = z
  .union([z.number().int().positive(), z.null()])
  .optional();

export async function startExecution(
  runtime: DashboardRuntime,
  input: unknown
): Promise<{ executionId: string }> {
  const body = bodyRecord(input);
  const version = optionalVersionSchema.parse(body.version);
  const task = requireWorkflow(runtime, nonEmpty(body.workflow), version);
  return { executionId: await runtime.durable.start(task, body.input) };
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
    const task =
      findWorkflowForExecution(
        runtime,
        execution.workflowKey,
        execution.workflowVersion
      ) ?? requireWorkflow(runtime, execution.workflowKey);
    const signal = resolveSignal(runtime, task, nonEmpty(body.signal));
    await durable.signal(id, signal, body.payload);
    return { delivered: true };
  }
  if (
    action === "commands" &&
    runtime.descriptor.capabilities.command &&
    "command" in durable &&
    typeof durable.command === "function"
  ) {
    requireActive(execution);
    const task =
      findWorkflowForExecution(
        runtime,
        execution.workflowKey,
        execution.workflowVersion
      ) ?? requireWorkflow(runtime, execution.workflowKey);
    const commandKey = nonEmpty(body.command);
    const commandTask = resolveCommand(runtime, task, commandKey);
    const idempotencyKey =
      body.idempotencyKey === undefined
        ? undefined
        : nonEmpty(body.idempotencyKey);
    const waitTimeoutMs = z
      .number()
      .int()
      .min(500)
      .max(30_000)
      .optional()
      .parse(body.waitTimeoutMs);
    const effectiveWaitTimeoutMs =
      String(execution.status) === "paused"
        ? Math.min(waitTimeoutMs ?? 500, 500)
        : waitTimeoutMs ?? 10_000;
    try {
      const result: unknown = await durable.command(
        id,
        commandTask,
        body.input,
        {
          ...(idempotencyKey ? { idempotencyKey } : {}),
          waitTimeoutMs: effectiveWaitTimeoutMs,
        }
      );
      return {
        accepted: true,
        completed: true,
        result: jsonSafe(result),
      };
    } catch (error) {
      if (
        errors.durableExecutionInvariantError.is(error) &&
        error.message.includes("Command wait timed out")
      ) {
        return {
          accepted: true,
          completed: false,
          pending: true,
          message:
            "Command accepted and queued; waiting for the execution to process it.",
        };
      }
      throw error;
    }
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
        "continued_as_new",
      ].includes(execution.status)
    ) {
      throw new DurableHttpError(
        409,
        "Only terminal or paused executions can be restarted."
      );
    }
    if (execution.historyCollectedAt) {
      throw new DurableHttpError(
        409,
        "Execution history was collected; start a new workflow run instead."
      );
    }
    if (
      !findWorkflowForExecution(
        runtime,
        execution.workflowKey,
        execution.workflowVersion
      )
    ) {
      requireWorkflow(runtime, execution.workflowKey);
    }
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
  const operator = safeGetOperator(durable);
  if (
    action === "reset" &&
    runtime.descriptor.capabilities.reset &&
    typeof operator?.reset === "function"
  ) {
    if (
      String(execution.status) !== "paused" &&
      !isTerminal(execution.status)
    ) {
      throw new DurableHttpError(
        409,
        "Pause the execution before resetting to a checkpoint."
      );
    }
    if (execution.historyCollectedAt) {
      throw new DurableHttpError(
        409,
        "Execution history was collected and cannot be reset."
      );
    }
    const beforeStep = nonEmpty(body.beforeStep);
    const reason = nonEmpty(body.reason);
    const idempotencyKey =
      body.idempotencyKey === undefined
        ? undefined
        : nonEmpty(body.idempotencyKey);
    const executionId = await operator.reset(id, {
      beforeStep,
      reason,
      ...(idempotencyKey ? { idempotencyKey } : {}),
    });
    logger?.info(`Durable dashboard reset before '${beforeStep}': ${reason}`, {
      data: {
        runtimeId: runtime.descriptor.id,
        executionId: id,
        branchExecutionId: executionId,
        beforeStep,
      },
    });
    return { executionId };
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
