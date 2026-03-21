const TYPE_BUCKET_SEGMENTS = new Set([
  "tasks",
  "resources",
  "events",
  "hooks",
  "middlewares",
  "tags",
  "errors",
  "asyncContexts",
]);

export interface OverviewIdElement {
  id: string;
  registeredBy?: string | null;
}

export interface OverviewIdResource {
  id: string;
  registeredBy?: string | null;
}

export interface OverviewDisplayId {
  collapsedSegments: string[];
  fullSegments: string[];
  hasHiddenAncestors: boolean;
}

function collapseToLastTwoSegments(segments: string[]): OverviewDisplayId {
  if (segments.length <= 2) {
    return {
      collapsedSegments: segments,
      fullSegments: segments,
      hasHiddenAncestors: false,
    };
  }

  return {
    collapsedSegments: segments.slice(-2),
    fullSegments: segments,
    hasHiddenAncestors: true,
  };
}

function stripTypeBuckets(id: string): string[] {
  return id
    .split(".")
    .filter(Boolean)
    .filter((segment) => !TYPE_BUCKET_SEGMENTS.has(segment));
}

function getLeafLabel(id: string): string {
  const stripped = stripTypeBuckets(id);
  if (stripped.length > 0) return stripped[stripped.length - 1];

  const rawSegments = id.split(".").filter(Boolean);
  return rawSegments[rawSegments.length - 1] ?? id;
}

function getOwnerChain(
  ownerId: string | null | undefined,
  resources: OverviewIdResource[]
): string[] {
  if (!ownerId) return [];

  const resourceMap = new Map(
    resources.map((resource) => [resource.id, resource])
  );
  const chain: string[] = [];
  const visited = new Set<string>();
  let currentOwnerId: string | null | undefined = ownerId;

  while (currentOwnerId && !visited.has(currentOwnerId)) {
    visited.add(currentOwnerId);
    chain.push(currentOwnerId);
    currentOwnerId = resourceMap.get(currentOwnerId)?.registeredBy;
  }

  return chain;
}

export function getOverviewDisplayId(
  element: OverviewIdElement,
  resources: OverviewIdResource[]
): OverviewDisplayId {
  const leafLabel = getLeafLabel(element.id);
  const ownerChain = getOwnerChain(element.registeredBy, resources);

  if (ownerChain.length > 0) {
    const ownerLabels = ownerChain.map((ownerId) => getLeafLabel(ownerId));
    const fullSegments = [...ownerLabels.slice().reverse(), leafLabel];
    return collapseToLastTwoSegments(fullSegments);
  }

  const fallbackSegments = stripTypeBuckets(element.id);
  return collapseToLastTwoSegments(
    fallbackSegments.length > 0 ? fallbackSegments : [element.id]
  );
}

export function formatOverviewDisplayId(
  element: OverviewIdElement,
  resources: OverviewIdResource[]
): string {
  const displayId = getOverviewDisplayId(element, resources);
  const collapsedPrefix = displayId.hasHiddenAncestors ? "..." : null;
  const segments = collapsedPrefix
    ? [collapsedPrefix, ...displayId.collapsedSegments]
    : displayId.collapsedSegments;

  return segments.join(">");
}
