import type {
  TopologyGraphEdge,
  TopologyGraphNode,
} from "../utils/topologyGraph";

export interface TopologyRelationGroup {
  kind: TopologyGraphEdge["kind"];
  title: string;
  nodes: TopologyGraphNode[];
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
