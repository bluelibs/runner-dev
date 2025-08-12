import { middleware, resource, task, event, tag } from "@bluelibs/runner";

// Middleware
export const logMw = middleware({
  id: "mw.log",
  async run({ next }) {
    return next();
  },
});

// Resource
export const dbRes = resource({
  id: "res.db",
  middleware: [logMw],
  async init() {
    return { url: "memory://" };
  },
});

// Resource with config
export const cacheRes = resource({
  id: "res.cache",
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
  meta: { tags: [areaTag.with({ scope: "greetings" })] },
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
  meta: { tags: [areaTag.with({ scope: "listeners" })] },
  async run() {
    /* noop */
  },
});

// Global listener
export const allEventsListener = task({
  id: "listener.all",
  on: "*",
  async run() {
    /* noop */
  },
});

// Middleware with config
export const tagMw = middleware<{ label: string }, {}>({
  id: "mw.tag",
  async run({ next }) {
    return next();
  },
});

// Task that depends on another task and a configured resource
export const aggregateTask = task({
  id: "task.aggregate",
  dependencies: () => ({ db: dbRes, cache: cacheRes, hello: helloTask }),
  middleware: [tagMw.with({ label: "agg" })],
  async run(_input, { hello }) {
    const result = await hello();
    return { result };
  },
});

// Helper to build a dummy app resource with optional extra registrations
export function createDummyApp(extra: any[] = []) {
  return resource({
    id: "dummy.app",
    register: [
      logMw,
      tagMw,
      dbRes,
      cacheRes.with({ ttlMs: 1000 }),
      helloTask,
      helloListener,
      allEventsListener,
      aggregateTask,
      evtHello,
      ...extra,
    ],
  });
}
