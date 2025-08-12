import { globals, resource } from "@bluelibs/runner";
import {
  readId,
  ensureStringArray,
  mapStoreTaskToTaskModel,
  mapStoreTaskToListenerModel,
  mapStoreResourceToResourceModel,
  buildEvents,
  buildMiddlewares,
  buildIdMap,
  attachOverrides,
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
  Listener,
  Middleware,
  Resource,
  Task,
} from "../schema/model";

export interface Introspector {
  getRoot(): Resource;
  getEvents(): Event[];
  getTasks(): Task[];
  getListeners(): Listener[];
  getMiddlewares(): Middleware[];
  getResources(): Resource[];
  getEvent(id: string): Event | null;
  getTask(id: string): Task | null;
  getListener(id: string): Listener | null;
  getMiddleware(id: string): Middleware | null;
  getResource(id: string): Resource | null;
  getDependencies(node: Task | Listener): {
    tasks: Task[];
    listeners: Listener[];
    resources: Resource[];
    emitters: Event[];
  };
  getEmittedEvents(node: Task | Listener): Event[];
  getMiddlewaresByIds(ids: string[]): Middleware[];
  getResourcesByIds(ids: string[]): Resource[];
  getTasksByIds(ids: string[]): Task[];
  getListenersByIds(ids: string[]): Listener[];
  getEventsByIds(ids: string[]): Event[];
  getTaskLikesUsingResource(resourceId: string): (Task | Listener)[];
  getTaskLikesUsingMiddleware(middlewareId: string): (Task | Listener)[];
  getEmittersOfEvent(eventId: string): (Task | Listener)[];
  getListenersOfEvent(eventId: string): Listener[];
  getMiddlewareEmittedEvents(middlewareId: string): Event[];
  getMiddlewareUsagesForTaskLike(
    taskLikeId: string
  ): Array<{ id: string; config: string | null; node: Middleware }>;
  getMiddlewareUsagesForResource(
    resourceId: string
  ): Array<{ id: string; config: string | null; node: Middleware }>;
  getTaskLikesUsingMiddlewareDetailed(
    middlewareId: string
  ): Array<{ id: string; config: string | null; node: Task | Listener }>;
  getResourcesUsingMiddlewareDetailed(
    middlewareId: string
  ): Array<{ id: string; config: string | null; node: Resource }>;
  getEmittedEventsForResource(resourceId: string): Event[];
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
}

export const introspector = resource({
  id: "runner-dev.introspector",
  dependencies: {
    store: globals.resources.store,
  },
  async init(_, { store }): Promise<Introspector> {
    // Build tasks & listeners
    const tasksCollection = store.tasks;
    const allTasksLike = tasksCollection.values();
    const tasks: Task[] = [];
    const listeners: Listener[] = [];
    for (const t of allTasksLike) {
      const isListener = Boolean(t.task.on);
      if (isListener) {
        listeners.push(mapStoreTaskToListenerModel(t.task));
      } else {
        tasks.push(mapStoreTaskToTaskModel(t.task));
      }
    }

    // Build resources
    const resources: Resource[] = Array.from(store.resources.values()).map(
      (r) => mapStoreResourceToResourceModel(r.resource)
    );

    // Build events
    const events: Event[] = buildEvents(
      Array.from(store.events.values()).map((v) => v.event),
      tasks,
      listeners,
      resources
    );

    // Build middlewares
    const middlewares: Middleware[] = buildMiddlewares(
      Array.from(store.middlewares.values()).map((v) => v.middleware),
      tasks,
      listeners,
      resources
    );

    attachOverrides(store.overrideRequests, tasks, listeners, middlewares);

    // Maps
    const taskMap = buildIdMap(tasks);
    const listenerMap = buildIdMap(listeners);
    const resourceMap = buildIdMap(resources);
    const eventMap = buildIdMap(events);
    const middlewareMap = buildIdMap(middlewares);

    // API
    const api: Introspector = {
      getRoot: () => {
        return resourceMap.get(store.root.resource.id.toString())!;
      },
      getEvents: () => events,
      getTasks: () => tasks,
      getListeners: () => listeners,
      getMiddlewares: () => middlewares,
      getResources: () => resources,
      getEvent: (id) => eventMap.get(id) ?? null,
      getTask: (id) => taskMap.get(id) ?? null,
      getListener: (id) => listenerMap.get(id) ?? null,
      getMiddleware: (id) => middlewareMap.get(id) ?? null,
      getResource: (id) => resourceMap.get(id) ?? null,
      getDependencies: (node) => {
        const depends = ensureStringArray(node.dependsOn);
        const tasksDeps = tasks.filter((t) => depends.includes(t.id));
        const listenersDeps = listeners.filter((l) => depends.includes(l.id));
        const resourcesDeps = resources.filter((r) => depends.includes(r.id));
        const emitIds = ensureStringArray((node as any).emits);
        const emitEvents = events.filter((e) => emitIds.includes(e.id));
        return {
          tasks: tasksDeps,
          listeners: listenersDeps,
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
      getListenersByIds: (ids) => {
        const set = new Set(ensureStringArray(ids));
        return listeners.filter((l) => set.has(l.id));
      },
      getEventsByIds: (ids) => {
        const set = new Set(ensureStringArray(ids));
        return events.filter((e) => set.has(e.id));
      },
      getTaskLikesUsingResource: (resourceId) => {
        return [...tasks, ...listeners].filter((t) =>
          ensureStringArray(t.dependsOn).includes(resourceId)
        );
      },
      getTaskLikesUsingMiddleware: (middlewareId) => {
        return [...tasks, ...listeners].filter((t) =>
          ensureStringArray(t.middleware).includes(middlewareId)
        );
      },
      getEmittersOfEvent: (eventId) => {
        return [...tasks, ...listeners].filter((t) =>
          ensureStringArray((t as any).emits).includes(eventId)
        );
      },
      getListenersOfEvent: (eventId) => {
        return listeners.filter((l) => l.event === eventId);
      },
      getMiddlewareEmittedEvents: (middlewareId) => {
        const taskLikes = api.getTaskLikesUsingMiddleware(middlewareId);
        const emittedIds = new Set<string>();
        for (const t of taskLikes) {
          for (const e of ensureStringArray((t as any).emits)) {
            emittedIds.add(e);
          }
        }
        return events.filter((e) => emittedIds.has(e.id));
      },
      getMiddlewareUsagesForTaskLike: (taskLikeId) => {
        const taskLike = taskMap.get(taskLikeId) ?? listenerMap.get(taskLikeId);
        if (!taskLike) return [];
        const detailed = taskLike.middlewareDetailed ?? [];
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
      getTaskLikesUsingMiddlewareDetailed: (middlewareId) => {
        const result: Array<{
          id: string;
          config: string | null;
          node: Task | Listener;
        }> = [];
        const addFrom = (arr: Array<Task | Listener>) => {
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
        addFrom(listeners);
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
        const taskLikes = api.getTaskLikesUsingResource(resourceId);
        const emitted = new Set<string>();
        for (const t of taskLikes) {
          for (const e of ensureStringArray((t as any).emits)) emitted.add(e);
        }
        return api.getEventsByIds(Array.from(emitted));
      },
      // Diagnostics
      getOrphanEvents: () => computeOrphanEvents(api),
      getUnemittedEvents: () => computeUnemittedEvents(api),
      getUnusedMiddleware: () => computeUnusedMiddleware(api),
      getMissingFiles: () => computeMissingFiles(api),
      getOverrideConflicts: () => computeOverrideConflicts(api),
      getDiagnostics: () => buildDiagnostics(api),
    };

    return api;
  },
});
