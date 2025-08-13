import type {
  Task,
  Listener,
  Resource,
  Event,
  Middleware,
  ElementKind,
  WithElementKind,
} from "../schema/model";
import { elementKindSymbol } from "../schema/model";
import { definitions } from "@bluelibs/runner";
import type { Introspector } from "./introspector.resource";
import type { DiagnosticItem } from "../schema/model";
import { accessSync, constants as fsConstants } from "fs";
import { sanitizePath } from "../utils/path";

export function toArray(collection: any): any[] {
  if (!collection) return [];
  if (Array.isArray(collection)) return collection;
  if (collection instanceof Map) return Array.from(collection.values());
  if (typeof collection === "object") return Object.values(collection);
  return [];
}

export function readId(obj: any): string {
  if (!obj) return "";
  if (typeof obj.id === "string") return obj.id;
  return String(obj);
}

export function ensureStringArray(input: any): string[] {
  if (!input) return [];
  if (Array.isArray(input)) {
    return input
      .map((v) => (typeof v === "string" ? v : readId(v)))
      .filter(Boolean);
  }
  if (typeof input === "string") return [input];
  return [];
}

export function stringifyIfObject(input: any): string | null {
  if (input == null) return null;
  if (typeof input === "string") return input;
  try {
    return JSON.stringify(input);
  } catch {
    return String(input);
  }
}

// Internal helper to stamp a non-enumerable discriminator used by GraphQL type resolution
export function stampElementKind<T extends object>(
  obj: T,
  kind: ElementKind
): WithElementKind<T> {
  try {
    Object.defineProperty(obj, elementKindSymbol, {
      value: kind,
      enumerable: false,
      configurable: false,
      writable: false,
    });
  } catch {
    // best-effort; if it fails, we ignore
  }
  return obj as WithElementKind<T>;
}

function normalizeTags(
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
      // t can be ITagDefinition or ITagWithConfig
      const id = String((t as any).id);
      ids.push(id);
      const config = (t as any).config ?? null;
      detailed.push({ id, config: stringifyIfObject(config) });
    }
  }
  return { ids: Array.from(new Set(ids)), detailed };
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
  const middlewareDetailed = (task.middleware || []).map((m: any) => ({
    id: String(m.id),
    config: m[definitions.symbolMiddlewareConfigured]
      ? stringifyIfObject(m.config)
      : null,
  }));

  return stampElementKind(
    {
      id: task.id.toString(),
      meta: (() => {
        const base = task.meta ?? null;
        if (!base) return base;
        const { ids, detailed } = normalizeTags((base as any).tags);
        return { ...base, tags: ids, tagsDetailed: detailed } as any;
      })(),
      filePath: task[definitions.symbolFilePath],
      dependsOn: resourceIdsFromDeps,
      middleware: task.middleware.map((m) => m.id.toString()),
      middlewareDetailed,
      registeredBy: null,
      kind: "TASK",
      // Emits any events present in its dependencies
      emits: eventIdsFromDeps,
    },
    "TASK"
  );
}

