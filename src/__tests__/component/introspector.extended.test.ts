import { resource, run } from "@bluelibs/runner";
import { introspector } from "../../resources/introspector.resource";
import { createDummyApp, helloTask, evtHello, logMw } from "../dummy/dummyApp";

describe("introspector (extended)", () => {
  test("discovers dependencies, emits, hooks and relations", async () => {
    let snapshot: any = {};

    const probe = resource({
      id: "probe.extended-1",
      dependencies: { introspector },
      async init(_, { introspector }) {
        const tasks = introspector.getTasks();
        const hooks = introspector.getHooks();
        const resources = introspector.getResources();
        const events = introspector.getEvents();
        const middlewares = introspector.getMiddlewares();

        const taskHello = introspector.getTask("task.hello")!;
        const depsHello = introspector.getDependencies(taskHello);
        const evt = introspector.getEvent("evt.hello")!;

        const usingRes = introspector.getTasksUsingResource("res.db");
        const usingMw = introspector.getTasksUsingMiddleware("mw.log.task");
        const emittersOfEvt = introspector.getEmittersOfEvent("evt.hello");
        const hooksOfEvt = introspector.getHooksOfEvent("evt.hello");
        const mwEmits = introspector.getMiddlewareEmittedEvents("mw.log.task");

        const mwLog = middlewares.find((m) => m.id === "mw.log")!;
        const mwTag = middlewares.find((m) => m.id === "mw.tag")!;

        const hookAll =
          introspector.getHook("hook.all") ||
          ({ dependsOn: [], middleware: [], emits: [] } as any);

        snapshot = {
          tasks: tasks.map((t) => t.id),
          hooks: hooks.map((l) => l.id),
          resources: resources.map((r) => r.id),
          events: events.map((e) => e.id),
          middlewares: middlewares.map((m) => m.id),
          depsHello: {
            tasks: depsHello.tasks.map((t) => t.id),
            hooks: depsHello.hooks.map((l) => l.id),
            resources: depsHello.resources.map((r) => r.id),
            emitters: depsHello.emitters.map((e) => e.id),
          },
          taskHelloEmits: taskHello.emits,
          evtHello_listenedToBy: evt.listenedToBy,
          evtHello_specificHooks: introspector
            .getHooksOfEvent("evt.hello")
            .map((h) => h.id),
          usingRes: usingRes.map((t) => t.id),
          usingMw: usingMw.map((t) => t.id),
          emittersOfEvt: emittersOfEvt.map((t) => t.id),
          hooksOfEvt: hooksOfEvt.map((l) => l.id),
          mwEmits: mwEmits.map((e) => e.id),
          mwLog: {
            usedByTasks: mwLog.usedByTasks,
            usedByResources: mwLog.usedByResources,
          },
          mwTag: {
            usedByTasks: mwTag.usedByTasks,
            usedByResources: mwTag.usedByResources,
          },
          hookAll: {
            dependsOn: hookAll.dependsOn,
            middleware: hookAll.middleware,
            emits: hookAll.emits,
          },
        };
      },
    });

    const app = createDummyApp([introspector, probe]);

    await run(app);

    expect(snapshot.tasks).toEqual(
      expect.arrayContaining(["task.hello", "task.aggregate"])
    );
    expect(snapshot.hooks).toEqual(
      expect.arrayContaining(["hook.hello", "hook.all"])
    );
    expect(snapshot.resources).toEqual(expect.arrayContaining(["res.db"]));
    expect(snapshot.events).toEqual(expect.arrayContaining(["evt.hello"]));
    expect(snapshot.middlewares).toEqual(
      expect.arrayContaining(["mw.log", "mw.log.task", "mw.tag"])
    );

    // Dependencies of task.hello
    expect(snapshot.depsHello.resources).toEqual(
      expect.arrayContaining(["res.db"])
    );
    expect(snapshot.depsHello.emitters).toEqual(
      expect.arrayContaining(["evt.hello"])
    );

    // Emits inference
    expect(snapshot.taskHelloEmits).toEqual(
      expect.arrayContaining(["evt.hello"])
    );

    // Graph helpers
    expect(snapshot.usingRes).toEqual(
      expect.arrayContaining(["task.hello", "hook.hello", "task.aggregate"])
    );
    expect(snapshot.usingMw).toEqual(expect.arrayContaining(["task.hello"]));
    expect(snapshot.emittersOfEvt).toEqual(
      expect.arrayContaining(["task.hello"])
    );
    expect(snapshot.hooksOfEvt).toEqual(expect.arrayContaining(["hook.hello"]));
    expect(snapshot.mwEmits).toEqual(expect.arrayContaining(["evt.hello"]));

    // listenedToBy may include wildcard hooks, so assert specific via getHooksOfEvent
    expect(snapshot.evtHello_specificHooks).toEqual(
      expect.arrayContaining(["hook.hello"])
    );
    expect(snapshot.evtHello_specificHooks).not.toEqual(
      expect.arrayContaining(["hook.all"])
    );

    // Middleware usage mapping
    expect(snapshot.mwLog.usedByResources).toEqual(
      expect.arrayContaining(["res.db"])
    );
    expect(snapshot.mwTag.usedByTasks).toEqual(
      expect.arrayContaining(["task.aggregate"])
    );
    expect(snapshot.mwTag.usedByResources).toEqual([]);

    // Non-null arrays for a hook with no deps/mw/emits
    expect(Array.isArray(snapshot.hookAll.dependsOn)).toBe(true);
    expect(snapshot.hookAll.dependsOn.length).toBe(0);
    expect(Array.isArray(snapshot.hookAll.middleware)).toBe(true);
    expect(snapshot.hookAll.middleware.length).toBe(0);
    expect(Array.isArray(snapshot.hookAll.emits)).toBe(true);
    expect(snapshot.hookAll.emits.length).toBe(0);
  });

  test("overrides mapping sets overriddenBy for middleware", async () => {
    let snapshot: any = {};

    const overrideRes = resource({
      id: "res.override",
      overrides: [logMw],
      async init() {
        return {};
      },
    });

    const probe = resource({
      id: "probe.extended-2",
      dependencies: { introspector },
      async init(_, { introspector }) {
        const m = introspector.getMiddleware("mw.log")!;
        snapshot = {
          overriddenBy: m.overriddenBy ?? null,
        };
      },
    });

    const app = createDummyApp([overrideRes, introspector, probe]);

    await run(app);

    expect(snapshot.overriddenBy).toBe("res.override");
  });
});
