import type {
  Resource,
  Event,
  Task,
  Hook,
  Middleware,
  Tag,
  Error as ErrorModel,
  AsyncContext as AsyncContextModel,
} from "../../schema";
import type { Store } from "@bluelibs/runner";
import type { DiagnosticItem } from "../../schema";
import {
  computeOrphanEvents,
  computeUnemittedEvents,
  computeUnusedMiddleware,
  computeOverrideConflicts,
  buildDiagnostics,
  stampElementKind,
  buildIdMap,
  ensureStringArray,
} from "./introspector.tools";
import { hasDurableIdPattern } from "./durable.tools";
import { extractTunnelInfo } from "./initializeFromStore.utils";

export type SerializedIntrospector = {
  tasks: Task[];
  hooks: Hook[];
  resources: Resource[];
  events: Event[];
  middlewares: Middleware[];
  tags: Tag[];
  errors?: ErrorModel[];
  asyncContexts?: AsyncContextModel[];
  diagnostics?: DiagnosticItem[];
  orphanEvents?: { id: string }[];
  unemittedEvents?: { id: string }[];
  unusedMiddleware?: { id: string }[];
  missingFiles?: Array<{ id: string; filePath: string }>;
  overrideConflicts?: Array<{ targetId: string; by: string }>;
  rootId?: string | null;
};

export class Introspector {
  public tasks: Task[] = [];
  public hooks: Hook[] = [];
  public resources: Resource[] = [];
  public events: Event[] = [];
  public taskMiddlewares: Middleware[] = [];
  public resourceMiddlewares: Middleware[] = [];
  public middlewares: Middleware[] = [];
  public tags: Tag[] = [];
  public errors: ErrorModel[] = [];
  public asyncContexts: AsyncContextModel[] = [];
  public store: Pick<Store, "tasks" | "resources" | "root"> | null = null;
  public rootId: string | null = null;

  public taskMap: Map<string, Task> = new Map();
  public hookMap: Map<string, Hook> = new Map();
  public resourceMap: Map<string, Resource> = new Map();
  public eventMap: Map<string, Event> = new Map();
  public middlewareMap: Map<string, Middleware> = new Map();
  public tagMap: Map<string, Tag> = new Map();
  public errorMap: Map<string, ErrorModel> = new Map();
  public asyncContextMap: Map<string, AsyncContextModel> = new Map();

  constructor(
    input:
      | { store: Pick<Store, "tasks" | "resources" | "root"> }
      | { data: SerializedIntrospector }
  ) {
    if ("store" in input) {
      // this.store = input.store;
      // this.initializeFromStore();
    } else {
      this.store = null;
      this.initializeFromData(input.data);
    }
  }

  private initializeFromData(data: SerializedIntrospector): void {
    this.tasks = Array.isArray(data.tasks) ? data.tasks : [];
    this.hooks = Array.isArray(data.hooks) ? data.hooks : [];
    this.resources = Array.isArray(data.resources) ? data.resources : [];
    this.events = Array.isArray(data.events) ? data.events : [];
    this.taskMiddlewares = [];
    this.resourceMiddlewares = [];
    this.middlewares = Array.isArray(data.middlewares) ? data.middlewares : [];
    this.errors = Array.isArray(data.errors) ? data.errors : [];
    this.asyncContexts = Array.isArray(data.asyncContexts)
      ? data.asyncContexts
      : [];
    this.rootId = data.rootId ?? null;

    // Maps
    this.taskMap = buildIdMap(this.tasks);
    this.hookMap = buildIdMap(this.hooks);
    this.resourceMap = buildIdMap(this.resources);
    this.eventMap = buildIdMap(this.events);
    this.middlewareMap = buildIdMap(this.middlewares);
    this.errorMap = buildIdMap(this.errors);
    this.asyncContextMap = buildIdMap(this.asyncContexts);

    // Populate thrownBy for errors based on dependencies (after maps are built)
    this.populateErrorThrownBy();

    // Tags
    const _getTasksWithTag = (tagId: string) =>
      this.tasks.filter((t) => ensureStringArray(t.tags).includes(tagId));
    const _getHooksWithTag = (tagId: string) =>
      this.hooks.filter((h) => ensureStringArray(h.tags).includes(tagId));
    const _getResourcesWithTag = (tagId: string) =>
      this.resources.filter((r) => ensureStringArray(r.tags).includes(tagId));
    const _getMiddlewaresWithTag = (tagId: string) =>
      this.middlewares.filter((m) => ensureStringArray(m.tags).includes(tagId));
    const _getEventsWithTag = (tagId: string) =>
      this.events.filter((e) => ensureStringArray(e.tags).includes(tagId));

    this.tags = data.tags;
    this.tagMap = new Map<string, Tag>();
    for (const tag of this.tags) {
      this.tagMap.set(tag.id, tag);
    }
  }

