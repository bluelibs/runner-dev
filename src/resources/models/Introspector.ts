import type {
  Resource,
  Event,
  Task,
  Hook,
  Middleware,
  Tag,
} from "../../schema";
import type { DiagnosticItem } from "../../schema";
import {
  computeOrphanEvents,
  computeUnemittedEvents,
  computeUnusedMiddleware,
  computeOverrideConflicts,
  buildDiagnostics,
  stampElementKind,
  buildIdMap,
  ensureStringArray,
} from "./introspector.tools";

export type SerializedIntrospector = {
  tasks: Task[];
  hooks: Hook[];
  resources: Resource[];
  events: Event[];
  middlewares: Middleware[];
  tags?: Array<{ id: string }>;
  diagnostics?: DiagnosticItem[];
  orphanEvents?: { id: string }[];
  unemittedEvents?: { id: string }[];
  unusedMiddleware?: { id: string }[];
  missingFiles?: Array<{ id: string; filePath: string }>;
  overrideConflicts?: Array<{ targetId: string; by: string }>;
  rootId?: string | null;
};

export class Introspector {
  public tasks: Task[] = [];
  public hooks: Hook[] = [];
  public resources: Resource[] = [];
  public events: Event[] = [];
  public taskMiddlewares: Middleware[] = [];
  public resourceMiddlewares: Middleware[] = [];
  public middlewares: Middleware[] = [];
  public allTags: Tag[] = [];
  public store: unknown | null = null;
  public rootId: string | null = null;

  public taskMap: Map<string, Task> = new Map();
  public hookMap: Map<string, Hook> = new Map();
  public resourceMap: Map<string, Resource> = new Map();
  public eventMap: Map<string, Event> = new Map();
  public middlewareMap: Map<string, Middleware> = new Map();
  public tagMap: Map<string, Tag> = new Map();

  constructor(input: { store: unknown } | { data: SerializedIntrospector }) {
    if ("store" in input) {
      // this.store = input.store;
      // this.initializeFromStore();
    } else {
      this.store = null;
      this.initializeFromData(input.data);
    }
  }

  private initializeFromData(data: SerializedIntrospector): void {
    this.tasks = Array.isArray(data.tasks) ? data.tasks : [];
    this.hooks = Array.isArray(data.hooks) ? data.hooks : [];
    this.resources = Array.isArray(data.resources) ? data.resources : [];
    this.events = Array.isArray(data.events) ? data.events : [];
    this.taskMiddlewares = [];
    this.resourceMiddlewares = [];
    this.middlewares = Array.isArray(data.middlewares) ? data.middlewares : [];
    this.rootId = data.rootId ?? null;

    // Maps
    this.taskMap = buildIdMap(this.tasks);
    this.hookMap = buildIdMap(this.hooks);
    this.resourceMap = buildIdMap(this.resources);
    this.eventMap = buildIdMap(this.events);
    this.middlewareMap = buildIdMap(this.middlewares);

    // Tags
    const getTasksWithTag = (tagId: string) =>
      this.tasks.filter((t) => ensureStringArray(t.tags).includes(tagId));
    const getHooksWithTag = (tagId: string) =>
      this.hooks.filter((h) => ensureStringArray(h.tags).includes(tagId));
    const getResourcesWithTag = (tagId: string) =>
      this.resources.filter((r) => ensureStringArray(r.tags).includes(tagId));
    const getMiddlewaresWithTag = (tagId: string) =>
      this.middlewares.filter((m) => ensureStringArray(m.tags).includes(tagId));
    const getEventsWithTag = (tagId: string) =>
      this.events.filter((e) => ensureStringArray(e.tags).includes(tagId));

    const allTagIds = new Set<string>();
    const collect = (arr: { tags?: string[] | null }[]) => {
      for (const n of arr) {
        for (const id of ensureStringArray(n.tags)) allTagIds.add(id);
      }
    };
    collect(this.tasks as any);
    collect(this.hooks as any);
    collect(this.resources as any);
    collect(this.middlewares as any);
    collect(this.events as any);

    this.allTags = Array.from(allTagIds).map((id) => ({
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
    this.tagMap = new Map<string, Tag>(this.allTags.map((t) => [t.id, t]));
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

  getDependencies(node: Task | Hook): {
    tasks: Task[];
    hooks: Hook[];
    resources: Resource[];
    emitters: Event[];
  } {
    const depends = ensureStringArray(node.dependsOn);
    const tasksDeps = this.tasks.filter((t) => depends.includes(t.id));
    const hooksDeps = this.hooks.filter((l) => depends.includes(l.id));
    const resourcesDeps = this.resources.filter((r) => depends.includes(r.id));
    const emitIds = ensureStringArray((node as any).emits);
    const emitEvents = this.events.filter((e) => emitIds.includes(e.id));
    return {
      tasks: tasksDeps,
      hooks: hooksDeps,
      resources: resourcesDeps,
      emitters: emitEvents,
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
    return this.hooks.filter((l) => l.event === eventId);
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

  getEventsWithTag(tagId: string): Event[] {
    return this.events.filter((e) => ensureStringArray(e.tags).includes(tagId));
  }

  getAllTags(): Tag[] {
    return this.allTags;
  }

  getTag(id: string): Tag | null {
    return this.tagMap.get(id) ?? null;
  }

  getTagsByIds(ids: string[]): Tag[] {
    return ids.map((id) => this.getTag(id)).filter((tag): tag is Tag => tag !== null);
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

  // Serialization API
  serialize(): SerializedIntrospector {
    return {
      tasks: this.tasks,
      hooks: this.hooks,
      resources: this.resources,
      events: this.events,
      middlewares: this.middlewares,
      tags: this.allTags.map((t) => ({ id: t.id })),
      diagnostics: this.getDiagnostics(),
      orphanEvents: this.getOrphanEvents(),
      unemittedEvents: this.getUnemittedEvents(),
      unusedMiddleware: this.getUnusedMiddleware(),
      overrideConflicts: this.getOverrideConflicts(),
      rootId:
        (this.store as any)?.root?.resource?.id != null
          ? String((this.store as any).root.resource.id)
          : this.rootId,
    };
  }

  static deserialize(data: SerializedIntrospector): Introspector {
    return new Introspector({ data });
  }
}
