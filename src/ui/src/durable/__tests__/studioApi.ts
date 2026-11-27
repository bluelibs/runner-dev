import type { StudioExecutionDetail } from "../../../../durable/shared/types";
import type { StudioApi } from "../api";
import { execution, executionDetail, schedule, workflow } from "./fixtures";

export function studioApi(
  detail: StudioExecutionDetail = executionDetail()
): jest.Mocked<StudioApi> {
  return {
    listCatalog: jest
      .fn()
      .mockResolvedValue({ entries: [], total: 0, nextCursor: null }),
    listWorkflowPage: jest
      .fn()
      .mockResolvedValue({ workflows: [workflow], total: 1, nextCursor: null }),
    getWorkflow: jest.fn().mockResolvedValue(workflow),
    listWorkflows: jest.fn().mockResolvedValue([workflow]),
    listExecutions: jest.fn().mockResolvedValue([execution()]),
    listExecutionPage: jest.fn().mockResolvedValue({
      executions: [execution()],
      total: 1,
      hasMore: false,
      nextCursor: null,
      nextOffset: null,
    }),
    getExecution: jest.fn().mockResolvedValue(detail),
    startExecution: jest.fn().mockResolvedValue("new-run"),
    sendSignal: jest.fn().mockResolvedValue(undefined),
    sendCommand: jest.fn().mockResolvedValue({
      accepted: true,
      completed: true,
      result: { ok: true },
    }),
    cancelExecution: jest.fn().mockResolvedValue(undefined),
    retryExecution: jest.fn().mockResolvedValue(undefined),
    pauseExecution: jest.fn().mockResolvedValue(undefined),
    resumeExecution: jest.fn().mockResolvedValue(undefined),
    restartExecution: jest.fn().mockResolvedValue("restarted-run"),
    resetExecution: jest.fn().mockResolvedValue("branch-run"),
    exportReplay: jest.fn().mockResolvedValue({
      execution: { id: "run-1" },
      history: [],
      steps: [],
    }),
    forceFailExecution: jest.fn().mockResolvedValue(undefined),
    skipStep: jest.fn().mockResolvedValue(undefined),
    editState: jest.fn().mockResolvedValue(undefined),
    listScheduleRuns: jest.fn().mockResolvedValue({
      executions: [],
      hasMore: false,
      nextOffset: null,
      nextCursor: null,
    }),
    listSchedules: jest.fn().mockResolvedValue([schedule()]),
    createSchedule: jest.fn().mockResolvedValue("new-schedule"),
    previewSchedule: jest.fn().mockResolvedValue([]),
    updateSchedule: jest.fn().mockResolvedValue(undefined),
    pauseSchedule: jest.fn().mockResolvedValue(undefined),
    resumeSchedule: jest.fn().mockResolvedValue(undefined),
    removeSchedule: jest.fn().mockResolvedValue(undefined),
    listStuck: jest.fn().mockResolvedValue([]),
    recover: jest.fn().mockResolvedValue({
      scannedCount: 1,
      recoveredCount: 1,
      skippedCount: 0,
      failedCount: 0,
    }),
    subscribeExecution: jest.fn((_id, onDetail) => {
      onDetail(detail);
      return jest.fn();
    }),
  };
}
