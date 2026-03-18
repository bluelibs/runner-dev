import type {
  Task,
  Hook,
  Resource,
  Event,
  Middleware,
  IdentityRequirementSummary,
  IdentityScopeSummary,
} from "../../schema/model";

import {
  definitions,
  Store,
  type IdentityRequirementConfig,
  type IdentityScopeConfig,
} from "@bluelibs/runner";
import {
  RPC_LANE_TAG_ID,
  extractLaneId,
  isEventLanesResource,
} from "../../utils/lane-resources";
import { formatSchemaIfZod } from "../../utils/zod";
import { sanitizePath } from "../../utils/path";
import {
  buildIdMap,
  readId,
  stampElementKind,
  stringifyIfObject,
  toArray,
} from "./introspector.tools";

export function normalizeTags(
  tags: Array<string | definitions.ITagDefinition> | null | undefined
): {
  ids: string[];
  detailed: { id: string; config: string | null }[];
} {
  const ids: string[] = [];
  const detailed: { id: string; config: string | null }[] = [];
  for (const t of toArray(tags)) {
    if (typeof t === "string") {
      ids.push(t);
    } else if (t && typeof t === "object" && "id" in t) {
      const id = String((t as any).id);
      ids.push(id);
      const config = (t as any).config ?? null;
      detailed.push({ id, config: stringifyIfObject(config) });
    }
  }
  return { ids: Array.from(new Set(ids)), detailed };
}

export function buildMetaWithNormalizedTags(
  meta: any,
  sourceWithTags: any
): any {
  const base = meta ?? null;
  // Only return meta fields; tags are handled at the top-level of elements.
  const topLevel = (sourceWithTags as any)?.tags ?? null;
  if (!topLevel) return base;
  const { ids, detailed } = normalizeTags(topLevel);
  // Keep a copy for backward GraphQL meta.tags resolver compatibility.
  return { ...(base || {}), tags: ids, tagsDetailed: detailed } as any;
}

export function findById(collection: any, id: string): any | undefined {
  if (!collection) return undefined;
  if (collection instanceof Map) return collection.get(id);
  if (Array.isArray(collection))
    return collection.find((x) => readId(x) === id);
  if (typeof collection === "object")
    return (
      collection[id] ??
      Object.values(collection).find((x: any) => readId(x) === id)
    );
  return undefined;
}

const taskMiddlewareScopeMarker = ".middleware.task.";
const resourceMiddlewareScopeMarker = ".middleware.resource.";

function getMiddlewareDuplicateKey(id: string): string {
  const taskScopeIndex = id.lastIndexOf(taskMiddlewareScopeMarker);
  if (taskScopeIndex >= 0) {
    return id.slice(taskScopeIndex + taskMiddlewareScopeMarker.length);
  }

  const resourceScopeIndex = id.lastIndexOf(resourceMiddlewareScopeMarker);
  if (resourceScopeIndex >= 0) {
    return id.slice(resourceScopeIndex + resourceMiddlewareScopeMarker.length);
  }

  return id;
}

function getTaskOwnerResourceChain(store: Store, taskId: string): string[] {
  const chain: string[] = [];
  const visited = new Set<string>();
  let currentOwnerId = store.getOwnerResourceId(taskId);

  while (currentOwnerId && !visited.has(currentOwnerId)) {
    visited.add(currentOwnerId);
    chain.push(currentOwnerId);
    currentOwnerId = store.getOwnerResourceId(currentOwnerId);
  }

  return chain;
}

function normalizeIdentityRequirementSummary(
  value: unknown
): IdentityRequirementSummary | null {
  if (!value || typeof value !== "object") return null;
  const config = value as IdentityRequirementConfig;
  return {
    tenant: true,
    user: config.user === true,
    roles: Array.isArray(config.roles)
      ? config.roles.map((role) => String(role))
      : [],
  };
}

function normalizeIdentityRequirementSummaries(
  value: unknown
): IdentityRequirementSummary[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => normalizeIdentityRequirementSummary(entry))
    .filter((entry): entry is IdentityRequirementSummary => Boolean(entry));
}

function normalizeIdentityScopeSummary(
  value: unknown
): IdentityScopeSummary | null {
  if (!value || typeof value !== "object") return null;
  const config = value as IdentityScopeConfig;
  return {
    tenant: true,
    user: config.user === true,
    required: config.required ?? true,
  };
}

function getSubtreePolicies(resource: any): SubtreePolicyInput[] {
  const rawSubtree = resource?.subtree;
  if (!rawSubtree || typeof rawSubtree !== "object") return [];
  return Array.isArray(rawSubtree)
    ? rawSubtree.filter(
        (policy): policy is SubtreePolicyInput =>
          Boolean(policy) && typeof policy === "object"
      )
    : [rawSubtree as SubtreePolicyInput];
}

function readSubtreeMiddlewareEntryId(entry: unknown): string | null {
  if (!entry || typeof entry !== "object") return null;
  if ("use" in (entry as Record<string, unknown>)) {
    return readSubtreeMiddlewareEntryId(
      (entry as { use?: unknown }).use ?? null
    );
  }

  const id = readId(entry);
  return id ? id : null;
}

function resolveTaskSubtreeMiddlewareEntry(
  entry: unknown,
  task: definitions.ITask
): string | null {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  if ("use" in (entry as Record<string, unknown>)) {
    const conditionalEntry = entry as {
      use?: unknown;
      when?: (definition: definitions.ITask) => boolean;
    };

    if (
      typeof conditionalEntry.when === "function" &&
      !conditionalEntry.when(task)
    ) {
      return null;
    }

    return readSubtreeMiddlewareEntryId(conditionalEntry.use ?? null);
  }

  return readSubtreeMiddlewareEntryId(entry);
}