  // Helper function for building runs options
  private buildRunsOptions(
    nodeId: string,
    args?: {
      afterTimestamp?: number;
      last?: number;
      filter?: {
        nodeKinds?: ("TASK" | "HOOK")[];
        ok?: boolean;
        parentIds?: string[];
        rootIds?: string[];
        correlationIds?: string[];
      } | null;
    }
  ) {
    const opts: any = {} as any;
    if (typeof args?.afterTimestamp === "number")
      (opts as any).afterTimestamp = args.afterTimestamp;
    if (typeof args?.last === "number") (opts as any).last = args.last;
    const f = (args as any)?.filter ?? {};
    (opts as any).nodeIds = [String(nodeId)];
    if (Array.isArray(f.nodeKinds)) (opts as any).nodeKinds = f.nodeKinds;
    if (typeof f.ok === "boolean") (opts as any).ok = f.ok;
    if (Array.isArray(f.parentIds)) (opts as any).parentIds = f.parentIds;
    if (Array.isArray(f.rootIds)) (opts as any).rootIds = f.rootIds;
    if (Array.isArray(f.correlationIds))
      (opts as any).correlationIds = f.correlationIds;
    return opts as any;
  }

  // API Methods
  getRoot(): Resource {
    const s: any = this.store as any;
    const idFromStore = s?.root?.resource?.id
      ? String(s.root.resource.id)
      : null;
    const id = idFromStore ?? this.rootId ?? this.resources[0]?.id;
    return stampElementKind(this.resourceMap.get(String(id))!, "RESOURCE");
  }

  getAll(): (
    | Task
    | Hook
    | Resource
    | Event
    | Middleware
    | ErrorModel
    | AsyncContextModel
  )[] {
    return [
      ...this.tasks,
      ...this.hooks,
      ...this.resources,
      ...this.events,
      ...this.middlewares,
      ...this.errors,
      ...this.asyncContexts,
    ];
  }

  private populateErrorThrownBy(): void {
    // Create error ID map for quick lookup
    const errorIds = new Set(this.errors.map((e) => e.id));

    // Clear existing thrownBy arrays
    this.errors.forEach((error) => {
      error.thrownBy = [];
    });

    // Check tasks
    this.tasks.forEach((task) => {
      const depends = ensureStringArray(task.dependsOn);
      depends.forEach((depId) => {
        if (errorIds.has(depId)) {
          const error = this.errorMap.get(depId);
          if (error && !error.thrownBy.includes(task.id)) {
            error.thrownBy.push(task.id);
          }
        }
      });
    });

    // Check hooks
    this.hooks.forEach((hook) => {
      const depends = ensureStringArray(hook.dependsOn);
      depends.forEach((depId) => {
        if (errorIds.has(depId)) {
          const error = this.errorMap.get(depId);
          if (error && !error.thrownBy.includes(hook.id)) {
            error.thrownBy.push(hook.id);
          }
        }
      });
    });

    // Check resources
    this.resources.forEach((resource) => {
      const depends = ensureStringArray(resource.dependsOn);
      depends.forEach((depId) => {
        if (errorIds.has(depId)) {
          const error = this.errorMap.get(depId);
          if (error && !error.thrownBy.includes(resource.id)) {
            error.thrownBy.push(resource.id);
          }
        }
      });
    });

    // Note: Middleware doesn't have dependsOn field, so it can't depend on errors
    // Middlewares are referenced by tasks/resources via the middleware field
  }

  getEvents(): Event[] {
    return this.events;
  }

  getTasks(): Task[] {
    return this.tasks;
  }

  getHooks(): Hook[] {
    return this.hooks;
  }

  getMiddlewares(): Middleware[] {
    return this.middlewares;
  }

  getTaskMiddlewares(): Middleware[] {
    return this.taskMiddlewares;
  }

  getResourceMiddlewares(): Middleware[] {
    return this.resourceMiddlewares;
  }

  getResources(): Resource[] {
    return this.resources;
  }

  getEvent(id: string): Event | null {
    return this.eventMap.get(id) ?? null;
  }

