import React from "react";
import JsonViewer from "../JsonViewer";
import "./StructuredDataPanel.scss";

export interface StructuredDataPanelProps {
  data?: unknown;
  textValue?: string | null;
  className?: string;
  emptyLabel: string;
  emptyBadge?: string;
}

function isEmptyObjectValue(value: unknown): value is Record<string, never> {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).length === 0
  );
}

export const StructuredDataPanel: React.FC<StructuredDataPanelProps> = ({
  data,
  textValue,
  className,
  emptyLabel,
  emptyBadge = "Empty",
}) => {
  const classes = ["structured-data-panel", className]
    .filter(Boolean)
    .join(" ");
  const hasTextValue =
    typeof textValue === "string" && textValue.trim().length > 0;

  if (data && typeof data === "object" && !isEmptyObjectValue(data)) {
    return <JsonViewer data={data as object} className={classes} />;
  }

  if (hasTextValue) {
    return <pre className={classes}>{textValue}</pre>;
  }

  return (
    <div className={`${classes} structured-data-panel--empty`} role="status">
      <span className="structured-data-panel__badge">{emptyBadge}</span>
      <span className="structured-data-panel__message">{emptyLabel}</span>
    </div>
  );
};
