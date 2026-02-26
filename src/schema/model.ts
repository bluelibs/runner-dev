export interface TagUsage {
  id: string;
  config?: string | null;
  configSchema?: string | null;
}

export type MiddlewareApplyScope = "where-visible" | "subtree";
export type IsolationExportsMode = "unset" | "none" | "list";
export type TagTarget =
  | "tasks"
  | "resources"
  | "events"
  | "hooks"
  | "taskMiddlewares"
  | "resourceMiddlewares"
  | "errors";

export interface Meta {
  title?: string | null;
  description?: string | null;
}

export interface BaseElement {
  id: string;
  meta?: Meta | null;
  filePath?: string | null;
  // True when this element is internal to a resource isolate() boundary.
  isPrivate?: boolean;
  // Optional debugging detail for why this element is private/public.
  visibilityReason?: string | null;
  // Id of the resource that registered this element (if any)
  registeredBy?: string | null;
  overriddenBy?: string | null;

  // Normalized tag ids
  tags?: string[] | null;
  // Detailed tag usages with serialized config when present
  tagsDetailed?: TagUsage[] | null;
  // Pre-fetched coverage summary (percentage only) when available
  coverage?: { percentage?: number } | null;
}

export interface All extends BaseElement {
  id: string;
  meta?: Meta | null;
  filePath?: string | null;
}

// Events can't be overridden.
export interface Event extends Omit<BaseElement, "overriddenBy"> {
  id: string;
  meta?: Meta | null;
  filePath?: string | null;
  listenedToBy: string[];
  transactional: boolean;
  parallel: boolean;
  eventLane?: {
    laneId: string;
    orderingKey?: string | null;
    metadata?: string | null;
  } | null;
  // Prettified Zod schema for the event payload if provided
  payloadSchema?: string | null;
}

export interface TunnelInfo {
  mode: "client" | "server" | "both";
  transport: "http" | "other";
  tasks?: string[]; // tunneled task IDs
  events?: string[]; // tunneled event IDs
  endpoint?: string; // for client tunnels
  auth?: string; // auth method
  eventDeliveryMode?: string; // e.g., "mirror", "remote-only", "local-only", "remote-first"
}

export interface DurableFlowNode {
  kind: string;
  stepId?: string | null;
  durationMs?: number | null;
  signalId?: string | null;
  eventId?: string | null;
  selectedBranchId?: string | null;
  message?: string | null;
}

export interface DurableFlowShape {
  nodes: DurableFlowNode[];
}

export interface Tag extends BaseElement {
  id: string;
  configSchema?: string | null;
  targets?: TagTarget[] | null;
  tasks: Task[];
  hooks: Hook[];
  resources: Resource[];
  taskMiddlewares: Middleware[];
  resourceMiddlewares: Middleware[];
  events: Event[];
  errors: Error[];
}

// Internal discriminator for GraphQL type resolution (non-enumerable)
export type ElementKind =
  | "ALL"
  | "TASK"
  | "HOOK"
  | "RESOURCE"
  | "MIDDLEWARE"
  | "EVENT";

export const elementKindSymbol: unique symbol = Symbol(
  "runner-dev.elementKind"
);

// Optional typing marker for objects stamped at runtime
export type WithElementKind<T> = T & { [elementKindSymbol]?: ElementKind };

export interface MiddlewareAutoApply {
  enabled: boolean;
  scope: MiddlewareApplyScope | null;
  hasPredicate: boolean;
}

export interface MiddlewareUsage {
  id: string;
  config?: string | null;
}

export interface Middleware extends BaseElement {
  id: string;
  meta?: Meta | null;
  filePath?: string | null;
  autoApply: MiddlewareAutoApply;
  type: "task" | "resource";
  usedByTasks: string[];
  usedByResources: string[];
  // Prettified Zod schema for the middleware config if provided
  configSchema?: string | null;
}

export interface Task extends BaseElement {
  id: string;
  meta?: Meta | null;
  filePath?: string | null;
  emits: string[];
  dependsOn: string[];
  middleware: string[];
  middlewareDetailed?: MiddlewareUsage[];
  // Prettified Zod schema for the task input if provided
  inputSchema?: string | null;
  // Prettified Zod schema for the task result if provided
  resultSchema?: string | null;
  isDurable?: boolean;
  durableResourceId?: string | null;
  flowShape?: DurableFlowShape | null;
  // Runtime-registered per-task interceptors via taskDependency.intercept(...)
  interceptorCount?: number;
  hasInterceptors?: boolean;
  // Resource ids that registered local task interceptors.
  interceptorOwnerIds?: string[];
}

