/**
 * API data contracts shared by the studio server and the web client.
 *
 * Everything here is plain JSON-serialisable data: no Runner imports, so the
 * Vite app can import this file directly without pulling Node-only code.
 */

/** Execution lifecycle states, mirroring the durable engine. */
export type StudioExecutionStatus =
  | "pending"
  | "running"
  | "cancelling"
  | "retrying"
  | "sleeping"
  | "paused"
  | "completed"
  | "compensation_failed"
  | "failed"
  | "cancelled"
  | "continued_as_new";

/** Visual node kinds rendered on the execution timeline. */
export type StudioNodeKind =
  | "step"
  | "sleep"
  | "signal"
  | "switch"
  | "child"
  | "note"
  | "command"
  | "state"
  | "continue";

/** Runtime state of a single timeline node. */
export type StudioNodeState =
  | "completed"
  | "active"
  | "waiting"
  | "failed"
  | "skipped"
  | "pending"
  | "unreached";

/** A static node of a workflow graph, declared in the catalog. */
export interface StudioGraphNode {
  /** Persisted durable step id (e.g. `validateOrder`, `__signal:awaitPayment`). */
  id: string;
  kind: StudioNodeKind;
  label: string;
  description: string;
  /** Signal id for `signal` nodes. */
  signal?: string;
  /** Branch ids for `switch` nodes. */
  branches?: string[];
}

/** A static edge of a workflow graph. */
export interface StudioGraphEdge {
  from: string;
  to: string;
  /** Switch branch this edge belongs to (for branch edges). */
  branch?: string;
  label?: string;
}

/** Static workflow graph used for visualisation. */
export interface StudioWorkflowGraph {
  nodes: StudioGraphNode[];
  edges: StudioGraphEdge[];
}

/** A tracked command task declared on a durable workflow version. */
export interface StudioCommand {
  taskKey: string;
  title: string;
  description: string;
}

/** One registered implementation version of a durable workflow. */
export interface StudioWorkflowVersion {
  version: number | null;
  taskId: string;
  title: string;
  description: string;
  signals: StudioSignal[];
  commands: StudioCommand[];
  presets: StudioInputPreset[];
}

/** Retention delay schedule for completed-execution history or receipt cleanup. */
export type StudioRetentionSchedule = "retain" | "delete" | { afterMs: number };

/** Resolved retention policy and derived cleanup deadlines. */
export interface StudioExecutionRetention {
  onComplete: StudioRetentionSchedule;
  receipts?: StudioRetentionSchedule;
  historyCollectAt?: string | null;
  receiptExpireAt?: string | null;
}

/** Ordered operation checkpoint metadata recorded by Runner 6.10+. */
export interface StudioHistoryEntry {
  stepId: string;
  kind: string;
  parentStepId?: string;
  taskKey?: string;
  workflowVersion?: number;
  startedOrder: number;
  completedOrder?: number;
  hasStateSnapshot?: boolean;
}

/** Result of submitting a tracked workflow command from Studio. */
export interface StudioCommandResult {
  accepted: true;
  completed: boolean;
  pending?: boolean;
  result?: unknown;
  message?: string;
}

/** A runnable workflow presented in the studio sidebar. */
export interface StudioWorkflow {
  key: string;
  /** Registered task identity for links into Runner Dev documentation. */
  taskId?: string;
  title: string;
  category: string;
  description: string;
  /** Primary implementation version when versioned. */
  version?: number;
  /** All discovered implementations sharing this durable workflow key. */
  versions?: StudioWorkflowVersion[];
  /** Signals this workflow can receive. */
  signals: StudioSignal[];
  /** Declared tracked commands accepted by this workflow. */
  commands?: StudioCommand[];
  /** Default completion retention policy configured on this workflow. */
  retention?: StudioExecutionRetention;
  /** Human-readable global attempt concurrency/rate-limit policy. */
  concurrency?: string;
  /** Named input presets for the start dialog. */
  presets: StudioInputPreset[];
  graph: StudioWorkflowGraph;
}

/** A signal a workflow can receive, with payload presets. */
export interface StudioSignal {
  id: string;
  title: string;
  description: string;
  presets: StudioInputPreset[];
}

/** A named JSON payload preset. */
export interface StudioInputPreset {
  name: string;
  payload: unknown;
}

/** Compact execution row for lists. */
export interface StudioExecutionSummary {
  id: string;
  workflowKey: string;
  workflowTitle: string;
  /** Pinned workflow implementation version when versioned. */
  workflowVersion?: number;
  status: StudioExecutionStatus;
  attempt: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  /** Short human line describing where the execution currently sits. */
  position: string | null;
  /** Direct parent execution when this run was started by another workflow. */
  parentExecutionId?: string;
  /** Forward link when this run was continued as a new execution. */
  continuedAsExecutionId?: string;
  /** Source execution when this run was created via continue-as-new. */
  continuedFromExecutionId?: string;
  /** Forward link to the run created by restarting this one. */
  restartedAsExecutionId?: string;
  /** Source execution when this run was created via restart. */
  restartedFromExecutionId?: string;
  /** Source execution when this run was created via checkpoint reset. */
  resetFromExecutionId?: string;
  /** First top-level step omitted from the branched checkpoint prefix. */
  resetBeforeStep?: string;
  /** Operator explanation retained on a checkpoint branch. */
  resetReason?: string;
  /** Timestamp when bulky history was collected, leaving only receipt metadata. */
  historyCollectedAt?: string | null;
}

