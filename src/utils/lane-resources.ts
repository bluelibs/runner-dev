export const EVENT_LANE_TAG_ID = "globals.tags.eventLane";
export const RPC_LANE_TAG_ID = "globals.tags.rpcLane";
export const EVENT_LANES_RESOURCE_ID = "globals.resources.node.eventLanes";
export const EVENT_LANES_RESOURCE_TAG_ID = "globals.tags.eventLanes";
export const RPC_LANES_RESOURCE_ID = "platform.node.resources.rpcLanes";
export const RPC_LANES_RESOURCE_TAG_ID = "globals.tags.rpcLanes";

type TagIds = string[] | null | undefined;

export type LaneResourceLike = {
  id: string;
  tags?: TagIds;
};

export type RpcLaneLike = { id?: unknown } | string;
export type RpcCommunicatorLike = { id?: unknown } | string;

export type RpcLanesResourceConfigShape = {
  mode?: string;
  profile?: string;
  communicator?: RpcCommunicatorLike;
  communicators?: RpcCommunicatorLike[];
  topology?: {
    bindings?: Array<{
      lane?: RpcLaneLike;
      communicator?: RpcCommunicatorLike;
      communicatorId?: string;
    }>;
    profiles?: Record<
      string,
      {
        serve?: RpcLaneLike[];
        communicator?: RpcCommunicatorLike;
        communicatorId?: string;
      }
    >;
  };
};

export type RpcLaneBindingSummary = {
  laneId: string;
  communicatorId: string | null;
};

export type RpcLaneProfileSummary = {
  profileId: string;
  serveLaneIds: string[];
  communicatorId: string | null;
};

function hasTag(tags: TagIds, tagId: string): boolean {
  if (!Array.isArray(tags)) return false;
  return tags.some((candidate) => candidate === tagId);
}

export function isEventLanesResource(resource: LaneResourceLike): boolean {
  return (
    resource.id === EVENT_LANES_RESOURCE_ID ||
    hasTag(resource.tags, EVENT_LANES_RESOURCE_TAG_ID)
  );
}

export function isRpcLanesResource(resource: LaneResourceLike): boolean {
  return (
    resource.id === RPC_LANES_RESOURCE_ID ||
    hasTag(resource.tags, RPC_LANES_RESOURCE_TAG_ID)
  );
}

export function parseRpcLanesResourceConfig(
  resourceConfig: string | null | undefined
): RpcLanesResourceConfigShape | null {
  if (!resourceConfig) return null;
  try {
    return JSON.parse(resourceConfig) as RpcLanesResourceConfigShape;
  } catch {
    return null;
  }
}

export function extractLaneId(laneLike: unknown): string | null {
  if (typeof laneLike === "string") {
    const laneId = laneLike.trim();
    return laneId.length > 0 ? laneId : null;
  }

  if (!laneLike || typeof laneLike !== "object") return null;
  const candidateId = (laneLike as { id?: unknown }).id;
  if (typeof candidateId !== "string") return null;

  const laneId = candidateId.trim();
  return laneId.length > 0 ? laneId : null;
}

export function extractCommunicatorId(
  communicatorLike: unknown
): string | null {
  if (typeof communicatorLike === "string") {
    const communicatorId = communicatorLike.trim();
    return communicatorId.length > 0 ? communicatorId : null;
  }

  if (!communicatorLike || typeof communicatorLike !== "object") return null;
  const candidateId = (communicatorLike as { id?: unknown }).id;
  if (typeof candidateId !== "string") return null;

  const communicatorId = candidateId.trim();
  return communicatorId.length > 0 ? communicatorId : null;
}

export function collectRpcLaneIds(
  config: RpcLanesResourceConfigShape | null | undefined
): Set<string> {
  const laneIds = new Set<string>();
  if (!config) return laneIds;

  const bindings = config.topology?.bindings;
  if (Array.isArray(bindings)) {
    for (const binding of bindings) {
      const laneId = extractLaneId(binding?.lane);
      if (laneId) laneIds.add(laneId);
    }
  }

  const profiles = config.topology?.profiles;
  if (profiles && typeof profiles === "object") {
    for (const profile of Object.values(profiles)) {
      const servedLanes = profile?.serve;
      if (!Array.isArray(servedLanes)) continue;
      for (const servedLane of servedLanes) {
        const laneId = extractLaneId(servedLane);
        if (laneId) laneIds.add(laneId);
      }
    }
  }

  return laneIds;
}

export function collectRpcLaneIdsFromResourceConfig(
  resourceConfig: string | null | undefined
): Set<string> {
  const config = parseRpcLanesResourceConfig(resourceConfig);
  return collectRpcLaneIds(config);
}

export function getRpcLaneBindings(
  config: RpcLanesResourceConfigShape | null | undefined
): RpcLaneBindingSummary[] {
  const bindings = config?.topology?.bindings;
  if (!Array.isArray(bindings)) return [];

  return bindings.map((binding) => ({
    laneId: extractLaneId(binding?.lane) ?? "unknown",
    communicatorId:
      binding?.communicatorId ?? extractCommunicatorId(binding?.communicator),
  }));
}

export function getRpcLaneProfiles(
  config: RpcLanesResourceConfigShape | null | undefined
): RpcLaneProfileSummary[] {
  const rawProfiles = config?.topology?.profiles;
  if (!rawProfiles || typeof rawProfiles !== "object") return [];

  return Object.entries(rawProfiles).map(([profileId, profile]) => ({
    profileId,
    serveLaneIds: Array.isArray(profile?.serve)
      ? profile.serve.map((lane) => extractLaneId(lane) ?? "unknown")
      : [],
    communicatorId:
      profile?.communicatorId ?? extractCommunicatorId(profile?.communicator),
  }));
}

export function collectRpcCommunicatorIds(
  config: RpcLanesResourceConfigShape | null | undefined,
  bindings: RpcLaneBindingSummary[] = getRpcLaneBindings(config),
  profiles: RpcLaneProfileSummary[] = getRpcLaneProfiles(config)
): string[] {
  const communicatorIds = new Set<string>();

  const topLevelCommunicator = extractCommunicatorId(config?.communicator);
  if (topLevelCommunicator) communicatorIds.add(topLevelCommunicator);

  if (Array.isArray(config?.communicators)) {
    for (const communicator of config.communicators) {
      const communicatorId = extractCommunicatorId(communicator);
      if (communicatorId) communicatorIds.add(communicatorId);
    }
  }

  for (const binding of bindings) {
    if (binding.communicatorId) communicatorIds.add(binding.communicatorId);
  }

  for (const profile of profiles) {
    if (profile.communicatorId) communicatorIds.add(profile.communicatorId);
  }

  return Array.from(communicatorIds);
}
