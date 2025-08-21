import { globals, resource } from "@bluelibs/runner";
import {
  readId,
  ensureStringArray,
  mapStoreTaskToTaskModel,
  mapStoreTaskToHookModel,
  mapStoreHookToHookModel,
  mapStoreResourceToResourceModel,
  buildEvents,
  buildTaskMiddlewares,
  buildResourceMiddlewares,
  buildIdMap,
  attachOverrides,
  attachRegisteredBy,
} from "./introspector.tools";
import {
  buildDiagnostics,
  computeMissingFiles,
  computeOrphanEvents,
  computeOverrideConflicts,
  computeUnemittedEvents,
  computeUnusedMiddleware,
} from "./introspector.tools";
import type {
  All,
  Event,
  Hook,
  Middleware,
  Resource,
  Task,
  ElementKind,
  Tag,
} from "../schema/model";
import { elementKindSymbol } from "../schema/model";
import { stampElementKind } from "./introspector.tools";
// Note: avoid depending on live resource here to keep introspector lightweight

export interface Introspector {
  getRoot(): Resource;
  getEvents(): Event[];
  getTasks(): Task[];
  getHooks(): Hook[];
  getMiddlewares(): Middleware[];
  getTaskMiddlewares(): Middleware[];
  getResourceMiddlewares(): Middleware[];
  getResources(): Resource[];
  getEvent(id: string): Event | null;
  getTask(id: string): Task | null;
  getHook(id: string): Hook | null;
  getMiddleware(id: string): Middleware | null;
  getResource(id: string): Resource | null;
  getDependencies(node: Task | Hook): {
    tasks: Task[];
    hooks: Hook[];
    resources: Resource[];
    emitters: Event[];
  };
  getEmittedEvents(node: Task | Hook): Event[];
  getMiddlewaresByIds(ids: string[]): Middleware[];
  getResourcesByIds(ids: string[]): Resource[];
  getTasksByIds(ids: string[]): Task[];
  getHooksByIds(ids: string[]): Hook[];
  getEventsByIds(ids: string[]): Event[];
  getTasksUsingResource(resourceId: string): (Task | Hook)[];
  getTasksUsingMiddleware(middlewareId: string): (Task | Hook)[];
  // Backward-compat alias used by schema types
  getTaskLikesUsingMiddleware?(middlewareId: string): (Task | Hook)[];
  getEmittersOfEvent(eventId: string): (Task | Hook | Resource)[];
  getHooksOfEvent(eventId: string): Hook[];
  getMiddlewareEmittedEvents(middlewareId: string): Event[];
  getMiddlewareUsagesForTask(
    taskLikeId: string
  ): Array<{ id: string; config: string | null; node: Middleware }>;
  getMiddlewareUsagesForResource(
    resourceId: string
  ): Array<{ id: string; config: string | null; node: Middleware }>;
  getTasksUsingMiddlewareDetailed(
    middlewareId: string
  ): Array<{ id: string; config: string | null; node: Task | Hook }>;
  getResourcesUsingMiddlewareDetailed(
    middlewareId: string
  ): Array<{ id: string; config: string | null; node: Resource }>;
  getEmittedEventsForResource(resourceId: string): Event[];
  // Tags API
  getTasksWithTag(tagId: string): Task[];
  getHooksWithTag(tagId: string): Hook[];
  getResourcesWithTag(tagId: string): Resource[];
  getMiddlewaresWithTag(tagId: string): Middleware[];
  getEventsWithTag(tagId: string): Event[];
  getAllTags(): Tag[];
  getTag(id: string): Tag | null;
  // Diagnostics API
  getOrphanEvents(): { id: string }[];
  getUnemittedEvents(): { id: string }[];
  getUnusedMiddleware(): { id: string }[];
  getMissingFiles(): Array<{ id: string; filePath: string }>;
  getOverrideConflicts(): Array<{ targetId: string; by: string }>;
  getDiagnostics(): Array<{
    severity: string;
    code: string;
    message: string;
    nodeId?: string;
    nodeKind?: string;
  }>;
  // Runs helpers (filters only, resolver will call ctx.live)
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
  };
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
  };
}

