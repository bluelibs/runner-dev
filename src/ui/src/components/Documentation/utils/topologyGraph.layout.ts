import type { TopologyFocusKind } from "./topologyGraph";

export interface TopologyLayoutNode {
  id: string;
  kind: TopologyFocusKind;
  title: string;
  x: number;
  y: number;
  depth: number;
  order: number;
  parentId: string | null;
  isFocus: boolean;
}

export function layoutBlast(
  nodes: TopologyLayoutNode[],
  focusId: string,
  autoOrder: boolean
): void {
  const layers = new Map<number, TopologyLayoutNode[]>();
  for (const node of nodes) {
    const layer = node.depth;
    if (!layers.has(layer)) layers.set(layer, []);
    layers.get(layer)?.push(node);
  }

  const maxLayer = Math.max(...layers.keys(), 0);
  const densestLayer = Math.max(
    ...Array.from(layers.values(), (items) => items.length),
    1
  );
  const layerGap = Math.max(300, 220 + densestLayer * 18);
  const stageHeight = Math.max(760, 440 + densestLayer * 180);
  const startX = 260;
  const endX = startX + Math.max(1, maxLayer) * layerGap;
  const layerSpan = Math.max(1, maxLayer);
  const centerY = stageHeight / 2;

  for (const [layer, layerNodes] of layers.entries()) {
    const x = startX + ((endX - startX) * layer) / layerSpan;
    const sorted = layerNodes.slice().sort((a, b) => {
      return compareTopologyLayoutNodes(a, b, autoOrder);
    });
    const count = sorted.length;
    const preferredStep = count <= 2 ? 220 : count === 3 ? 190 : 170;
    const availableSpan = Math.max(0, stageHeight - 320);
    const totalHeight =
      count > 1 ? Math.min((count - 1) * preferredStep, availableSpan) : 0;
    const yStart = centerY - totalHeight / 2;
    const yStep = count > 1 ? totalHeight / (count - 1) : 0;

    for (let index = 0; index < sorted.length; index++) {
      const node = sorted[index];
      node.x = x;
      node.y = count === 1 ? centerY : yStart + index * yStep;
      if (node.isFocus) {
        node.x = Math.min(205, node.x);
        node.y = centerY;
      }
    }
  }

  const focusNode = nodes.find((node) => node.id === focusId);
  if (focusNode) {
    focusNode.x = 170;
    focusNode.y = centerY;
  }

  relaxCollisions(nodes, {
    minHorizontalGap: 220,
    minVerticalGap: 160,
    maxIterations: 10,
  });
}

