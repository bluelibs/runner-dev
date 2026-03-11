import React from "react";
import { InfoBlock } from "./common/ElementCard";

type EventLaneLike = { id?: string } | string;
type EventLaneQueueLike = { id?: string; resource?: { id?: string } } | string;
type EventLanesResourceConfigShape = {
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
    profiles?: Record<string, { consume?: EventLaneLike[] }>;
  };
};

function toEventLaneId(lane: EventLaneLike | undefined): string {
  if (!lane) return "unknown";
  if (typeof lane === "string") return lane;
  return typeof lane.id === "string" ? lane.id : "unknown";
}

function toQueueId(queue: EventLaneQueueLike | undefined): string {
  if (!queue) return "inline queue";
  if (typeof queue === "string") return queue;
  if (typeof queue.id === "string") return queue.id;
  if (typeof queue.resource?.id === "string") return queue.resource.id;
  return "inline queue";
}

export interface ResourceEventLanesSectionProps {
  resourceConfig: string | null | undefined;
}

export const ResourceEventLanesSection: React.FC<
  ResourceEventLanesSectionProps
> = ({ resourceConfig }) => {
  const eventLanesConfig =
    React.useMemo<EventLanesResourceConfigShape | null>(() => {
      if (!resourceConfig) return null;
      try {
        return JSON.parse(resourceConfig) as EventLanesResourceConfigShape;
      } catch {
        return null;
      }
    }, [resourceConfig]);

  const eventLanesBindings = React.useMemo(() => {
    if (!eventLanesConfig?.topology?.bindings) return [];
    return eventLanesConfig.topology.bindings.map((binding) => ({
      laneId: toEventLaneId(binding.lane),
      queueId: toQueueId(binding.queue),
      prefetch:
        typeof binding.prefetch === "number" ? String(binding.prefetch) : null,
      dlqQueueId: binding.dlq?.queue ? toQueueId(binding.dlq.queue) : null,
    }));
  }, [eventLanesConfig]);

  const eventLanesProfiles = React.useMemo(() => {
    const rawProfiles = eventLanesConfig?.topology?.profiles;
    if (!rawProfiles || typeof rawProfiles !== "object") return [];
    return Object.entries(rawProfiles).map(([profileId, profile]) => ({
      profileId,
      consumeLaneIds: Array.isArray(profile?.consume)
        ? profile.consume.map((lane) => toEventLaneId(lane))
        : [],
    }));
  }, [eventLanesConfig]);

  return (
    <>
      <InfoBlock prefix="resource-card" label="Event Lanes Mode:">
        {eventLanesConfig?.mode || "consumer"}
      </InfoBlock>
      <InfoBlock prefix="resource-card" label="Event Lanes Profile:">
        {eventLanesConfig?.profile || "unknown"}
      </InfoBlock>
      <InfoBlock prefix="resource-card" label="Relay Source Prefix:">
        {eventLanesConfig?.topology?.relaySourcePrefix ||
          "runner.event-lanes.relay:"}
      </InfoBlock>
      <InfoBlock prefix="resource-card" label="Lane Bindings:">
        {eventLanesBindings.length}
      </InfoBlock>
      <InfoBlock prefix="resource-card" label="Bindings Detail:">
        {eventLanesBindings.length > 0 ? (
          <div className="resource-card__event-lanes-list">
            {eventLanesBindings.map((binding) => (
              <div
                key={`${binding.laneId}:${binding.queueId}`}
                className="resource-card__event-lanes-item"
              >
                <span className="resource-card__event-lanes-item__lane">
                  {binding.laneId}
                </span>
                <span>queue: {binding.queueId}</span>
                {binding.prefetch && <span>prefetch: {binding.prefetch}</span>}
                {binding.dlqQueueId && <span>dlq: {binding.dlqQueueId}</span>}
              </div>
            ))}
          </div>
        ) : (
          "No bindings configured."
        )}
      </InfoBlock>
      <InfoBlock prefix="resource-card" label="Profiles:">
        {eventLanesProfiles.length > 0 ? (
          <div className="resource-card__event-lanes-list">
            {eventLanesProfiles.map((profile) => {
              const isActive = profile.profileId === eventLanesConfig?.profile;
              return (
                <div
                  key={profile.profileId}
                  className="resource-card__event-lanes-item"
                >
                  <span
                    className={`resource-card__event-lanes-item__lane ${
                      isActive
                        ? "resource-card__event-lanes-item__lane--active"
                        : ""
                    }`}
                  >
                    {profile.profileId}
                  </span>
                  <span>
                    consume:{" "}
                    {profile.consumeLaneIds.length > 0
                      ? profile.consumeLaneIds.join(", ")
                      : "(none)"}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          "No profiles configured."
        )}
      </InfoBlock>
    </>
  );
};
