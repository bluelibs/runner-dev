export const EVENT_LANE_TAG_ID = "runner.tags.eventLane";
export const RPC_LANE_TAG_ID = "runner.tags.rpcLane";
export const EVENT_LANES_RESOURCE_ID = "runner.node.eventLanes";
export const EVENT_LANES_RESOURCE_TAG_ID = "runner.tags.eventLanes";
export const RPC_LANES_RESOURCE_ID = "runner.node.rpcLanes";
export const RPC_LANES_RESOURCE_TAG_ID = "runner.tags.rpcLanes";

type TagIds = string[] | null | undefined;

export type LaneResourceLike = {
  id: string;
  tags?: TagIds;
};

export type EventLaneApplyTargetLike = { id?: unknown } | string;
export type EventLaneLike = {
  id?: unknown;
  applyTo?: readonly EventLaneApplyTargetLike[];
  orderingKey?: unknown;
  metadata?: unknown;
} | string;
export type EventLaneHookLike = { id?: unknown } | string;
export type EventLaneQueueLike =
  | { id?: unknown; resource?: { id?: unknown } }
  | string;
export type EventLaneConsumeEntryLike = {
  lane?: EventLaneLike;
  hooks?: {
    only?: EventLaneHookLike[];
  };
};
export type RpcLaneLike = { id?: unknown } | string;
export type RpcCommunicatorLike = { id?: unknown } | string;

export type EventLaneSummaryLike = {
  laneId: string;
  orderingKey: string | null;
  metadata: string | null;
};

export type EventLaneBindingSummary = {
  laneId: string;
  queueId: string | null;
  prefetch: string | null;
  dlqQueueId: string | null;
};

export type EventLaneProfileSummary = {
  profileId: string;
  consume: Array<{
    laneId: string;
    hookAllowlistIds: string[];
  }>;
};

export type EventLanesResourceConfigShape = {
  mode?: string;
  profile?: string;
  topology?: {
    relaySourcePrefix?: string;
    bindings?: Array<{
      lane?: EventLaneLike;
      queue?: EventLaneQueueLike;
      prefetch?: number;
      dlq?: { queue?: EventLaneQueueLike };
    }>;
    profiles?: Record<
      string,
      {
        consume?: EventLaneConsumeEntryLike[];
      }
    >;
  };
};

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
  const expectedLocalId = tagId.split(".").pop();
  return tags.some(
    (candidate) =>
      candidate === tagId ||
      candidate.endsWith(`.${tagId}`) ||
      tagId.endsWith(`.${candidate}`) ||
      candidate.split(".").pop() === expectedLocalId
  );
}

export function isEventLanesResource(resource: LaneResourceLike): boolean {
  return (
    resource.id === EVENT_LANES_RESOURCE_ID ||
    resource.id === "eventLanes" ||
    resource.id.endsWith(".eventLanes") ||
    hasTag(resource.tags, EVENT_LANES_RESOURCE_TAG_ID)
  );
}

