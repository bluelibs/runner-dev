import { defineResource, run } from "@bluelibs/runner";
import { introspector } from "../../resources/introspector.resource";
import {
  createDummyApp,
  dummyAppIds,
  evtHello,
  logMw,
  logMwTask,
  tagMw,
} from "../dummy/dummyApp";

describe("introspector (detailed helpers)", () => {
  test("middleware usages and detailed lookups are correct", async () => {
    let snapshot: any = {};

    const probe = defineResource({
      id: "probe-introspector-detailed",
      dependencies: { introspector },
      async init(_, { introspector }) {
        const taskLikeUsages = introspector.getMiddlewareUsagesForTask(
          dummyAppIds.task("task-hello")
        );
        const hookUsages = introspector.getMiddlewareUsagesForTask(
          dummyAppIds.hook("hook-hello")
        );
        const resourceUsages = introspector.getMiddlewareUsagesForResource(
          dummyAppIds.resource("res-db")
        );

        const usedByTasksDetailed =
          introspector.getTasksUsingMiddlewareDetailed(
            dummyAppIds.taskMiddleware(logMwTask.id)
          );
        const usedByResourcesDetailed =
          introspector.getResourcesUsingMiddlewareDetailed(
            dummyAppIds.resourceMiddleware(logMw.id)
          );

        const resourceEmits = introspector.getEmittedEventsForResource(
          dummyAppIds.resource("res-db")
        );

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
        {
          id: dummyAppIds.taskMiddleware(logMwTask.id),
          nodeId: dummyAppIds.taskMiddleware(logMwTask.id),
          config: "{}",
        },
      ])
    );

    // hook.hello also captures detailed usages (none by default)
    expect(Array.isArray(snapshot.hookUsages)).toBe(true);

    // res.db uses mw.log
    expect(snapshot.resourceUsages).toEqual(
      expect.arrayContaining([
        {
          id: dummyAppIds.resourceMiddleware(logMw.id),
          nodeId: dummyAppIds.resourceMiddleware(logMw.id),
          config: "{}",
        },
      ])
    );

    // usedByTasksDetailed/usedByResourcesDetailed for mw.log(.task)
    expect(snapshot.usedByTasksDetailed).toEqual(
      expect.arrayContaining([
        {
          id: dummyAppIds.task("task-hello"),
          nodeId: dummyAppIds.task("task-hello"),
          config: "{}",
        },
      ])
    );
    expect(snapshot.usedByResourcesDetailed).toEqual(
      expect.arrayContaining([
        {
          id: dummyAppIds.resource("res-db"),
          nodeId: dummyAppIds.resource("res-db"),
          config: "{}",
        },
      ])
    );

    // resource emits
    expect(snapshot.resourceEmits).toEqual(
      expect.arrayContaining([dummyAppIds.event(evtHello.id)])
    );
  });

  test("two tasks using the same middleware with different configs are reported distinctly", async () => {
    let snapshot: any = {};

    const probe = defineResource({
      id: "probe-introspector-detailed-2",
      dependencies: { introspector },
      async init(_, { introspector }) {
        const usedByTasksDetailed =
          introspector.getTasksUsingMiddlewareDetailed(
            dummyAppIds.taskMiddleware(tagMw.id)
          );
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
        {
          id: dummyAppIds.task("task-aggregate"),
          config: expect.stringMatching(/"agg"/),
        },
        {
          id: dummyAppIds.task("task-tagged"),
          config: expect.stringMatching(/"beta"/),
        },
      ])
    );

    // meta.tagsDetailed exists and is an array (for root it may be empty by default)
    expect(Array.isArray(snapshot.tagsDetailed)).toBe(true);
  });
});
