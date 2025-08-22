import type {
  Task,
  Hook,
  Resource,
  Event,
  Middleware,
  ElementKind,
  WithElementKind,
} from "../schema/model";
import { elementKindSymbol } from "../schema/model";
import { definitions } from "@bluelibs/runner";
import type { Introspector } from "./models/Introspector";
import type { DiagnosticItem } from "../schema/model";
import { accessSync, constants as fsConstants } from "fs";
import { sanitizePath } from "../utils/path";
import { formatSchemaIfZod } from "../utils/zod";

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

function buildMetaWithNormalizedTags(meta: any, sourceWithTags: any): any {
  const base = meta ?? null;
  // Gather tags provided either at top-level (sourceWithTags.tags) or inside meta.tags
  const topLevel = (sourceWithTags as any)?.tags ?? null;
  const metaLevel = (base as any)?.tags ?? null;
  if (!topLevel && !metaLevel) return base;
  const merged: Array<string | definitions.ITagDefinition> = [
    ...toArray(metaLevel),
    ...toArray(topLevel),
  ];
  const { ids, detailed } = normalizeTags(merged);
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
  const middlewareDetailed = (task.middleware || []).map((m: any) => ({
    id: String(m.id),
    config: m[definitions.symbolMiddlewareConfigured]
      ? stringifyIfObject(m.config)
      : null,
  }));

  return stampElementKind(
    {
      id: task.id.toString(),
      meta: buildMetaWithNormalizedTags(task.meta, task),
      filePath: task[definitions.symbolFilePath],
      dependsOn: resourceIdsFromDeps,
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

  const eventId =
    typeof hk?.on === "string"
      ? (hk.on as string)
      : hk?.on?.id != null
      ? String(hk.on.id)
      : "";

  return stampElementKind(
    {
      id: String(hk?.id),
      meta: buildMetaWithNormalizedTags(hk?.meta, hk),
      filePath: hk?.[definitions.symbolFilePath] ?? null,
      emits: eventIdsFromDeps,
      dependsOn: resourceIdsFromDeps,
      middleware: [],
      middlewareDetailed: [],
      overriddenBy: null,
      registeredBy: null,
      kind: "HOOK",
      event: eventId,
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
  const middlewareDetailed = (resource.middleware || []).map((m: any) => ({
    id: String(m.id),
    config: m[definitions.symbolMiddlewareConfigured]
      ? stringifyIfObject(m.config)
      : null,
  }));

  return stampElementKind(
    {
      id: resource.id.toString(),
      meta: buildMetaWithNormalizedTags(resource.meta, resource),
      emits: eventIdsFromDeps,
      dependsOn: resourceIdsFromDeps,
      filePath: resource[definitions.symbolFilePath] ?? null,
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

export function buildEvents(
  eventsCollection: definitions.IEvent[],
  tasks: Task[],
  hooks: Hook[],
  resources: Resource[]
): Event[] {
  const eventIdsFromStore: string[] = eventsCollection.map((e) =>
    e.id.toString()
  );
  const inferredFromTasks = tasks.flatMap((t) => t.emits || []);
  const inferredFromHooks = hooks.map((l) => l.event);
  const inferredFromResources = resources.flatMap((r) => r.emits || []);
  const allEventIds = Array.from(
    new Set([
      ...eventIdsFromStore,
      ...inferredFromTasks,
      ...inferredFromHooks,
      ...inferredFromResources,
    ])
  );
  return allEventIds.map((eventId) => {
    const e = findById(eventsCollection, eventId);
    return stampElementKind(
      {
        id: eventId,
        meta: buildMetaWithNormalizedTags((e as any)?.meta ?? null, e),
        filePath: e?.filePath ?? e?.path ?? null,
        listenedToBy: hooks.filter((l) => l.event === eventId).map((l) => l.id),
        registeredBy: null,
        payloadSchema: formatSchemaIfZod((e as any)?.payloadSchema),
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
        filePath:
          mw?.[definitions.symbolFilePath] ?? mw?.filePath ?? mw?.path ?? null,
        global: globalValue,
        usedByTasks,
        usedByResources,
        overriddenBy: mw?.overriddenBy ?? null,
        registeredBy: null,
        configSchema: formatSchemaIfZod(mw.configSchema),
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
  // Events with no specific hooks (wildcard hooks are ignored by buildEvents)
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
    ...introspector.getHooks().map((l) => ({ id: l.id, filePath: l.filePath })),
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

  // Anonymous (Symbol) IDs
  const collections: Array<{
    kind: "RESOURCE" | "TASK" | "HOOK" | "EVENT" | "MIDDLEWARE";
    nodes: Array<{ id: string }>;
  }> = [
    { kind: "RESOURCE", nodes: introspector.getResources() },
    { kind: "TASK", nodes: introspector.getTasks() },
    { kind: "HOOK", nodes: introspector.getHooks() },
    { kind: "EVENT", nodes: introspector.getEvents() },
    { kind: "MIDDLEWARE", nodes: introspector.getMiddlewares() },
  ];

  for (const e of computeOrphanEvents(introspector)) {
    if (isSystemEventId(e.id)) continue;
    diags.push({
      severity: "warning",
      code: "ORPHAN_EVENT",
      message: `Event has no hooks: ${e.id}`,
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
    if (isSystemEventId(m.id)) continue;
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
  return id.startsWith("globals.") || id === "*";
}
