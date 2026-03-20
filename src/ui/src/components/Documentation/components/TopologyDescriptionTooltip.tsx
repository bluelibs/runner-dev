import React from "react";
import { MarkdownRenderer } from "../utils/markdownUtils";
import { Tooltip } from "./Tooltip";

export interface TopologyDescriptionTooltipProps {
  description?: string | null;
  label: string;
  className?: string;
  position?: "top" | "bottom" | "left" | "right";
}

function stopTopologyTooltipEvent(
  event:
    | React.MouseEvent<HTMLButtonElement>
    | React.PointerEvent<HTMLButtonElement>
    | React.KeyboardEvent<HTMLButtonElement>
) {
  event.preventDefault();
  event.stopPropagation();
}

export const TopologyDescriptionTooltip: React.FC<
  TopologyDescriptionTooltipProps
> = ({ description, label, className = "", position = "top" }) => {
  const normalizedDescription = description?.trim();
  if (!normalizedDescription) return null;

  return (
    <Tooltip
      content={
        <MarkdownRenderer
          content={normalizedDescription}
          className="topology-panel__help-tooltip-markdown"
        />
      }
      position={position}
      delay={160}
      interactive
      tooltipClassName="topology-panel__help-tooltip"
    >
      <button
        type="button"
        className={["topology-panel__help-trigger", className]
          .filter(Boolean)
          .join(" ")}
        aria-label={`${label} description`}
        title={`Show ${label} description`}
        onClick={stopTopologyTooltipEvent}
        onPointerDown={stopTopologyTooltipEvent}
        onKeyDown={stopTopologyTooltipEvent}
      >
        ?
      </button>
    </Tooltip>
  );
};
