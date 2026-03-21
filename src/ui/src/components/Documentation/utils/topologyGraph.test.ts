/** @jest-environment node */

import { Introspector } from "../../../../../resources/models/Introspector";
import {
  buildTopologyHash,
  buildTopologyProjection,
  collectSearchTopologyVisibleIds,
  parseTopologyHash,
} from "./topologyGraph";

function createIntrospector(): Introspector {
  return new Introspector({
    data: {
      tasks: [
        {
          id: "task.build",
          emits: ["event.shipped"],
          dependsOn: ["resource.cache"],
          middleware: ["middleware.audit"],
          isPrivate: false,
          tags: [],
        },
      ],
      hooks: [
        {
          id: "hook.shipped",
          events: ["event.shipped"],
          dependsOn: [],
          emits: [],
          isPrivate: false,
          tags: [],
        },
      ],
      resources: [
        {
          id: "resource.root",
          emits: [],
          dependsOn: [],
          middleware: [],
          overrides: [],
          registers: ["task.build", "resource.cache"],
          isPrivate: false,
          tags: [],
        },
        {
          id: "resource.cache",
          emits: [],
          dependsOn: [],
          middleware: [],
          overrides: [],
          registers: [],
          isPrivate: false,
          tags: [],
        },
      ],
      events: [
        {
          id: "event.shipped",
          listenedToBy: ["hook.shipped"],
          isPrivate: false,
          tags: [],
        },
      ],
      middlewares: [
        {
          id: "middleware.audit",
          type: "task",
          usedByTasks: ["task.build"],
          usedByResources: [],
          isPrivate: false,
          tags: [],
        },
      ],
      errors: [],
      asyncContexts: [],
      tags: [],
      rootId: "resource.root",
    },
  });
}

function createLoggerIntrospector(): Introspector {
  return new Introspector({
    data: {
      tasks: [
        {
          id: "task.play",
          emits: ["event.play.logged"],
          dependsOn: ["runner.logger"],
          registeredBy: "runner",
          middleware: [],
          isPrivate: false,
          tags: [],
        },
      ],
      hooks: [
        {
          id: "hook.play.logged",
          events: ["event.play.logged"],
          dependsOn: [],
          emits: [],
          isPrivate: false,
          tags: [],
        },
      ],
      resources: [
        {
          id: "runner",
          emits: [],
          dependsOn: [],
          middleware: [],
          overrides: [],
          registers: ["runner.logger", "task.play"],
          isPrivate: false,
          tags: [],
        },
        {
          id: "runner.logger",
          emits: [],
          dependsOn: [],
          registeredBy: "runner",
          middleware: [],
          overrides: [],
          registers: [],
          isPrivate: false,
          tags: [],
        },
      ],
      events: [
        {
          id: "event.play.logged",
          listenedToBy: ["hook.play.logged"],
          isPrivate: false,
          tags: [],
        },
      ],
      middlewares: [],
      errors: [],
      asyncContexts: [],
      tags: [],
      rootId: "runner",
    },
  });
}

