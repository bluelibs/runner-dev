import { middleware, resource, task, event, tag } from "@bluelibs/runner";

// Middleware
export const logMw = middleware({
  id: "mw.log",
  meta: {
    title: "Logger middleware",
    description: "Pass-through logger middleware used in tests",
  },
  async run({ next }) {
    return next();
  },
});

// Resource
export const dbRes = resource({
  id: "res.db",
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
export const cacheRes = resource({
  id: "res.cache",
  meta: {
    title: "Cache resource",
    description: "Cache with TTL configuration used for tests",
  },
  async init(config: { ttlMs: number }) {
    return { ttlMs: config.ttlMs };
  },
});

// Event
export const evtHello = event<{ name: string }>({ id: "evt.hello" });

// Tag
export const areaTag = tag<{ scope?: string }>({ id: "tag.area" });

// Task
export const helloTask = task({
  id: "task.hello",
  dependencies: () => ({ db: dbRes, emitHello: evtHello }),
  middleware: [logMw],
  meta: {
    title: "Hello task",
    description: "Emits 'evt.hello' and returns 'ok'",
    tags: [areaTag.with({ scope: "greetings" })],
  },
  async run(_input, { emitHello }) {
    await emitHello({ name: "world" });
    return "ok" as const;
  },
});

// Listener
export const helloListener = task({
  id: "listener.hello",
  on: evtHello,
  dependencies: { db: dbRes },
  meta: {
    title: "Hello listener",
    description: "Listens to 'evt.hello' and performs no operation",
    tags: [areaTag.with({ scope: "listeners" })],
  },
  async run() {
    /* noop */
  },
});

// Global listener
export const allEventsListener = task({
  id: "listener.all",
  on: "*",
  meta: {
    title: "Global listener",
    description: "Wildcard listener that observes all events",
  },
  async run() {
    /* noop */
  },
});

// Middleware with config
export const tagMw = middleware<{ label: string }, {}>({
  id: "mw.tag",
  meta: {
    title: "Tagging middleware",
    description: "Configurable middleware used to tag tasks in tests",
  },
  async run({ next }) {
    return next();
  },
});

// Task that depends on another task and a configured resource
export const aggregateTask = task({
  id: "task.aggregate",
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
export const taggedTask = task({
  id: "task.tagged",
  dependencies: () => ({ db: dbRes }),
  middleware: [tagMw.with({ label: "beta" })],
  meta: {
    title: "Tagged task",
    description: "Uses tagging middleware with label 'beta'",
  },
  async run() {
    return "ok" as const;
  },
});

// Helper to build a dummy app resource with optional extra registrations
export function createDummyApp(extra: any[] = []) {
  return resource({
    id: "dummy.app",
    meta: {
      title: "Dummy app",
      description: "Test application composed of resources, tasks, and events",
    },
    register: [
      logMw,
      tagMw,
      dbRes,
      cacheRes.with({ ttlMs: 1000 }),
      helloTask,
      helloListener,
      allEventsListener,
      aggregateTask,
      taggedTask,
      evtHello,
      ...extra,
    ],
  });
}