function collectSubtreeTaskMiddlewareOwnerIds(
  store: Store,
  task: definitions.ITask
): Map<string, string> {
  const ownerIds = new Map<string, string>();
  const chainRootToNearest = [
    ...getTaskOwnerResourceChain(store, task.id),
  ].reverse();

  for (const ownerResourceId of chainRootToNearest) {
    const ownerResource = store.resources.get(ownerResourceId)?.resource;
    if (!ownerResource) continue;

    for (const policy of getSubtreePolicies(ownerResource)) {
      const taskMiddlewares = Array.isArray(policy.tasks?.middleware)
        ? policy.tasks.middleware
        : [];

      for (const entry of taskMiddlewares) {
        const middlewareId = resolveTaskSubtreeMiddlewareEntry(entry, task);
        if (!middlewareId) continue;

        const duplicateKey = getMiddlewareDuplicateKey(middlewareId);
        if (!ownerIds.has(duplicateKey)) {
          ownerIds.set(duplicateKey, ownerResourceId);
        }
      }
    }
  }

  return ownerIds;
}

function hasMiddlewareConfig(middleware: { config?: unknown }): boolean {
  return (
    Boolean((middleware as any)?.[definitions.symbolMiddlewareConfigured]) ||
    middleware?.config !== undefined
  );
}

function buildEffectiveTaskMiddlewareUsages(
  store: Store,
  task: definitions.ITask
): NonNullable<Task["middlewareDetailed"]> {
  const resolver = (store.getMiddlewareManager() as any)?.middlewareResolver as
    | {
        getApplicableTaskMiddlewares: (
          taskDefinition: definitions.ITask
        ) => definitions.ITaskMiddleware[];
      }
    | undefined;
  const effectiveMiddlewares = resolver
    ? resolver.getApplicableTaskMiddlewares(task)
    : task.middleware;
  const subtreeOwnersByKey = collectSubtreeTaskMiddlewareOwnerIds(store, task);

  return effectiveMiddlewares.map((middleware: any) => {
    const duplicateKey = getMiddlewareDuplicateKey(String(middleware.id));
    const subtreeOwnerId = subtreeOwnersByKey.get(duplicateKey) ?? null;

    return {
      id: String(middleware.id),
      config: hasMiddlewareConfig(middleware)
        ? stringifyIfObject(middleware.config)
        : null,
      origin: subtreeOwnerId ? "subtree" : "local",
      subtreeOwnerId,
    };
  });
}

// Mapping helpers
export function mapStoreTaskToTaskModel(
  task: definitions.ITask,
  store?: Store,
  taskStoreElement?: {
    interceptors?: Array<{ ownerResourceId?: string }>;
  }
): Task {
  const depsObj = normalizeDependencies(task?.dependencies);
  const eventIdsFromDeps = extractEventIdsFromDependencies(depsObj);
  const resourceIdsFromDeps = extractResourceIdsFromDependencies(depsObj);
  const taskIdsFromDeps = extractTaskIdsFromDependencies(depsObj);
  const errorIdsFromDeps = extractErrorIdsFromDependencies(depsObj);
  const tagIdsFromDeps = extractTagIdsFromDependencies(depsObj);
  const middlewareDetailed = store
    ? buildEffectiveTaskMiddlewareUsages(store, task)
    : (task.middleware || []).map((m: any) => ({
        id: String(m.id),
        config: hasMiddlewareConfig(m) ? stringifyIfObject(m.config) : null,
        origin: "local" as const,
        subtreeOwnerId: null,
      }));
  const { ids: tagIds, detailed: tagsDetailed } = normalizeTags(
    (task as any)?.tags
  );
  const interceptorOwnerIds = Array.from(
    new Set(
      taskStoreElement?.interceptors
        ?.map((record) => record.ownerResourceId)
        .filter((value): value is string => Boolean(value)) ?? []
    )
  );

  return stampElementKind(
    {
      id: task.id.toString(),
      meta: buildMetaWithNormalizedTags(task.meta, task),
      tags: tagIds,
      tagsDetailed,
      filePath: sanitizePath(
        (task as any)?.[definitions.symbolFilePath] ??
          (task as any)?.filePath ??
          (task as any)?.path ??
          null
      ),
      dependsOn: [
        ...resourceIdsFromDeps,
        ...taskIdsFromDeps,
        ...errorIdsFromDeps,
        ...tagIdsFromDeps,
      ],
      middleware: middlewareDetailed.map((m) => m.id),
      middlewareDetailed,
      registeredBy: null,
      kind: "TASK",
      isPrivate: false,
      visibilityReason: null,
      // Emits any events present in its dependencies
      emits: eventIdsFromDeps,
      inputSchema: formatSchemaIfZod(task.inputSchema),
      resultSchema: formatSchemaIfZod(task.resultSchema),
      rpcLane: extractRpcLaneSummary(tagsDetailed),
      interceptorCount: taskStoreElement?.interceptors?.length ?? 0,
      hasInterceptors: (taskStoreElement?.interceptors?.length ?? 0) > 0,
      interceptorOwnerIds,
    },
    "TASK"
  );
}

export function mapStoreTaskToHookModel(
  _task: definitions.ITask<any, any, any>
): Hook {
  throw new Error("deprecated");
}

