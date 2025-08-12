import { definitions } from "@bluelibs/runner";

export interface Meta {
  title?: string | null;
  description?: string | null;
  tags?: Array<string | definitions.ITagDefinition> | null;
}

export interface BaseElement {
  id: string;
  meta?: Meta | null;
  filePath?: string | null;
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

export interface MiddlewareGlobal {
  enabled: boolean;
  tasks: string[];
  resources: string[];
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
  config?: string | null;
  middleware: string[];
  overrides: string[];
  registers: string[];
  context?: string | null;
}
