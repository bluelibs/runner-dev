import { definitions, Store } from "@bluelibs/runner";
import { Tag } from "../../schema";
import {
  attachOverrides,
  attachRegisteredBy,
  buildEvents,
  buildResourceMiddlewares,
  buildTaskMiddlewares,
  extractAsyncContextIdsFromDependencies,
  extractRequiredContextIds,
  mapStoreHookToHookModel,
  mapStoreResourceToResourceModel,
  mapStoreTaskToTaskModel,
  normalizeDependencies,
} from "./initializeFromStore.utils";
import { Introspector } from "./Introspector";
import { buildIdMap, ensureStringArray } from "./introspector.tools";
import { formatSchemaIfZod } from "../../utils/zod";
import { sanitizePath } from "../../utils/path";

const EXTERNAL_VISIBILITY_CONSUMER_ID = "runner-dev.visibility.external";
const MIDDLEWARE_MANAGER_RESOURCE_ID = "globals.resources.middlewareManager";

type TaskInterceptorRecord = {
  ownerResourceId?: string;
};

type MiddlewareInterceptorOwnerSnapshot = {
  globalTaskInterceptorOwnerIds?: readonly string[];
  globalResourceInterceptorOwnerIds?: readonly string[];
  perTaskMiddlewareInterceptorOwnerIds?: Readonly<
    Record<string, readonly string[]>
  >;
  perResourceMiddlewareInterceptorOwnerIds?: Readonly<
    Record<string, readonly string[]>
  >;
};

function buildTaskInterceptorOwnersSnapshot(
  store: Store
): Record<string, string[]> {
  const tasksById: Record<string, string[]> = {};
  for (const [taskId, taskStore] of store.tasks.entries()) {
    const ownerIds = Array.from(
      new Set(
        ((taskStore as any).interceptors as TaskInterceptorRecord[] | undefined)
          ?.map((record) => record.ownerResourceId)
          .filter((value): value is string => Boolean(value)) ?? []
      )
    );
    if (ownerIds.length > 0) {
      tasksById[String(taskId)] = ownerIds;
    }
  }
  return tasksById;
}

function normalizeMiddlewareOwnerSnapshot(
  snapshot: MiddlewareInterceptorOwnerSnapshot | null | undefined
) {
  const toStringArray = (value: readonly string[] | undefined): string[] =>
    Array.isArray(value) ? value.map((entry) => String(entry)) : [];
  const toStringMap = (
    value: Readonly<Record<string, readonly string[]>> | undefined
  ): Record<string, string[]> => {
    if (!value || typeof value !== "object") return {};
    const normalized: Record<string, string[]> = {};
    for (const [middlewareId, ownerIds] of Object.entries(value)) {
      const ids = toStringArray(ownerIds);
      if (ids.length > 0) normalized[middlewareId] = ids;
    }
    return normalized;
  };

  return {
    globalTaskInterceptorOwnerIds: toStringArray(
      snapshot?.globalTaskInterceptorOwnerIds
    ),
    globalResourceInterceptorOwnerIds: toStringArray(
      snapshot?.globalResourceInterceptorOwnerIds
    ),
    perTaskMiddlewareInterceptorOwnerIds: toStringMap(
      snapshot?.perTaskMiddlewareInterceptorOwnerIds
    ),
    perResourceMiddlewareInterceptorOwnerIds: toStringMap(
      snapshot?.perResourceMiddlewareInterceptorOwnerIds
    ),
  };
}

function getMiddlewareInterceptorOwnersSnapshot(store: Store) {
  const managerFromStore = (store as any).getMiddlewareManager?.();
  const managerFromResource = (store as any).resources?.get?.(
    MIDDLEWARE_MANAGER_RESOURCE_ID
  )?.value;
  const middlewareManager = managerFromStore ?? managerFromResource;
  const snapshot =
    middlewareManager &&
    typeof middlewareManager.getInterceptorOwnerSnapshot === "function"
      ? middlewareManager.getInterceptorOwnerSnapshot()
      : null;

  return normalizeMiddlewareOwnerSnapshot(snapshot);
}

function applyVisibilityMetadata(
  store: Store,
  elements: Array<{
    id: string;
    isPrivate?: boolean;
    visibilityReason?: string | null;
  }>
): void {
  for (const element of elements) {
    const isVisible = store.isItemVisibleToConsumer(
      element.id,
      EXTERNAL_VISIBILITY_CONSUMER_ID
    );
    element.isPrivate = !isVisible;
    element.visibilityReason = isVisible
      ? "Visible outside owning resource boundary."
      : "Hidden by resource exports() boundary.";
  }
}