export function mapStoreTaskToListenerModel(
  task: definitions.ITask<any, any, any, "*" | definitions.IEvent<any>>
): Listener {
  const depsObj = normalizeDependencies(task?.dependencies);
  const eventIdsFromDeps = extractEventIdsFromDependencies(depsObj);
  const resourceIdsFromDeps = extractResourceIdsFromDependencies(depsObj);
  const middlewareDetailed = (task.middleware || []).map((m: any) => ({
    id: String(m.id),
    config: m[definitions.symbolMiddlewareConfigured]
      ? stringifyIfObject(m.config)
      : null,
  }));

  return stampElementKind(
    {
      id: task.id.toString(),
      meta: (() => {
        const base = task.meta ?? null;
        if (!base) return base;
        const { ids, detailed } = normalizeTags((base as any).tags);
        return { ...base, tags: ids, tagsDetailed: detailed } as any;
      })(),
      filePath: task[definitions.symbolFilePath] ?? null,
      emits: eventIdsFromDeps,
      dependsOn: resourceIdsFromDeps,
      middleware: task.middleware.map((m) => m.id.toString()),
      middlewareDetailed,
      // They are stored later.
      overriddenBy: null,
      registeredBy: null,
      kind: "LISTENER",
      event:
        typeof task.on === "string"
          ? task.on
          : (task.on?.id.toString() as string), // Assertion to ensure it's not undefined
      listenerOrder: task.listenerOrder ?? null,
    },
    "LISTENER"
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
  const middlewareDetailed = (resource.middleware || []).map((m: any) => ({
    id: String(m.id),
    config: m[definitions.symbolMiddlewareConfigured]
      ? stringifyIfObject(m.config)
      : null,
  }));

  return stampElementKind(
    {
      id: resource.id.toString(),
      meta: (() => {
        const base = resource.meta ?? null;
        if (!base) return base;
        const { ids, detailed } = normalizeTags((base as any).tags);
        return { ...base, tags: ids, tagsDetailed: detailed } as any;
      })(),
      emits: eventIdsFromDeps,
      dependsOn: resourceIdsFromDeps,
      filePath: resource[definitions.symbolFilePath] ?? null,
      middleware: resource.middleware.map((m) => m.id.toString()),
      middlewareDetailed,
      overrides: resource.overrides.map((o) => o.id.toString()),
      registers: register.map((r) => r.id.toString()) as string[],
      context: stringifyIfObject(resource.context),
      registeredBy: null,
    },
    "RESOURCE"
  );
}

export function buildEvents(
  eventsCollection: definitions.IEvent[],
  tasks: Task[],
  listeners: Listener[],
  resources: Resource[]
): Event[] {
  const eventIdsFromStore: string[] = eventsCollection.map((e) =>
    e.id.toString()
  );
  const inferredFromTasks = tasks.flatMap((t) => t.emits || []);
  const inferredFromListeners = listeners.map((l) => l.event);
  const inferredFromResources = resources.flatMap((r) => r.emits || []);
  const allEventIds = Array.from(
    new Set([
      ...eventIdsFromStore,
      ...inferredFromTasks,
      ...inferredFromListeners,
      ...inferredFromResources,
    ])
  );
  return allEventIds.map((eventId) => {
    const e = findById(eventsCollection, eventId);
    return stampElementKind(
      {
        id: eventId,
        meta: e?.meta ?? null,
        filePath: e?.filePath ?? e?.path ?? null,
        listenedToBy: listeners
          .filter((l) => l.event === eventId)
          .map((l) => l.id),
        registeredBy: null,
      },
      "EVENT"
    );
  });
}

export function buildMiddlewares(
  middlewaresCollection: definitions.IMiddleware[],
  tasks: Task[],
  listeners: Listener[],
  resources: Resource[]
): Middleware[] {
  return toArray(middlewaresCollection).map((entry: any) => {
    const mw = entry?.middleware ?? entry;
    const id = readId(mw);

    // Global flags are stored via .everywhere({ tasks?, resources? })
    const isEverywhereTasks = Boolean(
      Reflect.get(mw, definitions.symbolMiddlewareEverywhereTasks)
    );
    const isEverywhereResources = Boolean(
      Reflect.get(mw, definitions.symbolMiddlewareEverywhereResources)
    );
    const hasEverywhere = isEverywhereTasks || isEverywhereResources;

    const globalValue = hasEverywhere
      ? {
          enabled: true,
          tasks: isEverywhereTasks,
          resources: isEverywhereResources,
        }
      : { enabled: false, tasks: false, resources: false };

    const usedByTasks = [...tasks, ...listeners]
      .filter((t) => (t.middleware || []).includes(id))
      .map((t) => t.id);
    const usedByResources = resources
      .filter((r) => (r.middleware || []).includes(id))
      .map((r) => r.id);

    return stampElementKind(
      {
        id,
        meta: mw?.meta ?? null,
        filePath:
          mw?.[definitions.symbolFilePath] ?? mw?.filePath ?? mw?.path ?? null,
        global: globalValue,
        usedByTasks,
        usedByResources,
        overriddenBy: mw?.overriddenBy ?? null,
        registeredBy: null,
      },
      "MIDDLEWARE"
    );
  });
}

export function attachRegisteredBy(
  resources: Resource[],
  tasks: Task[],
  listeners: Listener[],
  middlewares: Middleware[],
  events: Event[]
): void {
  const taskMap = buildIdMap(tasks);
  const listenerMap = buildIdMap(listeners);
  const resourceMap = buildIdMap(resources);
  const middlewareMap = buildIdMap(middlewares);
  const eventMap = buildIdMap(events);

  for (const r of resources) {
    for (const id of r.registers ?? []) {
      if (taskMap.has(id)) taskMap.get(id)!.registeredBy = r.id;
      else if (listenerMap.has(id)) listenerMap.get(id)!.registeredBy = r.id;
      else if (resourceMap.has(id)) resourceMap.get(id)!.registeredBy = r.id;
      else if (middlewareMap.has(id))
        middlewareMap.get(id)!.registeredBy = r.id;
      else if (eventMap.has(id)) eventMap.get(id)!.registeredBy = r.id;
    }
  }
}

export function buildIdMap<T extends { id: string }>(
  items: T[]
): Map<string, T> {
  return new Map(items.map((i) => [i.id, i] as const));
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
  listeners: Listener[],
  middlewares: Middleware[]
): void {
  const overriddenByMap = computeOverriddenByMap(overrideRequests);
  for (const t of tasks) t.overriddenBy = overriddenByMap.get(t.id) ?? null;
  for (const l of listeners) l.overriddenBy = overriddenByMap.get(l.id) ?? null;
  for (const m of middlewares)
    m.overriddenBy = overriddenByMap.get(m.id) ?? null;
}

// Internal helpers
function normalizeDependencies(
  deps: unknown
): Record<string | symbol, unknown> {
  if (deps && typeof deps === "object")
    return deps as Record<string | symbol, unknown>;
  return {};
}

function extractEventIdsFromDependencies(
  deps: Record<string | symbol, unknown>
): string[] {
  const result: string[] = [];
  for (const value of Object.values(deps)) {
    if (
      value &&
      typeof value === "object" &&
      Reflect.get(value, definitions.symbolEvent) === true
    ) {
      result.push(readId(value));
    }
  }
  return Array.from(new Set(result));
}

function extractResourceIdsFromDependencies(
  deps: Record<string | symbol, unknown>
): string[] {
  const result: string[] = [];
  for (const value of Object.values(deps)) {
    if (
      value &&
      typeof value === "object" &&
      Reflect.get(value, definitions.symbolResource) === true
    ) {
      result.push(readId(value));
    }
  }
  return Array.from(new Set(result));
}

// Diagnostics helpers
export function computeOrphanEvents(
  introspector: Introspector
): { id: string }[] {
  // Events with no specific listeners (wildcard listeners are ignored by buildEvents)
  const events = introspector.getEvents();
  return events
    .filter((e) => (e.listenedToBy ?? []).length === 0)
    .map((e) => ({ id: e.id }));
}

export function computeUnemittedEvents(
  introspector: Introspector
): { id: string }[] {
  const events = introspector.getEvents();
  return events
    .filter((e) => introspector.getEmittersOfEvent(e.id).length === 0)
    .map((e) => ({ id: e.id }));
}

export function computeUnusedMiddleware(
  introspector: Introspector
): { id: string }[] {
  const middlewares = introspector.getMiddlewares();
  return middlewares
    .filter((m) => {
      const used =
        (m.usedByTasks?.length ?? 0) > 0 ||
        (m.usedByResources?.length ?? 0) > 0;
      const globalEnabled = Boolean(m.global?.enabled);
      return !used && !globalEnabled;
    })
    .map((m) => ({ id: m.id }));
}

export function computeMissingFiles(
  introspector: Introspector
): Array<{ id: string; filePath: string }> {
  const nodes: Array<{ id: string; filePath: string | null | undefined }> = [];
  nodes.push(
    ...introspector.getTasks().map((t) => ({ id: t.id, filePath: t.filePath })),
    ...introspector
      .getListeners()
      .map((l) => ({ id: l.id, filePath: l.filePath })),
    ...introspector
      .getResources()
      .map((r) => ({ id: r.id, filePath: r.filePath })),
    ...introspector
      .getEvents()
      .map((e) => ({ id: e.id, filePath: e.filePath })),
    ...introspector
      .getMiddlewares()
      .map((m) => ({ id: m.id, filePath: m.filePath }))
  );

  const result: Array<{ id: string; filePath: string }> = [];
  for (const n of nodes) {
    if (!n.filePath) continue;
    try {
      accessSync(n.filePath, fsConstants.R_OK);
    } catch {
      result.push({ id: n.id, filePath: n.filePath });
    }
  }
  return result;
}

export function computeOverrideConflicts(
  introspector: Introspector
): Array<{ targetId: string; by: string }> {
  // If multiple resources declare overrides for the same target, it is a conflict.
  const resources = introspector.getResources();
  const targetToBy = new Map<string, Set<string>>();
  for (const r of resources) {
    for (const target of r.overrides ?? []) {
      if (!targetToBy.has(target)) targetToBy.set(target, new Set());
      targetToBy.get(target)!.add(r.id);
    }
  }
  const result: Array<{ targetId: string; by: string }> = [];
  for (const [target, bySet] of targetToBy) {
    if (bySet.size > 1) {
      for (const by of bySet) {
        result.push({ targetId: target, by });
      }
    }
  }
  // stable ordering
  result.sort((a, b) =>
    a.targetId === b.targetId
      ? a.by.localeCompare(b.by)
      : a.targetId.localeCompare(b.targetId)
  );
  return result;
}

export function buildDiagnostics(introspector: Introspector): DiagnosticItem[] {
  const diags: DiagnosticItem[] = [];

  for (const e of computeOrphanEvents(introspector)) {
    if (isSystemEventId(e.id)) continue;
    diags.push({
      severity: "warning",
      code: "ORPHAN_EVENT",
      message: `Event has no listeners: ${e.id}`,
      nodeId: e.id,
      nodeKind: "EVENT",
    });
  }
  for (const e of computeUnemittedEvents(introspector)) {
    if (isSystemEventId(e.id)) continue;
    diags.push({
      severity: "warning",
      code: "UNEMITTED_EVENT",
      message: `Event has no emitters: ${e.id}`,
      nodeId: e.id,
      nodeKind: "EVENT",
    });
  }
  for (const m of computeUnusedMiddleware(introspector)) {
    diags.push({
      severity: "info",
      code: "UNUSED_MIDDLEWARE",
      message: `Middleware is defined but not used: ${m.id}`,
      nodeId: m.id,
      nodeKind: "MIDDLEWARE",
    });
  }
  for (const n of computeMissingFiles(introspector)) {
    diags.push({
      severity: "warning",
      code: "MISSING_FILE",
      message: `File not readable: ${sanitizePath(n.filePath) ?? "<unknown>"}`,
      nodeId: n.id,
    });
  }
  for (const c of computeOverrideConflicts(introspector)) {
    diags.push({
      severity: "error",
      code: "OVERRIDE_CONFLICT",
      message: `Override conflict on ${c.targetId} by ${c.by}`,
      nodeId: c.targetId,
    });
  }

  diags.sort((a, b) => {
    if (a.code !== b.code) return a.code.localeCompare(b.code);
    const an = a.nodeId ?? "";
    const bn = b.nodeId ?? "";
    if (an !== bn) return an.localeCompare(bn);
    return a.message.localeCompare(b.message);
  });

  return diags;
}

// System events helpers
export function isSystemEventId(eventId: string): boolean {
  const id = String(eventId).toLowerCase();
  return (
    id.endsWith(".beforerun") ||
    id.endsWith(".afterrun") ||
    id.endsWith(".onerror") ||
    id.endsWith(".afterinit") ||
    id.endsWith(".beforeinit")
  );
}
