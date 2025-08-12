import { resource, run } from "@bluelibs/runner";
import { introspector } from "../../resources/introspector.resource";
import { createDummyApp } from "../dummy/dummyApp";

describe("introspector (integration)", () => {
  test("discovers tasks, listeners, resources, middlewares, events and relations", async () => {
    // Use dummy app fixtures

    let snapshot: any = {};
    const probe = resource({
      id: "probe",
      dependencies: { introspector },
      async init(_, { introspector }) {
        const tasks = introspector.getTasks();
        const listeners = introspector.getListeners();
        const resources = introspector.getResources();
        const events = introspector.getEvents();
        const middlewares = introspector.getMiddlewares();
        const deps = introspector.getDependencies(tasks[0]);
        const usingRes = introspector.getTaskLikesUsingResource("res.db");
        const usingMw = introspector.getTaskLikesUsingMiddleware("mw.log");
        const emittersOfEvt = introspector.getEmittersOfEvent("evt.hello");
        const listenersOfEvt = introspector.getListenersOfEvent("evt.hello");
        const mwEmits = introspector.getMiddlewareEmittedEvents("mw.log");

        snapshot = {
          tasks: tasks.map((t) => t.id),
          listeners: listeners.map((l) => l.id),
          resources: resources.map((r) => r.id),
          events: events.map((e) => e.id),
          middlewares: middlewares.map((m) => m.id),
          event_listenedToBy: events.find((e) => e.id === "evt.hello")
            ?.listenedToBy,
          deps: {
            tasks: deps.tasks.map((t) => t.id),
            listeners: deps.listeners.map((l) => l.id),
            resources: deps.resources.map((r) => r.id),
            emitters: deps.emitters.map((e) => e.id),
          },
          usingRes: usingRes.map((t) => t.id),
          usingMw: usingMw.map((t) => t.id),
          emittersOfEvt: emittersOfEvt.map((t) => t.id),
          listenersOfEvt: listenersOfEvt.map((l) => l.id),
          mwEmits: mwEmits.map((e) => e.id),
        };
      },
    });

    const app = createDummyApp([introspector, probe]);

    await run(app);

    expect(snapshot.tasks).toEqual(expect.arrayContaining(["task.hello"]));
    expect(snapshot.listeners).toEqual(
      expect.arrayContaining(["listener.hello"])
    );
    expect(snapshot.resources).toEqual(expect.arrayContaining(["res.db"]));
    expect(snapshot.events).toEqual(expect.arrayContaining(["evt.hello"]));
    expect(snapshot.middlewares).toEqual(expect.arrayContaining(["mw.log"]));
  });
});
