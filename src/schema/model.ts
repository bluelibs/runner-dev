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
}

export interface All extends BaseElement {
  id: string;
  meta?: Meta | null;
  filePath?: string | null;
}

export interface Event extends BaseElement {
  id: string;
  meta?: Meta | null;
  filePath?: string | null;
  listenedToBy: string[];
}

// Internal discriminator for GraphQL type resolution (non-enumerable)
export type ElementKind =
  | "ALL"
  | "TASK"
  | "LISTENER"
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
  overriddenBy?: string | null;
}

export interface TaskBase extends BaseElement {
  id: string;
  meta?: Meta | null;
  filePath?: string | null;
  emits: string[];
  dependsOn: string[];
  middleware: string[];
  middlewareDetailed?: MiddlewareUsage[];
  overriddenBy?: string | null;
}

export interface Task extends TaskBase {
  kind: "TASK";
}

export interface Listener extends TaskBase {
  kind: "LISTENER";
  event: string;
  listenerOrder?: number | null;
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