export function initializeFromStore(
  introspector: Introspector,
  store: Store
): void {
  // Set store reference for methods that need it (e.g., populateTunnelInfo)
  introspector.store = store;

  // Build tasks
  introspector.tasks = [];
  introspector.hooks = [];

  const s = store;
  for (const t of s.tasks.values()) {
    introspector.tasks.push(mapStoreTaskToTaskModel(t.task, t));
  }

  for (const h of s.hooks.values()) {
    introspector.hooks.push(mapStoreHookToHookModel(h));
  }

  const taskInterceptorOwnersById = buildTaskInterceptorOwnersSnapshot(store);
  for (const task of introspector.tasks) {
    task.interceptorOwnerIds = taskInterceptorOwnersById[task.id] ?? [];
  }

  // Build resources
  introspector.resources = Array.from(s.resources.values()).map((r: any) =>
    mapStoreResourceToResourceModel(r.resource)
  );

  // Build events
  introspector.events = buildEvents(store);

  // Best effort: when resource values are available, this populates tunnel metadata.
  // In early init phases values may not exist yet; callers can invoke populateTunnelInfo()
  // again later (for example on demand in resolvers or docs routes).
  introspector.populateTunnelInfo();

  // Build errors
  introspector.errors = Array.from(store.errors.values()).map((e: any) => ({
    id: e.id,
    meta: e.meta,
    filePath: sanitizePath(e[definitions.symbolFilePath]),
    dataSchema: e.dataSchema,
    thrownBy: e.thrownBy || [],
    registeredBy: e.registeredBy,
    overriddenBy: e.overriddenBy,
    tags: ensureStringArray(e.tags),
    isPrivate: false,
    visibilityReason: null,
  }));

  // Build async contexts
  // First, create the basic async context models
  const asyncContextBasics = Array.from(store.asyncContexts.values()).map(
    (c: any) => ({
      id: c.id,
      meta: c.meta,
      filePath: sanitizePath(c[definitions.symbolFilePath]),
      serialize: c.serialize,
      parse: c.parse,
      usedBy: [] as string[],
      requiredBy: [] as string[],
      providedBy: c.providedBy || [],
      registeredBy: c.registeredBy,
      overriddenBy: c.overriddenBy,
      tags: ensureStringArray(c.tags),
      isPrivate: false,
      visibilityReason: null,
    })
  );

  // Compute usedBy (dependencies) and requiredBy (.require() middleware)
  // by scanning all tasks, hooks, resources, and middlewares
  const asyncContextIds = new Set(asyncContextBasics.map((ac) => ac.id));
  const usedByMap = new Map<string, Set<string>>();
  const requiredByMap = new Map<string, Set<string>>();
  for (const acId of asyncContextIds) {
    usedByMap.set(acId, new Set());
    requiredByMap.set(acId, new Set());
  }

  // Scan tasks for dependency-based usage and .require() middleware
  for (const t of s.tasks.values()) {
    const task = t.task;
    const depsObj = normalizeDependencies(task?.dependencies);
    const contextIds = extractAsyncContextIdsFromDependencies(depsObj);
    for (const ctxId of contextIds) {
      usedByMap.get(ctxId)?.add(task.id.toString());
    }
    const reqIds = extractRequiredContextIds(task.middleware);
    for (const ctxId of reqIds) {
      requiredByMap.get(ctxId)?.add(task.id.toString());
    }
  }

  // Scan hooks for dependency-based usage
  for (const h of s.hooks.values()) {
    const hook = h.hook;
    const depsObj = normalizeDependencies(hook?.dependencies);
    const contextIds = extractAsyncContextIdsFromDependencies(depsObj);
    for (const ctxId of contextIds) {
      usedByMap.get(ctxId)?.add(hook.id.toString());
    }
  }

  // Scan resources for dependency-based usage
  for (const r of s.resources.values()) {
    const resource = r.resource;
    const depsObj = normalizeDependencies(resource?.dependencies);
    const contextIds = extractAsyncContextIdsFromDependencies(depsObj);
    for (const ctxId of contextIds) {
      usedByMap.get(ctxId)?.add(resource.id.toString());
    }
  }

  // Scan task middlewares for dependency-based usage
  for (const mw of s.taskMiddlewares.values()) {
    const middleware = mw.middleware;
    const depsObj = normalizeDependencies(middleware?.dependencies);
    const contextIds = extractAsyncContextIdsFromDependencies(depsObj);
    for (const ctxId of contextIds) {
      usedByMap.get(ctxId)?.add(middleware.id.toString());
    }
  }

  // Scan resource middlewares for dependency-based usage
  for (const mw of s.resourceMiddlewares.values()) {
    const middleware = mw.middleware;
    const depsObj = normalizeDependencies(middleware?.dependencies);
    const contextIds = extractAsyncContextIdsFromDependencies(depsObj);
    for (const ctxId of contextIds) {
      usedByMap.get(ctxId)?.add(middleware.id.toString());
    }
  }

  // Apply computed usedBy and requiredBy to the async context models
  introspector.asyncContexts = asyncContextBasics.map((ac) => ({
    ...ac,
    usedBy: Array.from(usedByMap.get(ac.id) ?? []),
    requiredBy: Array.from(requiredByMap.get(ac.id) ?? []),
  }));

  // Build middlewares from both task and resource middleware collections
  introspector.taskMiddlewares = buildTaskMiddlewares(
    Array.from(s.taskMiddlewares.values()).map((v: any) => v.middleware),
    introspector.tasks,
    introspector.hooks,
    introspector.resources
  );
  introspector.resourceMiddlewares = buildResourceMiddlewares(
    Array.from(s.resourceMiddlewares.values()).map((v: any) => v.middleware),
    introspector.tasks,
    introspector.hooks,
    introspector.resources
  );
  introspector.middlewares = [
    ...introspector.taskMiddlewares,
    ...introspector.resourceMiddlewares,
  ];

  introspector.interceptorOwners = {
    tasksById: taskInterceptorOwnersById,
    middleware: getMiddlewareInterceptorOwnersSnapshot(store),
  };

  applyVisibilityMetadata(store, introspector.tasks);
  applyVisibilityMetadata(store, introspector.hooks);
  applyVisibilityMetadata(store, introspector.resources);
  applyVisibilityMetadata(store, introspector.events);
  applyVisibilityMetadata(store, introspector.middlewares);
  applyVisibilityMetadata(store, introspector.errors as any);
  applyVisibilityMetadata(store, introspector.asyncContexts as any);

  attachOverrides(
    s.overrideRequests,
    introspector.tasks,
    introspector.hooks,
    introspector.middlewares
  );

  // Attach registeredBy to all nodes based on each resource.registers
  attachRegisteredBy(
    introspector.resources,
    introspector.tasks,
    introspector.hooks,
    introspector.middlewares,
    introspector.events
  );

  // Maps
  introspector.taskMap = buildIdMap(introspector.tasks);
  introspector.hookMap = buildIdMap(introspector.hooks);
  introspector.resourceMap = buildIdMap(introspector.resources);
  introspector.eventMap = buildIdMap(introspector.events);
  introspector.middlewareMap = buildIdMap(introspector.middlewares);
  introspector.errorMap = buildIdMap(introspector.errors);
  introspector.asyncContextMap = buildIdMap(introspector.asyncContexts);

  // Tags
  const getTasksWithTag = (tagId: string) =>
    introspector.tasks.filter((t) => ensureStringArray(t.tags).includes(tagId));
  const getHooksWithTag = (tagId: string) =>
    introspector.hooks.filter((h) => ensureStringArray(h.tags).includes(tagId));
  const getResourcesWithTag = (tagId: string) =>
    introspector.resources.filter((r) =>
      ensureStringArray(r.tags).includes(tagId)
    );
  const getMiddlewaresWithTag = (tagId: string) =>
    introspector.middlewares.filter((m) =>
      ensureStringArray(m.tags).includes(tagId)
    );
  const getEventsWithTag = (tagId: string) =>
    introspector.events.filter((e) =>
      ensureStringArray(e.tags).includes(tagId)
    );

  introspector.tags = Array.from(store.tags.values()).map((tag) => {
    return {
      id: tag.id,
      meta: tag.meta,
      filePath: sanitizePath(tag[definitions.symbolFilePath]),
      configSchema: formatSchemaIfZod(tag.configSchema),
      isPrivate: false,
      visibilityReason: "Tags are globally discoverable metadata.",
      get tasks() {
        return getTasksWithTag(tag.id);
      },
      get hooks() {
        return getHooksWithTag(tag.id);
      },
      get resources() {
        return getResourcesWithTag(tag.id);
      },
      get middlewares() {
        return getMiddlewaresWithTag(tag.id);
      },
      get events() {
        return getEventsWithTag(tag.id);
      },
    };
  });
  introspector.tagMap = new Map<string, Tag>();
  for (const tag of introspector.tags) {
    introspector.tagMap.set(tag.id, tag);
  }
  introspector.rootId =
    s?.root?.resource?.id != null
      ? String(s.root.resource.id)
      : introspector.rootId ?? null;
}
