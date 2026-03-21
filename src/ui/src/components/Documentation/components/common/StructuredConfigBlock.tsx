import React from "react";
import JsonViewer from "../JsonViewer";
import { formatConfig } from "../../utils/formatting";

export interface StructuredConfigBlockProps {
  value?: string | null;
  className?: string;
  emptyLabel?: string;
}

function parseConfigValue(value?: string | null): object | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export const StructuredConfigBlock: React.FC<StructuredConfigBlockProps> = ({
  value,
  className,
  emptyLabel = "No configuration",
}) => {
  const parsedValue = React.useMemo(() => parseConfigValue(value), [value]);
  const hasValue = typeof value === "string" && value.trim().length > 0;

  if (!hasValue) {
    return <pre className={className}>{emptyLabel}</pre>;
  }

  if (parsedValue) {
    return <JsonViewer data={parsedValue} className={className} />;
  }

  return <pre className={className}>{formatConfig(value)}</pre>;
};