export function mapStoreHookToHookModel(
  hkStoreElement: definitions.HookStoreElementType,
  store?: Store
): Hook {
  const hk = hkStoreElement.hook;
  const depsObj = normalizeDependencies(hk?.dependencies);
  const eventIdsFromDeps = extractEventIdsFromDependencies(depsObj);
  const resourceIdsFromDeps = extractResourceIdsFromDependencies(depsObj);
  const taskIdsFromDeps = extractTaskIdsFromDependencies(depsObj);
  const errorIdsFromDeps = extractErrorIdsFromDependencies(depsObj);
  const tagIdsFromDeps = extractTagIdsFromDependencies(depsObj);
  const { ids: tagIds, detailed: tagsDetailed } = normalizeTags(hk.tags);

  const eventIds = resolveHookEventIds(hk, store);

  return stampElementKind(
    {
      id: String(hk?.id),
      meta: buildMetaWithNormalizedTags(hk?.meta, hk),
      tags: tagIds,
      tagsDetailed,
      filePath: sanitizePath(
        (hk as any)?.[definitions.symbolFilePath] ??
          (hk as any)?.filePath ??
          (hk as any)?.path ??
          null
      ),
      emits: eventIdsFromDeps,
      dependsOn: [
        ...resourceIdsFromDeps,
        ...taskIdsFromDeps,
        ...errorIdsFromDeps,
        ...tagIdsFromDeps,
      ],
      middleware: [],
      middlewareDetailed: [],
      overriddenBy: null,
      registeredBy: null,
      kind: "HOOK",
      events: eventIds,
      hookOrder: typeof hk?.order === "number" ? hk.order : null,
      isPrivate: false,
      visibilityReason: null,
    },
    "HOOK"
  );
}

export function mapStoreResourceToResourceModel(
  resource: definitions.IResource,
  resourceConfig?: unknown
): Resource {
  const introspectorMode = "dev" as never;

  const register = Array.isArray(resource.register)
    ? resource.register
    : typeof resource.register === "function"
    ? resource.register(resourceConfig as never, introspectorMode)
    : [];

  const overrides = Array.isArray(resource.overrides)
    ? resource.overrides
    : typeof resource.overrides === "function"
    ? resource.overrides(resourceConfig as never, introspectorMode)
    : [];

  const depsObj = normalizeDependencies(resource?.dependencies);
  const eventIdsFromDeps = extractEventIdsFromDependencies(depsObj);
  const resourceIdsFromDeps = extractResourceIdsFromDependencies(depsObj);
  const taskIdsFromDeps = extractTaskIdsFromDependencies(depsObj);
  const errorIdsFromDeps = extractErrorIdsFromDependencies(depsObj);
  const tagIdsFromDeps = extractTagIdsFromDependencies(depsObj);
  const middlewareDetailed = (resource.middleware || []).map((m: any) => ({
    id: String(m.id),
    // In some @bluelibs/runner versions the configured flag may be missing; fall back to presence of config
    config:
      (m && m[definitions.symbolMiddlewareConfigured]) ||
      m?.config !== undefined
        ? stringifyIfObject(m.config)
        : null,
  }));

  const { ids: tagIds, detailed: tagsDetailed } = normalizeTags(
    (resource as any)?.tags
  );
  const isolation = normalizeIsolation(resource);
  const subtree = normalizeSubtreePolicy(resource);
  const hasCooldown = typeof (resource as any)?.cooldown === "function";
  const hasReady = typeof (resource as any)?.ready === "function";
  const hasHealthCheck = typeof (resource as any)?.health === "function";
  const config = normalizeResourceConfig(resourceConfig);

  return stampElementKind(
    {
      id: resource.id.toString(),
      meta: buildMetaWithNormalizedTags(resource.meta, resource),
      tags: tagIds,
      tagsDetailed,
      emits: eventIdsFromDeps,
      dependsOn: [
        ...resourceIdsFromDeps,
        ...taskIdsFromDeps,
        ...errorIdsFromDeps,
        ...tagIdsFromDeps,
      ],
      filePath: sanitizePath(
        (resource as any)?.[definitions.symbolFilePath] ??
          (resource as any)?.filePath ??
          (resource as any)?.path ??
          null
      ),
      config,
      middleware: resource.middleware.map((m) => m.id.toString()),
      middlewareDetailed,
      overrides: overrides.flatMap((override) =>
        override ? [override.id.toString()] : []
      ),
      registers: register.map((r) => r.id.toString()) as string[],
      isolation,
      subtree,
      hasCooldown,
      hasReady,
      hasHealthCheck,
      context: stringifyIfObject(resource.context),
      registeredBy: null,
      configSchema: formatSchemaIfZod(resource.configSchema),
      isPrivate: false,
      visibilityReason: null,
    },
    "RESOURCE"
  );
}

function normalizeResourceConfig(config: unknown): string | null {
  if (config == null) return null;
  if (typeof config === "object" && !Array.isArray(config)) {
    if (Object.keys(config as Record<string, unknown>).length === 0) {
      return null;
    }
  }
  return stringifyIfObject(config);
}