export function isRpcLanesResource(resource: LaneResourceLike): boolean {
  return (
    resource.id === RPC_LANES_RESOURCE_ID ||
    resource.id === "rpcLanes" ||
    resource.id.endsWith(".rpcLanes") ||
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

export function parseEventLanesResourceConfig(
  resourceConfig: string | null | undefined
): EventLanesResourceConfigShape | null {
  if (!resourceConfig) return null;
  try {
    return JSON.parse(resourceConfig) as EventLanesResourceConfigShape;
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

export function extractHookId(hookLike: unknown): string | null {
  if (typeof hookLike === "string") {
    const hookId = hookLike.trim();
    return hookId.length > 0 ? hookId : null;
  }

  if (!hookLike || typeof hookLike !== "object") return null;
  const candidateId = (hookLike as { id?: unknown }).id;
  if (typeof candidateId !== "string") return null;

  const hookId = candidateId.trim();
  return hookId.length > 0 ? hookId : null;
}

export function extractQueueId(queueLike: unknown): string | null {
  if (typeof queueLike === "string") {
    const queueId = queueLike.trim();
    return queueId.length > 0 ? queueId : null;
  }

  if (!queueLike || typeof queueLike !== "object") return null;
  const directId = (queueLike as { id?: unknown }).id;
  if (typeof directId === "string" && directId.trim().length > 0) {
    return directId.trim();
  }

  const resourceId = (queueLike as { resource?: { id?: unknown } }).resource?.id;
  if (typeof resourceId !== "string") return null;

  const queueId = resourceId.trim();
  return queueId.length > 0 ? queueId : null;
}

function stringifyMetadata(metadata: unknown): string | null {
  if (metadata == null) return null;
  if (typeof metadata === "string") return metadata;

  try {
    return JSON.stringify(metadata);
  } catch {
    return String(metadata);
  }
}

export function extractEventLaneSummary(
  laneLike: unknown
): EventLaneSummaryLike | null {
  const laneId = extractLaneId(laneLike);
  if (!laneId) return null;

  const laneConfig =
    laneLike && typeof laneLike === "object"
      ? (laneLike as {
          orderingKey?: unknown;
          metadata?: unknown;
        })
      : null;

  return {
    laneId,
    orderingKey:
      laneConfig?.orderingKey != null ? String(laneConfig.orderingKey) : null,
    metadata: stringifyMetadata(laneConfig?.metadata),
  };
}

export function extractEventLaneApplyToIds(laneLike: unknown): string[] {
  if (!laneLike || typeof laneLike !== "object") return [];
  const applyTo = (laneLike as { applyTo?: readonly unknown[] }).applyTo;
  if (!Array.isArray(applyTo)) return [];

  const eventIds = new Set<string>();
  for (const target of applyTo) {
    const eventId = extractLaneId(target);
    if (eventId) eventIds.add(eventId);
  }

  return Array.from(eventIds);
}

export function collectEventLaneSummaries(
  config: EventLanesResourceConfigShape | null | undefined
): Map<string, EventLaneSummaryLike> {
  const eventLaneByEventId = new Map<string, EventLaneSummaryLike>();
  if (!config) return eventLaneByEventId;

  const collectFromLane = (laneLike: unknown) => {
    const summary = extractEventLaneSummary(laneLike);
    if (!summary) return;

    for (const eventId of extractEventLaneApplyToIds(laneLike)) {
      if (!eventLaneByEventId.has(eventId)) {
        eventLaneByEventId.set(eventId, summary);
      }
    }
  };

  for (const binding of config.topology?.bindings ?? []) {
    collectFromLane(binding?.lane);
  }

  for (const profile of Object.values(config.topology?.profiles ?? {})) {
    for (const entry of profile?.consume ?? []) {
      collectFromLane(entry?.lane);
    }
  }

  return eventLaneByEventId;
}

export function collectEventLaneSummariesFromResourceConfig(
  resourceConfig: string | null | undefined
): Map<string, EventLaneSummaryLike> {
  return collectEventLaneSummaries(parseEventLanesResourceConfig(resourceConfig));
}

export function getEventLaneBindings(
  config: EventLanesResourceConfigShape | null | undefined
): EventLaneBindingSummary[] {
  const bindings = config?.topology?.bindings;
  if (!Array.isArray(bindings)) return [];

  return bindings.map((binding) => ({
    laneId: extractLaneId(binding?.lane) ?? "unknown",
    queueId: extractQueueId(binding?.queue),
    prefetch:
      typeof binding?.prefetch === "number" ? String(binding.prefetch) : null,
    dlqQueueId: binding?.dlq?.queue ? extractQueueId(binding.dlq.queue) : null,
  }));
}

export function getEventLaneProfiles(
  config: EventLanesResourceConfigShape | null | undefined
): EventLaneProfileSummary[] {
  const rawProfiles = config?.topology?.profiles;
  if (!rawProfiles || typeof rawProfiles !== "object") return [];

  return Object.entries(rawProfiles).map(([profileId, profile]) => ({
    profileId,
    consume: Array.isArray(profile?.consume)
      ? profile.consume.map((entry) => ({
          laneId: extractLaneId(entry?.lane) ?? "unknown",
          hookAllowlistIds: Array.isArray(entry?.hooks?.only)
            ? entry.hooks.only
                .map((hook) => extractHookId(hook))
                .filter((hookId): hookId is string => Boolean(hookId))
            : [],
        }))
      : [],
  }));
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
