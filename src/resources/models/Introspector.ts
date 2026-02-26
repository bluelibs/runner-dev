import type {
  Resource,
  Event,
  Task,
  Hook,
  Middleware,
  Tag,
  Error as ErrorModel,
  AsyncContext as AsyncContextModel,
  RunOptions,
} from "../../schema";
import type { Store } from "@bluelibs/runner";
import type { DiagnosticItem } from "../../schema";
import {
  computeOrphanEvents,
  computeUnemittedEvents,
  computeUnusedMiddleware,
  computeOverrideConflicts,
  computeOverriddenElements,
  computeUnusedErrors,
  buildDiagnostics,
  stampElementKind,
  buildIdMap,
  ensureStringArray,
} from "./introspector.tools";
import {
  findDurableDependencyId,
  hasDurableWorkflowTag,
} from "./durable.tools";
import { extractTunnelInfo } from "./extractTunnelInfo";
import { hasTunnelTag } from "./tunnel.tools";

export type MiddlewareInterceptorOwnerSnapshot = {
  globalTaskInterceptorOwnerIds: string[];
  globalResourceInterceptorOwnerIds: string[];
  perTaskMiddlewareInterceptorOwnerIds: Record<string, string[]>;
  perResourceMiddlewareInterceptorOwnerIds: Record<string, string[]>;
};

export type InterceptorOwnersSnapshot = {
  tasksById: Record<string, string[]>;
  middleware: MiddlewareInterceptorOwnerSnapshot;
};

