import type {
  Task,
  Hook,
  Resource,
  Event,
  Middleware,
  ElementKind,
  WithElementKind,
} from "../../schema/model";
import { elementKindSymbol } from "../../schema/model";

import { definitions, Store } from "@bluelibs/runner";
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

// Mapping helpers
export function mapStoreTaskToTaskModel(task: definitions.ITask): Task {
  const depsObj = normalizeDependencies(task?.dependencies);
  const eventIdsFromDeps = extractEventIdsFromDependencies(depsObj);
  const resourceIdsFromDeps = extractResourceIdsFromDependencies(depsObj);
  const taskIdsFromDeps = extractTaskIdsFromDependencies(depsObj);
  const errorIdsFromDeps = extractErrorIdsFromDependencies(depsObj);
  const middlewareDetailed = (task.middleware || []).map((m: any) => ({
    id: String(m.id),
    // In some @bluelibs/runner versions the configured flag may be missing; fall back to presence of config
    config:
      (m && m[definitions.symbolMiddlewareConfigured]) ||
      m?.config !== undefined
        ? stringifyIfObject(m.config)
        : null,
  }));
  const { ids: tagIds, detailed: tagsDetailed } = normalizeTags(
    (task as any)?.tags
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
      dependsOn: [...resourceIdsFromDeps, ...taskIdsFromDeps, ...errorIdsFromDeps],
      middleware: task.middleware.map((m) => m.id.toString()),
      middlewareDetailed,
      registeredBy: null,
      kind: "TASK",
      // Emits any events present in its dependencies
      emits: eventIdsFromDeps,
      inputSchema: formatSchemaIfZod(task.inputSchema),
    },
    "TASK"
  );
}

export function mapStoreTaskToHookModel(
  task: definitions.ITask<any, any, any>
): Hook {
  throw new Error("deprecated");
}

export function mapStoreHookToHookModel(
  hkStoreElement: definitions.HookStoreElementType
): Hook {
  const hk = hkStoreElement.hook;
  const depsObj = normalizeDependencies(hk?.dependencies);
  const eventIdsFromDeps = extractEventIdsFromDependencies(depsObj);
  const resourceIdsFromDeps = extractResourceIdsFromDependencies(depsObj);
  const taskIdsFromDeps = extractTaskIdsFromDependencies(depsObj);
  const errorIdsFromDeps = extractErrorIdsFromDependencies(depsObj);
  const { ids: tagIds, detailed: tagsDetailed } = normalizeTags(hk.tags);

  const eventIds = Array.isArray(hk.on)
    ? hk.on.map((e) => String(e.id))
    : [String(hk.on?.id ?? "*")];

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
      dependsOn: [...resourceIdsFromDeps, ...taskIdsFromDeps, ...errorIdsFromDeps],
      middleware: [],
      middlewareDetailed: [],
      overriddenBy: null,
      registeredBy: null,
      kind: "HOOK",
      events: eventIds,
      hookOrder: typeof hk?.order === "number" ? hk.order : null,
    },
    "HOOK"
  );
}

export function mapStoreResourceToResourceModel(
  resource: definitions.IResource
): Resource {
  // TODO: We might be able to improve typesafety somehow here.
  const register =
    typeof resource.register === "function"
      ? resource.register()
      : resource.register;

  const depsObj = normalizeDependencies(resource?.dependencies);
  const eventIdsFromDeps = extractEventIdsFromDependencies(depsObj);
  const resourceIdsFromDeps = extractResourceIdsFromDependencies(depsObj);
  const taskIdsFromDeps = extractTaskIdsFromDependencies(depsObj);
  const errorIdsFromDeps = extractErrorIdsFromDependencies(depsObj);
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
  return stampElementKind(
    {
      id: resource.id.toString(),
      meta: buildMetaWithNormalizedTags(resource.meta, resource),
      tags: tagIds,
      tagsDetailed,
      emits: eventIdsFromDeps,
      dependsOn: [...resourceIdsFromDeps, ...taskIdsFromDeps, ...errorIdsFromDeps],
      filePath: sanitizePath(
        (resource as any)?.[definitions.symbolFilePath] ??
          (resource as any)?.filePath ??
          (resource as any)?.path ??
          null
      ),
      middleware: resource.middleware.map((m) => m.id.toString()),
      middlewareDetailed,
      overrides: resource.overrides
        .filter((o) => !!o)
        .map((o) => o.id.toString()),
      registers: register.map((r) => r.id.toString()) as string[],
      context: stringifyIfObject(resource.context),
      registeredBy: null,
      configSchema: formatSchemaIfZod(resource.configSchema),
    },
    "RESOURCE"
  );
}

