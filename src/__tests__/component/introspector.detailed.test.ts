import { resource, run } from "@bluelibs/runner";
import { introspector } from "../../resources/introspector.resource";
import { createDummyApp } from "../dummy/dummyApp";

describe("introspector (detailed helpers)", () => {
  test("middleware usages and detailed lookups are correct", async () => {
    let snapshot: any = {};

    const probe = resource({
      id: "probe.introspector-detailed",
      dependencies: { introspector },
      async init(_, { introspector }) {
        const taskLikeUsages =
          introspector.getMiddlewareUsagesForTask("task.hello");
        const hookUsages =
          introspector.getMiddlewareUsagesForTask("hook.hello");
        const resourceUsages =
          introspector.getMiddlewareUsagesForResource("res.db");

        const usedByTasksDetailed =
          introspector.getTasksUsingMiddlewareDetailed("mw.log.task");
        const usedByResourcesDetailed =
          introspector.getResourcesUsingMiddlewareDetailed("mw.log");

        const resourceEmits =
          introspector.getEmittedEventsForResource("res.db");

        snapshot = {
          taskLikeUsages: taskLikeUsages.map((u) => ({
            id: u.id,
            nodeId: u.node.id,
            config: u.config,
          })),
          hookUsages: hookUsages.map((u) => ({
            id: u.id,
            nodeId: u.node.id,
            config: u.config,
          })),
          resourceUsages: resourceUsages.map((u) => ({
            id: u.id,
            nodeId: u.node.id,
            config: u.config,
          })),
          usedByTasksDetailed: usedByTasksDetailed.map((x) => ({
            id: x.id,
            config: x.config,
            nodeId: x.node.id,
          })),
          usedByResourcesDetailed: usedByResourcesDetailed.map((x) => ({
            id: x.id,
            config: x.config,
            nodeId: x.node.id,
          })),
          resourceEmits: resourceEmits.map((e) => e.id),
        };
      },
    });

    const app = createDummyApp([introspector, probe]);
    await run(app);

    // task.hello uses mw.log.task
    expect(snapshot.taskLikeUsages).toEqual(
      expect.arrayContaining([
        { id: "mw.log.task", nodeId: "mw.log.task", config: "{}" },
      ])
    );

    // hook.hello also captures detailed usages (none by default)
    expect(Array.isArray(snapshot.hookUsages)).toBe(true);

    // res.db uses mw.log
    expect(snapshot.resourceUsages).toEqual(
      expect.arrayContaining([{ id: "mw.log", nodeId: "mw.log", config: "{}" }])
    );

    // usedByTasksDetailed/usedByResourcesDetailed for mw.log(.task)
    expect(snapshot.usedByTasksDetailed).toEqual(
      expect.arrayContaining([
        { id: "task.hello", nodeId: "task.hello", config: "{}" },
      ])
    );
    expect(snapshot.usedByResourcesDetailed).toEqual(
      expect.arrayContaining([{ id: "res.db", nodeId: "res.db", config: "{}" }])
    );

    // resource emits
    expect(snapshot.resourceEmits).toEqual(
      expect.arrayContaining(["evt.hello"])
    );
  });

  test("two tasks using the same middleware with different configs are reported distinctly", async () => {
    let snapshot: any = {};

    const probe = resource({
      id: "probe.introspector-detailed-2",
      dependencies: { introspector },
      async init(_, { introspector }) {
        const usedByTasksDetailed =
          introspector.getTasksUsingMiddlewareDetailed("mw.tag");
        const all = introspector.getRoot();
        snapshot = {
          usedByTasksDetailed: usedByTasksDetailed.map((x) => ({
            id: x.id,
            config: x.config,
          })),
          // collect tagsDetailed from model
          tagsDetailed: all.tagsDetailed ?? [],
        };
      },
    });

    const app = createDummyApp([introspector, probe]);
    await run(app);

    // mw.tag is used by task.aggregate with label "agg" and task.tagged with label "beta"
    expect(snapshot.usedByTasksDetailed).toEqual(
      expect.arrayContaining([
        { id: "task.aggregate", config: expect.stringMatching(/"agg"/) },
        { id: "task.tagged", config: expect.stringMatching(/"beta"/) },
      ])
    );

    // meta.tagsDetailed exists and is an array (for root it may be empty by default)
    expect(Array.isArray(snapshot.tagsDetailed)).toBe(true);
  });
});