  getTask(id: string): Task | null {
    return this.taskMap.get(id) ?? null;
  }

  getHook(id: string): Hook | null {
    return this.hookMap.get(id) ?? null;
  }

  getMiddleware(id: string): Middleware | null {
    return this.middlewareMap.get(id) ?? null;
  }

  getResource(id: string): Resource | null {
    return this.resourceMap.get(id) ?? null;
  }

  getDependencies(node: Task | Hook | Resource): {
    tasks: Task[];
    hooks: Hook[];
    resources: Resource[];
    emitters: Event[];
    errors: ErrorModel[];
  } {
    const depends = ensureStringArray(node.dependsOn);
    const tasksDeps = this.tasks.filter((t) => depends.includes(t.id));
    const hooksDeps = this.hooks.filter((l) => depends.includes(l.id));
    const resourcesDeps = this.resources.filter((r) => depends.includes(r.id));
    const errorDeps = this.errors.filter((e) => depends.includes(e.id));

    // Only Task and Hook have emits, Resource doesn't
    const emitIds = ensureStringArray((node as any).emits);
    const emitEvents = this.events.filter((e) => emitIds.includes(e.id));

    return {
      tasks: tasksDeps,
      hooks: hooksDeps,
      resources: resourcesDeps,
      emitters: emitEvents,
      errors: errorDeps,
    };
  }

  getEmittedEvents(node: Task | Hook): Event[] {
    const emits = ensureStringArray((node as any).emits);
    return this.events.filter((e) => emits.includes(e.id));
  }

  getMiddlewaresByIds(ids: string[]): Middleware[] {
    const set = new Set(ensureStringArray(ids));
    return this.middlewares.filter((m) => set.has(m.id));
  }

  getResourcesByIds(ids: string[]): Resource[] {
    const set = new Set(ensureStringArray(ids));
    return this.resources.filter((r) => set.has(r.id));
  }

  getTasksByIds(ids: string[]): Task[] {
    const set = new Set(ensureStringArray(ids));
    return this.tasks.filter((t) => set.has(t.id));
  }

  getHooksByIds(ids: string[]): Hook[] {
    const set = new Set(ensureStringArray(ids));
    return this.hooks.filter((l) => set.has(l.id));
  }

  getEventsByIds(ids: string[]): Event[] {
    const set = new Set(ensureStringArray(ids));
    return this.events.filter((e) => set.has(e.id));
  }

  getTasksUsingResource(resourceId: string): (Task | Hook)[] {
    return [...this.tasks, ...this.hooks].filter((t) =>
      ensureStringArray(t.dependsOn).includes(resourceId)
    );
  }

  getTasksUsingMiddleware(middlewareId: string): (Task | Hook)[] {
    return this.tasks.filter((t) =>
      ensureStringArray(t.middleware).includes(middlewareId)
    );
  }

  // Backward-compat for schema fields expecting this name
  // Returns only task-like nodes (tasks and hooks)
  getTaskLikesUsingMiddleware(middlewareId: string): (Task | Hook)[] {
    return this.getTasksUsingMiddleware(middlewareId);
  }

  getEmittersOfEvent(eventId: string): (Task | Hook | Resource)[] {
    return [...this.tasks, ...this.hooks, ...this.resources].filter((t) =>
      ensureStringArray((t as any).emits).includes(eventId)
    );
  }

  getHooksOfEvent(eventId: string): Hook[] {
    return this.hooks.filter((l) => l.events.includes(eventId));
  }

  getMiddlewareEmittedEvents(middlewareId: string): Event[] {
    const taskLikes = this.getTasksUsingMiddleware(middlewareId);
    const emittedIds = new Set<string>();
    for (const t of taskLikes) {
      for (const e of ensureStringArray((t as any).emits)) {
        emittedIds.add(e);
      }
    }
    return this.events.filter((e) => emittedIds.has(e.id));
  }

  getMiddlewareUsagesForTask(
    taskId: string
  ): Array<{ id: string; config: string | null; node: Middleware }> {
    const task = this.taskMap.get(taskId);
    if (!task) return [];
    const detailed = task.middlewareDetailed ?? [];
    return detailed
      .map((d) => ({
        id: d.id,
        config: d.config ?? null,
        node: this.middlewareMap.get(d.id),
      }))
      .filter(
        (x): x is { id: string; config: string | null; node: Middleware } =>
          Boolean(x.node)
      );
  }

