import React from "react";
import { InfoBlock } from "./ElementCard";
import "./RegisteredByInfoBlock.scss";

type RegisteredByResolver = {
  getRegisteredByResourceId?: (node: {
    id: string;
    registeredBy?: string | null;
  }) => string | null;
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
  const resolvedRegisteredBy =
    elementId && introspector?.getRegisteredByResourceId
      ? introspector.getRegisteredByResourceId({
          id: elementId,
          registeredBy,
        })
      : registeredBy;

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
        <a
          href={`#element-${resolvedRegisteredBy}`}
          className="registered-by-info__link"
        >
          {resolvedRegisteredBy}
        </a>
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
