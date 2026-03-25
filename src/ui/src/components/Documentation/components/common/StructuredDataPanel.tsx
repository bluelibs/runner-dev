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

  if (data !== null && typeof data === "object") {
    return <JsonViewer data={data} className={classes} />;
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
