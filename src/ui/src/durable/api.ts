import type { DurableCatalogEntry } from "../../../durable/shared/catalog";
/** Runtime-scoped Studio client using Runner Dev’s existing browser authentication. */
import type {
  StudioCommandResult,
  StudioExecutionDetail,
  StudioExecutionPage,
  StudioExecutionSummary,
  StudioRecoverReport,
  StudioSchedule,
  StudioWorkflow,
} from "../../../durable/shared/types";
import type {
  WorkflowPage,
  WorkflowQuery,
} from "../../../durable/shared/workflowPage";

export interface ExecutionFilters {
  workflowKey?: string;
  status?: string;
  limit?: number;
  offset?: number;
  cursor?: string;
  executionId?: string;
}

export interface StudioApi {
  listCatalog(query: WorkflowQuery): Promise<{
    entries: DurableCatalogEntry[];
    total: number;
    nextCursor: string | null;
  }>;
  listWorkflowPage(query?: WorkflowQuery): Promise<WorkflowPage>;
  getWorkflow(key: string): Promise<StudioWorkflow>;
  listWorkflows(): Promise<StudioWorkflow[]>;
  listExecutions(filters?: ExecutionFilters): Promise<StudioExecutionSummary[]>;
  listExecutionPage(filters?: ExecutionFilters): Promise<StudioExecutionPage>;
  getExecution(id: string): Promise<StudioExecutionDetail>;
  startExecution(
    workflow: string,
    input: unknown,
    version?: number | null
  ): Promise<string>;
  sendSignal(id: string, signal: string, payload: unknown): Promise<void>;
  sendCommand(
    id: string,
    command: string,
    input: unknown,
    options?: { idempotencyKey?: string; waitTimeoutMs?: number }
  ): Promise<StudioCommandResult>;
  cancelExecution(id: string): Promise<void>;
  retryExecution(id: string): Promise<void>;
  pauseExecution(id: string): Promise<void>;
  resumeExecution(id: string): Promise<void>;
  restartExecution(id: string, input?: unknown): Promise<string>;
  resetExecution(
    id: string,
    beforeStep: string,
    reason: string,
    idempotencyKey?: string
  ): Promise<string>;
  exportReplay(id: string): Promise<unknown>;
  forceFailExecution(id: string, reason: string): Promise<void>;
  skipStep(id: string, stepId: string, reason: string): Promise<void>;
  editState(
    id: string,
    stepId: string,
    result: unknown,
    reason: string
  ): Promise<void>;
  listScheduleRuns(id: string, cursor?: string): Promise<StudioExecutionPage>;
  listSchedules(): Promise<StudioSchedule[]>;
  createSchedule(body: Record<string, unknown>): Promise<string>;
  previewSchedule(body: Record<string, unknown>): Promise<string[]>;
  updateSchedule(id: string, body: Record<string, unknown>): Promise<void>;
  pauseSchedule(id: string): Promise<void>;
  resumeSchedule(id: string): Promise<void>;
  removeSchedule(id: string): Promise<void>;
  listStuck(): Promise<StudioExecutionSummary[]>;
  recover(): Promise<StudioRecoverReport>;
  subscribeExecution(
    id: string,
    onDetail: (detail: StudioExecutionDetail) => void,
    onError?: (error: unknown) => void
  ): () => void;
}

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

function workflowParams(query: WorkflowQuery) {
  const params = new URLSearchParams();
  if (query.query) params.set("query", query.query);
  if (query.cursor) params.set("cursor", query.cursor);
  params.set("limit", String(query.limit ?? 20));
  return params;
}

