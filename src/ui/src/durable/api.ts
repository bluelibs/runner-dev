/** Runtime-scoped Studio client using Runner Dev’s existing browser authentication. */
import type {
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
  listWorkflowPage(query?: WorkflowQuery): Promise<WorkflowPage>;
  getWorkflow(key: string): Promise<StudioWorkflow>;
  listWorkflows(): Promise<StudioWorkflow[]>;
  listExecutions(filters?: ExecutionFilters): Promise<StudioExecutionSummary[]>;
  listExecutionPage(filters?: ExecutionFilters): Promise<StudioExecutionPage>;
  getExecution(id: string): Promise<StudioExecutionDetail>;
  startExecution(workflow: string, input: unknown): Promise<string>;
  sendSignal(id: string, signal: string, payload: unknown): Promise<void>;
  cancelExecution(id: string): Promise<void>;
  retryExecution(id: string): Promise<void>;
  pauseExecution(id: string): Promise<void>;
  resumeExecution(id: string): Promise<void>;
  restartExecution(id: string, input?: unknown): Promise<string>;
  forceFailExecution(id: string, reason: string): Promise<void>;
  skipStep(id: string, stepId: string, reason: string): Promise<void>;
  editState(
    id: string,
    stepId: string,
    result: unknown,
    reason: string
  ): Promise<void>;
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

export function createLiveApi(runtimeId: string): StudioApi {
  async function request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = new URL(`/durable${path}`, window.location.origin);
    url.searchParams.set("runtimeId", runtimeId);
    const response = await fetch(url, {
      method,
      headers:
        body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const parsed = await response.json();
    if (!response.ok) {
      throw new ApiError(
        response.status,
        typeof parsed?.error === "string" ? parsed.error : response.statusText
      );
    }
    return parsed as T;
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
    listWorkflowPage: (query = {}) => {
      const params = new URLSearchParams();
      if (query.query) params.set("query", query.query);
      if (query.cursor) params.set("cursor", query.cursor);
      params.set("limit", String(query.limit ?? 20));
      return request("GET", `/api/workflows?${params}`);
    },
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
    startExecution: async (workflow, input) =>
      (
        await request<{ executionId: string }>("POST", "/api/executions", {
          workflow,
          input,
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
      const controller = new AbortController();
      const poll = async () => {
        try {
          const url = new URL(
            `/durable/api/executions/${encodeURIComponent(id)}`,
            window.location.origin
          );
          url.searchParams.set("runtimeId", runtimeId);
          const response = await fetch(url, { signal: controller.signal });
          const parsed = await response.json();
          if (!response.ok)
            throw new ApiError(
              response.status,
              parsed.error ?? response.statusText
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
        controller.abort();
        window.clearTimeout(timer);
      };
    },
  };
  return api;
}
