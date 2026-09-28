/** @jest-environment node */

import type {
  AsyncContext,
  Error as ErrorModel,
  Event,
  Hook,
  Middleware,
  Resource,
  Tag,
  Task,
} from "../../../../../schema/model";
import { Introspector } from "../../../../../resources/models/Introspector";
import {
  buildTopologyProjection,
  type TopologyFocusKind,
  type TopologyGraphNode,
  type TopologyGraphProjection,
} from "./topologyGraph";

const task = (id: string, overrides: Partial<Task> = {}): Task => ({
  id,
  emits: [],
  dependsOn: [],
  middleware: [],
  tags: [],
  ...overrides,
});

const hook = (id: string, overrides: Partial<Hook> = {}): Hook => ({
  id,
  events: [],
  dependsOn: [],
  emits: [],
  tags: [],
  ...overrides,
});

const resource = (id: string, overrides: Partial<Resource> = {}): Resource => ({
  id,
  emits: [],
  dependsOn: [],
  middleware: [],
  overrides: [],
  registers: [],
  tags: [],
  ...overrides,
});

const event = (id: string, overrides: Partial<Event> = {}): Event => ({
  id,
  listenedToBy: [],
  transactional: false,
  parallel: false,
  tags: [],
  ...overrides,
});

const middleware = (
  id: string,
  overrides: Partial<Middleware> = {}
): Middleware => ({
  id,
  type: "task",
  autoApply: { enabled: false, scope: null, hasPredicate: false },
  usedByTasks: [],
  usedByResources: [],
  tags: [],
  ...overrides,
});

const tag = (id: string, overrides: Partial<Tag> = {}): Tag => ({
  id,
  tasks: [],
  hooks: [],
  resources: [],
  taskMiddlewares: [],
  resourceMiddlewares: [],
  events: [],
  errors: [],
  ...overrides,
});

interface GraphFixture {
  tasks?: Task[];
  hooks?: Hook[];
  resources?: Resource[];
  events?: Event[];
  middlewares?: Middleware[];
  errors?: ErrorModel[];
  asyncContexts?: AsyncContext[];
  tags?: Tag[];
}

function createIntrospector(fixture: GraphFixture): Introspector {
  return new Introspector({
    data: {
      tasks: fixture.tasks ?? [],
      hooks: fixture.hooks ?? [],
      resources: fixture.resources ?? [],
      events: fixture.events ?? [],
      middlewares: fixture.middlewares ?? [],
      errors: fixture.errors ?? [],
      asyncContexts: fixture.asyncContexts ?? [],
      tags: fixture.tags ?? [],
      rootId: null,
    },
  });
}

function projectBlast(
  introspector: Introspector,
  focusId: string,
  focusKind: TopologyFocusKind,
  radius = 4
): TopologyGraphProjection {
  return buildTopologyProjection(introspector, {
    focusId,
    focusKind,
    view: "blast",
    radius,
  });
}

function indexNodes(
  graph: TopologyGraphProjection
): Map<string, TopologyGraphNode> {
  return new Map(graph.nodes.map((node) => [node.id, node] as const));
}

function findEdge(graph: TopologyGraphProjection, edgeId: string) {
  return graph.edges.find((edge) => edge.id === edgeId);
}