export function buildEvents(store: Store): Event[] {
  const eventsCollection = Array.from(store.events.values()).map(
    (e) => e.event
  );
  const allEventIds = eventsCollection.map((e) => e.id.toString());
  const hookEntries = Array.from(store.hooks.values());
  const hookTargetEventIdsByHookId = new Map<string, string[]>();
  const eventLaneByEventId = buildEventLaneSummaryByEventId(store);

  for (const hookEntry of hookEntries) {
    hookTargetEventIdsByHookId.set(
      hookEntry.hook.id,
      resolveHookEventIds(hookEntry.hook, store)
    );
  }

  return allEventIds.map((eventId) => {
    const e = findById(eventsCollection, eventId) as Event;
    const { ids: tagIds, detailed: tagsDetailed } = normalizeTags(e.tags);
    const hooksListeningToEvent = hookEntries
      .filter(({ hook }) => {
        if (hook.on === "*") return true;
        return (
          hookTargetEventIdsByHookId.get(hook.id)?.includes(eventId) ?? false
        );
      })
      .map(({ hook }) => hook.id);

    return stampElementKind(
      {
        id: eventId,
        meta: buildMetaWithNormalizedTags((e as any)?.meta ?? null, e),
        tags: tagIds,
        tagsDetailed,
        transactional: Boolean((e as any)?.transactional),
        parallel: Boolean((e as any)?.parallel),
        eventLane: eventLaneByEventId.get(eventId) ?? null,
        rpcLane: extractRpcLaneSummary(tagsDetailed),
        filePath: sanitizePath(
          (e && (e as any)[definitions.symbolFilePath]) ?? e?.filePath ?? null
        ),
        listenedToBy: hooksListeningToEvent,
        registeredBy: null,
        payloadSchema: formatSchemaIfZod(e.payloadSchema),
        isPrivate: false,
        visibilityReason: null,
      },
      "EVENT"
    );
  });
}

function resolveHookEventIds(hook: definitions.IHook, store?: Store): string[] {
  if (hook.on === "*") {
    return ["*"];
  }

  if (store && hook.on) {
    return store.resolveHookTargets(hook).map((entry) => entry.event.id);
  }

  if (Array.isArray(hook.on)) {
    return hook.on.map((entry) =>
      typeof entry === "string" ? entry : String(entry?.id)
    );
  }

  return [String(hook.on?.id ?? "*")];
}

function buildEventLaneSummaryByEventId(
  store: Store
): Map<string, NonNullable<Event["eventLane"]>> {
  const laneByEventId = new Map<string, NonNullable<Event["eventLane"]>>();
  const topologyLanesById = new Map<
    string,
    {
      id: string;
      applyTo?: readonly unknown[] | ((event: unknown) => boolean);
      orderingKey: string | null;
      metadata: string | null;
    }
  >();

  for (const resourceEntry of store.resources.values()) {
    const resource = resourceEntry.resource;
    const normalizedTags = normalizeTags((resource as any)?.tags).ids;

    if (
      !isEventLanesResource({
        id: String(resource.id),
        tags: normalizedTags,
      })
    ) {
      continue;
    }

    const topology = (resourceEntry as { config?: { topology?: unknown } })
      .config?.topology as
      | {
          bindings?: Array<{
            lane?: {
              id?: unknown;
              applyTo?: unknown;
              orderingKey?: unknown;
              metadata?: unknown;
            };
          }>;
          profiles?: Record<
            string,
            {
              consume?: Array<{
                lane?: {
                  id?: unknown;
                  applyTo?: unknown;
                  orderingKey?: unknown;
                  metadata?: unknown;
                };
              }>;
            }
          >;
        }
      | undefined;

    if (Array.isArray(topology?.bindings)) {
      for (const binding of topology.bindings) {
        const laneId = extractLaneId(binding?.lane);
        if (!laneId || !binding?.lane) continue;
        topologyLanesById.set(laneId, {
          id: laneId,
          applyTo: normalizeEventLaneApplyTo(binding.lane.applyTo),
          orderingKey:
            typeof binding.lane.orderingKey === "string"
              ? binding.lane.orderingKey
              : null,
          metadata: stringifyIfObject(binding.lane.metadata),
        });
      }
    }

    if (topology?.profiles && typeof topology.profiles === "object") {
      for (const profile of Object.values(topology.profiles)) {
        if (!Array.isArray(profile?.consume)) continue;
        for (const entry of profile.consume) {
          const laneId = extractLaneId(entry?.lane);
          if (!laneId || !entry?.lane) continue;
          topologyLanesById.set(laneId, {
            id: laneId,
            applyTo: normalizeEventLaneApplyTo(entry.lane.applyTo),
            orderingKey:
              typeof entry.lane.orderingKey === "string"
                ? entry.lane.orderingKey
                : null,
            metadata: stringifyIfObject(entry.lane.metadata),
          });
        }
      }
    }
  }

  const registeredEvents = Array.from(store.events.values()).map(
    (eventEntry) => eventEntry.event
  );

  for (const lane of topologyLanesById.values()) {
    if (typeof lane.applyTo === "function") {
      for (const event of registeredEvents) {
        if (laneByEventId.has(event.id)) continue;
        if (!(lane.applyTo as (event: unknown) => boolean)(event)) continue;
        laneByEventId.set(event.id, {
          laneId: lane.id,
          orderingKey: lane.orderingKey,
          metadata: lane.metadata,
        });
      }
      continue;
    }

    if (!Array.isArray(lane.applyTo)) {
      continue;
    }

    for (const target of lane.applyTo) {
      const targetId =
        typeof target === "string"
          ? target
          : store.findIdByDefinition(target as never) ?? extractLaneId(target);
      if (!targetId) continue;

      const event = store.events.get(targetId)?.event;
      if (!event || laneByEventId.has(event.id)) continue;
      laneByEventId.set(event.id, {
        laneId: lane.id,
        orderingKey: lane.orderingKey,
        metadata: lane.metadata,
      });
    }
  }

  return laneByEventId;
}

function normalizeEventLaneApplyTo(
  applyTo: unknown
): readonly unknown[] | ((event: unknown) => boolean) | undefined {
  if (Array.isArray(applyTo)) {
    return applyTo;
  }

  if (typeof applyTo === "function") {
    return applyTo as (event: unknown) => boolean;
  }

  return undefined;
}

