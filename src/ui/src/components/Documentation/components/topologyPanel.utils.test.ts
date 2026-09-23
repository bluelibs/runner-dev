/** @jest-environment node */

import type { TopologyGraphNode } from "../utils/topologyGraph";
import {
  formatBlastSubtitle,
  groupImpactNodes,
  summarizeImpact,
} from "./topologyPanel.utils";

function createNode(
  id: string,
  overrides: Partial<TopologyGraphNode> = {}
): TopologyGraphNode {
  return {
    id,
    kind: "task",
    label: id,
    subtitle: id,
    icon: "task",
    x: 0,
    y: 0,
    depth: 1,
    order: 0,
    parentId: null,
    parentRelationKind: null,
    isFocus: false,
    isVisible: true,
    terminal: false,
    hiddenNeighborCount: 0,
    incomingCount: 0,
    outgoingCount: 0,
    visibility: "public",
    pills: [],
    ...overrides,
  };
}

const blastNodes: TopologyGraphNode[] = [
  createNode("resource.focus", { kind: "resource", depth: 0, isFocus: true }),
  createNode("task.visibleDirect", { depth: 1 }),
  createNode("task.hiddenDirect", { depth: 1, isVisible: false }),
  createNode("event.visibleTransitive", { kind: "event", depth: 2 }),
  createNode("hook.hiddenTransitive", {
    kind: "hook",
    depth: 3,
    isVisible: false,
  }),
  createNode("task.emitter", { terminal: true }),
  createNode("task.hiddenEmitter", { terminal: true, isVisible: false }),
];

describe("summarizeImpact", () => {
  it("counts the true downstream set and reports hidden nodes apart", () => {
    expect(summarizeImpact(blastNodes)).toEqual({
      affected: 4,
      direct: 2,
      transitive: 2,
      contract: 2,
      hiddenAffected: 2,
      hiddenContract: 1,
    });
  });

  it("keeps contract partners out of Affected", () => {
    const summary = summarizeImpact([
      createNode("event.focus", { depth: 0, isFocus: true }),
      createNode("task.emitter", { terminal: true }),
    ]);

    expect(summary.affected).toBe(0);
    expect(summary.contract).toBe(1);
  });
});

describe("groupImpactNodes", () => {
  it("lists visible nodes per group and counts the hidden ones", () => {
    const groups = groupImpactNodes(blastNodes);

    expect(
      groups.map((group) => ({
        title: group.title,
        visible: group.visibleNodes.map((node) => node.id),
        hidden: group.hiddenCount,
      }))
    ).toEqual([
      { title: "Direct", visible: ["task.visibleDirect"], hidden: 1 },
      { title: "Transitive", visible: ["event.visibleTransitive"], hidden: 1 },
      { title: "Contract partners", visible: ["task.emitter"], hidden: 1 },
    ]);
  });

  it("keeps a fully hidden group and drops empty ones", () => {
    const groups = groupImpactNodes([
      createNode("resource.focus", { depth: 0, isFocus: true }),
      createNode("task.b", { depth: 1, isVisible: false }),
      createNode("task.a", { depth: 1, isVisible: false }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]).toEqual(
      expect.objectContaining({ title: "Direct", hiddenCount: 2 })
    );
    expect(groups[0].visibleNodes).toEqual([]);
  });

  it("sorts visible nodes by label, then id", () => {
    const groups = groupImpactNodes([
      createNode("task.2", { label: "Same" }),
      createNode("task.1", { label: "Same" }),
      createNode("task.0", { label: "Alpha" }),
    ]);

    expect(groups[0].visibleNodes.map((node) => node.id)).toEqual([
      "task.0",
      "task.1",
      "task.2",
    ]);
  });
});

describe("formatBlastSubtitle", () => {
  it("mentions hidden affected nodes and contract partners", () => {
    expect(formatBlastSubtitle(summarizeImpact(blastNodes), 3)).toBe(
      "Blast radius · 4 affected (2 hidden by filters) within 3 hops · 2 contract partners"
    );
  });

  it("stays short when nothing is hidden and nobody shares the contract", () => {
    const summary = summarizeImpact([
      createNode("task.focus", { depth: 0, isFocus: true }),
      createNode("event.emitted", { kind: "event" }),
    ]);

    expect(formatBlastSubtitle(summary, 1)).toBe(
      "Blast radius · 1 affected within 1 hop"
    );
  });

  it("uses the singular for one contract partner", () => {
    const summary = summarizeImpact([
      createNode("error.focus", { depth: 0, isFocus: true }),
      createNode("task.thrower", { terminal: true }),
    ]);

    expect(formatBlastSubtitle(summary, 2)).toBe(
      "Blast radius · 0 affected within 2 hops · 1 contract partner"
    );
  });
});
