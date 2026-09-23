/** @jest-environment node */

import type { Event, Hook, Resource, Task } from "../../../../../schema/model";
import { Introspector } from "../../../../../resources/models/Introspector";
import {
  buildTopologyProjection,
  type TopologyGraphProjection,
} from "./topologyGraph";

const readerTask: Task = {
  id: "app.tasks.reader",
  emits: [],
  dependsOn: ["app.resources.db"],
  middleware: [],
  tags: [],
};

const dbResource: Resource = {
  id: "app.resources.db",
  emits: [],
  dependsOn: [],
  middleware: [],
  overrides: [],
  registers: [],
  tags: [],
};

// Listens to and re-emits the same event: a cycle back to the focus.
const echoHook: Hook = {
  id: "app.hooks.echo",
  events: ["app.events.ping"],
  dependsOn: [],
  emits: ["app.events.ping"],
  tags: [],
};

const pingEvent: Event = {
  id: "app.events.ping",
  listenedToBy: ["app.hooks.echo"],
  transactional: false,
  parallel: false,
  tags: [],
};

function createIntrospector(): Introspector {
  return new Introspector({
    data: {
      tasks: [readerTask],
      hooks: [echoHook],
      resources: [dbResource],
      events: [pingEvent],
      middlewares: [],
      errors: [],
      asyncContexts: [],
      tags: [],
      rootId: null,
    },
  });
}

function expectFocusedOn(graph: TopologyGraphProjection, canonicalId: string) {
  expect(graph.focus.id).toBe(canonicalId);
  expect(graph.selectedNode.id).toBe(canonicalId);
  const focusNode = graph.nodes.find((node) => node.id === canonicalId);
  expect(focusNode).toEqual(
    expect.objectContaining({
      isFocus: true,
      depth: 0,
      order: 0,
      parentId: null,
    })
  );
}

describe("topology focus named by a short id", () => {
  it("stays the root of a mindmap whose neighbor depends back on it", () => {
    const graph = buildTopologyProjection(createIntrospector(), {
      focusId: "db",
      focusKind: "resource",
      view: "mindmap",
      radius: 3,
    });

    expectFocusedOn(graph, "app.resources.db");
  });

  it("stays the root of a blast radius that cycles back to it", () => {
    const graph = buildTopologyProjection(createIntrospector(), {
      focusId: "ping",
      focusKind: "event",
      view: "blast",
      radius: 3,
    });

    expectFocusedOn(graph, "app.events.ping");
    expect(graph.nodes.map((node) => node.id).sort()).toEqual([
      "app.events.ping",
      "app.hooks.echo",
    ]);
  });

  it("keeps an id it cannot resolve as given", () => {
    const graph = buildTopologyProjection(createIntrospector(), {
      focusId: "missing",
      focusKind: "task",
      view: "blast",
      radius: 3,
    });

    expect(graph.focus).toEqual({ kind: "task", id: "missing" });
  });
});
