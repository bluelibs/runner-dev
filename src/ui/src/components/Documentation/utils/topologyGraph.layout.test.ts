/** @jest-environment node */

import type { TopologyLayoutNode } from "./topologyGraph.layout";
import { layoutBlast, layoutMindmap } from "./topologyGraph.layout";

function createNode(
  overrides: Partial<TopologyLayoutNode> &
    Pick<
      TopologyLayoutNode,
      "id" | "kind" | "title" | "depth" | "order" | "parentId" | "isFocus"
    >
): TopologyLayoutNode {
  return {
    id: overrides.id,
    kind: overrides.kind,
    title: overrides.title,
    x: overrides.x ?? 0,
    y: overrides.y ?? 0,
    depth: overrides.depth,
    order: overrides.order,
    parentId: overrides.parentId,
    isFocus: overrides.isFocus,
  };
}

describe("topologyGraph.layout", () => {
  it("keeps the blast-radius focus away from the left border and auto-orders siblings", () => {
    const discoveryNodes = [
      createNode({
        id: "resource.root",
        kind: "resource",
        title: "Root Resource",
        depth: 0,
        order: 0,
        parentId: null,
        isFocus: true,
      }),
      createNode({
        id: "task.zeta",
        kind: "task",
        title: "Zeta Task",
        depth: 1,
        order: 1,
        parentId: "resource.root",
        isFocus: false,
      }),
      createNode({
        id: "task.alpha",
        kind: "task",
        title: "Alpha Task",
        depth: 1,
        order: 2,
        parentId: "resource.root",
        isFocus: false,
      }),
    ];

    layoutBlast(discoveryNodes, "resource.root", false);

    expect(discoveryNodes[0].x).toBeGreaterThanOrEqual(160);
    expect(discoveryNodes[1].y).toBeLessThan(discoveryNodes[2].y);

    const autoOrderedNodes = [
      createNode({
        id: "resource.root",
        kind: "resource",
        title: "Root Resource",
        depth: 0,
        order: 0,
        parentId: null,
        isFocus: true,
      }),
      createNode({
        id: "task.zeta",
        kind: "task",
        title: "Zeta Task",
        depth: 1,
        order: 1,
        parentId: "resource.root",
        isFocus: false,
      }),
      createNode({
        id: "task.alpha",
        kind: "task",
        title: "Alpha Task",
        depth: 1,
        order: 2,
        parentId: "resource.root",
        isFocus: false,
      }),
    ];

    layoutBlast(autoOrderedNodes, "resource.root", true);

    expect(autoOrderedNodes[0].x).toBeGreaterThanOrEqual(160);
    expect(autoOrderedNodes[2].y).toBeLessThan(autoOrderedNodes[1].y);
  });

  it("auto-orders mindmap siblings by title while keeping the root centered", () => {
    const discoveryNodes = [
      createNode({
        id: "resource.root",
        kind: "resource",
        title: "Root Resource",
        depth: 0,
        order: 0,
        parentId: null,
        isFocus: true,
      }),
      createNode({
        id: "task.zeta",
        kind: "task",
        title: "Zeta Task",
        depth: 1,
        order: 1,
        parentId: "resource.root",
        isFocus: false,
      }),
      createNode({
        id: "task.alpha",
        kind: "task",
        title: "Alpha Task",
        depth: 1,
        order: 2,
        parentId: "resource.root",
        isFocus: false,
      }),
    ];

    layoutMindmap(discoveryNodes, "resource.root", false);
    expect(discoveryNodes[1].x).toBeGreaterThan(discoveryNodes[2].x);

    const autoOrderedNodes = [
      createNode({
        id: "resource.root",
        kind: "resource",
        title: "Root Resource",
        depth: 0,
        order: 0,
        parentId: null,
        isFocus: true,
      }),
      createNode({
        id: "task.zeta",
        kind: "task",
        title: "Zeta Task",
        depth: 1,
        order: 1,
        parentId: "resource.root",
        isFocus: false,
      }),
      createNode({
        id: "task.alpha",
        kind: "task",
        title: "Alpha Task",
        depth: 1,
        order: 2,
        parentId: "resource.root",
        isFocus: false,
      }),
    ];

    layoutMindmap(autoOrderedNodes, "resource.root", true);
    expect(autoOrderedNodes[2].x).toBeGreaterThan(autoOrderedNodes[1].x);
  });

  it("pushes dense blast-radius siblings apart so they do not collapse into one stack", () => {
    const denseNodes = [
      createNode({
        id: "resource.root",
        kind: "resource",
        title: "Root Resource",
        depth: 0,
        order: 0,
        parentId: null,
        isFocus: true,
      }),
      ...Array.from({ length: 6 }, (_, index) =>
        createNode({
          id: `task.${index}`,
          kind: "task",
          title: `Task ${index}`,
          depth: 1,
          order: index + 1,
          parentId: "resource.root",
          isFocus: false,
        })
      ),
    ];

    layoutBlast(denseNodes, "resource.root", true);

    const siblingYs = denseNodes
      .filter((node) => node.depth === 1)
      .map((node) => node.y)
      .sort((left, right) => left - right);

    for (let index = 1; index < siblingYs.length; index++) {
      expect(siblingYs[index] - siblingYs[index - 1]).toBeGreaterThanOrEqual(
        150
      );
    }
  });

  it("keeps tiny blast-radius pairs close enough to avoid an exaggerated angle", () => {
    const compactNodes = [
      createNode({
        id: "resource.root",
        kind: "resource",
        title: "Root Resource",
        depth: 0,
        order: 0,
        parentId: null,
        isFocus: true,
      }),
      createNode({
        id: "task.left",
        kind: "task",
        title: "Left Task",
        depth: 1,
        order: 1,
        parentId: "resource.root",
        isFocus: false,
      }),
      createNode({
        id: "task.right",
        kind: "task",
        title: "Right Task",
        depth: 1,
        order: 2,
        parentId: "resource.root",
        isFocus: false,
      }),
    ];

    layoutBlast(compactNodes, "resource.root", true);

    const siblings = compactNodes.filter((node) => node.depth === 1);
    expect(Math.abs(siblings[1].y - siblings[0].y)).toBeLessThanOrEqual(240);
  });

  it("gives first-ring mindmap siblings a bit more breathing room", () => {
    const nodes = [
      createNode({
        id: "resource.root",
        kind: "resource",
        title: "Root Resource",
        depth: 0,
        order: 0,
        parentId: null,
        isFocus: true,
      }),
      createNode({
        id: "task.alpha",
        kind: "task",
        title: "Alpha Task",
        depth: 1,
        order: 1,
        parentId: "resource.root",
        isFocus: false,
      }),
      createNode({
        id: "task.beta",
        kind: "task",
        title: "Beta Task",
        depth: 1,
        order: 2,
        parentId: "resource.root",
        isFocus: false,
      }),
    ];

    layoutMindmap(nodes, "resource.root", true);

    const root = nodes[0];
    const siblingDistances = nodes
      .slice(1)
      .map((node) => Math.hypot(node.x - root.x, node.y - root.y));

    for (const distance of siblingDistances) {
      expect(distance).toBeGreaterThanOrEqual(165);
    }
  });
});