export function createLiveApi(runtimeId: string): StudioApi {
  async function request<T>(
    method: string,
    path: string,
    body?: unknown,
    controller?: AbortController
  ): Promise<T> {
    const url = new URL(`/durable${path}`, window.location.origin);
    url.searchParams.set("runtimeId", runtimeId);
    // Only reads have a deadline: cancelling a write cannot prove it was not applied.
    const readController =
      method === "GET" ? controller ?? new AbortController() : undefined;
    let timedOut = false;
    const timeout = readController
      ? window.setTimeout(() => {
          timedOut = true;
          readController.abort();
        }, 30_000)
      : undefined;
    try {
      const response = await fetch(url, {
        method,
        headers:
          body === undefined
            ? undefined
            : { "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
        ...(readController ? { signal: readController.signal } : {}),
      });
      const parsed = await response.json();
      if (!response.ok) {
        throw new ApiError(
          response.status,
          typeof parsed?.error === "string" ? parsed.error : response.statusText
        );
      }
      return parsed as T;
    } catch (error) {
      if (timedOut)
        throw new ApiError(
          408,
          "Read request timed out after 30 seconds. Try again."
        );
      throw error;
    } finally {
      window.clearTimeout(timeout);
    }
  }

  async function listExecutionPage(
    filters?: ExecutionFilters
  ): Promise<StudioExecutionPage> {
    const params = new URLSearchParams();
    if (filters?.workflowKey) params.set("workflowKey", filters.workflowKey);
    if (filters?.status) params.set("status", filters.status);
    params.set("limit", String(filters?.limit ?? 100));
    if (filters?.offset !== undefined)
      params.set("offset", String(filters.offset));
    if (filters?.cursor) params.set("cursor", filters.cursor);
    if (filters?.executionId) params.set("executionId", filters.executionId);
    return await request<StudioExecutionPage>(
      "GET",
      `/api/executions?${params.toString()}`
    );
  }

  const api: StudioApi = {
    listCatalog: (query) =>
      request("GET", "/api/catalog?" + workflowParams(query)),
    listWorkflowPage: (query = {}) =>
      request("GET", "/api/workflows?" + workflowParams(query)),

    getWorkflow: async (key) =>
      (
        await request<{ workflow: StudioWorkflow }>(
          "GET",
          `/api/workflows/${encodeURIComponent(key)}`
        )
      ).workflow,
    listWorkflows: async () =>
      (await request<{ workflows: StudioWorkflow[] }>("GET", "/api/workflows"))
        .workflows,
    listExecutions: async (filters) =>
      (await listExecutionPage(filters)).executions,
    listExecutionPage,
    getExecution: async (id) =>
      (
        await request<{ execution: StudioExecutionDetail }>(
          "GET",
          `/api/executions/${encodeURIComponent(id)}`
        )
      ).execution,
    startExecution: async (workflow, input, version) =>
      (
        await request<{ executionId: string }>("POST", "/api/executions", {
          workflow,
          input,
          ...(version !== undefined ? { version } : {}),
        })
      ).executionId,
    sendSignal: async (id, signal, payload) => {
      await request(
        "POST",
        `/api/executions/${encodeURIComponent(id)}/signals`,
        {
          signal,
          payload,
        }
      );
    },
    sendCommand: async (id, command, input, options) =>
      await request<StudioCommandResult>(
        "POST",
        `/api/executions/${encodeURIComponent(id)}/commands`,
        {
          command,
          input,
          ...(options?.idempotencyKey
            ? { idempotencyKey: options.idempotencyKey }
            : {}),
          ...(options?.waitTimeoutMs !== undefined
            ? { waitTimeoutMs: options.waitTimeoutMs }
            : {}),
        }
      ),
    cancelExecution: async (id) => {
      await request("POST", `/api/executions/${encodeURIComponent(id)}/cancel`);
    },
    retryExecution: async (id) => {
      await request("POST", `/api/executions/${encodeURIComponent(id)}/retry`);
    },
    pauseExecution: async (id) => {
      await request("POST", `/api/executions/${encodeURIComponent(id)}/pause`);
    },
    resumeExecution: async (id) => {
      await request("POST", `/api/executions/${encodeURIComponent(id)}/resume`);
    },
    restartExecution: async (id, input) =>
      (
        await request<{ executionId: string }>(
          "POST",
          `/api/executions/${encodeURIComponent(id)}/restart`,
          input === undefined ? undefined : { input }
        )
      ).executionId,
    resetExecution: async (id, beforeStep, reason, idempotencyKey) =>
      (
        await request<{ executionId: string }>(
          "POST",
          `/api/executions/${encodeURIComponent(id)}/reset`,
          {
            beforeStep,
            reason,
            ...(idempotencyKey ? { idempotencyKey } : {}),
          }
        )
      ).executionId,
    exportReplay: async (id) =>
      (
        await request<{ fixture: unknown }>(
          "GET",
          `/api/executions/${encodeURIComponent(id)}/replay`
        )
      ).fixture,
    forceFailExecution: async (id, reason) => {
      await request(
        "POST",
        `/api/executions/${encodeURIComponent(id)}/force-fail`,
        { reason }
      );
    },
    skipStep: async (id, stepId, reason) => {
      await request(
        "POST",
        `/api/executions/${encodeURIComponent(id)}/skip-step`,
        {
          stepId,
          reason,
        }
      );
    },
    editState: async (id, stepId, result, reason) => {
      await request(
        "POST",
        `/api/executions/${encodeURIComponent(id)}/edit-state`,
        {
          stepId,
          result,
          reason,
        }
      );
    },
    listScheduleRuns: (id, cursor) =>
      request(
        "GET",
        `/api/schedules/${encodeURIComponent(id)}/runs${
          cursor ? "?" + new URLSearchParams({ cursor }) : ""
        }`
      ),
    listSchedules: async () =>
      (await request<{ schedules: StudioSchedule[] }>("GET", "/api/schedules"))
        .schedules,
    createSchedule: async (body) =>
      (await request<{ scheduleId: string }>("POST", "/api/schedules", body))
        .scheduleId,
    previewSchedule: async (body) =>
      (
        await request<{ fires: string[] }>(
          "POST",
          "/api/schedules/preview",
          body
        )
      ).fires,
    updateSchedule: async (id, body) => {
      await request("PATCH", `/api/schedules/${encodeURIComponent(id)}`, body);
    },
    pauseSchedule: async (id) => {
      await request("POST", `/api/schedules/${encodeURIComponent(id)}/pause`);
    },
    resumeSchedule: async (id) => {
      await request("POST", `/api/schedules/${encodeURIComponent(id)}/resume`);
    },
    removeSchedule: async (id) => {
      await request("DELETE", `/api/schedules/${encodeURIComponent(id)}`);
    },
    listStuck: async () =>
      (
        await request<{ executions: StudioExecutionSummary[] }>(
          "GET",
          "/api/stuck"
        )
      ).executions,
    recover: async () =>
      (await request<{ report: StudioRecoverReport }>("POST", "/api/recover"))
        .report,
    subscribeExecution: (id, onDetail, onError) => {
      let stopped = false;
      let timer: number | undefined;
      let controller: AbortController | undefined;
      const poll = async () => {
        try {
          if (document.hidden) return;
          controller = new AbortController();
          const parsed = await request<{ execution: StudioExecutionDetail }>(
            "GET",
            `/api/executions/${encodeURIComponent(id)}`,
            undefined,
            controller
          );
          if (!stopped) onDetail(parsed.execution);
        } catch (error) {
          if (!stopped) onError?.(error);
        } finally {
          if (!stopped) timer = window.setTimeout(poll, 2000);
        }
      };
      void poll();
      return () => {
        stopped = true;
        controller?.abort();
        window.clearTimeout(timer);
      };
    },
  };
  return api;
}
