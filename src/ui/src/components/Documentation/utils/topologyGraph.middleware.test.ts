/** @jest-environment node */

import type {
  Event,
  Hook,
  Middleware,
  Resource,
  Task,
} from "../../../../../schema/model";
import { Introspector } from "../../../../../resources/models/Introspector";
import {
  buildTopologyProjection,
  type TopologyGraphNode,
  type TopologyGraphProjection,
  type TopologyViewMode,
} from "./topologyGraph";

const event = (id: string, listenedToBy: string[] = []): Event => ({
  id,
  listenedToBy,
  transactional: false,
  parallel: false,
});

const hook = (id: string, events: string[]): Hook => ({
  id,
  events,
  dependsOn: [],
  emits: [],
});

/**
 * `middleware.retry` wraps `resource.db` and emits `event.retried` itself.
 * `resource.db` emits `event.connected`; `task.reader` only depends on the
 * resource and emits `event.read`, outside the middleware.
 */
function createIntrospector(retryEmits?: string[]): Introspector {
  const retry: Middleware = {
    id: "middleware.retry",
    type: "resource",
    autoApply: { enabled: false, scope: null, hasPredicate: false },
    usedByTasks: [],
    usedByResources: ["resource.db"],
    ...(retryEmits ? { emits: retryEmits } : {}),
  };
  const db: Resource = {
    id: "resource.db",
    emits: ["event.connected"],
    dependsOn: [],
    middleware: ["middleware.retry"],
    overrides: [],
    registers: [],
  };
  const reader: Task = {
    id: "task.reader",
    emits: ["event.read"],
    dependsOn: ["resource.db"],
    middleware: [],
  };

  return new Introspector({
    data: {
      tasks: [reader],
      hooks: [
        hook("hook.onRetried", ["event.retried"]),
        hook("hook.onRead", ["event.read"]),
      ],
      resources: [db],
      events: [
        event("event.retried", ["hook.onRetried"]),
        event("event.connected"),
        event("event.read", ["hook.onRead"]),
      ],
      middlewares: [retry],
      tags: [],
      rootId: null,
    },
  });
}

function project(
  introspector: Introspector,
  view: TopologyViewMode,
  radius: number
): TopologyGraphProjection {
  return buildTopologyProjection(introspector, {
    focusId: "middleware.retry",
    focusKind: "middleware",
    view,
    radius,
  });
}

function middlewareEmitTargets(graph: TopologyGraphProjection): string[] {
  return graph.edges
    .filter(
      (edge) => edge.sourceId === "middleware.retry" && edge.kind === "emits"
    )
    .map((edge) => edge.targetId);
}

function placement(graph: TopologyGraphProjection, id: string) {
  const node: TopologyGraphNode | undefined = graph.nodes.find(
    (candidate) => candidate.id === id
  );
  return node ? { depth: node.depth, parentId: node.parentId } : undefined;
}

describe("topology middleware emits", () => {
  it.each<TopologyViewMode>(["mindmap", "blast"])(
    "%s: a middleware emits only its own events",
    (view) => {
      const graph = project(createIntrospector(["event.retried"]), view, 3);

      expect(middlewareEmitTargets(graph)).toEqual(["event.retried"]);
      expect(placement(graph, "event.retried")).toEqual({
        depth: 1,
        parentId: "middleware.retry",
      });
      // The wrapped resource's own event hangs off the resource, not the
      // middleware.
      expect(placement(graph, "event.connected")).toEqual({
        depth: 2,
        parentId: "resource.db",
      });
    }
  );

  it("blast: consumers of a wrapped resource are downstream, not emits", () => {
    const graph = project(createIntrospector(["event.retried"]), "blast", 4);

    expect(placement(graph, "hook.onRetried")?.depth).toBe(2);
    expect(placement(graph, "task.reader")).toEqual({
      depth: 2,
      parentId: "resource.db",
    });
    expect(placement(graph, "event.read")).toEqual({
      depth: 3,
      parentId: "task.reader",
    });
    expect(placement(graph, "hook.onRead")?.depth).toBe(4);
  });

  it("draws no emit edges for a middleware without event dependencies", () => {
    const graph = project(createIntrospector(), "blast", 4);

    expect(middlewareEmitTargets(graph)).toEqual([]);
    expect(placement(graph, "event.retried")).toBeUndefined();
    expect(placement(graph, "event.connected")?.depth).toBe(2);
  });
});
