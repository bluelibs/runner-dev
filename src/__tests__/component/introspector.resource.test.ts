import { defineResource, run } from "@bluelibs/runner";
import { introspector } from "../../resources/introspector.resource";
import {
  createDummyApp,
  dummyAppIds,
  evtHello,
  helloTask,
  logMw,
} from "../dummy/dummyApp";

describe("introspector (integration)", () => {
  test("discovers tasks, hooks, resources, middlewares, events and relations", async () => {
    // Use dummy app fixtures

    let snapshot: any = {};
    const probe = defineResource({
      id: "probe",
      dependencies: { introspector },
      async init(_, { introspector }) {
        const tasks = introspector.getTasks();
        const hooks = introspector.getHooks();
        const resources = introspector.getResources();
        const events = introspector.getEvents();
        const middlewares = introspector.getMiddlewares();
        const deps = introspector.getDependencies(tasks[0]);
        const usingRes = introspector.getTasksUsingResource(
          dummyAppIds.resource("res-db")
        );
        const usingMw = introspector.getTasksUsingMiddleware(
          dummyAppIds.taskMiddleware("mw-log-task")
        );
        const emittersOfEvt = introspector.getEmittersOfEvent(
          dummyAppIds.event(evtHello.id)
        );
        const hooksOfEvt = introspector.getHooksOfEvent(
          dummyAppIds.event(evtHello.id)
        );
        const mwEmits = introspector.getMiddlewareEmittedEvents(
          dummyAppIds.taskMiddleware("mw-log-task")
        );

        snapshot = {
          tasks: tasks.map((t) => t.id),
          hooks: hooks.map((l) => l.id),
          resources: resources.map((r) => r.id),
          events: events.map((e) => e.id),
          middlewares: middlewares.map((m) => m.id),
          event_listenedToBy: events.find((e) => e.id === "evt.hello")
            ?.listenedToBy,
          deps: {
            tasks: deps.tasks.map((t) => t.id),
            hooks: deps.hooks.map((l) => l.id),
            resources: deps.resources.map((r) => r.id),
            emitters: deps.emitters.map((e) => e.id),
          },
          usingRes: usingRes.map((t) => t.id),
          usingMw: usingMw.map((t) => t.id),
          emittersOfEvt: emittersOfEvt.map((t) => t.id),
          hooksOfEvt: hooksOfEvt.map((l) => l.id),
          mwEmits: mwEmits.map((e) => e.id),
        };
      },
    });

    const app = createDummyApp([introspector, probe]);

    await run(app);

    expect(snapshot.tasks).toEqual(
      expect.arrayContaining([dummyAppIds.task(helloTask.id)])
    );
    expect(Array.isArray(snapshot.hooks)).toBe(true);
    expect(snapshot.resources).toEqual(
      expect.arrayContaining([dummyAppIds.resource("res-db")])
    );
    expect(snapshot.events).toEqual(
      expect.arrayContaining([dummyAppIds.event(evtHello.id)])
    );
    expect(snapshot.middlewares).toEqual(
      expect.arrayContaining([dummyAppIds.resourceMiddleware(logMw.id)])
    );
  });
});