  getMiddlewareUsagesForResource(
    resourceId: string
  ): Array<{ id: string; config: string | null; node: Middleware }> {
    const res = this.resourceMap.get(resourceId);
    if (!res) return [];
    const detailed = res.middlewareDetailed ?? [];
    return detailed
      .map((d) => ({
        id: d.id,
        config: d.config ?? null,
        node: this.middlewareMap.get(d.id),
      }))
      .filter(
        (x): x is { id: string; config: string | null; node: Middleware } =>
          Boolean(x.node)
      );
  }

  getTasksUsingMiddlewareDetailed(
    middlewareId: string
  ): Array<{ id: string; config: string | null; node: Task | Hook }> {
    const result: Array<{
      id: string;
      config: string | null;
      node: Task;
    }> = [];
    const addFrom = (arr: Array<Task>) => {
      for (const tl of arr) {
        if ((tl.middleware || []).includes(middlewareId)) {
          const conf =
            (tl.middlewareDetailed || []).find((m) => m.id === middlewareId)
              ?.config ?? null;
          result.push({ id: tl.id, config: conf ?? null, node: tl });
        }
      }
    };
    addFrom(this.tasks);
    return result;
  }

  getResourcesUsingMiddlewareDetailed(
    middlewareId: string
  ): Array<{ id: string; config: string | null; node: Resource }> {
    const result: Array<{
      id: string;
      config: string | null;
      node: Resource;
    }> = [];
    for (const r of this.resources) {
      if ((r.middleware || []).includes(middlewareId)) {
        const conf =
          (r.middlewareDetailed || []).find((m) => m.id === middlewareId)
            ?.config ?? null;
        result.push({ id: r.id, config: conf ?? null, node: r });
      }
    }
    return result;
  }

  getEmittedEventsForResource(resourceId: string): Event[] {
    const taskLikes = this.getTasksUsingResource(resourceId);
    const emitted = new Set<string>();
    for (const t of taskLikes) {
      for (const e of ensureStringArray((t as any).emits)) emitted.add(e);
    }
    return this.getEventsByIds(Array.from(emitted));
  }

  // Tags API
  getTasksWithTag(tagId: string): Task[] {
    return this.tasks.filter((t) => ensureStringArray(t.tags).includes(tagId));
  }

  getHooksWithTag(tagId: string): Hook[] {
    return this.hooks.filter((h) => ensureStringArray(h.tags).includes(tagId));
  }

  getResourcesWithTag(tagId: string): Resource[] {
    return this.resources.filter((r) =>
      ensureStringArray(r.tags).includes(tagId)
    );
  }

  getMiddlewaresWithTag(tagId: string): Middleware[] {
    return this.middlewares.filter((m) =>
      ensureStringArray(m.tags).includes(tagId)
    );
  }

  getEventsWithTag(tagId: string): Event[] {
    return this.events.filter((e) => ensureStringArray(e.tags).includes(tagId));
  }

  getAllTags(): Tag[] {
    return this.tags;
  }

  getTag(id: string): Tag | null {
    return this.tagMap.get(id) ?? null;
  }

  getTagsByIds(ids: string[]): Tag[] {
    return ids
      .map((id) => this.getTag(id))
      .filter((tag): tag is Tag => tag !== null);
  }

  // Diagnostics
  getOrphanEvents(): { id: string }[] {
    return computeOrphanEvents(this);
  }

  getUnemittedEvents(): { id: string }[] {
    return computeUnemittedEvents(this);
  }

  getUnusedMiddleware(): { id: string }[] {
    return computeUnusedMiddleware(this);
  }

  getOverrideConflicts(): Array<{ targetId: string; by: string }> {
    return computeOverrideConflicts(this);
  }

  getDiagnostics(): Array<{
    severity: string;
    code: string;
    message: string;
    nodeId?: string;
    nodeKind?: string;
  }> {
    return buildDiagnostics(this);
  }

  buildRunOptionsForTask(
    taskId: string,
    args?: {
      afterTimestamp?: number;
      last?: number;
      filter?: {
        nodeKinds?: ("TASK" | "HOOK")[];
        ok?: boolean;
        parentIds?: string[];
        rootIds?: string[];
        correlationIds?: string[];
      } | null;
    }
  ): {
    afterTimestamp?: number;
    last?: number;
    nodeKinds?: ("TASK" | "HOOK")[];
    nodeIds?: string[];
    ok?: boolean;
    parentIds?: string[];
    rootIds?: string[];
    correlationIds?: string[];
  } {
    return this.buildRunsOptions(taskId, args);
  }