export interface Hook extends BaseElement {
  events: string[];
  hookOrder?: number | null;
  dependsOn: string[];
  emits: string[];
}

export interface Resource extends BaseElement {
  id: string;
  meta?: Meta | null;
  filePath?: string | null;
  // Events this resource may emit (from deps or lifecycle). For now we only
  // derive from dependencies; lifecycle emissions can be added later.
  emits: string[];
  // Resource dependencies (other resources this resource depends on)
  dependsOn: string[];
  config?: string | null;
  // Prettified Zod schema for the resource config if provided
  configSchema?: string | null;
  middleware: string[];
  middlewareDetailed?: MiddlewareUsage[];
  overrides: string[];
  registers: string[];
  // Hard-switch note: `exports` was removed in favor of `isolation`.
  isolation?: {
    deny: string[];
    only: string[];
    exports: string[];
    exportsMode: IsolationExportsMode;
  } | null;
  subtree?: {
    tasks?: {
      middleware: string[];
      validatorCount: number;
    } | null;
    resources?: {
      middleware: string[];
      validatorCount: number;
    } | null;
    hooks?: {
      validatorCount: number;
    } | null;
    taskMiddleware?: {
      validatorCount: number;
    } | null;
    resourceMiddleware?: {
      validatorCount: number;
    } | null;
    events?: {
      validatorCount: number;
    } | null;
    tags?: {
      validatorCount: number;
    } | null;
  } | null;
  cooldown?: boolean;
  context?: string | null;
  // Tunnel information (populated when resource has globals.tags.tunnel)
  tunnelInfo?: TunnelInfo | null;
}

export interface Error extends BaseElement {
  id: string;
  meta?: Meta | null;
  filePath?: string | null;
  // Prettified Zod schema for the error data if provided
  dataSchema?: string | null;
  // Task/resource IDs that throw this error
  thrownBy: string[];
}

export interface AsyncContext extends BaseElement {
  id: string;
  meta?: Meta | null;
  filePath?: string | null;
  // Serialization method signature if provided
  serialize?: string | null;
  // Parse method signature if provided
  parse?: string | null;
  // Task/resource/hook/middleware IDs that depend on this context (via dependencies)
  usedBy: string[];
  // Task/resource/hook/middleware IDs that use .require() for this context
  requiredBy: string[];
  // Resource IDs that provide this context
  providedBy: string[];
}

// Run options (effective at startup)
export interface RunOptions {
  mode: string;
  // Whether debug instrumentation is enabled.
  debug: boolean;
  // High-level debug mode summary when available: "normal", "verbose", "custom", or "disabled".
  debugMode?: string | null;
  // Whether logger output is printed (false when printThreshold is null).
  logsEnabled: boolean;
  // Logger print threshold summary (trace/debug/info/warn/error/critical) or null when disabled.
  logsPrintThreshold?: string | null;
  // Logger print strategy summary (pretty/json/minimal) when available.
  logsPrintStrategy?: string | null;
  // Whether logger is buffering logs.
  logsBuffer: boolean;
  // May be unknown when options cannot be introspected from runtime internals.
  errorBoundary?: boolean | null;
  // May be unknown when options cannot be introspected from runtime internals.
  shutdownHooks?: boolean | null;
  // Whether app was started in dryRun mode when known.
  dryRun: boolean;
  // Whether lazy resource mode is enabled when known.
  lazy: boolean;
  // Startup scheduler mode summary.
  lifecycleMode: "sequential" | "parallel";
  // Shutdown disposal total budget in milliseconds.
  disposeBudgetMs?: number | null;
  // Shutdown drain wait budget in milliseconds.
  disposeDrainBudgetMs?: number | null;
  // Runtime event cycle detection toggle when known.
  runtimeEventCycleDetection?: boolean | null;
  // Presence flag for onUnhandledError callback.
  hasOnUnhandledError: boolean;
  rootId: string;
}

// Diagnostics
export interface DiagnosticItem {
  severity: string;
  code: string;
  message: string;
  nodeId?: string;
  nodeKind?: string;
}
