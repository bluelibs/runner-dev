import React from "react";
import { formatConfig } from "../../utils/formatting";
import { StructuredDataPanel } from "./StructuredDataPanel";

export interface StructuredConfigBlockProps {
  value?: string | null;
  className?: string;
  emptyLabel?: string;
}

function parseConfigValue(value?: string | null): unknown | null {
  if (!value) return null;

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export const StructuredConfigBlock: React.FC<StructuredConfigBlockProps> = ({
  value,
  className,
  emptyLabel = "No configuration defined",
}) => {
  const parsedValue = React.useMemo(() => parseConfigValue(value), [value]);
  const hasRawValue = typeof value === "string" && value.trim().length > 0;
  const formattedValue = hasRawValue ? formatConfig(value) : null;
  const parsedObjectValue =
    parsedValue && typeof parsedValue === "object" ? parsedValue : undefined;

  return (
    <StructuredDataPanel
      className={className}
      data={parsedObjectValue}
      textValue={parsedObjectValue ? null : formattedValue}
      emptyLabel={emptyLabel}
      emptyBadge="Config"
    />
  );
};