  buildRunOptionsForHook(
    hookId: string,
    args?: {
      afterTimestamp?: number;
      last?: number;
      filter?: {
        nodeKinds?: ("TASK" | "HOOK")[];
        ok?: boolean;
        parentIds?: string[];
        rootIds?: string[];
        correlationIds?: string[];
      } | null;
    }
  ): {
    afterTimestamp?: number;
    last?: number;
    nodeKinds?: ("TASK" | "HOOK")[];
    nodeIds?: string[];
    ok?: boolean;
    parentIds?: string[];
    rootIds?: string[];
    correlationIds?: string[];
  } {
    return this.buildRunsOptions(hookId, args);
  }

  // Error-related methods
  getErrors(): ErrorModel[] {
    return this.errors;
  }

  getError(id: string): ErrorModel | null {
    return this.errorMap.get(id) ?? null;
  }

  getTasksUsingError(errorId: string): Task[] {
    const error = this.errorMap.get(errorId);
    if (!error?.thrownBy) return [];

    return this.tasks.filter((task) => error.thrownBy.includes(task.id));
  }

  getResourcesUsingError(errorId: string): Resource[] {
    const error = this.errorMap.get(errorId);
    if (!error?.thrownBy) return [];

    return this.resources.filter((resource) =>
      error.thrownBy.includes(resource.id)
    );
  }

  getHooksUsingError(errorId: string): Hook[] {
    const error = this.errorMap.get(errorId);
    if (!error?.thrownBy) return [];

    return this.hooks.filter((hook) => error.thrownBy.includes(hook.id));
  }

  getMiddlewaresUsingError(errorId: string): Middleware[] {
    const error = this.errorMap.get(errorId);
    if (!error?.thrownBy) return [];

    return this.middlewares.filter((middleware) =>
      error.thrownBy.includes(middleware.id)
    );
  }

  getAllUsingError(errorId: string): (Task | Hook | Resource | Middleware)[] {
    return [
      ...this.getTasksUsingError(errorId),
      ...this.getHooksUsingError(errorId),
      ...this.getResourcesUsingError(errorId),
      ...this.getMiddlewaresUsingError(errorId),
    ];
  }

  // Async Context-related methods
  getAsyncContexts(): AsyncContextModel[] {
    return this.asyncContexts;
  }

  getAsyncContext(id: string): AsyncContextModel | null {
    return this.asyncContextMap.get(id) ?? null;
  }

  getTasksUsingContext(contextId: string): Task[] {
    const context = this.asyncContextMap.get(contextId);
    if (!context?.usedBy) return [];

    return this.tasks.filter((task) => context.usedBy.includes(task.id));
  }

  getResourcesUsingContext(contextId: string): Resource[] {
    const context = this.asyncContextMap.get(contextId);
    if (!context?.usedBy) return [];

    return this.resources.filter((resource) =>
      context.usedBy.includes(resource.id)
    );
  }

  getResourcesProvidingContext(contextId: string): Resource[] {
    const context = this.asyncContextMap.get(contextId);
    if (!context?.providedBy) return [];

    return this.resources.filter((resource) =>
      context.providedBy.includes(resource.id)
    );
  }

  getHooksUsingContext(contextId: string): Hook[] {
    const context = this.asyncContextMap.get(contextId);
    if (!context?.usedBy) return [];

    return this.hooks.filter((hook) => context.usedBy.includes(hook.id));
  }

  getMiddlewaresUsingContext(contextId: string): Middleware[] {
    const context = this.asyncContextMap.get(contextId);
    if (!context?.usedBy) return [];

    return this.middlewares.filter((middleware) =>
      context.usedBy.includes(middleware.id)
    );
  }

  getAllUsingContext(
    contextId: string
  ): (Task | Hook | Resource | Middleware)[] {
    return [
      ...this.getTasksUsingContext(contextId),
      ...this.getHooksUsingContext(contextId),
      ...this.getResourcesUsingContext(contextId),
      ...this.getMiddlewaresUsingContext(contextId),
    ];
  }

  // Tunnel-related methods (enhance existing methods)
  getTunnelResources(): Resource[] {
    // Resources with populated tunnelInfo (set during store initialization)
    return this.resources.filter((resource) => resource.tunnelInfo != null);
  }

