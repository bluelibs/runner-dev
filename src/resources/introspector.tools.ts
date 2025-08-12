import type {
  Task,
  Listener,
  Resource,
  Event,
  Middleware,
} from "../schema/model";
import { definitions } from "@bluelibs/runner";

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

  return {
    id: task.id.toString(),
    meta: task.meta ?? null,
    filePath: task[definitions.symbolFilePath],
    dependsOn: resourceIdsFromDeps,
    middleware: task.middleware.map((m) => m.id.toString()),
    kind: "TASK",
    // Emits any events present in its dependencies
    emits: eventIdsFromDeps,
  };
}

export function mapStoreTaskToListenerModel(
  task: definitions.ITask<any, any, any, "*" | definitions.IEvent<any>>
): Listener {
  const depsObj = normalizeDependencies(task?.dependencies);
  const eventIdsFromDeps = extractEventIdsFromDependencies(depsObj);
  const resourceIdsFromDeps = extractResourceIdsFromDependencies(depsObj);

  return {
    id: task.id.toString(),
    meta: task.meta ?? null,
    filePath: task[definitions.symbolFilePath] ?? null,
    emits: eventIdsFromDeps,
    dependsOn: resourceIdsFromDeps,
    middleware: task.middleware.map((m) => m.id.toString()),
    // They are stored later.
    overriddenBy: null,
    kind: "LISTENER",
    event:
      typeof task.on === "string"
        ? task.on
        : (task.on?.id.toString() as string), // Assertion to ensure it's not undefined
    listenerOrder: task.listenerOrder ?? null,
  };
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

  return {
    id: resource.id.toString(),
    meta: resource.meta ?? null,
    emits: eventIdsFromDeps,
    filePath: resource[definitions.symbolFilePath] ?? null,
    middleware: resource.middleware.map((m) => m.id.toString()),
    overrides: resource.overrides.map((o) => o.id.toString()),
    registers: register.map((r) => r.id.toString()) as string[],
    context: stringifyIfObject(resource.context),
  };
}

export function buildEvents(
  eventsCollection: definitions.IEvent[],
  tasks: Task[],
  listeners: Listener[],
  resources: Resource[]
): Event[] {
  const eventIdsFromStore: string[] = toArray(eventsCollection)
    .map((e: any) => readId(e))
    .filter(Boolean) as string[];
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
    return {
      id: eventId,
      meta: e?.meta ?? null,
      filePath: e?.filePath ?? e?.path ?? null,
      listenedToBy: listeners
        .filter((l) => l.event === eventId)
        .map((l) => l.id),
    };
  });
}

export function buildMiddlewares(
  middlewaresCollection: any,
  tasks: Task[],
  listeners: Listener[],
  resources: Resource[]
): Middleware[] {
  return toArray(middlewaresCollection).map((m: any) => {
    const mw = m && m.middleware ? m.middleware : m;
    const id = readId(mw);
    const globalConf = mw?.global ?? mw?.config?.global ?? undefined;
    const globalValue = globalConf
      ? {
          enabled: Boolean(globalConf.enabled ?? globalConf?.active ?? false),
          tasks: ensureStringArray(
            globalConf.tasks ?? globalConf?.taskIds ?? []
          ),
          resources: ensureStringArray(
            globalConf.resources ?? globalConf?.resourceIds ?? []
          ),
        }
      : undefined;

    const usedByTasks = [...tasks, ...listeners]
      .filter((t) => (t.middleware || []).includes(id))
      .map((t) => t.id);
    const usedByResources = resources
      .filter((r) => (r.middleware || []).includes(id))
      .map((r) => r.id);

    return {
      id,
      meta: mw?.meta ?? null,
      filePath:
        (mw && mw[definitions.symbolFilePath]) ||
        mw?.filePath ||
        mw?.path ||
        null,
      global: globalValue ?? null,
      usedByTasks,
      usedByResources,
      overriddenBy: mw?.overriddenBy ?? null,
    };
  });
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
