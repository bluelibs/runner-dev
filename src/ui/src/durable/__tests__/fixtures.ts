import type {
  StudioExecutionDetail,
  StudioExecutionSummary,
  StudioSchedule,
  StudioWorkflow,
} from "../../../../durable/shared/types";

export const timestamp = "2026-10-08T10:00:00.000Z";

export const workflow: StudioWorkflow = {
  key: "orders",
  taskId: "app.orders",
  title: "Order fulfillment",
  category: "Commerce",
  description: "Ship paid orders",
  signals: [],
  presets: [{ name: "Example order", payload: { orderId: "order-1" } }],
  graph: { nodes: [], edges: [] },
};

export function execution(
  overrides: Partial<StudioExecutionSummary> = {}
): StudioExecutionSummary {
  return {
    id: "run-1",
    workflowKey: workflow.key,
    workflowTitle: workflow.title,
    status: "running",
    attempt: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
    completedAt: null,
    position: "Waiting for payment",
    ...overrides,
  };
}

export function executionDetail(
  overrides: Partial<StudioExecutionDetail> = {}
): StudioExecutionDetail {
  return {
    ...execution(),
    maxAttempts: 3,
    input: { orderId: "order-1" },
    result: null,
    error: null,
    timeline: [],
    edges: [],
    steps: [],
    audit: [],
    signals: [],
    state: null,
    relations: { parent: null, children: [] },
    ...overrides,
  };
}

export function schedule(
  overrides: Partial<StudioSchedule> = {}
): StudioSchedule {
  return {
    id: "daily-orders",
    workflowKey: workflow.key,
    workflowTitle: workflow.title,
    type: "interval",
    pattern: "60000",
    input: {},
    status: "active",
    lastRun: null,
    nextRun: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}