describe("blast lens traversal", () => {
  it("treats tag carriers as direct downstream and keeps traversing them", () => {
    const carrierTask = task("task.audited", { emits: ["event.done"] });
    const carrierEvent = event("event.audited", {
      listenedToBy: ["hook.onAudited"],
    });
    const introspector = createIntrospector({
      tasks: [carrierTask],
      hooks: [
        hook("hook.onDone", { events: ["event.done"] }),
        hook("hook.onAudited", { events: ["event.audited"] }),
      ],
      resources: [resource("resource.auditor", { dependsOn: ["tag.audit"] })],
      events: [
        event("event.done", { listenedToBy: ["hook.onDone"] }),
        carrierEvent,
      ],
      tags: [
        tag("tag.audit", { tasks: [carrierTask], events: [carrierEvent] }),
      ],
    });

    const graph = projectBlast(introspector, "tag.audit", "tag");
    const nodes = indexNodes(graph);

    expect([...nodes.keys()].sort()).toEqual([
      "event.audited",
      "event.done",
      "hook.onAudited",
      "hook.onDone",
      "resource.auditor",
      "tag.audit",
      "task.audited",
    ]);
    // Handlers (dependsOn the tag) and carriers are both direct impact.
    expect(nodes.get("resource.auditor")?.parentRelationKind).toBe("used-by");
    expect(nodes.get("task.audited")).toEqual(
      expect.objectContaining({
        depth: 1,
        terminal: false,
        parentRelationKind: "tagged",
      })
    );
    expect(nodes.get("event.audited")?.depth).toBe(1);
    // Carriers expand like any other downstream node.
    expect(nodes.get("event.done")?.depth).toBe(2);
    expect(nodes.get("hook.onDone")?.depth).toBe(3);
    expect(nodes.get("hook.onAudited")?.depth).toBe(2);
    expect(findEdge(graph, "tag.audit::tagged::task.audited")?.isPrimary).toBe(
      true
    );
  });

  it("follows middleware consumers and what they trigger", () => {
    const introspector = createIntrospector({
      tasks: [
        task("task.build", {
          middleware: ["middleware.audit"],
          emits: ["event.shipped"],
        }),
        task("task.reader", { dependsOn: ["resource.cache"] }),
      ],
      hooks: [hook("hook.shipped", { events: ["event.shipped"] })],
      resources: [
        resource("resource.cache", { middleware: ["middleware.audit"] }),
      ],
      events: [event("event.shipped", { listenedToBy: ["hook.shipped"] })],
      middlewares: [
        middleware("middleware.audit", {
          usedByTasks: ["task.build"],
          usedByResources: ["resource.cache"],
        }),
      ],
    });

    const nodes = indexNodes(
      projectBlast(introspector, "middleware.audit", "middleware")
    );

    expect(nodes.get("task.build")?.depth).toBe(1);
    expect(nodes.get("resource.cache")?.depth).toBe(1);
    expect(nodes.get("event.shipped")?.depth).toBe(2);
    expect(nodes.get("task.reader")?.depth).toBe(2);
    expect(nodes.get("hook.shipped")?.depth).toBe(3);
    expect([...nodes.values()].some((node) => node.terminal)).toBe(false);
  });

  it("records error throwers as contract partners without expanding them", () => {
    const introspector = createIntrospector({
      tasks: [task("task.login", { emits: ["event.loggedIn"] })],
      events: [event("event.loggedIn")],
      errors: [{ id: "error.denied", thrownBy: ["task.login"] }],
    });

    const graph = projectBlast(introspector, "error.denied", "error");
    const nodes = indexNodes(graph);

    expect([...nodes.keys()].sort()).toEqual(["error.denied", "task.login"]);
    expect(nodes.get("task.login")?.terminal).toBe(true);
    expect(graph.edges.some((edge) => edge.sourceId === "task.login")).toBe(
      false
    );
  });

  describe("async context focus", () => {
    // context.request is used by resource.session and provided by two tasks.
    // task.entry also depends on resource.session, so it is really
    // downstream; task.providerOnly only shares the contract.
    const createContextIntrospector = () =>
      createIntrospector({
        tasks: [
          task("task.entry", {
            dependsOn: ["resource.session"],
            emits: ["event.entered"],
          }),
          task("task.providerOnly", { emits: ["event.unrelated"] }),
          task("task.guarded"),
        ],
        hooks: [hook("hook.entered", { events: ["event.entered"] })],
        resources: [resource("resource.session")],
        events: [
          event("event.entered", { listenedToBy: ["hook.entered"] }),
          event("event.unrelated"),
        ],
        asyncContexts: [
          {
            id: "context.request",
            usedBy: ["resource.session"],
            requiredBy: ["task.guarded"],
            providedBy: ["task.providerOnly", "task.entry"],
          },
        ],
      });

    it("upgrades a provider reached later through a real downstream edge", () => {
      const graph = projectBlast(
        createContextIntrospector(),
        "context.request",
        "asyncContext"
      );
      const nodes = indexNodes(graph);

      expect(nodes.get("resource.session")).toEqual(
        expect.objectContaining({ depth: 1, terminal: false })
      );
      expect(nodes.get("task.guarded")).toEqual(
        expect.objectContaining({
          depth: 1,
          terminal: false,
          parentRelationKind: "required-by",
        })
      );
      // Shallowest downstream reach wins over the earlier contract reach.
      expect(nodes.get("task.entry")).toEqual(
        expect.objectContaining({
          depth: 2,
          terminal: false,
          parentId: "resource.session",
          parentRelationKind: "used-by",
        })
      );
      expect(nodes.get("event.entered")?.depth).toBe(3);
      expect(nodes.get("hook.entered")?.depth).toBe(4);
      expect(
        findEdge(graph, "resource.session::used-by::task.entry")?.isPrimary
      ).toBe(true);
      expect(
        findEdge(graph, "context.request::provided-by::task.entry")?.isPrimary
      ).toBe(false);

      // A pure provider stays a terminal contract partner.
      expect(nodes.get("task.providerOnly")?.terminal).toBe(true);
      expect(nodes.has("event.unrelated")).toBe(false);
    });

    it("keeps the provider terminal when its downstream reach is out of radius", () => {
      const nodes = indexNodes(
        projectBlast(
          createContextIntrospector(),
          "context.request",
          "asyncContext",
          1
        )
      );

      expect(nodes.get("task.entry")).toEqual(
        expect.objectContaining({ depth: 1, terminal: true })
      );
      expect(nodes.has("event.entered")).toBe(false);
    });
  });
});
