export interface TagUsage {
  id: string;
  config?: string | null;
  configSchema?: string | null;
}

export interface Meta {
  title?: string | null;
  description?: string | null;
}

export interface BaseElement {
  id: string;
  meta?: Meta | null;
  filePath?: string | null;
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

// Events can't be overriden
export interface Event extends Omit<BaseElement, "overriddenBy"> {
  id: string;
  meta?: Meta | null;
  filePath?: string | null;
  listenedToBy: string[];
  // Prettified Zod schema for the event payload if provided
  payloadSchema?: string | null;
}

export interface TagUsage {
  id: string;
  configSchema?: string | null;
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
  tasks: Task[];
  hooks: Hook[];
  resources: Resource[];
  middlewares: Middleware[];
  events: Event[];
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

export interface MiddlewareGlobal {
  enabled: boolean;
  tasks: boolean;
  resources: boolean;
}

export interface MiddlewareUsage {
  id: string;
  config?: string | null;
}

export interface Middleware extends BaseElement {
  id: string;
  meta?: Meta | null;
  filePath?: string | null;
  global?: MiddlewareGlobal | null;
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

// Diagnostics
export interface DiagnosticItem {
  severity: string;
  code: string;
  message: string;
  nodeId?: string;
  nodeKind?: string;
}
