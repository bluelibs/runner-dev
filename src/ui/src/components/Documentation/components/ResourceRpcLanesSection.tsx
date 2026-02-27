import React from "react";
import { InfoBlock } from "./common/ElementCard";
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
              <div
                key={`${binding.laneId}:${binding.communicatorId ?? "none"}`}
                className="resource-card__rpc-lanes-item"
              >
                <span className="resource-card__rpc-lanes-item__lane">
                  {binding.laneId}
                </span>
                <span>
                  communicator: {binding.communicatorId || "(not specified)"}
                </span>
              </div>
            ))}
          </div>
        ) : (
          "No bindings configured."
        )}
      </InfoBlock>
      <InfoBlock prefix="resource-card" label="Profiles:">
        {rpcLaneProfiles.length > 0 ? (
          <div className="resource-card__rpc-lanes-list">
            {rpcLaneProfiles.map((profile) => {
              const isActive = profile.profileId === rpcLanesConfig?.profile;
              return (
                <div
                  key={profile.profileId}
                  className="resource-card__rpc-lanes-item"
                >
                  <span
                    className={`resource-card__rpc-lanes-item__lane ${
                      isActive
                        ? "resource-card__rpc-lanes-item__lane--active"
                        : ""
                    }`}
                  >
                    {profile.profileId}
                  </span>
                  <span>
                    serve:{" "}
                    {profile.serveLaneIds.length > 0
                      ? profile.serveLaneIds.join(", ")
                      : "(none)"}
                  </span>
                  {profile.communicatorId && (
                    <span>communicator: {profile.communicatorId}</span>
                  )}
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