describe("topologyGraph", () => {
  it("round-trips topology hashes", () => {
    const hash = buildTopologyHash({
      focus: { kind: "resource", id: "resource.root" },
      view: "mindmap",
    });

    expect(hash).toBe("#topology/resource/resource.root?view=mindmap");
    expect(parseTopologyHash(hash)).toEqual({
      focus: { kind: "resource", id: "resource.root" },
      view: "mindmap",
    });
  });

  it("builds a blast-radius projection with static edges", () => {
    const introspector = createIntrospector();

    const graph = buildTopologyProjection(introspector, {
      focusId: "task.build",
      focusKind: "task",
      view: "blast",
      radius: 2,
    });
    const selectedFromNodes = graph.nodes.find(
      (node) => node.id === "task.build"
    );

    expect(graph.selectedNode.id).toBe("task.build");
    expect(graph.selectedNode).toEqual(selectedFromNodes);
    expect(
      graph.selectedNode.incomingCount + graph.selectedNode.outgoingCount
    ).toBeGreaterThan(0);
    expect(graph.nodes.map((node) => node.id)).toEqual(
      expect.arrayContaining([
        "task.build",
        "resource.cache",
        "event.shipped",
        "hook.shipped",
        "middleware.audit",
      ])
    );
    expect(graph.summary).toEqual({
      visibleNodes: 5,
      visibleEdges: 8,
      hiddenNodes: 0,
    });
    expect(
      graph.edges.find((edge) => edge.id === "task.build::emits::event.shipped")
        ?.isPrimary
    ).toBe(true);
    expect(
      graph.edges.find(
        (edge) => edge.id === "event.shipped::listened-to-by::hook.shipped"
      )?.isPrimary
    ).toBe(true);
  });

  it("keeps resource mindmaps anchored on registers while cross-linking dependencies", () => {
    const introspector = createIntrospector();
    const graph = buildTopologyProjection(introspector, {
      focusId: "resource.root",
      focusKind: "resource",
      view: "mindmap",
      radius: 3,
    });

    expect(graph.selectedNode.id).toBe("resource.root");
    expect(graph.nodes.map((node) => node.id)).toEqual(
      expect.arrayContaining([
        "resource.root",
        "resource.cache",
        "task.build",
        "event.shipped",
        "hook.shipped",
        "middleware.audit",
      ])
    );
    expect(
      graph.edges.find(
        (edge) => edge.id === "resource.root::registers::task.build"
      )?.isPrimary
    ).toBe(true);
    expect(
      graph.edges.find((edge) => edge.id === "task.build::emits::event.shipped")
        ?.isPrimary
    ).toBe(false);
    expect(
      graph.edges.find((edge) => edge.id === "task.build::emits::event.shipped")
        ?.isCrossLink
    ).toBe(true);
  });

  it("expands logger-like resource mindmaps with ownership and consumer chains", () => {
    const introspector = createLoggerIntrospector();
    const graph = buildTopologyProjection(introspector, {
      focusId: "runner.logger",
      focusKind: "resource",
      view: "mindmap",
      radius: 3,
    });

    expect(graph.selectedNode.id).toBe("runner.logger");
    expect(graph.nodes.map((node) => node.id)).toEqual(
      expect.arrayContaining([
        "runner.logger",
        "runner",
        "task.play",
        "event.play.logged",
        "hook.play.logged",
      ])
    );
    expect(
      graph.edges.find((edge) => edge.id === "runner::registers::runner.logger")
    ).toBeDefined();
    expect(
      graph.edges.find((edge) => edge.id === "runner::registers::runner.logger")
        ?.isCrossLink
    ).toBe(true);
    expect(
      graph.edges.find(
        (edge) => edge.id === "runner.logger::used-by::task.play"
      )?.isCrossLink
    ).toBe(true);
    expect(
      graph.edges.find(
        (edge) => edge.id === "task.play::emits::event.play.logged"
      )?.isCrossLink
    ).toBe(true);
    expect(
      graph.edges.find(
        (edge) =>
          edge.id === "event.play.logged::listened-to-by::hook.play.logged"
      )?.isCrossLink
    ).toBe(true);
  });

  it("keeps ancestor chains visible when filtering for a deeper match", () => {
    const introspector = createIntrospector();
    const baseGraph = buildTopologyProjection(introspector, {
      focusId: "resource.root",
      focusKind: "resource",
      view: "mindmap",
      radius: 3,
    });
    const visibleIds = collectSearchTopologyVisibleIds(
      baseGraph.nodes,
      "resource.root",
      new Set(["resource.root", "event.shipped"])
    );

    expect([...visibleIds].sort()).toEqual([
      "event.shipped",
      "resource.root",
      "task.build",
    ]);

    const filteredGraph = buildTopologyProjection(introspector, {
      focusId: "resource.root",
      focusKind: "resource",
      view: "mindmap",
      radius: 3,
      visibleIds,
    });

    expect(filteredGraph.nodes.map((node) => node.id)).toEqual(
      expect.arrayContaining(["resource.root", "task.build", "event.shipped"])
    );
  });
});
