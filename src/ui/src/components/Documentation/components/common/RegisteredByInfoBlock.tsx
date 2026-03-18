import React from "react";
import { InfoBlock } from "./ElementCard";
import "./RegisteredByInfoBlock.scss";

export interface RegisteredByInfoBlockProps {
  prefix: string;
  registeredBy?: string | null;
  fallbackLabel?: React.ReactNode;
}

export const RegisteredByInfoBlock: React.FC<RegisteredByInfoBlockProps> = ({
  prefix,
  registeredBy,
  fallbackLabel = "Direct / root-level",
}) => {
  return (
    <InfoBlock
      prefix={prefix}
      label="Registered By:"
      valueClassName={
        !registeredBy ? "registered-by-info__value--fallback" : undefined
      }
    >
      {registeredBy ? (
        <a
          href={`#element-${registeredBy}`}
          className="registered-by-info__link"
        >
          {registeredBy}
        </a>
      ) : (
        <span className="registered-by-info__fallback">{fallbackLabel}</span>
      )}
    </InfoBlock>
  );
};