type TaskInterceptorRecord = {
  ownerResourceId?: string;
};

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
  overriddenElements?: Array<{
    id: string;
    kind: "TASK" | "HOOK" | "MIDDLEWARE";
    overriddenBy: string;
  }>;
  unusedErrors?: Array<{ id: string }>;
  missingFiles?: Array<{ id: string; filePath: string }>;
  overrideConflicts?: Array<{ targetId: string; by: string }>;
  rootId?: string | null;
  runOptions?: RunOptions | null;
  interceptorOwners?: InterceptorOwnersSnapshot | null;
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
  public store: Store | null = null;
  public runtime: any | null = null;
  public rootId: string | null = null;
  public runOptions: RunOptions | null = null;
  public interceptorOwners: InterceptorOwnersSnapshot = {
    tasksById: {},
    middleware: {
      globalTaskInterceptorOwnerIds: [],
      globalResourceInterceptorOwnerIds: [],
      perTaskMiddlewareInterceptorOwnerIds: {},
      perResourceMiddlewareInterceptorOwnerIds: {},
    },
  };

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
      | { store: Store; runtime?: any; runOptions?: RunOptions | null }
      | { data: SerializedIntrospector }
  ) {
    if ("store" in input) {
      this.store = input.store;
      this.runtime = input.runtime ?? null;
      this.runOptions = input.runOptions ?? null;
    } else {
      this.store = null;
      this.runtime = null;
      this.initializeFromData(input.data);
    }
  }

  private initializeFromData(data: SerializedIntrospector): void {
    this.tasks = Array.isArray(data.tasks) ? data.tasks : [];
    this.hooks = Array.isArray(data.hooks) ? data.hooks : [];
    this.resources = Array.isArray(data.resources) ? data.resources : [];
    this.events = Array.isArray(data.events) ? data.events : [];
    this.middlewares = Array.isArray(data.middlewares) ? data.middlewares : [];
    const splitMiddlewares = this.splitMiddlewaresByType(this.middlewares);
    this.taskMiddlewares = splitMiddlewares.taskMiddlewares;
    this.resourceMiddlewares = splitMiddlewares.resourceMiddlewares;
    this.errors = Array.isArray(data.errors) ? data.errors : [];
    this.asyncContexts = Array.isArray(data.asyncContexts)
      ? data.asyncContexts
      : [];
    this.rootId = data.rootId ?? null;
    this.runOptions = data.runOptions
      ? this.normalizeRunOptions(data.runOptions)
      : null;
    this.interceptorOwners = data.interceptorOwners ?? this.interceptorOwners;

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

  private splitMiddlewaresByType(middlewares: Middleware[]): {
    taskMiddlewares: Middleware[];
    resourceMiddlewares: Middleware[];
  } {
    const taskMiddlewares: Middleware[] = [];
    const resourceMiddlewares: Middleware[] = [];

    for (const middleware of middlewares) {
      if (middleware.type === "task") {
        taskMiddlewares.push(middleware);
        continue;
      }

      if (middleware.type === "resource") {
        resourceMiddlewares.push(middleware);
        continue;
      }

      const usedByTasksLength = Array.isArray(middleware.usedByTasks)
        ? middleware.usedByTasks.length
        : 0;
      const usedByResourcesLength = Array.isArray(middleware.usedByResources)
        ? middleware.usedByResources.length
        : 0;

      if (usedByTasksLength > 0 || usedByResourcesLength === 0) {
        taskMiddlewares.push(middleware);
      } else {
        resourceMiddlewares.push(middleware);
      }
    }

    return { taskMiddlewares, resourceMiddlewares };
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

  /**
   * Returns the effective run options that were used when the application was started.
   * When a live store is available, options are derived from it; otherwise
   * the previously serialized snapshot is used.
   */
  private normalizeRunOptions(runOptions: Partial<RunOptions>): RunOptions {
    const mode = runOptions.mode ?? "dev";
    const debug = Boolean(runOptions.debug);
    const rootId = runOptions.rootId ?? this.rootId ?? "";
    const logsPrintThreshold =
      runOptions.logsPrintThreshold !== undefined
        ? runOptions.logsPrintThreshold
        : "info";

    return {
      mode,
      debug,
      debugMode: runOptions.debugMode ?? (debug ? "normal" : "disabled"),
      logsEnabled:
        typeof runOptions.logsEnabled === "boolean"
          ? runOptions.logsEnabled
          : logsPrintThreshold !== null,
      logsPrintThreshold,
      logsPrintStrategy:
        runOptions.logsPrintStrategy !== undefined
          ? runOptions.logsPrintStrategy
          : "pretty",
      logsBuffer: Boolean(runOptions.logsBuffer),
      errorBoundary:
        runOptions.errorBoundary !== undefined
          ? runOptions.errorBoundary
          : null,
      shutdownHooks:
        runOptions.shutdownHooks !== undefined
          ? runOptions.shutdownHooks
          : null,
      dryRun: Boolean(runOptions.dryRun),
      lazy: Boolean(runOptions.lazy),
      lifecycleMode:
        runOptions.lifecycleMode === "parallel" ? "parallel" : "sequential",
      disposeBudgetMs:
        typeof runOptions.disposeBudgetMs === "number"
          ? runOptions.disposeBudgetMs
          : null,
      disposeDrainBudgetMs:
        typeof runOptions.disposeDrainBudgetMs === "number"
          ? runOptions.disposeDrainBudgetMs
          : null,
      runtimeEventCycleDetection:
        runOptions.runtimeEventCycleDetection !== undefined
          ? runOptions.runtimeEventCycleDetection
          : null,
      hasOnUnhandledError: Boolean(runOptions.hasOnUnhandledError),
      rootId,
    };
  }

  getRunOptions(): RunOptions {
    if (this.store) {
      const sAny = this.store as any;
      const rootId =
        sAny.root?.resource?.id != null
          ? String(sAny.root.resource.id)
          : this.rootId ?? "";
      const hasDebug = !!sAny.resources?.has?.("globals.resources.debug");
      const debugResource = sAny.resources?.get?.("globals.resources.debug");
      const debugConfig = debugResource?.config;
      const debugMode = !hasDebug
        ? "disabled"
        : debugConfig === true
        ? "normal"
        : typeof debugConfig === "string"
        ? debugConfig
        : debugConfig && typeof debugConfig === "object"
        ? "custom"
        : "normal";

      const loggerResource = sAny.resources?.get?.("globals.resources.logger");
      const logger = loggerResource?.value as any;
      const logsPrintThresholdRaw = logger?.printThreshold;
      const logsPrintStrategyRaw = logger?.printStrategy;
      const logsBufferRaw = logger?.bufferLogs;

      const logsPrintThreshold =
        logsPrintThresholdRaw == null ? null : String(logsPrintThresholdRaw);
      const logsPrintStrategy =
        logsPrintStrategyRaw == null ? null : String(logsPrintStrategyRaw);
      const logsBuffer = Boolean(logsBufferRaw);

      const lifecycleMode = sAny.preferInitOrderDisposal
        ? "sequential"
        : "parallel";
      const disposeBudgetMs =
        typeof sAny.disposeBudgetMs === "number" ? sAny.disposeBudgetMs : null;
      const disposeDrainBudgetMs =
        typeof sAny.disposeDrainBudgetMs === "number"
          ? sAny.disposeDrainBudgetMs
          : null;

      const runtimeAny = this.runtime as any;
      const lazy = Boolean(runtimeAny?.lazyOptions?.lazyMode);
      const runtimeEventCycleDetection =
        runtimeAny?.eventManager?.runtimeEventCycleDetection;

      return {
        mode: sAny.mode ?? "dev",
        debug: hasDebug,
        debugMode,
        logsEnabled: logsPrintThreshold !== null,
        logsPrintThreshold,
        logsPrintStrategy,
        logsBuffer,
        errorBoundary: null,
        shutdownHooks: null,
        dryRun: Boolean(this.runOptions?.dryRun),
        lazy,
        lifecycleMode,
        disposeBudgetMs,
        disposeDrainBudgetMs,
        runtimeEventCycleDetection:
          typeof runtimeEventCycleDetection === "boolean"
            ? runtimeEventCycleDetection
            : null,
        hasOnUnhandledError: typeof sAny.onUnhandledError === "function",
        rootId,
      };
    }
    // Fallback to serialized data
    if (this.runOptions) return this.normalizeRunOptions(this.runOptions);
    return this.normalizeRunOptions({
      mode: "dev",
      debug: false,
      rootId: this.rootId ?? "",
    });
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

  getTaskMiddlewaresWithTag(tagId: string): Middleware[] {
    return this.taskMiddlewares.filter((m) =>
      ensureStringArray(m.tags).includes(tagId)
    );
  }

  getResourceMiddlewaresWithTag(tagId: string): Middleware[] {
    return this.resourceMiddlewares.filter((m) =>
      ensureStringArray(m.tags).includes(tagId)
    );
  }

  getEventsWithTag(tagId: string): Event[] {
    return this.events.filter((e) => ensureStringArray(e.tags).includes(tagId));
  }

  getErrorsWithTag(tagId: string): ErrorModel[] {
    return this.errors.filter((e) => ensureStringArray(e.tags).includes(tagId));
  }

  getTagHandlers(tagId: string): {
    tasks: Task[];
    hooks: Hook[];
    resources: Resource[];
  } {
    const dependsOnTag = <T extends { dependsOn?: string[] | null }>(
      item: T
    ): boolean => ensureStringArray(item.dependsOn).includes(tagId);

    return {
      tasks: this.tasks.filter(dependsOnTag),
      hooks: this.hooks.filter(dependsOnTag),
      resources: this.resources.filter(dependsOnTag),
    };
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

  getOverriddenElements(): Array<{
    id: string;
    kind: "TASK" | "HOOK" | "MIDDLEWARE";
    overriddenBy: string;
  }> {
    return computeOverriddenElements(this);
  }

  getUnusedErrors(): Array<{ id: string }> {
    return computeUnusedErrors(this);
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

  /**
   * Returns tasks that use `.require()` for a given async context.
   */
  getTasksRequiringContext(contextId: string): Task[] {
    const context = this.asyncContextMap.get(contextId);
    if (!context?.requiredBy) return [];

    return this.tasks.filter((task) => context.requiredBy.includes(task.id));
  }

  /**
   * Checks whether a given element uses `.require()` for a specific async context.
   */
  isContextRequiredBy(contextId: string, elementId: string): boolean {
    const context = this.asyncContextMap.get(contextId);
    return context?.requiredBy?.includes(elementId) ?? false;
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
      if (hasTunnelTag(modelResource.tags) && resourceValue) {
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
   * A task is durable if it has the durable workflow tag (current: `globals.tags.durableWorkflow`, legacy: `durable.workflow`).
   */
  isDurableTask(taskId: string): boolean {
    const task = this.taskMap.get(taskId);
    if (!task) return false;
    return hasDurableWorkflowTag(task.tags);
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
    if (!this.isDurableTask(taskId)) return null;

    const deps = ensureStringArray(task.dependsOn);
    const durableDepId = findDurableDependencyId(deps);
    return durableDepId ? this.getResource(durableDepId) : null;
  }

  // Serialization API
  getInterceptorOwnersSnapshot(): InterceptorOwnersSnapshot {
    return this.interceptorOwners;
  }

  getTaskInterceptorOwnerIds(taskId: string): string[] {
    const taskInterceptors = this.getTaskInterceptorsFromLiveStore(taskId);
    if (taskInterceptors != null) {
      return Array.from(
        new Set(
          taskInterceptors
            .map((record) => record.ownerResourceId)
            .filter((value): value is string => Boolean(value))
        )
      );
    }

    return this.interceptorOwners.tasksById[taskId] ?? [];
  }

  getTaskInterceptorCount(taskId: string): number {
    const taskInterceptors = this.getTaskInterceptorsFromLiveStore(taskId);
    if (taskInterceptors != null) {
      return taskInterceptors.length;
    }

    const task = this.taskMap.get(taskId);
    if (typeof task?.interceptorCount === "number") {
      return task.interceptorCount;
    }

    return (this.interceptorOwners.tasksById[taskId] ?? []).length;
  }

  hasTaskInterceptors(taskId: string): boolean {
    return this.getTaskInterceptorCount(taskId) > 0;
  }

  getMiddlewareInterceptorOwnerIds(middlewareId: string): string[] {
    const taskOwners =
      this.interceptorOwners.middleware.perTaskMiddlewareInterceptorOwnerIds[
        middlewareId
      ] ?? [];
    const resourceOwners =
      this.interceptorOwners.middleware
        .perResourceMiddlewareInterceptorOwnerIds[middlewareId] ?? [];
    return Array.from(new Set([...taskOwners, ...resourceOwners]));
  }

  private getTaskInterceptorsFromLiveStore(
    taskId: string
  ): TaskInterceptorRecord[] | null {
    const taskStoreEntry = this.store?.tasks.get(taskId) as
      | { interceptors?: TaskInterceptorRecord[] }
      | undefined;

    if (!taskStoreEntry || !Array.isArray(taskStoreEntry.interceptors)) {
      return null;
    }

    return taskStoreEntry.interceptors;
  }

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
      overriddenElements: this.getOverriddenElements(),
      unusedErrors: this.getUnusedErrors(),
      overrideConflicts: this.getOverrideConflicts(),
      rootId:
        (this.store as any)?.root?.resource?.id != null
          ? String((this.store as any).root.resource.id)
          : this.rootId,
      runOptions: this.getRunOptions(),
      interceptorOwners: this.getInterceptorOwnersSnapshot(),
    };
  }

  static deserialize(data: SerializedIntrospector): Introspector {
    return new Introspector({ data });
  }
}
