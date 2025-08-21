import { definitions } from "@bluelibs/runner";

export interface TagUsage {
  id: string;
  config?: string | null;
}

export interface Meta {
  title?: string | null;
  description?: string | null;
  // Normalized tag ids
  tags?: string[] | null;
  // Detailed tag usages with serialized config when present
  tagsDetailed?: TagUsage[] | null;
}

export interface BaseElement {
  id: string;
  meta?: Meta | null;
  filePath?: string | null;
  // Id of the resource that registered this element (if any)
  registeredBy?: string | null;
  overriddenBy?: string | null;
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

export interface Tag {
  id: string;
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
}

export interface Hook extends BaseElement {
  event: string;
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
  emits?: string[];
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
}

// Diagnostics
export interface DiagnosticItem {
  severity: string;
  code: string;
  message: string;
  nodeId?: string;
  nodeKind?: string;
}