function buildMiddlewaresGeneric(
  middlewaresCollection: Array<
    | {
        middleware?:
          | definitions.ITaskMiddleware
          | definitions.IResourceMiddleware;
      }
    | any
  >,
  tasks: Task[],
  resources: Resource[],
  kind: "task" | "resource"
): Middleware[] {
  const matchesMiddlewareId = (
    candidateIds: string[] | null | undefined,
    middlewareId: string
  ) =>
    (candidateIds ?? []).some(
      (candidateId) =>
        candidateId === middlewareId ||
        candidateId.endsWith(`.${middlewareId}`) ||
        middlewareId.endsWith(`.${candidateId}`)
    );

  return toArray(middlewaresCollection).map((entry: any) => {
    const mw = entry?.middleware ?? entry;
    const id = readId(mw);
    const depsObj = normalizeDependencies(mw?.dependencies);
    const eventIdsFromDeps = extractEventIdsFromDependencies(depsObj);
    const resourceIdsFromDeps = extractResourceIdsFromDependencies(depsObj);
    const taskIdsFromDeps = extractTaskIdsFromDependencies(depsObj);
    const errorIdsFromDeps = extractErrorIdsFromDependencies(depsObj);
    const tagIdsFromDeps = extractTagIdsFromDependencies(depsObj);
    const { ids: tagIds, detailed: tagsDetailed } = normalizeTags(
      (mw as any)?.tags
    );
    const autoApply = normalizeMiddlewareAutoApply(mw);

    const usedByTasks =
      kind === "task"
        ? tasks
            .filter((t) => matchesMiddlewareId(t.middleware, id))
            .map((t) => t.id)
        : [];
    const usedByResources =
      kind === "resource"
        ? resources
            .filter((r) => matchesMiddlewareId(r.middleware, id))
            .map((r) => r.id)
        : [];

    return stampElementKind(
      {
        id,
        meta: buildMetaWithNormalizedTags(mw?.meta ?? null, mw),
        tags: tagIds,
        tagsDetailed,
        filePath: sanitizePath(
          mw?.[definitions.symbolFilePath] ?? mw?.filePath ?? mw?.path ?? null
        ),
        autoApply,
        emits: eventIdsFromDeps,
        dependsOn: [
          ...resourceIdsFromDeps,
          ...taskIdsFromDeps,
          ...errorIdsFromDeps,
          ...tagIdsFromDeps,
        ],
        usedByTasks,
        usedByResources,
        overriddenBy: mw?.overriddenBy ?? null,
        registeredBy: null,
        configSchema: formatSchemaIfZod(mw.configSchema),
        type: kind,
        isPrivate: false,
        visibilityReason: null,
      },
      "MIDDLEWARE"
    );
  });
}

export function buildTaskMiddlewares(
  middlewaresCollection: definitions.ITaskMiddleware[],
  tasks: Task[],
  resources: Resource[]
): Middleware[] {
  return buildMiddlewaresGeneric(
    middlewaresCollection as any,
    tasks,
    resources,
    "task"
  );
}

export function buildResourceMiddlewares(
  middlewaresCollection: definitions.IResourceMiddleware[],
  tasks: Task[],
  resources: Resource[]
): Middleware[] {
  return buildMiddlewaresGeneric(
    middlewaresCollection as any,
    tasks,
    resources,
    "resource"
  );
}

export function attachRegisteredBy(
  resources: Resource[],
  tasks: Task[],
  hooks: Hook[],
  middlewares: Middleware[],
  events: Event[]
): void {
  const taskMap = buildIdMap(tasks);
  const hookMap = buildIdMap(hooks);
  const resourceMap = buildIdMap(resources);
  const middlewareMap = buildIdMap(middlewares);
  const eventMap = buildIdMap(events);

  for (const r of resources) {
    for (const id of r.registers ?? []) {
      if (taskMap.has(id)) taskMap.get(id)!.registeredBy = r.id;
      else if (hookMap.has(id)) hookMap.get(id)!.registeredBy = r.id;
      else if (resourceMap.has(id)) resourceMap.get(id)!.registeredBy = r.id;
      else if (middlewareMap.has(id))
        middlewareMap.get(id)!.registeredBy = r.id;
      else if (eventMap.has(id)) eventMap.get(id)!.registeredBy = r.id;
    }
  }
}

// Overrides helpers
type OverrideRequest = {
  source: string | symbol;
  override: definitions.RegisterableItems;
};

function isResourceWithConfig(
  item: definitions.RegisterableItems
): item is definitions.IResourceWithConfig<any, any, any> {
  return typeof item === "object" && item !== null && "resource" in item;
}

export function computeOverriddenByMap(
  overrideRequests: ReadonlyArray<OverrideRequest>
): Map<string, string> {
  const map = new Map<string, string>();
  for (const req of overrideRequests) {
    const { source, override } = req;
    const targetId = isResourceWithConfig(override)
      ? override.resource.id.toString()
      : (override.id as string | symbol).toString();
    const sourceId = (source as string | symbol).toString();
    map.set(targetId, sourceId);
  }
  return map;
}

