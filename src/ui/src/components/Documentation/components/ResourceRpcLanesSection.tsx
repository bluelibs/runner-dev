import React from "react";
import { InfoBlock } from "./common/ElementCard";
import { SearchableList } from "./common/SearchableList";
import {
  collectRpcCommunicatorIds,
  getRpcLaneBindings,
  getRpcLaneProfiles,
  parseRpcLanesResourceConfig,
  type RpcLanesResourceConfigShape,
} from "../../../../../utils/lane-resources";

export interface ResourceRpcLanesSectionProps {
  resourceConfig: string | null | undefined;
}

export const ResourceRpcLanesSection: React.FC<
  ResourceRpcLanesSectionProps
> = ({ resourceConfig }) => {
  const rpcLanesConfig =
    React.useMemo<RpcLanesResourceConfigShape | null>(() => {
      return parseRpcLanesResourceConfig(resourceConfig);
    }, [resourceConfig]);

  const rpcLaneBindings = React.useMemo(() => {
    return getRpcLaneBindings(rpcLanesConfig);
  }, [rpcLanesConfig]);

  const rpcLaneProfiles = React.useMemo(() => {
    return getRpcLaneProfiles(rpcLanesConfig);
  }, [rpcLanesConfig]);

  const communicatorIds = React.useMemo(() => {
    return collectRpcCommunicatorIds(
      rpcLanesConfig,
      rpcLaneBindings,
      rpcLaneProfiles
    );
  }, [rpcLanesConfig, rpcLaneBindings, rpcLaneProfiles]);

  return (
    <>
      <InfoBlock prefix="resource-card" label="RPC Lanes Mode:">
        {rpcLanesConfig?.mode || "service"}
      </InfoBlock>
      <InfoBlock prefix="resource-card" label="RPC Lanes Profile:">
        {rpcLanesConfig?.profile || "unknown"}
      </InfoBlock>
      <InfoBlock prefix="resource-card" label="Lane Bindings:">
        {rpcLaneBindings.length}
      </InfoBlock>
      <InfoBlock prefix="resource-card" label="Communicators:">
        {communicatorIds.length > 0 ? communicatorIds.join(", ") : "(none)"}
      </InfoBlock>
      <InfoBlock prefix="resource-card" label="Bindings Detail:">
        {rpcLaneBindings.length > 0 ? (
          <div className="resource-card__rpc-lanes-list">
            {rpcLaneBindings.map((binding) => (
              <a
                key={`${binding.laneId}:${binding.communicatorId ?? "none"}`}
                href={`#element-${binding.laneId}`}
                className="resource-card__relation-item resource-card__relation-item--task resource-card__relation-link"
              >
                <div className="title title--task">{binding.laneId}</div>
                <div className="id">
                  communicator: {binding.communicatorId || "(not specified)"}
                </div>
              </a>
            ))}
          </div>
        ) : (
          "No bindings configured."
        )}
      </InfoBlock>
      <InfoBlock prefix="resource-card" label="Profiles:">
        {rpcLaneProfiles.length > 0 ? (
          <div className="resource-card__rpc-lanes-profiles">
            {rpcLaneProfiles.map((profile) => {
              const isActive = profile.profileId === rpcLanesConfig?.profile;
              return (
                <div
                  key={profile.profileId}
                  className="resource-card__rpc-lanes-profile"
                >
                  <div className="resource-card__rpc-lanes-profile__header">
                    <span
                      className={`resource-card__rpc-lanes-item__lane ${
                        isActive
                          ? "resource-card__rpc-lanes-item__lane--active"
                          : ""
                      }`}
                    >
                      {profile.profileId}
                    </span>
                    {profile.communicatorId && (
                      <span className="resource-card__rpc-lanes-profile__communicator">
                        communicator: {profile.communicatorId}
                      </span>
                    )}
                  </div>
                  <SearchableList
                    items={profile.serveLaneIds.map((id) => ({ id }))}
                    placeholder="Filter serve lanes..."
                    emptyMessage="No lanes match this search."
                    itemVariant="task"
                  />
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
