import type {
  TopologyGraphEdge,
  TopologyGraphNode,
} from "../utils/topologyGraph";

export interface TopologyRelationGroup {
  kind: TopologyGraphEdge["kind"];
  title: string;
  nodes: TopologyGraphNode[];
}

export interface TopologyImpactSummary {
  /** Downstream nodes: direct + transitive. Contract partners are not. */
  affected: number;
  direct: number;
  transitive: number;
  /** Emitters, throwers, providers: must still conform, not downstream. */
  contract: number;
  /** Affected nodes the current filters hide from the canvas. */
  hiddenAffected: number;
  /** Contract partners the current filters hide from the canvas. */
  hiddenContract: number;
}

type ImpactClass = "direct" | "transitive" | "contract";

function classifyImpact(node: TopologyGraphNode): ImpactClass {
  if (node.terminal) return "contract";
  return node.depth <= 1 ? "direct" : "transitive";
}

/**
 * Blast-lens counts over every non-focus node of the projection. Filters
 * only decide what the canvas shows, so hidden nodes still count (the true
 * downstream set) and are reported separately instead of silently dropped.
 */
export function summarizeImpact(
  nodes: TopologyGraphNode[]
): TopologyImpactSummary {
  const counts = { direct: 0, transitive: 0, contract: 0 };
  let hiddenAffected = 0;
  let hiddenContract = 0;
  for (const node of nodes) {
    if (node.isFocus) continue;
    const impactClass = classifyImpact(node);
    counts[impactClass] += 1;
    if (node.isVisible) continue;
    if (impactClass === "contract") hiddenContract += 1;
    else hiddenAffected += 1;
  }
  return {
    affected: counts.direct + counts.transitive,
    ...counts,
    hiddenAffected,
    hiddenContract,
  };
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

/** One-line blast summary for the fullscreen header (the hero is hidden there). */
export function formatBlastSubtitle(
  summary: TopologyImpactSummary,
  radius: number
): string {
  const parts = [`Blast radius · ${summary.affected} affected`];
  if (summary.hiddenAffected > 0) {
    parts.push(` (${formatHiddenByFilters(summary.hiddenAffected)})`);
  }
  parts.push(` within ${pluralize(radius, "hop")}`);
  if (summary.contract > 0) {
    parts.push(` · ${pluralize(summary.contract, "contract partner")}`);
  }
  return parts.join("");
}

function pluralize(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

export function buildRelationGroups(
  edges: TopologyGraphEdge[],
  nodesById: Map<string, TopologyGraphNode>,
  nodeId: string | null,
  direction: "outgoing" | "incoming"
): TopologyRelationGroup[] {
  if (!nodeId) return [];

  const matches = edges.filter((edge) =>
    direction === "outgoing"
      ? edge.sourceId === nodeId
      : edge.targetId === nodeId
  );

  const groups = new Map<TopologyGraphEdge["kind"], TopologyGraphNode[]>();
  for (const edge of matches) {
    const otherId = direction === "outgoing" ? edge.targetId : edge.sourceId;
    const node = nodesById.get(otherId);
    if (!node) continue;
    if (!groups.has(edge.kind)) groups.set(edge.kind, []);
    const bucket = groups.get(edge.kind);
    if (!bucket?.some((item) => item.id === node.id)) {
      bucket?.push(node);
    }
  }

  const order: TopologyGraphEdge["kind"][] =
    direction === "outgoing"
      ? [
          "registers",
          "registered-by",
          "depends-on",
          "emits",
          "listens-to",
          "uses-middleware",
          "overrides",
          "provided-by",
          "required-by",
          "used-by",
          "tagged",
          "thrown-by",
          "emitted-by",
          "listened-to-by",
        ]
      : [
          "registered-by",
          "listened-to-by",
          "emitted-by",
          "thrown-by",
          "required-by",
          "provided-by",
          "used-by",
          "uses-middleware",
          "overrides",
          "emits",
          "depends-on",
          "registers",
          "tagged",
          "listens-to",
        ];

  return order
    .filter((kind) => groups.has(kind))
    .map((kind) => ({
      kind,
      title: formatRelationTitle(kind, direction),
      nodes: (groups.get(kind) ?? [])
        .slice()
        .sort(
          (left, right) =>
            left.label.localeCompare(right.label) ||
            left.id.localeCompare(right.id)
        ),
    }));
}

export function formatRelationTitle(
  kind: TopologyGraphEdge["kind"],
  direction: "outgoing" | "incoming"
): string {
  switch (kind) {
    case "depends-on":
      return "Dependencies";
    case "emits":
      return "Emitted";
    case "listens-to":
      return "Listens To";
    case "listened-to-by":
      return "Listeners";
    case "registers":
      return direction === "incoming" ? "Registered By" : "Children";
    case "registered-by":
      return direction === "incoming" ? "Children" : "Registered By";
    case "uses-middleware":
      return "Middleware";
    case "overrides":
      return "Overrides";
    case "thrown-by":
      return "Thrown By";
    case "provided-by":
      return "Provided By";
    case "required-by":
      return "Required By";
    case "used-by":
      return "Used By";
    case "tagged":
      return "Tagged Elements";
    case "emitted-by":
      return "Emitters";
    default:
      return kind;
  }
}

export function buildEdgePath(
  source: TopologyGraphNode,
  target: TopologyGraphNode
): string {
  const dx = target.x - source.x;
  const curve = Math.max(60, Math.min(180, Math.abs(dx) * 0.35));
  const direction = dx >= 0 ? 1 : -1;
  const control1X = source.x + curve * direction;
  const control2X = target.x - curve * direction;
  return `M ${source.x} ${source.y} C ${control1X} ${source.y}, ${control2X} ${target.y}, ${target.x} ${target.y}`;
}
