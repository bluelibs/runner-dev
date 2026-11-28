/** @jest-environment node */

import type { Event, Hook, Resource, Task } from "../../../../../schema/model";
import { buildTopologyCatalog } from "./topologyCatalog";
import { Introspector } from "../../../../../resources/models/Introspector";
import {
  buildTopologyProjection,
  directTopologyRelations,
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

test("canonical dependencies and typed focuses distinguish IDs with the same suffix", () => {
  const source = new Introspector({
    data: {
      tasks: [
        { ...readerTask, id: "billing.delivery", dependsOn: [] },
        {
          ...readerTask,
          id: "consumer",
          dependsOn: ["delivery"],
          registeredBy: "billing",
        },
      ],
      resources: [
        { ...dbResource, id: "delivery", dependsOn: [] },
        { ...dbResource, id: "app.billing", registers: ["consumer"] },
      ],
      hooks: [],
      events: [],
      middlewares: [],
      tags: [],
      rootId: null,
    },
  });
  expect(buildTopologyCatalog(source).elements.get("consumer")?.owner).toBe(
    "app.billing"
  );
  const neighborhood = (id: string, kind: "resource" | "task") =>
    directTopologyRelations(source, { id, kind })
      .filter((edge) => edge.kind === "used-by")
      .flatMap((edge) => edge.targets.map((node) => node.id));
  expect(neighborhood("delivery", "resource")).toEqual(["consumer"]);
  expect(neighborhood("delivery", "task")).toEqual([]);
  const project = (id: string, kind: "task" | "resource") =>
    buildTopologyProjection(source, {
      focusId: id,
      focusKind: kind,
      radius: 2,
      view: "blast",
    }).nodes.map((node) => node.id);
  expect(project("delivery", "resource")).toEqual(["delivery", "consumer"]);
  expect(project("delivery", "task")).toEqual(["billing.delivery"]);
  expect(
    directTopologyRelations(source, { kind: "task", id: "consumer" }).find(
      (edge) => edge.kind === "depends-on"
    )?.targets[0]
  ).toMatchObject({ kind: "resource", id: "delivery" });
});