/** A JSON-safe persisted step result. */
export interface StudioStepResult {
  stepId: string;
  result: unknown;
  completedAt: string;
}

/** A JSON-safe audit entry. */
export interface StudioAuditEntry {
  id: string;
  at: string;
  kind: string;
  attempt: number;
  detail: Record<string, unknown>;
}

/** One accepted signal payload in its execution-level journal. */
export interface StudioSignalRecord {
  id: string;
  payload: unknown;
  receivedAt: string;
  /** Queued records still await a matching wait; consumed records already resumed one. */
  state: "queued" | "consumed";
}

/** Retained journal for one signal id. */
export interface StudioSignalJournal {
  signalId: string;
  history: StudioSignalRecord[];
}

/** Runtime overlay for one graph node. */
export interface StudioTimelineNode extends StudioGraphNode {
  state: StudioNodeState;
  /** Switch branch taken, when known. */
  branchTaken: string | null;
  result: unknown;
  completedAt: string | null;
  /** Enclosing step when recorded inside a callback. */
  parentStepId?: string;
  /** Canonical task key or child workflow key from ordered history. */
  taskKey?: string;
  /** Pinned child workflow version observed at the call site. */
  workflowVersion?: number;
  /** True when checkpoint reset can branch immediately before this node. */
  resettable?: boolean;
  /** Live wait metadata (signal waits, sleeps) for countdowns. */
  wait: {
    signalId?: string;
    targetExecutionId?: string;
    timeoutAtMs?: number;
    fireAtMs?: number;
  } | null;
}

/** Full execution detail backing the detail view. */
export interface StudioExecutionDetail {
  id: string;
  /** Direct parent execution when this run was started by another workflow. */
  parentExecutionId?: string;
  /** Forward link when this run was continued as a new execution. */
  continuedAsExecutionId?: string;
  /** Source execution when this run was created via continue-as-new. */
  continuedFromExecutionId?: string;
  /** Forward link to the run created by restarting this one. */
  restartedAsExecutionId?: string;
  /** Source execution when this run was created via restart. */
  restartedFromExecutionId?: string;
  /** Source execution when this run was created via checkpoint reset. */
  resetFromExecutionId?: string;
  /** First top-level step omitted from the branched checkpoint prefix. */
  resetBeforeStep?: string;
  /** Operator explanation retained on a checkpoint branch. */
  resetReason?: string;
  /** Status the execution held when it was paused; set only while paused. */
  pausedFrom?: StudioExecutionStatus;
  /** Current continuation tip status, when this execution continued as new. */
  continuedChainTipStatus?: StudioExecutionStatus;
  workflowKey: string;
  workflowTitle: string;
  /** Pinned workflow implementation version when versioned. */
  workflowVersion?: number;
  /** Ordered operation history was captured from admission. */
  historyRecorded?: boolean;
  /** Timestamp when bulky history was collected, leaving receipt only. */
  historyCollectedAt?: string | null;
  /** Admission-time retention policy and deadlines. */
  retention?: StudioExecutionRetention | null;
  status: StudioExecutionStatus;
  attempt: number;
  maxAttempts: number;
  input: unknown;
  result: unknown;
  error: { message: string; stack?: string; stepId?: string } | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  position: string | null;
  timeline: StudioTimelineNode[];
  edges: StudioGraphEdge[];
  steps: StudioStepResult[];
  /** Ordered operation history recorded for replay and checkpoint reset. */
  history?: StudioHistoryEntry[];
  /** Top-level step IDs eligible as checkpoint reset boundaries. */
  resettableSteps?: string[];
  audit: StudioAuditEntry[];
  signals: StudioSignalJournal[];
  /** Workflow-owned typed state; null until the workflow first sets state. */
  state: { state: unknown; updatedAt: string } | null;
  relations: {
    parent: StudioExecutionSummary | null;
    children: StudioExecutionSummary[];
  };
}

/** Query filters for the executions list endpoint. */
export interface StudioExecutionFilters {
  workflowKey?: string;
  status?: StudioExecutionStatus | "live";
  limit?: number;
  offset?: number;
  /** Stable continuation token; preferred over legacy offsets. */
  cursor?: string;
  /** Exact execution ID lookup, across the entire history. */
  executionId?: string;
}

/** One bounded execution page for progressively loaded operator views. */
export interface StudioExecutionPage {
  executions: StudioExecutionSummary[];
  hasMore: boolean;
  /** Offset for the next page, or `null` when the result set is exhausted. */
  nextOffset: number | null;
  /** Stable continuation token for the indexed operator path. */
  nextCursor?: string | null;
  /** Exact filtered total when the backing store can provide it cheaply. */
  total?: number;
}

/** A durable schedule (cron / interval / one-time timer). */
export interface StudioSchedule {
  id: string;
  workflowKey: string;
  workflowTitle: string;
  workflowVersion?: number;
  type: "cron" | "interval";
  pattern: string;
  timezone?: string;
  input: unknown;
  status: string;
  lastRun: string | null;
  nextRun: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Result of an orphan-recovery run. */
export interface StudioRecoverReport {
  scannedCount: number;
  recoveredCount: number;
  skippedCount: number;
  failedCount: number;
}