export function buildEvents(store: Store): Event[] {
  const eventsCollection = Array.from(store.events.values()).map(
    (e) => e.event
  );
  const allEventIds = eventsCollection.map((e) => e.id.toString());
  const hooks = Array.from(store.hooks.values()).map((h) => h.hook);

  return allEventIds.map((eventId) => {
    const e = findById(eventsCollection, eventId) as Event;
    const { ids: tagIds, detailed: tagsDetailed } = normalizeTags(e.tags);
    // Keep wildcard hooks in listenedToBy per design, but match specific listeners robustly
    const hooksListeningToEvent = hooks
      .filter((h) => {
        const on: any = h?.on;
        if (on === "*") return true;
        if (typeof on === "string") return on === eventId;
        if (on && typeof on === "object" && !Array.isArray(on))
          return String(on.id) === eventId;
        if (Array.isArray(on))
          return on.some((v: any) =>
            typeof v === "string" ? v === eventId : String(v?.id) === eventId
          );
        return false;
      })
      .map((h) => h.id);

    return stampElementKind(
      {
        id: eventId,
        meta: buildMetaWithNormalizedTags((e as any)?.meta ?? null, e),
        tags: tagIds,
        tagsDetailed,
        filePath: sanitizePath(
          (e && (e as any)[definitions.symbolFilePath]) ?? e?.filePath ?? null
        ),
        listenedToBy: hooksListeningToEvent,
        registeredBy: null,
        payloadSchema: formatSchemaIfZod(e.payloadSchema),
      },
      "EVENT"
    );
  });
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
  hooks: Hook[],
  resources: Resource[],
  kind: "task" | "resource"
): Middleware[] {
  return toArray(middlewaresCollection).map((entry: any) => {
    const mw = entry?.middleware ?? entry;
    const id = readId(mw);
    const { ids: tagIds, detailed: tagsDetailed } = normalizeTags(
      (mw as any)?.tags
    );

    const isEverywhereTasks = mw.everywhere;
    const isEverywhereResources = mw.everywhere;

    const hasEverywhere = isEverywhereTasks || isEverywhereResources;

    const globalValue = hasEverywhere
      ? {
          enabled: true,
          tasks: isEverywhereTasks,
          resources: isEverywhereResources,
        }
      : { enabled: false, tasks: false, resources: false };

    const usedByTasks =
      kind === "task"
        ? tasks
            .filter((t) => (t.middleware || []).includes(id))
            .map((t) => t.id)
        : [];
    const usedByResources =
      kind === "resource"
        ? resources
            .filter((r) => (r.middleware || []).includes(id))
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
        global: globalValue,
        usedByTasks,
        usedByResources,
        overriddenBy: mw?.overriddenBy ?? null,
        registeredBy: null,
        configSchema: formatSchemaIfZod(mw.configSchema),
        type: kind,
      },
      "MIDDLEWARE"
    );
  });
}

export function buildTaskMiddlewares(
  middlewaresCollection: definitions.ITaskMiddleware[],
  tasks: Task[],
  hooks: Hook[],
  resources: Resource[]
): Middleware[] {
  return buildMiddlewaresGeneric(
    middlewaresCollection as any,
    tasks,
    hooks,
    resources,
    "task"
  );
}

export function buildResourceMiddlewares(
  middlewaresCollection: definitions.IResourceMiddleware[],
  tasks: Task[],
  hooks: Hook[],
  resources: Resource[]
): Middleware[] {
  return buildMiddlewaresGeneric(
    middlewaresCollection as any,
    tasks,
    hooks,
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
  overrideRequests: ReadonlySet<OverrideRequest>
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
  overrideRequests: ReadonlySet<OverrideRequest>,
  tasks: Task[],
  hooks: Hook[],
  middlewares: Middleware[]
): void {
  const overriddenByMap = computeOverriddenByMap(overrideRequests);
  for (const t of tasks) t.overriddenBy = overriddenByMap.get(t.id) ?? null;
  for (const l of hooks) l.overriddenBy = overriddenByMap.get(l.id) ?? null;
  for (const m of middlewares)
    m.overriddenBy = overriddenByMap.get(m.id) ?? null;
}

// Internal helpers
export function normalizeDependencies(
  deps: unknown
): Record<string | symbol, unknown> {
  // dependencies can be provided as an object or as a function returning an object
  try {
    if (deps && typeof deps === "function") {
      const evaluated = (deps as Function)();
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

export function extractAllDependenciesFromDependencies(
  deps: Record<string | symbol, unknown>
): string[] {
  return [
    ...extractEventIdsFromDependencies(deps),
    ...extractResourceIdsFromDependencies(deps),
    ...extractTaskIdsFromDependencies(deps),
    ...extractErrorIdsFromDependencies(deps),
  ];
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
    if (
      value &&
      (typeof value === "object" || typeof value === "function")
    ) {
      // Check if this value has error-specific properties or methods
      // Try multiple approaches to identify errors

      // 1. Check for common error methods/properties
      const hasErrorMethods =
        typeof (value as any).throw === 'function' ||
        typeof (value as any).is === 'function' ||
        typeof (value as any).dataSchema === 'string' ||
        (value as any).kind === 'ERROR';

      // 2. Check for symbol-based identification (if it exists)
      const hasErrorSymbol =
        Reflect.get(value, (definitions as any).symbolError) === true;

      // 3. Check for error ID pattern (ends with .error or .errors)
      const id = readId(value);
      const hasErrorIdPattern =
        id.endsWith('.error') ||
        id.endsWith('.errors') ||
        id.includes('.errors.');

      if (hasErrorSymbol || hasErrorMethods || hasErrorIdPattern) {
        result.push(id);
      }
    }
  }
  return Array.from(new Set(result));
}