export function attachOverrides(
  overrideRequests: ReadonlyArray<OverrideRequest>,
  tasks: Task[],
  hooks: Hook[],
  middlewares: Middleware[]
): void {
  const overriddenByMap = computeOverriddenByMap(overrideRequests);
  const resolveOverrideOwner = (elementId: string): string | null => {
    const exact = overriddenByMap.get(elementId);
    if (exact) return exact;

    for (const [targetId, ownerId] of overriddenByMap.entries()) {
      if (
        targetId === elementId ||
        targetId.endsWith(`.${elementId}`) ||
        elementId.endsWith(`.${targetId}`)
      ) {
        return ownerId;
      }
    }

    return null;
  };

  for (const t of tasks) t.overriddenBy = resolveOverrideOwner(t.id);
  for (const l of hooks) l.overriddenBy = resolveOverrideOwner(l.id);
  for (const m of middlewares) m.overriddenBy = resolveOverrideOwner(m.id);
}

// Internal helpers
export function normalizeDependencies(
  deps: unknown
): Record<string | symbol, unknown> {
  // dependencies can be provided as an object or as a function returning an object
  try {
    if (deps && typeof deps === "function") {
      const evaluated = (deps as (...args: any[]) => any)();
      if (evaluated && typeof evaluated === "object") {
        return evaluated as Record<string | symbol, unknown>;
      }
    }
  } catch {
    // best-effort; if evaluation fails, fall through to empty object
  }
  if (deps && typeof deps === "object") {
    return deps as Record<string | symbol, unknown>;
  }
  return {};
}

export function extractAsyncContextIdsFromDependencies(
  deps: Record<string | symbol, unknown>
): string[] {
  const result: string[] = [];
  for (const value of Object.values(deps)) {
    if (
      value &&
      (typeof value === "object" || typeof value === "function") &&
      Reflect.get(value, definitions.symbolAsyncContext) === true
    ) {
      result.push(readId(value));
    }
  }
  return Array.from(new Set(result));
}

/**
 * Extracts async context IDs from `.require()` middleware usage on a task.
 * `.require()` returns `requireContextTaskMiddleware.with({ context })` so
 * we look for middleware entries with id `globals.middleware.requireContext`
 * and pull the context ID from the configured config object.
 */
export const REQUIRE_CONTEXT_MIDDLEWARE_ID =
  "runner.middleware.task.requireContext";

const REQUIRE_CONTEXT_MIDDLEWARE_IDS = [
  REQUIRE_CONTEXT_MIDDLEWARE_ID,
  "requireContext",
  // Legacy ids used by older Runner versions
  "globals.middleware.task.requireContext",
  "globals.middleware.requireContext",
] as const;

function matchesTagId(candidateId: string, expectedId: string): boolean {
  const candidateLocalId = candidateId.split(".").pop();
  const expectedLocalId = expectedId.split(".").pop();

  return (
    candidateId === expectedId ||
    candidateId.endsWith(`.${expectedId}`) ||
    expectedId.endsWith(`.${candidateId}`) ||
    (candidateLocalId !== undefined &&
      expectedLocalId !== undefined &&
      candidateLocalId === expectedLocalId)
  );
}

export function extractRequiredContextIds(middleware: any[]): string[] {
  const result: string[] = [];
  for (const m of middleware || []) {
    if (
      m &&
      (REQUIRE_CONTEXT_MIDDLEWARE_IDS as readonly string[]).includes(
        String(m.id)
      ) &&
      m.config?.context?.id
    ) {
      result.push(String(m.config.context.id));
    }
  }
  return Array.from(new Set(result));
}

export function extractAllDependenciesFromDependencies(
  deps: Record<string | symbol, unknown>
): string[] {
  return [
    ...extractEventIdsFromDependencies(deps),
    ...extractResourceIdsFromDependencies(deps),
    ...extractTaskIdsFromDependencies(deps),
    ...extractErrorIdsFromDependencies(deps),
    ...extractTagIdsFromDependencies(deps),
    ...extractAsyncContextIdsFromDependencies(deps),
  ];
}

function unwrapOptionalDependency(value: unknown): unknown {
  let current = value;
  for (let i = 0; i < 4; i += 1) {
    if (
      current &&
      typeof current === "object" &&
      Reflect.get(current, (definitions as any).symbolOptionalDependency) ===
        true &&
      "inner" in (current as any)
    ) {
      current = (current as any).inner;
      continue;
    }
    break;
  }
  return current;
}

function extractTagIdFromDependencyValue(value: unknown): string | null {
  const unwrapped = unwrapOptionalDependency(value);
  if (
    !unwrapped ||
    (typeof unwrapped !== "object" && typeof unwrapped !== "function")
  ) {
    return null;
  }

  if (Reflect.get(unwrapped, (definitions as any).symbolTag) === true) {
    return readId(unwrapped);
  }

  if (
    Reflect.get(
      unwrapped,
      (definitions as any).symbolTagBeforeInitDependency
    ) === true &&
    (unwrapped as any).tag
  ) {
    const startupTag = unwrapOptionalDependency((unwrapped as any).tag);
    if (
      startupTag &&
      Reflect.get(startupTag, (definitions as any).symbolTag) === true
    ) {
      return readId(startupTag);
    }
  }

  return null;
}

export function extractTagIdsFromDependencies(
  deps: Record<string | symbol, unknown>
): string[] {
  const ids = new Set<string>();
  for (const value of Object.values(deps)) {
    const id = extractTagIdFromDependencyValue(value);
    if (id) {
      ids.add(id);
    }
  }
  return Array.from(ids);
}

function toIsolationIds(entries: unknown): string[] {
  if (!Array.isArray(entries)) return [];
  const ids = entries
    .map((entry) => (typeof entry === "string" ? entry : readId(entry)))
    .filter(Boolean);
  return Array.from(new Set(ids));
}

