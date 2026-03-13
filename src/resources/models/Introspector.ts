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
import type { Store, IRuntime } from "@bluelibs/runner";
import type { DiagnosticItem } from "../../schema";
import {
  computeOrphanEvents,
  computeUnemittedEvents,
  computeUnusedMiddleware,
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
import {
  collectRpcLaneIdsFromResourceConfig,
  isRpcLanesResource,
} from "../../utils/lane-resources";

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
  public runtime: IRuntime | null = null;
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
      | { store: Store; runtime?: IRuntime; runOptions?: RunOptions | null }
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

  private idsMatch(candidateId: string, referenceId: string): boolean {
    return (
      candidateId === referenceId || candidateId.endsWith(`.${referenceId}`)
    );
  }

  private resolveCanonicalId(
    referenceId: string,
    candidateIds: string[]
  ): string {
    const direct = candidateIds.find(
      (candidateId) => candidateId === referenceId
    );
    if (direct) return direct;

    const suffixMatch = candidateIds.find((candidateId) =>
      this.idsMatch(candidateId, referenceId)
    );

    return suffixMatch ?? referenceId;
  }

  private canonicalizeReferenceArray(
    ids: string[] | null | undefined,
    candidateIds: string[]
  ): string[] {
    return ensureStringArray(ids).map((referenceId) =>
      this.resolveCanonicalId(referenceId, candidateIds)
    );
  }

  private findByIdLike<T extends { id: string }>(
    collection: T[],
    id: string
  ): T | null {
    return collection.find((entry) => this.idsMatch(entry.id, id)) ?? null;
  }

  private idsContainLike(
    ids: string[] | null | undefined,
    candidateId: string
  ): boolean {
    return ensureStringArray(ids).some((id) => this.idsMatch(candidateId, id));
  }

  private normalizeMetaTags(node: { meta?: unknown }, tagIds: string[]): void {
    const meta = node.meta as
      | {
          tags?: string[] | null;
          tagsDetailed?: Array<{ id: string; config?: string | null }> | null;
        }
      | null
      | undefined;

    if (!meta) return;

    const normalizedDetailed = Array.isArray(meta.tagsDetailed)
      ? meta.tagsDetailed.map((entry) => ({
          ...entry,
          id: this.resolveCanonicalId(entry.id, tagIds),
        }))
      : meta.tagsDetailed;

    (node as { meta?: unknown }).meta = {
      ...meta,
      tags: this.canonicalizeReferenceArray(meta.tags, tagIds),
      tagsDetailed: normalizedDetailed,
    };
  }

  private normalizeRelationIds(): void {
    const taskIds = this.tasks.map((entry) => entry.id);
    const hookIds = this.hooks.map((entry) => entry.id);
    const resourceIds = this.resources.map((entry) => entry.id);
    const eventIds = this.events.map((entry) => entry.id);
    const middlewareIds = this.middlewares.map((entry) => entry.id);
    const tagIds = this.tags.map((entry) => entry.id);
    const errorIds = this.errors.map((entry) => entry.id);
    const asyncContextIds = this.asyncContexts.map((entry) => entry.id);
    const allDependencyIds = [
      ...taskIds,
      ...hookIds,
      ...resourceIds,
      ...eventIds,
      ...middlewareIds,
      ...tagIds,
      ...errorIds,
      ...asyncContextIds,
    ];
    const taskLikeIds = [...taskIds, ...hookIds];
    const taskHookResourceMiddlewareIds = [
      ...taskIds,
      ...hookIds,
      ...resourceIds,
      ...middlewareIds,
    ];

    for (const task of this.tasks) {
      task.dependsOn = this.canonicalizeReferenceArray(
        task.dependsOn,
        allDependencyIds
      );
      task.tags = this.canonicalizeReferenceArray(task.tags, tagIds);
      task.emits = this.canonicalizeReferenceArray(task.emits, eventIds);
      task.middleware = this.canonicalizeReferenceArray(
        task.middleware,
        middlewareIds
      );
      this.normalizeMetaTags(task, tagIds);
    }

    for (const hook of this.hooks) {
      hook.dependsOn = this.canonicalizeReferenceArray(
        hook.dependsOn,
        allDependencyIds
      );
      hook.tags = this.canonicalizeReferenceArray(hook.tags, tagIds);
      hook.emits = this.canonicalizeReferenceArray(hook.emits, eventIds);
      hook.events = this.canonicalizeReferenceArray(hook.events, eventIds);
      const hookWithMiddleware = hook as Hook & {
        middleware?: string[] | null;
      };
      hookWithMiddleware.middleware = this.canonicalizeReferenceArray(
        hookWithMiddleware.middleware,
        middlewareIds
      );
      this.normalizeMetaTags(hook, tagIds);
    }

    for (const resource of this.resources) {
      resource.dependsOn = this.canonicalizeReferenceArray(
        resource.dependsOn,
        allDependencyIds
      );
      resource.tags = this.canonicalizeReferenceArray(resource.tags, tagIds);
      resource.emits = this.canonicalizeReferenceArray(
        resource.emits,
        eventIds
      );
      resource.middleware = this.canonicalizeReferenceArray(
        resource.middleware,
        middlewareIds
      );
      resource.overrides = this.canonicalizeReferenceArray(
        resource.overrides,
        taskHookResourceMiddlewareIds
      );
      resource.registers = this.canonicalizeReferenceArray(
        resource.registers,
        taskHookResourceMiddlewareIds
      );
      this.normalizeMetaTags(resource, tagIds);
    }

    for (const middleware of this.middlewares) {
      middleware.tags = this.canonicalizeReferenceArray(
        middleware.tags,
        tagIds
      );
      const middlewareWithEmits = middleware as Middleware & {
        emits?: string[] | null;
      };
      middlewareWithEmits.emits = this.canonicalizeReferenceArray(
        middlewareWithEmits.emits,
        eventIds
      );
      middleware.usedByTasks = this.canonicalizeReferenceArray(
        middleware.usedByTasks,
        taskLikeIds
      );
      middleware.usedByResources = this.canonicalizeReferenceArray(
        middleware.usedByResources,
        resourceIds
      );
      this.normalizeMetaTags(middleware, tagIds);
    }

    for (const event of this.events) {
      event.tags = this.canonicalizeReferenceArray(event.tags, tagIds);
      event.listenedToBy = this.canonicalizeReferenceArray(
        event.listenedToBy,
        hookIds
      );
      this.normalizeMetaTags(event, tagIds);
    }

    for (const error of this.errors) {
      error.tags = this.canonicalizeReferenceArray(error.tags, tagIds);
      error.thrownBy = this.canonicalizeReferenceArray(
        error.thrownBy,
        taskHookResourceMiddlewareIds
      );
      this.normalizeMetaTags(error, tagIds);
    }

    for (const asyncContext of this.asyncContexts) {
      asyncContext.usedBy = this.canonicalizeReferenceArray(
        asyncContext.usedBy,
        taskHookResourceMiddlewareIds
      );
      asyncContext.requiredBy = this.canonicalizeReferenceArray(
        asyncContext.requiredBy,
        taskIds
      );
      asyncContext.providedBy = this.canonicalizeReferenceArray(
        asyncContext.providedBy,
        resourceIds
      );
      this.normalizeMetaTags(asyncContext, tagIds);
    }
  }

  public finalizeDerivedState(): void {
    this.normalizeRelationIds();
    this.populateErrorThrownBy();
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
    this.tags = Array.isArray(data.tags) ? data.tags : [];
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

    this.finalizeDerivedState();

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
    const opts: Record<string, unknown> = {};
    if (typeof args?.afterTimestamp === "number")
      opts.afterTimestamp = args.afterTimestamp;
    if (typeof args?.last === "number") opts.last = args.last;
    const f = args?.filter ?? {};
    opts.nodeIds = [String(nodeId)];
    if (Array.isArray(f.nodeKinds)) opts.nodeKinds = f.nodeKinds;
    if (typeof f.ok === "boolean") opts.ok = f.ok;
    if (Array.isArray(f.parentIds)) opts.parentIds = f.parentIds;
    if (Array.isArray(f.rootIds)) opts.rootIds = f.rootIds;
    if (Array.isArray(f.correlationIds)) opts.correlationIds = f.correlationIds;
    return opts;
  }

  // API Methods
  getRoot(): Resource {
    const idFromStore = this.store?.root?.resource?.id
      ? String(this.store.root.resource.id)
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
    const legacyRunOptions = runOptions as Partial<RunOptions> & {
      disposeBudgetMs?: number | null;
      disposeDrainBudgetMs?: number | null;
      runtimeEventCycleDetection?: boolean | null;
    };
    const mode = runOptions.mode ?? "dev";
    const debug = Boolean(runOptions.debug);
    const rootId = runOptions.rootId ?? this.rootId ?? "";
    const logsPrintThreshold =
      runOptions.logsPrintThreshold !== undefined
        ? runOptions.logsPrintThreshold
        : "info";
    const dispose =
      runOptions.dispose ??
      ({
        totalBudgetMs:
          typeof legacyRunOptions.disposeBudgetMs === "number"
            ? legacyRunOptions.disposeBudgetMs
            : null,
        drainingBudgetMs:
          typeof legacyRunOptions.disposeDrainBudgetMs === "number"
            ? legacyRunOptions.disposeDrainBudgetMs
            : null,
        cooldownWindowMs: null,
      } satisfies RunOptions["dispose"]);
    const executionContext =
      runOptions.executionContext ??
      ({
        enabled: false,
        cycleDetection:
          typeof legacyRunOptions.runtimeEventCycleDetection === "boolean"
            ? legacyRunOptions.runtimeEventCycleDetection
            : null,
      } satisfies RunOptions["executionContext"]);

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
      dispose,
      executionContext,
      hasOnUnhandledError: Boolean(runOptions.hasOnUnhandledError),
      rootId,
    };
  }

  getRunOptions(): RunOptions {
    if (this.store) {
      const rootId =
        this.store.root?.resource?.id != null
          ? String(this.store.root.resource.id)
          : this.rootId ?? "";
      const hasDebug = this.store.resources.has("runner.debug");
      const debugResource = this.store.resources.get("runner.debug");
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

      const loggerResource = this.store.resources.get("runner.logger");
      const logger = loggerResource?.value;
      const logsPrintThresholdRaw = logger?.printThreshold;
      const logsPrintStrategyRaw = logger?.printStrategy;
      const logsBufferRaw = logger?.bufferLogs;

      const logsPrintThreshold =
        logsPrintThresholdRaw == null ? null : String(logsPrintThresholdRaw);
      const logsPrintStrategy =
        logsPrintStrategyRaw == null ? null : String(logsPrintStrategyRaw);
      const logsBuffer = Boolean(logsBufferRaw);

      const runtimeRunOptions = this.runtime?.runOptions;

      return this.normalizeRunOptions({
        mode: this.store.mode ?? "dev",
        debug: hasDebug,
        debugMode,
        logsEnabled: logsPrintThreshold !== null,
        logsPrintThreshold,
        logsPrintStrategy,
        logsBuffer,
        errorBoundary:
          typeof runtimeRunOptions?.errorBoundary === "boolean"
            ? runtimeRunOptions.errorBoundary
            : null,
        shutdownHooks:
          typeof runtimeRunOptions?.shutdownHooks === "boolean"
            ? runtimeRunOptions.shutdownHooks
            : null,
        dryRun: Boolean(runtimeRunOptions?.dryRun),
        lazy: Boolean(runtimeRunOptions?.lazy),
        lifecycleMode:
          runtimeRunOptions?.lifecycleMode === "parallel"
            ? "parallel"
            : "sequential",
        dispose: {
          totalBudgetMs:
            typeof runtimeRunOptions?.dispose?.totalBudgetMs === "number"
              ? runtimeRunOptions.dispose.totalBudgetMs
              : null,
          drainingBudgetMs:
            typeof runtimeRunOptions?.dispose?.drainingBudgetMs === "number"
              ? runtimeRunOptions.dispose.drainingBudgetMs
              : null,
          cooldownWindowMs:
            typeof runtimeRunOptions?.dispose?.cooldownWindowMs === "number"
              ? runtimeRunOptions.dispose.cooldownWindowMs
              : null,
        },
        executionContext: {
          enabled: runtimeRunOptions?.executionContext != null,
          cycleDetection:
            runtimeRunOptions?.executionContext == null
              ? null
              : typeof runtimeRunOptions.executionContext.cycleDetection ===
                "boolean"
              ? runtimeRunOptions.executionContext.cycleDetection
              : runtimeRunOptions.executionContext.cycleDetection != null,
        },
        hasOnUnhandledError: typeof this.store.onUnhandledError === "function",
        rootId,
      });
    }

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

    // Preserve preloaded producer data and only append derived dependencies.
    this.errors.forEach((error) => {
      error.thrownBy = ensureStringArray(error.thrownBy);
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
    return this.eventMap.get(id) ?? this.findByIdLike(this.events, id);
  }

  getTask(id: string): Task | null {
    return this.taskMap.get(id) ?? this.findByIdLike(this.tasks, id);
  }

  getHook(id: string): Hook | null {
    return this.hookMap.get(id) ?? this.findByIdLike(this.hooks, id);
  }

  getMiddleware(id: string): Middleware | null {
    return (
      this.middlewareMap.get(id) ?? this.findByIdLike(this.middlewares, id)
    );
  }

  getResource(id: string): Resource | null {
    return this.resourceMap.get(id) ?? this.findByIdLike(this.resources, id);
  }

  getDependencies(node: Task | Hook | Resource): {
    tasks: Task[];
    hooks: Hook[];
    resources: Resource[];
    emitters: Event[];
    errors: ErrorModel[];
  } {
    const depends = ensureStringArray(node.dependsOn);
    const tasksDeps = this.tasks.filter((t) =>
      this.idsContainLike(depends, t.id)
    );
    const hooksDeps = this.hooks.filter((l) =>
      this.idsContainLike(depends, l.id)
    );
    const resourcesDeps = this.resources.filter((r) =>
      this.idsContainLike(depends, r.id)
    );
    const errorDeps = this.errors.filter((e) =>
      this.idsContainLike(depends, e.id)
    );

    const emitIds = ensureStringArray(node.emits);
    const emitEvents = this.events.filter((e) =>
      this.idsContainLike(emitIds, e.id)
    );

    return {
      tasks: tasksDeps,
      hooks: hooksDeps,
      resources: resourcesDeps,
      emitters: emitEvents,
      errors: errorDeps,
    };
  }

  getEmittedEvents(node: Task | Hook): Event[] {
    const emits = ensureStringArray(node.emits);
    return this.events.filter((e) => this.idsContainLike(emits, e.id));
  }

  getMiddlewaresByIds(ids: string[]): Middleware[] {
    return this.middlewares.filter((m) => this.idsContainLike(ids, m.id));
  }

  getResourcesByIds(ids: string[]): Resource[] {
    return this.resources.filter((r) => this.idsContainLike(ids, r.id));
  }

  getTasksByIds(ids: string[]): Task[] {
    return this.tasks.filter((t) => this.idsContainLike(ids, t.id));
  }

  getHooksByIds(ids: string[]): Hook[] {
    return this.hooks.filter((l) => this.idsContainLike(ids, l.id));
  }

  getEventsByIds(ids: string[]): Event[] {
    return this.events.filter((e) => this.idsContainLike(ids, e.id));
  }

  getTasksUsingResource(resourceId: string): (Task | Hook)[] {
    return [...this.tasks, ...this.hooks].filter((t) =>
      this.idsContainLike(t.dependsOn, resourceId)
    );
  }

  getTasksUsingMiddleware(middlewareId: string): (Task | Hook)[] {
    return this.tasks.filter((t) =>
      this.idsContainLike(t.middleware, middlewareId)
    );
  }

  // Backward-compat for schema fields expecting this name
  // Returns only task-like nodes (tasks and hooks)
  getTaskLikesUsingMiddleware(middlewareId: string): (Task | Hook)[] {
    return this.getTasksUsingMiddleware(middlewareId);
  }

  getEmittersOfEvent(eventId: string): (Task | Hook | Resource)[] {
    return [...this.tasks, ...this.hooks, ...this.resources].filter((t) =>
      this.idsContainLike(t.emits, eventId)
    );
  }

  getHooksOfEvent(eventId: string): Hook[] {
    return this.hooks.filter((l) => this.idsContainLike(l.events, eventId));
  }

  getMiddlewareEmittedEvents(middlewareId: string): Event[] {
    const taskLikes = this.getTasksUsingMiddleware(middlewareId);
    const emittedIds = new Set<string>();
    for (const t of taskLikes) {
      for (const e of ensureStringArray(t.emits)) {
        emittedIds.add(e);
      }
    }
    return this.events.filter((e) => emittedIds.has(e.id));
  }

  getMiddlewareUsagesForTask(
    taskId: string
  ): Array<{ id: string; config: string | null; node: Middleware }> {
    const task = this.taskMap.get(taskId);
    if (!task) {
      const resolvedTask = this.getTask(taskId);
      if (!resolvedTask) return [];
      return this.getMiddlewareUsagesForTask(resolvedTask.id);
    }
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
    if (!res) {
      const resolvedResource = this.getResource(resourceId);
      if (!resolvedResource) return [];
      return this.getMiddlewareUsagesForResource(resolvedResource.id);
    }
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
        if (this.idsContainLike(tl.middleware, middlewareId)) {
          const conf =
            (tl.middlewareDetailed || []).find((m) =>
              this.idsMatch(
                this.resolveCanonicalId(
                  m.id,
                  this.middlewares.map((entry) => entry.id)
                ),
                middlewareId
              )
            )?.config ?? null;
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
      if (this.idsContainLike(r.middleware, middlewareId)) {
        const conf =
          (r.middlewareDetailed || []).find((m) =>
            this.idsMatch(
              this.resolveCanonicalId(
                m.id,
                this.middlewares.map((entry) => entry.id)
              ),
              middlewareId
            )
          )?.config ?? null;
        result.push({ id: r.id, config: conf ?? null, node: r });
      }
    }
    return result;
  }

  getEmittedEventsForResource(resourceId: string): Event[] {
    const taskLikes = this.getTasksUsingResource(resourceId);
    const emitted = new Set<string>();
    for (const t of taskLikes) {
      for (const e of ensureStringArray(t.emits)) emitted.add(e);
    }
    return this.getEventsByIds(Array.from(emitted));
  }

  // Tags API
  getTasksWithTag(tagId: string): Task[] {
    return this.tasks.filter((t) => this.idsContainLike(t.tags, tagId));
  }

  getHooksWithTag(tagId: string): Hook[] {
    return this.hooks.filter((h) => this.idsContainLike(h.tags, tagId));
  }

  getResourcesWithTag(tagId: string): Resource[] {
    return this.resources.filter((r) => this.idsContainLike(r.tags, tagId));
  }

  getMiddlewaresWithTag(tagId: string): Middleware[] {
    return this.middlewares.filter((m) => this.idsContainLike(m.tags, tagId));
  }

  getTaskMiddlewaresWithTag(tagId: string): Middleware[] {
    return this.taskMiddlewares.filter((m) =>
      this.idsContainLike(m.tags, tagId)
    );
  }

  getResourceMiddlewaresWithTag(tagId: string): Middleware[] {
    return this.resourceMiddlewares.filter((m) =>
      this.idsContainLike(m.tags, tagId)
    );
  }

  getEventsWithTag(tagId: string): Event[] {
    return this.events.filter((e) => this.idsContainLike(e.tags, tagId));
  }

  getErrorsWithTag(tagId: string): ErrorModel[] {
    return this.errors
      .filter((e) => this.idsContainLike(e.tags, tagId))
      .map((error) => stampElementKind(error, "ERROR"));
  }

  getTagHandlers(tagId: string): {
    tasks: Task[];
    hooks: Hook[];
    resources: Resource[];
  } {
    const dependsOnTag = <T extends { dependsOn?: string[] | null }>(
      item: T
    ): boolean => this.idsContainLike(item.dependsOn, tagId);

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
    return this.tagMap.get(id) ?? this.findByIdLike(this.tags, id);
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
    return this.errors.map((error) => stampElementKind(error, "ERROR"));
  }

  getError(id: string): ErrorModel | null {
    const error = this.errorMap.get(id) ?? this.findByIdLike(this.errors, id);
    return error ? stampElementKind(error, "ERROR") : null;
  }

  getTasksUsingError(errorId: string): Task[] {
    const error = this.getError(errorId);
    if (!error?.thrownBy) return [];

    return this.tasks.filter((task) =>
      this.idsContainLike(error.thrownBy, task.id)
    );
  }

  getResourcesUsingError(errorId: string): Resource[] {
    const error = this.getError(errorId);
    if (!error?.thrownBy) return [];

    return this.resources.filter((resource) =>
      this.idsContainLike(error.thrownBy, resource.id)
    );
  }

  getHooksUsingError(errorId: string): Hook[] {
    const error = this.getError(errorId);
    if (!error?.thrownBy) return [];

    return this.hooks.filter((hook) =>
      this.idsContainLike(error.thrownBy, hook.id)
    );
  }

  getMiddlewaresUsingError(errorId: string): Middleware[] {
    const error = this.getError(errorId);
    if (!error?.thrownBy) return [];

    return this.middlewares.filter((middleware) =>
      this.idsContainLike(error.thrownBy, middleware.id)
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
    return (
      this.asyncContextMap.get(id) ?? this.findByIdLike(this.asyncContexts, id)
    );
  }

  getTasksUsingContext(contextId: string): Task[] {
    const context = this.getAsyncContext(contextId);
    if (!context?.usedBy) return [];

    return this.tasks.filter((task) =>
      this.idsContainLike(context.usedBy, task.id)
    );
  }

  getResourcesUsingContext(contextId: string): Resource[] {
    const context = this.getAsyncContext(contextId);
    if (!context?.usedBy) return [];

    return this.resources.filter((resource) =>
      this.idsContainLike(context.usedBy, resource.id)
    );
  }

  getResourcesProvidingContext(contextId: string): Resource[] {
    const context = this.getAsyncContext(contextId);
    if (!context?.providedBy) return [];

    return this.resources.filter((resource) =>
      this.idsContainLike(context.providedBy, resource.id)
    );
  }

  getHooksUsingContext(contextId: string): Hook[] {
    const context = this.getAsyncContext(contextId);
    if (!context?.usedBy) return [];

    return this.hooks.filter((hook) =>
      this.idsContainLike(context.usedBy, hook.id)
    );
  }

  getMiddlewaresUsingContext(contextId: string): Middleware[] {
    const context = this.getAsyncContext(contextId);
    if (!context?.usedBy) return [];

    return this.middlewares.filter((middleware) =>
      this.idsContainLike(context.usedBy, middleware.id)
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
    const context = this.getAsyncContext(contextId);
    if (!context?.requiredBy) return [];

    return this.tasks.filter((task) =>
      this.idsContainLike(context.requiredBy, task.id)
    );
  }

  /**
   * Checks whether a given element uses `.require()` for a specific async context.
   */
  isContextRequiredBy(contextId: string, elementId: string): boolean {
    const context = this.getAsyncContext(contextId);
    return this.idsContainLike(context?.requiredBy, elementId);
  }

  // RPC lane-related methods
  getRpcLanesResources(): Resource[] {
    return this.resources.filter((resource) => isRpcLanesResource(resource));
  }

  getTasksByRpcLane(rpcLaneId: string): Task[] {
    return this.tasks.filter((task) => task.rpcLane?.laneId === rpcLaneId);
  }

  getEventsByRpcLane(rpcLaneId: string): Event[] {
    return this.events.filter((event) => event.rpcLane?.laneId === rpcLaneId);
  }

  getRpcLaneForTask(taskId: string): string | null {
    return this.getTask(taskId)?.rpcLane?.laneId ?? null;
  }

  getRpcLaneForEvent(eventId: string): string | null {
    return this.getEvent(eventId)?.rpcLane?.laneId ?? null;
  }

  getRpcLaneResourceForTask(taskId: string): Resource | null {
    const laneId = this.getRpcLaneForTask(taskId);
    if (!laneId) return null;
    return this.findRpcLanesResourceByLaneId(laneId);
  }

  getRpcLaneResourceForEvent(eventId: string): Resource | null {
    const laneId = this.getRpcLaneForEvent(eventId);
    if (!laneId) return null;
    return this.findRpcLanesResourceByLaneId(laneId);
  }

  private findRpcLanesResourceByLaneId(laneId: string): Resource | null {
    const rpcLanesResources = this.getRpcLanesResources();
    if (rpcLanesResources.length === 0) return null;

    for (const resource of rpcLanesResources) {
      const laneIds = collectRpcLaneIdsFromResourceConfig(resource.config);
      if (laneIds.has(laneId)) return resource;
    }

    // Fallback: if exactly one rpcLanes resource exists, prefer it.
    return rpcLanesResources.length === 1 ? rpcLanesResources[0] : null;
  }

  // Durable workflow-related methods
  /**
   * Checks if a task is a durable workflow task.
   * A task is durable if it has the durable workflow tag (current: `globals.tags.durableWorkflow`, legacy: `durable.workflow`).
   */
  isDurableTask(taskId: string): boolean {
    const task = this.getTask(taskId);
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
    const task = this.getTask(taskId);
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
      rootId:
        this.store?.root?.resource?.id != null
          ? String(this.store.root.resource.id)
          : this.rootId,
      runOptions: this.getRunOptions(),
      interceptorOwners: this.getInterceptorOwnersSnapshot(),
    };
  }

  static deserialize(data: SerializedIntrospector): Introspector {
    return new Introspector({ data });
  }
}
