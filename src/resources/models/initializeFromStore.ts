import { Store } from "@bluelibs/runner";
import { Tag } from "../../schema";
import {
  attachOverrides,
  attachRegisteredBy,
  buildEvents,
  buildResourceMiddlewares,
  buildTaskMiddlewares,
  mapStoreHookToHookModel,
  mapStoreResourceToResourceModel,
  mapStoreTaskToTaskModel,
} from "./initializeFromStore.utils";
import { Introspector } from "./Introspector";
import { buildIdMap, ensureStringArray } from "./introspector.tools";
import { formatSchemaIfZod, isZodSchema } from "../../utils/zod";

export function initializeFromStore(
  introspector: Introspector,
  store: Store
): void {
  // Build tasks
  introspector.tasks = [];
  introspector.hooks = [];

  const s = store;
  for (const t of s.tasks.values()) {
    introspector.tasks.push(mapStoreTaskToTaskModel(t.task));
  }

  for (const h of s.hooks.values()) {
    introspector.hooks.push(mapStoreHookToHookModel(h));
  }

  // Build resources
  introspector.resources = Array.from(s.resources.values()).map((r: any) =>
    mapStoreResourceToResourceModel(r.resource)
  );

  // Build events
  introspector.events = buildEvents(
    Array.from(s.events.values()).map((v: any) => v.event),
    introspector.tasks,
    introspector.hooks,
    introspector.resources
  );

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

  const allTagIds = new Set<string>();
  const collect = (arr: { tags?: string[] | null }[]) => {
    for (const n of arr) {
      for (const id of ensureStringArray(n.tags)) allTagIds.add(id);
    }
  };
  collect(introspector.tasks as any);
  collect(introspector.hooks as any);
  collect(introspector.resources as any);
  collect(introspector.middlewares as any);
  collect(introspector.events as any);

  introspector.allTags = Array.from(store.tags.values()).map((tag) => ({
    id: tag.id,
    configSchema: isZodSchema(tag.configSchema)
      ? formatSchemaIfZod(tag.configSchema)
      : null,
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
  }));
  introspector.tagMap = new Map<string, Tag>();
  for (const tag of introspector.allTags) {
    introspector.tagMap.set(tag.id, tag);
  }
  introspector.rootId =
    s?.root?.resource?.id != null
      ? String(s.root.resource.id)
      : introspector.rootId ?? null;
}
