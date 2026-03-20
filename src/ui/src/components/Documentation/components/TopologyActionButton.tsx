import React from "react";
import {
  defaultViewForKind,
  openTopologyFocus,
  type TopologyFocus,
  type TopologyViewMode,
} from "../utils/topologyGraph.state";

export interface TopologyActionButtonProps {
  focus: TopologyFocus;
  label?: string;
  title?: string;
  view?: TopologyViewMode;
  className?: string;
}

export const TopologyActionButton: React.FC<TopologyActionButtonProps> = ({
  focus,
  label = "Topology",
  title = "Open topology view",
  view,
  className,
}) => {
  const resolvedView = view ?? defaultViewForKind(focus.kind);

  return (
    <button
      type="button"
      className={["btn", className].filter(Boolean).join(" ")}
      onClick={() => openTopologyFocus({ focus, view: resolvedView })}
      title={title}
    >
      {label}
    </button>
  );
};