export const introspector = resource({
  id: "runner-dev.resources.introspector",
  dependencies: {
    store: globals.resources.store,
  },
  async init(_, { store }): Promise<Introspector> {
    // Build tasks
    const tasks: Task[] = [];
    const hooks: Hook[] = [];

    for (const t of store.tasks.values()) {
      tasks.push(mapStoreTaskToTaskModel(t.task));
    }

    for (const h of store.hooks.values()) {
      hooks.push(mapStoreHookToHookModel(h));
    }

    // Build resources
    const resources: Resource[] = Array.from(store.resources.values()).map(
      (r) => mapStoreResourceToResourceModel(r.resource)
    );

    // Build events
    const events: Event[] = buildEvents(
      Array.from(store.events.values()).map((v) => v.event),
      tasks,
      hooks,
      resources
    );

    // Build middlewares from both task and resource middleware collections
    const taskMiddlewares: Middleware[] = buildTaskMiddlewares(
      Array.from(store.taskMiddlewares.values()).map((v) => v.middleware),
      tasks,
      hooks,
      resources
    );
    const resourceMiddlewares: Middleware[] = buildResourceMiddlewares(
      Array.from(store.resourceMiddlewares.values()).map((v) => v.middleware),
      tasks,
      hooks,
      resources
    );
    const middlewares: Middleware[] = [
      ...taskMiddlewares,
      ...resourceMiddlewares,
    ];

    attachOverrides(store.overrideRequests, tasks, hooks, middlewares);

    // Attach registeredBy to all nodes based on each resource.registers
    attachRegisteredBy(resources, tasks, hooks, middlewares, events);

    // Maps
    const taskMap = buildIdMap(tasks);
    const hookMap = buildIdMap(hooks);
    const resourceMap = buildIdMap(resources);
    const eventMap = buildIdMap(events);
    const middlewareMap = buildIdMap(middlewares);

    // Tags
    const getTasksWithTag = (tagId: string) =>
      tasks.filter((t) => ensureStringArray(t.meta?.tags).includes(tagId));
    const getHooksWithTag = (tagId: string) =>
      hooks.filter((h) => ensureStringArray(h.meta?.tags).includes(tagId));
    const getResourcesWithTag = (tagId: string) =>
      resources.filter((r) => ensureStringArray(r.meta?.tags).includes(tagId));
    const getMiddlewaresWithTag = (tagId: string) =>
      middlewares.filter((m) =>
        ensureStringArray(m.meta?.tags).includes(tagId)
      );
    const getEventsWithTag = (tagId: string) =>
      events.filter((e) => ensureStringArray(e.meta?.tags).includes(tagId));

    const allTagIds = new Set<string>();
    const collect = (arr: { meta?: { tags?: string[] | null } | null }[]) => {
      for (const n of arr) {
        for (const id of ensureStringArray(n.meta?.tags)) allTagIds.add(id);
      }
    };
    collect(tasks as any);
    collect(hooks as any);
    collect(resources as any);
    collect(middlewares as any);
    collect(events as any);

    const allTags: Tag[] = Array.from(allTagIds).map((id) => ({
      id,
      get tasks() {
        return getTasksWithTag(id);
      },
      get hooks() {
        return getHooksWithTag(id);
      },
      get resources() {
        return getResourcesWithTag(id);
      },
      get middlewares() {
        return getMiddlewaresWithTag(id);
      },
      get events() {
        return getEventsWithTag(id);
      },
    }));
    const tagMap = new Map<string, Tag>(allTags.map((t) => [t.id, t]));

    // API
    function buildRunsOptions(
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

    const api: Introspector = {
      getRoot: () =>
        stampElementKind(
          resourceMap.get(store.root.resource.id.toString())!,
          "RESOURCE"
        ),
      getEvents: () => events,
      getTasks: () => tasks,
      getHooks: () => hooks,
      getMiddlewares: () => middlewares,
      getTaskMiddlewares: () => taskMiddlewares,
      getResourceMiddlewares: () => resourceMiddlewares,
      getResources: () => resources,
      getEvent: (id) => eventMap.get(id) ?? null,
      getTask: (id) => taskMap.get(id) ?? null,
      getHook: (id) => hookMap.get(id) ?? null,
      getMiddleware: (id) => middlewareMap.get(id) ?? null,
      getResource: (id) => resourceMap.get(id) ?? null,
      getDependencies: (node) => {
        const depends = ensureStringArray(node.dependsOn);
        const tasksDeps = tasks.filter((t) => depends.includes(t.id));
        const hooksDeps = hooks.filter((l) => depends.includes(l.id));
        const resourcesDeps = resources.filter((r) => depends.includes(r.id));
        const emitIds = ensureStringArray((node as any).emits);
        const emitEvents = events.filter((e) => emitIds.includes(e.id));
        return {
          tasks: tasksDeps,
          hooks: hooksDeps,
          resources: resourcesDeps,
          emitters: emitEvents,
        };
      },
      getEmittedEvents: (node) => {
        const emits = ensureStringArray((node as any).emits);
        return events.filter((e) => emits.includes(e.id));
      },
      getMiddlewaresByIds: (ids) => {
        const set = new Set(ensureStringArray(ids));
        return middlewares.filter((m) => set.has(m.id));
      },
      getResourcesByIds: (ids) => {
        const set = new Set(ensureStringArray(ids));
        return resources.filter((r) => set.has(r.id));
      },
      getTasksByIds: (ids) => {
        const set = new Set(ensureStringArray(ids));
        return tasks.filter((t) => set.has(t.id));
      },
      getHooksByIds: (ids) => {
        const set = new Set(ensureStringArray(ids));
        return hooks.filter((l) => set.has(l.id));
      },
      getEventsByIds: (ids) => {
        const set = new Set(ensureStringArray(ids));
        return events.filter((e) => set.has(e.id));
      },
      getTasksUsingResource: (resourceId) => {
        return [...tasks, ...hooks].filter((t) =>
          ensureStringArray(t.dependsOn).includes(resourceId)
        );
      },
      getTasksUsingMiddleware: (middlewareId) => {
        return tasks.filter((t) =>
          ensureStringArray(t.middleware).includes(middlewareId)
        );
      },
      // Backward-compat for schema fields expecting this name
      // Returns only task-like nodes (tasks and hooks)
      getTaskLikesUsingMiddleware: (middlewareId: string) => {
        return api.getTasksUsingMiddleware(middlewareId);
      },
      // getHooksUsingResource: (resourceId) => {
      //   return hooks.filter((l) =>
      //     ensureStringArray(l.dependsOn).includes(resourceId)
      //   );
      // },
      getEmittersOfEvent: (eventId) => {
        return [...tasks, ...hooks, ...resources].filter((t) =>
          ensureStringArray((t as any).emits).includes(eventId)
        );
      },
      getHooksOfEvent: (eventId) => {
        return hooks.filter((l) => l.event === eventId);
      },
      getMiddlewareEmittedEvents: (middlewareId) => {
        const taskLikes = api.getTasksUsingMiddleware(middlewareId);
        const emittedIds = new Set<string>();
        for (const t of taskLikes) {
          for (const e of ensureStringArray((t as any).emits)) {
            emittedIds.add(e);
          }
        }
        return events.filter((e) => emittedIds.has(e.id));
      },
      getMiddlewareUsagesForTask: (taskId) => {
        const task = taskMap.get(taskId);
        if (!task) return [];
        const detailed = task.middlewareDetailed ?? [];
        return detailed
          .map((d) => ({
            id: d.id,
            config: d.config ?? null,
            node: middlewareMap.get(d.id),
          }))
          .filter(
            (x): x is { id: string; config: string | null; node: Middleware } =>
              Boolean(x.node)
          );
      },
      getMiddlewareUsagesForResource: (resourceId) => {
        const res = resourceMap.get(resourceId);
        if (!res) return [];
        const detailed = res.middlewareDetailed ?? [];
        return detailed
          .map((d) => ({
            id: d.id,
            config: d.config ?? null,
            node: middlewareMap.get(d.id),
          }))
          .filter(
            (x): x is { id: string; config: string | null; node: Middleware } =>
              Boolean(x.node)
          );
      },
      getTasksUsingMiddlewareDetailed: (middlewareId) => {
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
        addFrom(tasks);
        return result;
      },
      getResourcesUsingMiddlewareDetailed: (middlewareId) => {
        const result: Array<{
          id: string;
          config: string | null;
          node: Resource;
        }> = [];
        for (const r of resources) {
          if ((r.middleware || []).includes(middlewareId)) {
            const conf =
              (r.middlewareDetailed || []).find((m) => m.id === middlewareId)
                ?.config ?? null;
            result.push({ id: r.id, config: conf ?? null, node: r });
          }
        }
        return result;
      },
      getEmittedEventsForResource: (resourceId) => {
        const taskLikes = api.getTasksUsingResource(resourceId);
        const emitted = new Set<string>();
        for (const t of taskLikes) {
          for (const e of ensureStringArray((t as any).emits)) emitted.add(e);
        }
        return api.getEventsByIds(Array.from(emitted));
      },
      // Tags API
      getTasksWithTag,
      getHooksWithTag,
      getResourcesWithTag,
      getMiddlewaresWithTag,
      getEventsWithTag,
      getAllTags: () => allTags,
      getTag: (id: string) => tagMap.get(id) ?? null,
      // Diagnostics
      getOrphanEvents: () => computeOrphanEvents(api),
      getUnemittedEvents: () => computeUnemittedEvents(api),
      getUnusedMiddleware: () => computeUnusedMiddleware(api),
      getMissingFiles: () => computeMissingFiles(api),
      getOverrideConflicts: () => computeOverrideConflicts(api),
      getDiagnostics: () => buildDiagnostics(api),
      buildRunOptionsForTask: (taskId, args) => buildRunsOptions(taskId, args),
      buildRunOptionsForHook: (hookId, args) => buildRunsOptions(hookId, args),
    };

    return api;
  },
});
