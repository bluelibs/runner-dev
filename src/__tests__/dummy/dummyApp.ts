import {
  Match,
  defineTaskMiddleware,
  defineResource,
  defineTask,
  defineHook,
  defineEvent,
  defineTag,
  defineResourceMiddleware,
} from "@bluelibs/runner";
import { createDummySuperApp } from "./largeApp";
import { dev } from "../../resources/dev.resource";
import { defineSchema } from "./schemas";

export const DUMMY_APP_ID = "dummy-app";

export const dummyAppIds = {
  resource(localId: string) {
    return `${DUMMY_APP_ID}.${localId}`;
  },
  task(localId: string) {
    return `${DUMMY_APP_ID}.tasks.${localId}`;
  },
  hook(localId: string) {
    return `${DUMMY_APP_ID}.hooks.${localId}`;
  },
  event(localId: string) {
    return `${DUMMY_APP_ID}.events.${localId}`;
  },
  tag(localId: string) {
    return `${DUMMY_APP_ID}.tags.${localId}`;
  },
  taskMiddleware(localId: string) {
    return `${DUMMY_APP_ID}.middleware.task.${localId}`;
  },
  resourceMiddleware(localId: string) {
    return `${DUMMY_APP_ID}.middleware.resource.${localId}`;
  },
  asyncContext(localId: string) {
    return `${DUMMY_APP_ID}.asyncContexts.${localId}`;
  },
  error(localId: string) {
    return `${DUMMY_APP_ID}.errors.${localId}`;
  },
};

// Middleware
export const logMw = defineResourceMiddleware({
  id: "mw-log",
  meta: {
    title: "Logger middleware",
    description: "Pass-through logger middleware used in tests",
  },
  async run({ next }) {
    return next();
  },
});

// Resource
export const dbRes = defineResource({
  id: "res-db",
  meta: {
    title: "Database resource",
    description: "In-memory database resource used for tests",
  },
  middleware: [logMw],
  async init() {
    return { url: "memory://" };
  },
});

// Resource with config
export const cacheRes = defineResource({
  id: "res-cache",
  meta: {
    title: "Cache resource",
    description: "Cache with TTL configuration used for tests",
  },
  configSchema: defineSchema({ ttlMs: Match.PositiveInteger }),
  async init(config: { ttlMs: number }) {
    return { ttlMs: config.ttlMs };
  },
});

// Event
export const evtHello = defineEvent<{ name: string }>({
  id: "evt-hello",
  payloadSchema: defineSchema({ name: String }),
});

export const logMwTask = defineTaskMiddleware({
  id: "mw-log-task",
  async run({ next }) {
    return next();
  },
});

// Tag
export const areaTag = defineTag<{ scope?: string }>({ id: "tag-area" });

// Task
export const helloTask = defineTask({
  id: "task-hello",
  dependencies: () => ({ db: dbRes, emitHello: evtHello }),
  middleware: [logMwTask],
  meta: {
    title: "Hello task",
    description: "Emits 'evt-hello' and returns 'ok'",
  },
  tags: [areaTag.with({ scope: "greetings" })],
  async run(_input, { emitHello }) {
    await emitHello({ name: "world" });
    return "ok" as const;
  },
});

// Hook
export const helloHook = defineHook({
  id: "hook-hello",
  on: evtHello,
  dependencies: { db: dbRes },
  meta: {
    title: "Hello hook",
    description: "Listens to 'evt-hello' and performs no operation",
  },
  tags: [areaTag.with({ scope: "hooks" })],
  async run() {
    /* noop */
  },
});

// Global hook
export const allEventsHook = defineHook({
  id: "hook-all",
  on: "*",
  meta: {
    title: "Global hook",
    description: "Wildcard hook that observes all events",
  },
  async run() {
    /* noop */
  },
});

// Middleware with config
export const tagMw = defineTaskMiddleware<{ label: string }>({
  id: "mw-tag",
  meta: {
    title: "Tagging middleware",
    description: "Configurable middleware used to tag tasks in tests",
  },
  configSchema: defineSchema({ label: String }),
  async run({ next }) {
    return next();
  },
});

// Task that depends on another task and a configured resource
export const aggregateTask = defineTask({
  id: "task-aggregate",
  dependencies: () => ({ db: dbRes, cache: cacheRes, hello: helloTask }),
  middleware: [tagMw.with({ label: "agg" })],
  meta: {
    title: "Aggregate task",
    description: "Calls 'helloTask' and returns its result",
  },
  async run(_input, { hello }) {
    const result = await hello();
    return { result };
  },
});

// Another task using the same configurable middleware with a different config
export const taggedTask = defineTask({
  id: "task-tagged",
  dependencies: () => ({ db: dbRes }),
  middleware: [tagMw.with({ label: "beta" })],
  meta: {
    title: "Tagged task",
    description: "Uses tagging middleware with label 'beta'",
  },
  async run() {
    return "ok" as const;
  },
  tags: [areaTag.with({ scope: "tagged" })],
});

// Helper to build a dummy app resource with optional extra registrations
export function createDummyApp(
  extra: any[] = [],
  options?: { overrides?: any[] }
) {
  return defineResource({
    id: "dummy-app",
    meta: {
      title: "Dummy app",
      description: "Test application composed of resources, tasks, and events",
    },
    register: [
      ...extra,
      logMw,
      tagMw,
      logMwTask,
      dbRes,
      cacheRes.with({ ttlMs: 1000 }),
      helloTask,
      helloHook,
      allEventsHook,
      aggregateTask,
      taggedTask,
      evtHello,
      areaTag,
    ],
    overrides: options?.overrides ?? [],
    dependencies: {},
  });
}

export const app = createDummySuperApp([
  dev.with({
    port: 31337,
  }),
]);
