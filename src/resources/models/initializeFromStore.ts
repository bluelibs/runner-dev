import { definitions, Store } from "@bluelibs/runner";
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
import { sanitizePath } from "../../utils/path";

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
  introspector.events = buildEvents(store);

  // NOTE: Tunnel info population is handled by Introspector.populateTunnelInfo()
  // which must be called after all resources have been initialized.
  // Resource values are not available at this stage.

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
  }));

  // Build async contexts
  introspector.asyncContexts = Array.from(store.asyncContexts.values()).map((c: any) => ({
    id: c.id,
    meta: c.meta,
    filePath: sanitizePath(c[definitions.symbolFilePath]),
    serialize: c.serialize,
    parse: c.parse,
    usedBy: c.usedBy || [],
    providedBy: c.providedBy || [],
    registeredBy: c.registeredBy,
    overriddenBy: c.overriddenBy,
    tags: ensureStringArray(c.tags),
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