export function layoutMindmap(
  nodes: TopologyLayoutNode[],
  focusId: string,
  autoOrder: boolean
): void {
  const childrenByParent = new Map<string, TopologyLayoutNode[]>();
  const nodeById = new Map(nodes.map((node) => [node.id, node] as const));
  const root = nodeById.get(focusId);
  if (!root) return;

  for (const node of nodes) {
    const parentId = node.parentId;
    if (!parentId) continue;
    if (!childrenByParent.has(parentId)) {
      childrenByParent.set(parentId, []);
    }
    childrenByParent.get(parentId)?.push(node);
  }

  const weights = new Map<string, number>();
  const computeWeight = (nodeId: string): number => {
    const cached = weights.get(nodeId);
    if (cached !== undefined) return cached;
    const children = childrenByParent.get(nodeId) ?? [];
    if (children.length === 0) {
      weights.set(nodeId, 1);
      return 1;
    }
    const total = children.reduce(
      (sum, child) => sum + computeWeight(child.id),
      1
    );
    weights.set(nodeId, total);
    return total;
  };

  computeWeight(focusId);

  const baseRadius = 0;
  const widestLevel = Math.max(
    1,
    ...Array.from(childrenByParent.values(), (items) => items.length)
  );
  const ringStep = Math.max(210, 150 + widestLevel * 18);

  const assign = (
    nodeId: string,
    startAngle: number,
    endAngle: number,
    depth: number
  ) => {
    const node = nodeById.get(nodeId);
    if (!node) return;

    const angle = (startAngle + endAngle) / 2;
    const radius = depth === 0 ? baseRadius : 165 + (depth - 1) * ringStep;
    node.x = 500 + radius * Math.cos(angle);
    node.y = 500 + radius * Math.sin(angle);

    const children = (childrenByParent.get(nodeId) ?? [])
      .slice()
      .sort((a, b) => {
        return compareTopologyLayoutNodes(a, b, autoOrder);
      });
    if (children.length === 0) return;

    const totalWeight = children.reduce(
      (sum, child) => sum + (weights.get(child.id) ?? 1),
      0
    );
    let cursor = startAngle;
    for (const child of children) {
      const share = (weights.get(child.id) ?? 1) / totalWeight;
      const nextEnd = cursor + share * (endAngle - startAngle);
      assign(child.id, cursor, nextEnd, depth + 1);
      cursor = nextEnd;
    }
  };

  assign(focusId, -Math.PI / 2, (3 * Math.PI) / 2, 0);

  const maxDepth = Math.max(...nodes.map((node) => node.depth), 0);
  for (const node of nodes) {
    if (node.id === focusId) continue;
    const effectiveRadius =
      node.depth === 0 ? 0 : 165 + (node.depth - 1) * ringStep;
    if (effectiveRadius > 0 && node.depth === maxDepth) {
      const angle = Math.atan2(node.y - 500, node.x - 500);
      const bumpedRadius = effectiveRadius + 20;
      node.x = 500 + bumpedRadius * Math.cos(angle);
      node.y = 500 + bumpedRadius * Math.sin(angle);
    }
  }

  relaxCollisions(nodes, {
    minHorizontalGap: 210,
    minVerticalGap: 170,
    maxIterations: 12,
  });
}

function compareTopologyLayoutNodes(
  left: TopologyLayoutNode,
  right: TopologyLayoutNode,
  autoOrder: boolean
): number {
  if (left.isFocus) return -1;
  if (right.isFocus) return 1;

  if (autoOrder) {
    return (
      kindRank(left.kind) - kindRank(right.kind) ||
      left.title.localeCompare(right.title) ||
      left.order - right.order ||
      left.id.localeCompare(right.id)
    );
  }

  return (
    kindRank(left.kind) - kindRank(right.kind) ||
    left.order - right.order ||
    left.title.localeCompare(right.title) ||
    left.id.localeCompare(right.id)
  );
}

function relaxCollisions(
  nodes: TopologyLayoutNode[],
  options: {
    minHorizontalGap: number;
    minVerticalGap: number;
    maxIterations: number;
  }
): void {
  for (let iteration = 0; iteration < options.maxIterations; iteration++) {
    let moved = false;

    for (let index = 0; index < nodes.length; index++) {
      const left = nodes[index];
      if (!left) continue;

      for (
        let innerIndex = index + 1;
        innerIndex < nodes.length;
        innerIndex++
      ) {
        const right = nodes[innerIndex];
        if (!right) continue;

        const dx = right.x - left.x;
        const dy = right.y - left.y;
        const horizontalOverlap = options.minHorizontalGap - Math.abs(dx);
        const verticalOverlap = options.minVerticalGap - Math.abs(dy);

        if (horizontalOverlap <= 0 || verticalOverlap <= 0) continue;

        moved = true;
        const pushX = horizontalOverlap / 2;
        const pushY = verticalOverlap / 2;
        const directionX = dx >= 0 ? 1 : -1;
        const directionY = dy >= 0 ? 1 : -1;

        if (!left.isFocus) {
          left.x -= pushX * directionX;
          left.y -= pushY * directionY;
        }

        if (!right.isFocus) {
          right.x += pushX * directionX;
          right.y += pushY * directionY;
        }
      }
    }

    if (!moved) return;
  }
}

function kindRank(kind: TopologyFocusKind): number {
  switch (kind) {
    case "resource":
      return 0;
    case "task":
      return 1;
    case "hook":
      return 2;
    case "event":
      return 3;
    case "middleware":
      return 4;
    case "asyncContext":
      return 5;
    case "error":
      return 6;
    case "tag":
      return 7;
    default:
      return 99;
  }
}