function normalizeIsolation(resource: any): Resource["isolation"] {
  const isolate = resource?.isolate;
  const legacyExports = Array.isArray(resource?.exports)
    ? resource.exports
    : [];

  if (!isolate && legacyExports.length === 0) {
    return null;
  }

  const deny = toIsolationIds(isolate?.deny);
  const only = toIsolationIds(isolate?.only);

  const whitelist = normalizeWhitelist(isolate?.whitelist);

  const hasIsolateExports = Boolean(isolate && "exports" in isolate);
  const rawExports = hasIsolateExports
    ? isolate.exports
    : !isolate
    ? legacyExports
    : undefined;

  let exports: string[] = [];
  let exportsMode: "unset" | "none" | "list" = "unset";

  if (rawExports === "none") {
    exportsMode = "none";
  } else if (Array.isArray(rawExports)) {
    exports = toIsolationIds(rawExports);
    exportsMode = exports.length > 0 ? "list" : "none";
  }

  return { deny, only, whitelist, exports, exportsMode };
}

function normalizeWhitelist(
  whitelist: unknown
): NonNullable<Resource["isolation"]>["whitelist"] {
  if (!Array.isArray(whitelist)) return [];
  return whitelist.map((entry: any) => ({
    for: toIsolationIds(entry?.for),
    targets: toIsolationIds(entry?.targets),
    channels: normalizeWhitelistChannels(entry?.channels),
  }));
}

function normalizeWhitelistChannels(channels: unknown): {
  dependencies?: boolean;
  listening?: boolean;
  tagging?: boolean;
  middleware?: boolean;
} | null {
  if (!channels || typeof channels !== "object") return null;
  const c = channels as Record<string, unknown>;
  return {
    dependencies:
      typeof c.dependencies === "boolean" ? c.dependencies : undefined,
    listening: typeof c.listening === "boolean" ? c.listening : undefined,
    tagging: typeof c.tagging === "boolean" ? c.tagging : undefined,
    middleware: typeof c.middleware === "boolean" ? c.middleware : undefined,
  };
}

function normalizeMiddlewareAutoApply(mw: any): Middleware["autoApply"] {
  const applyTo = mw?.applyTo;
  if (applyTo && typeof applyTo === "object") {
    return {
      enabled: true,
      scope:
        applyTo.scope === "subtree" || applyTo.scope === "where-visible"
          ? applyTo.scope
          : null,
      hasPredicate: typeof applyTo.when === "function",
    };
  }

  return {
    enabled: false,
    scope: null,
    hasPredicate: false,
  };
}

function normalizeSubtreeValidatorCount(value: unknown): number {
  if (Array.isArray(value)) return value.length;
  if (typeof value === "function") return 1;
  return 0;
}

function toSubtreeMiddlewareIds(entries: unknown): string[] {
  if (!Array.isArray(entries)) return [];
  const ids = entries
    .map((entry) =>
      typeof entry === "string" ? entry : readSubtreeMiddlewareEntryId(entry)
    )
    .filter((id): id is string => Boolean(id));
  return Array.from(new Set(ids));
}

type SubtreePolicyInput = {
  tasks?: {
    middleware?: unknown;
    identity?: unknown;
    validate?: unknown;
  } | null;
  middleware?: { identityScope?: unknown } | null;
  resources?: { middleware?: unknown; validate?: unknown } | null;
  hooks?: { validate?: unknown } | null;
  taskMiddleware?: { validate?: unknown } | null;
  resourceMiddleware?: { validate?: unknown } | null;
  events?: { validate?: unknown } | null;
  tags?: { validate?: unknown } | null;
};

function appendSubtreeMiddlewareIds(
  target: Set<string>,
  entries: unknown
): void {
  for (const id of toSubtreeMiddlewareIds(entries)) {
    target.add(id);
  }
}

