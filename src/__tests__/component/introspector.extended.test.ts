import { r, defineResource, run } from "@bluelibs/runner";
import { introspector } from "../../resources/introspector.resource";
import {
  createDummyApp,
  dummyAppIds,
  evtHello,
  logMw,
  logMwTask,
  tagMw,
} from "../dummy/dummyApp";

describe("introspector (extended)", () => {
  test("discovers dependencies, emits, hooks and relations", async () => {
    let snapshot: any = {};

    const probe = defineResource({
      id: "probe-extended-1",
      dependencies: { introspector },
      async init(_, { introspector }) {
        const tasks = introspector.getTasks();
        const hooks = introspector.getHooks();
        const resources = introspector.getResources();
        const events = introspector.getEvents();
        const middlewares = introspector.getMiddlewares();

        const taskHello = introspector.getTask(dummyAppIds.task("task-hello"))!;
        const depsHello = introspector.getDependencies(taskHello);
        const evt = introspector.getEvent(dummyAppIds.event(evtHello.id))!;

        const usingRes = introspector.getTasksUsingResource(
          dummyAppIds.resource("res-db")
        );
        const usingMw = introspector.getTasksUsingMiddleware(
          dummyAppIds.taskMiddleware(logMwTask.id)
        );
        const emittersOfEvt = introspector.getEmittersOfEvent(
          dummyAppIds.event(evtHello.id)
        );
        const hooksOfEvt = introspector.getHooksOfEvent(
          dummyAppIds.event(evtHello.id)
        );
        const mwEmits = introspector.getMiddlewareEmittedEvents(
          dummyAppIds.taskMiddleware(logMwTask.id)
        );

        const mwLog = middlewares.find(
          (m) => m.id === dummyAppIds.resourceMiddleware(logMw.id)
        )!;
        const mwTag = middlewares.find(
          (m) => m.id === dummyAppIds.taskMiddleware(tagMw.id)
        )!;

        const hookAll =
          introspector.getHook(dummyAppIds.hook("hook-all")) ||
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
            .getHooksOfEvent(dummyAppIds.event(evtHello.id))
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
      expect.arrayContaining([
        dummyAppIds.task("task-hello"),
        dummyAppIds.task("task-aggregate"),
      ])
    );
    expect(snapshot.hooks).toEqual(
      expect.arrayContaining([
        dummyAppIds.hook("hook-hello"),
        dummyAppIds.hook("hook-all"),
      ])
    );
    expect(snapshot.resources).toEqual(
      expect.arrayContaining([dummyAppIds.resource("res-db")])
    );
    expect(snapshot.events).toEqual(
      expect.arrayContaining([dummyAppIds.event(evtHello.id)])
    );
    expect(snapshot.middlewares).toEqual(
      expect.arrayContaining([
        dummyAppIds.resourceMiddleware(logMw.id),
        dummyAppIds.taskMiddleware(logMwTask.id),
        dummyAppIds.taskMiddleware(tagMw.id),
      ])
    );

    // Dependencies of task-hello
    expect(snapshot.depsHello.resources).toEqual(
      expect.arrayContaining([dummyAppIds.resource("res-db")])
    );
    expect(snapshot.depsHello.emitters).toEqual(
      expect.arrayContaining([dummyAppIds.event(evtHello.id)])
    );

    // Emits inference
    expect(snapshot.taskHelloEmits).toEqual(
      expect.arrayContaining([dummyAppIds.event(evtHello.id)])
    );

    // Graph helpers
    expect(snapshot.usingRes).toEqual(
      expect.arrayContaining([
        dummyAppIds.task("task-hello"),
        dummyAppIds.hook("hook-hello"),
        dummyAppIds.task("task-aggregate"),
      ])
    );
    expect(snapshot.usingMw).toEqual(
      expect.arrayContaining([dummyAppIds.task("task-hello")])
    );
    expect(snapshot.emittersOfEvt).toEqual(
      expect.arrayContaining([dummyAppIds.task("task-hello")])
    );
    expect(snapshot.hooksOfEvt).toEqual(
      expect.arrayContaining([dummyAppIds.hook("hook-hello")])
    );
    expect(snapshot.mwEmits).toEqual(
      expect.arrayContaining([dummyAppIds.event(evtHello.id)])
    );

    // listenedToBy may include wildcard hooks, so assert specific via getHooksOfEvent
    expect(snapshot.evtHello_specificHooks).toEqual(
      expect.arrayContaining([dummyAppIds.hook("hook-hello")])
    );
    expect(snapshot.evtHello_specificHooks).not.toEqual(
      expect.arrayContaining([dummyAppIds.hook("hook-all")])
    );

    // Middleware usage mapping
    expect(snapshot.mwLog.usedByResources).toEqual(
      expect.arrayContaining([dummyAppIds.resource("res-db")])
    );
    expect(snapshot.mwTag.usedByTasks).toEqual(
      expect.arrayContaining([dummyAppIds.task("task-aggregate")])
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

    const logMwOverride = r.override(logMw, async ({ next }) => next());

    const probe = defineResource({
      id: "probe-extended-2",
      dependencies: { introspector },
      async init(_, { introspector }) {
        const m = introspector.getMiddleware("mw-log")!;
        snapshot = {
          overriddenBy: m.overriddenBy ?? null,
        };
      },
    });

    const app = createDummyApp([introspector, probe], {
      overrides: [logMwOverride],
    });

    await run(app);

    expect(snapshot.overriddenBy).toBe("dummy-app");
  });
});