  getTunneledTasks(tunnelResourceId: string): Task[] {
    const tunnel = this.getResource(tunnelResourceId);
    if (!tunnel?.tunnelInfo?.tasks) return [];
    return this.getTasksByIds(tunnel.tunnelInfo.tasks);
  }

  getTunneledEvents(tunnelResourceId: string): Event[] {
    const tunnel = this.getResource(tunnelResourceId);
    if (!tunnel?.tunnelInfo?.events) return [];
    return this.getEventsByIds(tunnel.tunnelInfo.events);
  }

  getTunnelForTask(taskId: string): Resource | null {
    const task = this.getTask(taskId);
    if (!task) return null;

    // Find tunnel resource that owns this task
    return (
      this.getTunnelResources().find((tunnel) =>
        tunnel.tunnelInfo?.tasks?.includes(taskId)
      ) ?? null
    );
  }

  getTunnelForEvent(eventId: string): Resource | null {
    // Find tunnel resource that tunnels this event
    return (
      this.getTunnelResources().find((tunnel) =>
        tunnel.tunnelInfo?.events?.includes(eventId)
      ) ?? null
    );
  }

  /**
   * Populates tunnelInfo for resources with the tunnel tag.
   * Call this method after all resources have been initialized to ensure
   * tunnel resource values are available.
   */
  populateTunnelInfo(): void {
    const s = this.store as {
      resources: Map<
        string,
        { resource: { id: unknown; tags?: unknown[] }; value: unknown }
      >;
    } | null;
    if (!s?.resources) return;

    const allTaskIds = this.tasks.map((t) => t.id);
    const allEventIds = this.events.map((e) => e.id);

    for (const storeEntry of s.resources.values()) {
      const resourceDef = storeEntry.resource;
      const resourceValue = storeEntry.value;
      const resourceId = String(resourceDef.id);

      // Find the corresponding model resource
      const modelResource = this.resources.find((r) => r.id === resourceId);
      if (!modelResource) continue;

      // Check if resource has tunnel tag using the already-normalized tags
      const hasTunnelTag = (modelResource.tags || []).some((tagId) => {
        const tagStr = String(tagId);
        return (
          tagStr === "globals.tags.tunnel" ||
          (tagStr.includes("tunnel") && !tagStr.includes("tunnelPolicy"))
        );
      });

      if (hasTunnelTag && resourceValue) {
        const tunnelInfo = extractTunnelInfo(
          resourceValue,
          allTaskIds,
          allEventIds
        );
        if (tunnelInfo) {
          modelResource.tunnelInfo = tunnelInfo;
        }
      }
    }
  }

  // Durable workflow-related methods
  /**
   * Checks if a task is a durable workflow task.
   * A task is durable if it depends on a resource id matching the durable id pattern.
   *
   * Note: This method is used in the browser (docs UI) where the runtime Store and
   * durable resource instances are not available.
   */
  isDurableTask(taskId: string): boolean {
    const task = this.taskMap.get(taskId);
    if (!task) return false;
    const deps = ensureStringArray(task.dependsOn);
    return deps.some((depId) => hasDurableIdPattern(depId));
  }

  /**
   * Returns all tasks that are durable workflow tasks.
   */
  getDurableTasks(): Task[] {
    return this.tasks.filter((t) => this.isDurableTask(t.id));
  }

  /**
   * Returns the durable resource a task depends on, if any.
   */
  getDurableResourceForTask(taskId: string): Resource | null {
    const task = this.taskMap.get(taskId);
    if (!task) return null;
    const deps = ensureStringArray(task.dependsOn);
    const durableDepId = deps.find((depId) => hasDurableIdPattern(depId));
    return durableDepId ? this.getResource(durableDepId) : null;
  }

  // Serialization API
  serialize(): SerializedIntrospector {
    return {
      tasks: this.tasks,
      hooks: this.hooks,
      resources: this.resources,
      events: this.events,
      middlewares: this.middlewares,
      tags: this.tags,
      errors: this.errors,
      asyncContexts: this.asyncContexts,
      diagnostics: this.getDiagnostics(),
      orphanEvents: this.getOrphanEvents(),
      unemittedEvents: this.getUnemittedEvents(),
      unusedMiddleware: this.getUnusedMiddleware(),
      overrideConflicts: this.getOverrideConflicts(),
      rootId:
        (this.store as any)?.root?.resource?.id != null
          ? String((this.store as any).root.resource.id)
          : this.rootId,
    };
  }

  static deserialize(data: SerializedIntrospector): Introspector {
    return new Introspector({ data });
  }
}