function normalizeSubtreePolicy(resource: any): Resource["subtree"] {
  const subtreePolicies = getSubtreePolicies(resource);
  if (subtreePolicies.length === 0) return null;

  const taskMiddlewareIds = new Set<string>();
  const resourceMiddlewareIds = new Set<string>();
  const taskIdentityRequirements: NonNullable<
    NonNullable<NonNullable<Resource["subtree"]>["tasks"]>["identity"]
  > = [];
  let tasksValidatorCount = 0;
  let resourcesValidatorCount = 0;
  let hooksValidatorCount = 0;
  let taskMiddlewareValidatorCount = 0;
  let resourceMiddlewareValidatorCount = 0;
  let eventsValidatorCount = 0;
  let tagsValidatorCount = 0;
  let subtreeMiddlewareIdentityScope: NonNullable<
    NonNullable<Resource["subtree"]>["middleware"]
  >["identityScope"] = null;

  for (const subtree of subtreePolicies) {
    if (subtree.tasks) {
      appendSubtreeMiddlewareIds(taskMiddlewareIds, subtree.tasks.middleware);
      taskIdentityRequirements.push(
        ...normalizeIdentityRequirementSummaries(subtree.tasks.identity)
      );
      tasksValidatorCount += normalizeSubtreeValidatorCount(
        subtree.tasks.validate
      );
    }

    if (subtree.middleware && "identityScope" in subtree.middleware) {
      subtreeMiddlewareIdentityScope = normalizeIdentityScopeSummary(
        subtree.middleware.identityScope
      );
    }

    if (subtree.resources) {
      appendSubtreeMiddlewareIds(
        resourceMiddlewareIds,
        subtree.resources.middleware
      );
      resourcesValidatorCount += normalizeSubtreeValidatorCount(
        subtree.resources.validate
      );
    }

    if (subtree.hooks) {
      hooksValidatorCount += normalizeSubtreeValidatorCount(
        subtree.hooks.validate
      );
    }

    if (subtree.taskMiddleware) {
      taskMiddlewareValidatorCount += normalizeSubtreeValidatorCount(
        subtree.taskMiddleware.validate
      );
    }

    if (subtree.resourceMiddleware) {
      resourceMiddlewareValidatorCount += normalizeSubtreeValidatorCount(
        subtree.resourceMiddleware.validate
      );
    }

    if (subtree.events) {
      eventsValidatorCount += normalizeSubtreeValidatorCount(
        subtree.events.validate
      );
    }

    if (subtree.tags) {
      tagsValidatorCount += normalizeSubtreeValidatorCount(
        subtree.tags.validate
      );
    }
  }

  const tasks =
    taskMiddlewareIds.size > 0 ||
    tasksValidatorCount > 0 ||
    taskIdentityRequirements.length > 0
      ? {
          middleware: Array.from(taskMiddlewareIds),
          validatorCount: tasksValidatorCount,
          ...(taskIdentityRequirements.length > 0
            ? { identity: taskIdentityRequirements }
            : {}),
        }
      : null;
  const middleware =
    subtreeMiddlewareIdentityScope !== null
      ? {
          identityScope: subtreeMiddlewareIdentityScope,
        }
      : null;
  const resources =
    resourceMiddlewareIds.size > 0 || resourcesValidatorCount > 0
      ? {
          middleware: Array.from(resourceMiddlewareIds),
          validatorCount: resourcesValidatorCount,
        }
      : null;
  const hooks =
    hooksValidatorCount > 0
      ? {
          validatorCount: hooksValidatorCount,
        }
      : null;
  const taskMiddleware =
    taskMiddlewareValidatorCount > 0
      ? {
          validatorCount: taskMiddlewareValidatorCount,
        }
      : null;
  const resourceMiddleware =
    resourceMiddlewareValidatorCount > 0
      ? {
          validatorCount: resourceMiddlewareValidatorCount,
        }
      : null;
  const events =
    eventsValidatorCount > 0
      ? {
          validatorCount: eventsValidatorCount,
        }
      : null;
  const tags =
    tagsValidatorCount > 0
      ? {
          validatorCount: tagsValidatorCount,
        }
      : null;

  if (
    !tasks &&
    !middleware &&
    !resources &&
    !hooks &&
    !taskMiddleware &&
    !resourceMiddleware &&
    !events &&
    !tags
  ) {
    return null;
  }

  return {
    tasks,
    middleware,
    resources,
    hooks,
    taskMiddleware,
    resourceMiddleware,
    events,
    tags,
  };
}

function parseTagConfigJson(config: string | null | undefined): any | null {
  if (!config) return null;
  try {
    return JSON.parse(config);
  } catch {
    return null;
  }
}

function extractRpcLaneSummary(
  tagsDetailed: Array<{ id: string; config: string | null }>
): Task["rpcLane"] {
  const laneTag = tagsDetailed.find((tag) =>
    matchesTagId(tag.id, RPC_LANE_TAG_ID)
  );
  if (!laneTag) return null;

  const parsed = parseTagConfigJson(laneTag.config);
  const laneId = extractLaneId(parsed?.lane);
  if (!laneId) return null;

  return { laneId };
}

export function extractEventIdsFromDependencies(
  deps: Record<string | symbol, unknown>
): string[] {
  const result: string[] = [];
  for (const value of Object.values(deps)) {
    // Events can be objects or callable functions; check both
    if (
      value &&
      (typeof value === "object" || typeof value === "function") &&
      Reflect.get(value, definitions.symbolEvent) === true
    ) {
      result.push(readId(value));
    }
  }
  return Array.from(new Set(result));
}

export function extractResourceIdsFromDependencies(
  deps: Record<string | symbol, unknown>
): string[] {
  const result: string[] = [];
  for (const value of Object.values(deps)) {
    if (
      value &&
      (typeof value === "object" || typeof value === "function") &&
      Reflect.get(value, definitions.symbolResource) === true
    ) {
      result.push(readId(value));
    }
  }
  return Array.from(new Set(result));
}

export function extractTaskIdsFromDependencies(
  deps: Record<string | symbol, unknown>
): string[] {
  const result: string[] = [];
  for (const value of Object.values(deps)) {
    if (
      value &&
      (typeof value === "object" || typeof value === "function") &&
      Reflect.get(value, definitions.symbolTask) === true
    ) {
      result.push(readId(value));
    }
  }
  return Array.from(new Set(result));
}

export function extractErrorIdsFromDependencies(
  deps: Record<string | symbol, unknown>
): string[] {
  const result: string[] = [];
  for (const value of Object.values(deps)) {
    if (value && (typeof value === "object" || typeof value === "function")) {
      // Check if this value has error-specific properties or methods
      // Try multiple approaches to identify errors

      // 1. Check for common error methods/properties
      const hasErrorMethods =
        typeof (value as any).throw === "function" ||
        typeof (value as any).is === "function" ||
        typeof (value as any).dataSchema === "string" ||
        (value as any).kind === "ERROR";

      // 2. Check for symbol-based identification (if it exists)
      const hasErrorSymbol =
        Reflect.get(value, (definitions as any).symbolError) === true;

      // 3. Check for error ID pattern (ends with .error or .errors)
      const id = readId(value);
      const hasErrorIdPattern =
        id.endsWith(".error") ||
        id.endsWith(".errors") ||
        id.includes(".errors.");

      if (hasErrorSymbol || hasErrorMethods || hasErrorIdPattern) {
        result.push(id);
      }
    }
  }
  return Array.from(new Set(result));
}
