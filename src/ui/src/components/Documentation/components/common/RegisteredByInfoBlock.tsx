import React from "react";
import { InfoBlock } from "./ElementCard";
import { OverviewIdLink, type OverviewIdResource } from "./OverviewIdLink";
import "./RegisteredByInfoBlock.scss";

type RegisteredByResolver = {
  getRegisteredByResourceId?: (node: {
    id: string;
    registeredBy?: string | null;
  }) => string | null;
  getRegisteredByResource?: (node: {
    id: string;
    registeredBy?: string | null;
  }) => OverviewIdResource | null;
  getResources?: () => OverviewIdResource[];
};

export interface RegisteredByInfoBlockProps {
  prefix: string;
  elementId?: string;
  registeredBy?: string | null;
  introspector?: RegisteredByResolver;
  fallbackLabel?: React.ReactNode;
  isCurrentRootResource?: boolean;
}

export const RegisteredByInfoBlock: React.FC<RegisteredByInfoBlockProps> = ({
  prefix,
  elementId,
  registeredBy,
  introspector,
  fallbackLabel = "Registration source unavailable",
  isCurrentRootResource = false,
}) => {
  const owner =
    elementId && introspector?.getRegisteredByResource
      ? introspector.getRegisteredByResource({
          id: elementId,
          registeredBy,
        })
      : null;
  const resolvedRegisteredBy =
    owner?.id ??
    (elementId && introspector?.getRegisteredByResourceId
      ? introspector.getRegisteredByResourceId({
          id: elementId,
          registeredBy,
        })
      : registeredBy);
  const resources = introspector?.getResources?.() ?? [];

  return (
    <InfoBlock
      prefix={prefix}
      label="Registered By:"
      valueClassName={
        !resolvedRegisteredBy
          ? "registered-by-info__value--fallback"
          : undefined
      }
    >
      {resolvedRegisteredBy ? (
        <OverviewIdLink
          element={
            owner
              ? { id: owner.id, registeredBy: owner.registeredBy ?? null }
              : { id: resolvedRegisteredBy, registeredBy: null }
          }
          resources={resources}
          href={`#element-${resolvedRegisteredBy}`}
        />
      ) : isCurrentRootResource ? (
        <span className="registered-by-info__fallback">
          Root-level registration
        </span>
      ) : (
        <span className="registered-by-info__fallback">{fallbackLabel}</span>
      )}
    </InfoBlock>
  );
};
