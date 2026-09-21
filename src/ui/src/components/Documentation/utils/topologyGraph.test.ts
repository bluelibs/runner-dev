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

  it("builds a blast-radius projection with downstream-only edges", () => {
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
    // Upstream edges (depends-on resource.cache, uses-middleware
    // middleware.audit) stay in the mindmap lens, not the blast lens.
    expect(graph.nodes.map((node) => node.id).sort()).toEqual([
      "event.shipped",
      "hook.shipped",
      "task.build",
    ]);
    expect(graph.summary).toEqual({
      visibleNodes: 3,
      visibleEdges: 2,
      hiddenNodes: 0,
    });
    const byId = new Map(graph.nodes.map((node) => [node.id, node]));
    expect(byId.get("event.shipped")?.depth).toBe(1);
    expect(byId.get("hook.shipped")?.depth).toBe(2);
    expect(byId.get("hook.shipped")?.terminal).toBe(false);
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

  it("keeps task mindmaps on the full neighborhood", () => {
    const introspector = createIntrospector();
    const graph = buildTopologyProjection(introspector, {
      focusId: "task.build",
      focusKind: "task",
      view: "mindmap",
      radius: 2,
    });

    expect(graph.nodes.map((node) => node.id).sort()).toEqual([
      "event.shipped",
      "hook.shipped",
      "middleware.audit",
      "resource.cache",
      "task.build",
    ]);
    expect(
      graph.edges.some(
        (edge) => edge.id === "task.build::depends-on::resource.cache"
      )
    ).toBe(true);
    expect(
      graph.edges.some(
        (edge) => edge.id === "task.build::uses-middleware::middleware.audit"
      )
    ).toBe(true);
  });

  it("marks event emitters as terminal contract partners", () => {
    const introspector = createIntrospector();
    const graph = buildTopologyProjection(introspector, {
      focusId: "event.shipped",
      focusKind: "event",
      view: "blast",
      radius: 2,
    });

    const byId = new Map(graph.nodes.map((node) => [node.id, node]));
    expect([...byId.keys()].sort()).toEqual([
      "event.shipped",
      "hook.shipped",
      "task.build",
    ]);
    // The emitter shares the event contract but never expands: expanding it
    // would pull in its other emits as false-positive impact.
    expect(byId.get("task.build")?.terminal).toBe(true);
    expect(byId.get("hook.shipped")?.terminal).toBe(false);
    expect(graph.edges.some((edge) => edge.sourceId === "task.build")).toBe(
      false
    );
    expect(
      graph.edges.find(
        (edge) => edge.id === "event.shipped::emitted-by::task.build"
      )
    ).toBeDefined();
  });

  it("follows resource consumers transitively without ownership", () => {
    const introspector = createLoggerIntrospector();
    const graph = buildTopologyProjection(introspector, {
      focusId: "runner.logger",
      focusKind: "resource",
      view: "blast",
      radius: 3,
    });

    const byId = new Map(graph.nodes.map((node) => [node.id, node]));
    expect([...byId.keys()].sort()).toEqual([
      "event.play.logged",
      "hook.play.logged",
      "runner.logger",
      "task.play",
    ]);
    // Ownership (registered-by runner) is mindmap territory, not impact.
    expect(byId.has("runner")).toBe(false);
    expect(byId.get("task.play")?.depth).toBe(1);
    expect(byId.get("event.play.logged")?.depth).toBe(2);
    expect(byId.get("hook.play.logged")?.depth).toBe(3);
  });

  it("terminates blast traversal on event cycles", () => {
    const introspector = new Introspector({
      data: {
        tasks: [],
        hooks: [
          {
            id: "hook.ping",
            events: ["event.ping"],
            dependsOn: [],
            emits: ["event.pong"],
            isPrivate: false,
            tags: [],
          },
          {
            id: "hook.pong",
            events: ["event.pong"],
            dependsOn: [],
            emits: ["event.ping"],
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
            registers: [],
            isPrivate: false,
            tags: [],
          },
        ],
        events: [
          {
            id: "event.ping",
            listenedToBy: ["hook.ping"],
            isPrivate: false,
            tags: [],
          },
          {
            id: "event.pong",
            listenedToBy: ["hook.pong"],
            isPrivate: false,
            tags: [],
          },
        ],
        middlewares: [],
        errors: [],
        asyncContexts: [],
        tags: [],
        rootId: "resource.root",
      },
    });
    const graph = buildTopologyProjection(introspector, {
      focusId: "hook.ping",
      focusKind: "hook",
      view: "blast",
      radius: 4,
    });

    expect(graph.nodes.map((node) => node.id).sort()).toEqual([
      "event.ping",
      "event.pong",
      "hook.ping",
      "hook.pong",
    ]);
    expect(
      graph.edges.some((edge) => edge.id === "hook.pong::emits::event.ping")
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
