import type { TopologyGraphNode } from "../utils/topologyGraph";
type ImpactClass = "direct" | "transitive" | "contract";

function classifyImpact(node: TopologyGraphNode): ImpactClass {
  if (node.terminal) return "contract";
  return node.depth <= 1 ? "direct" : "transitive";
}

export interface TopologyImpactGroup {
  title: string;
  hint: string;
  /** Nodes the current filters leave visible, sorted by label. */
  visibleNodes: TopologyGraphNode[];
  hiddenCount: number;
}

const IMPACT_GROUPS: Array<{
  impactClass: ImpactClass;
  title: string;
  hint: string;
}> = [
  {
    impactClass: "direct",
    title: "Direct",
    hint: "Behaves differently if the focus changes",
  },
  {
    impactClass: "transitive",
    title: "Transitive",
    hint: "Affected further down the chain",
  },
  {
    impactClass: "contract",
    title: "Contract partners",
    hint: "Not downstream, but must still conform: emitters, throwers, providers",
  },
];

/** Impact panel groups; empty groups (no visible or hidden node) are dropped. */
export function groupImpactNodes(
  nodes: TopologyGraphNode[]
): TopologyImpactGroup[] {
  const byLabel = (left: TopologyGraphNode, right: TopologyGraphNode) =>
    left.label.localeCompare(right.label) || left.id.localeCompare(right.id);
  const impacted = nodes.filter((node) => !node.isFocus);

  return IMPACT_GROUPS.map(({ impactClass, title, hint }) => {
    const members = impacted.filter(
      (node) => classifyImpact(node) === impactClass
    );
    const visibleNodes = members.filter((node) => node.isVisible);
    return {
      title,
      hint,
      visibleNodes: visibleNodes.sort(byLabel),
      hiddenCount: members.length - visibleNodes.length,
    };
  }).filter((group) => group.visibleNodes.length + group.hiddenCount > 0);
}

export function formatHiddenByFilters(count: number): string {
  return `${count} hidden by filters`;
}
