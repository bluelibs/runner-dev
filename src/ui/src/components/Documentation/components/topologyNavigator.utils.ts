import type { TopologyGraphNode } from "../utils/topologyGraph";

export interface TopologyNavigatorEntry {
  node: TopologyGraphNode;
  isMatch: boolean;
  relevance: number;
}

export function getMatchingTopologyNodeIds(
  nodes: TopologyGraphNode[],
  selectedNodeId: string,
  query: string
): Set<string> | null {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return null;

  const matchingIds = new Set<string>([selectedNodeId]);
  for (const node of nodes) {
    const match = matchTopologyNode(node, normalizedQuery);
    if (match.isMatch) {
      matchingIds.add(node.id);
    }
  }

  return matchingIds;
}

export function buildTopologyNavigatorEntries(
  nodes: TopologyGraphNode[],
  selectedNodeId: string,
  query: string
): TopologyNavigatorEntry[] {
  const normalizedQuery = query.trim().toLowerCase();
  const entries: TopologyNavigatorEntry[] = [];

  for (const node of nodes) {
    const match = matchTopologyNode(node, normalizedQuery);
    if (normalizedQuery && node.id !== selectedNodeId && !match.isMatch) {
      continue;
    }

    entries.push({
      node,
      isMatch: node.id === selectedNodeId ? true : match.isMatch,
      relevance: scoreTopologyNode(
        node,
        selectedNodeId,
        match,
        normalizedQuery
      ),
    });
  }

  return entries.sort(compareTopologyNavigatorEntries);
}

function compareTopologyNavigatorEntries(
  left: TopologyNavigatorEntry,
  right: TopologyNavigatorEntry
): number {
  return (
    right.relevance - left.relevance ||
    right.node.incomingCount +
      right.node.outgoingCount -
      (left.node.incomingCount + left.node.outgoingCount) ||
    left.node.depth - right.node.depth ||
    left.node.label.localeCompare(right.node.label)
  );
}

function scoreTopologyNode(
  node: TopologyGraphNode,
  selectedNodeId: string,
  match: TopologyNodeMatch,
  query: string
): number {
  if (!query) {
    return (
      (node.id === selectedNodeId ? 1000 : 0) +
      (node.isFocus ? 250 : 0) +
      node.incomingCount +
      node.outgoingCount -
      node.depth * 4
    );
  }

  const matchBonus = match.isExact ? 300 : match.rank === 1 ? 200 : 100;

  return (
    (node.id === selectedNodeId ? 1000 : 0) +
    matchBonus +
    node.incomingCount +
    node.outgoingCount -
    node.depth * 4
  );
}

interface TopologyNodeMatch {
  isMatch: boolean;
  isExact: boolean;
  rank: number;
}

function matchTopologyNode(
  node: TopologyGraphNode,
  query: string
): TopologyNodeMatch {
  if (!query) {
    return { isMatch: false, isExact: false, rank: 0 };
  }

  const haystack = [
    node.id,
    node.label,
    node.subtitle,
    node.description ?? "",
    node.kind,
    node.filePath ?? "",
    ...node.pills,
  ]
    .join(" ")
    .toLowerCase();

  const isExact =
    node.id.toLowerCase() === query || node.label.toLowerCase() === query;
  const isPrefix =
    node.id.toLowerCase().startsWith(query) ||
    node.label.toLowerCase().startsWith(query);
  const isMatch = isExact || isPrefix || haystack.includes(query);

  return {
    isMatch,
    isExact,
    rank: isExact ? 0 : isPrefix ? 1 : 2,
  };
}
