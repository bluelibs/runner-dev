/** @jest-environment node */

import type { TopologyGraphNode } from "../utils/topologyGraph";
import {
  buildTopologyNavigatorEntries,
  getMatchingTopologyNodeIds,
} from "./topologyNavigator.utils";

function createNode(
  overrides: Partial<TopologyGraphNode> &
    Pick<
      TopologyGraphNode,
      "id" | "kind" | "label" | "incomingCount" | "outgoingCount"
    >
): TopologyGraphNode {
  return {
    id: overrides.id,
    kind: overrides.kind,
    label: overrides.label,
    subtitle: overrides.subtitle ?? overrides.id,
    description: overrides.description ?? null,
    filePath: overrides.filePath ?? null,
    icon: overrides.icon ?? "◦",
    x: overrides.x ?? 0,
    y: overrides.y ?? 0,
    depth: overrides.depth ?? 0,
    order: overrides.order ?? 0,
    parentId: overrides.parentId ?? null,
    parentRelationKind: overrides.parentRelationKind ?? null,
    isFocus: overrides.isFocus ?? false,
    isVisible: overrides.isVisible ?? true,
    hiddenNeighborCount: overrides.hiddenNeighborCount ?? 0,
    incomingCount: overrides.incomingCount,
    outgoingCount: overrides.outgoingCount,
    visibility: overrides.visibility ?? "public",
    pills: overrides.pills ?? [],
  };
}

describe("topologyNavigator", () => {
  it("pins the selected node while sorting stronger matches first", () => {
    const nodes = [
      createNode({
        id: "runner.logger",
        kind: "resource",
        label: "Runner Logger",
        incomingCount: 3,
        outgoingCount: 1,
      }),
      createNode({
        id: "task.play",
        kind: "task",
        label: "Play Task",
        incomingCount: 4,
        outgoingCount: 4,
      }),
      createNode({
        id: "event.play.logged",
        kind: "event",
        label: "Play Logged Event",
        incomingCount: 1,
        outgoingCount: 0,
      }),
      createNode({
        id: "hook.play.logged",
        kind: "hook",
        label: "Play Logged Hook",
        incomingCount: 1,
        outgoingCount: 0,
      }),
    ];

    const entries = buildTopologyNavigatorEntries(
      nodes,
      "runner.logger",
      "play"
    );

    expect(entries.map((entry) => entry.node.id)).toEqual([
      "runner.logger",
      "task.play",
      "event.play.logged",
      "hook.play.logged",
    ]);
  });

  it("prefers exact matches over broader prefixes", () => {
    const nodes = [
      createNode({
        id: "task.play",
        kind: "task",
        label: "Play Task",
        incomingCount: 1,
        outgoingCount: 1,
      }),
      createNode({
        id: "runner",
        kind: "resource",
        label: "Runner",
        incomingCount: 4,
        outgoingCount: 2,
      }),
      createNode({
        id: "runner.logger",
        kind: "resource",
        label: "Runner Logger",
        incomingCount: 1,
        outgoingCount: 1,
      }),
    ];

    const entries = buildTopologyNavigatorEntries(nodes, "task.play", "runner");

    expect(entries.map((entry) => entry.node.id)).toEqual([
      "task.play",
      "runner",
      "runner.logger",
    ]);
  });

  it("returns matching graph ids while keeping the selected node pinned", () => {
    const nodes = [
      createNode({
        id: "resource.root",
        kind: "resource",
        label: "Root Resource",
        incomingCount: 1,
        outgoingCount: 3,
      }),
      createNode({
        id: "task.orders.create",
        kind: "task",
        label: "Create Order",
        incomingCount: 2,
        outgoingCount: 1,
      }),
      createNode({
        id: "event.orders.created",
        kind: "event",
        label: "Order Created",
        incomingCount: 1,
        outgoingCount: 0,
      }),
    ];

    const matchingIds = getMatchingTopologyNodeIds(
      nodes,
      "resource.root",
      "order"
    );

    expect(
      [...((matchingIds as Set<string>) ?? new Set<string>())].sort()
    ).toEqual(["event.orders.created", "resource.root", "task.orders.create"]);
  });
});
