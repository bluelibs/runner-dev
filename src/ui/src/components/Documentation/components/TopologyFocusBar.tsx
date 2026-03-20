import React from "react";
import { formatId } from "../utils/formatting";
import type {
  TopologyGraphNode,
  TopologyViewMode,
} from "../utils/topologyGraph";

export interface TopologyFocusBarProps {
  selectedNode: TopologyGraphNode;
  view: TopologyViewMode;
}

export const TopologyFocusBar: React.FC<TopologyFocusBarProps> = ({
  selectedNode,
  view,
}) => {
  const formattedPath = formatId(selectedNode.id);

  return (
    <div className="topology-panel__focus-bar">
      <div className="topology-panel__focus-meta">
        <span
          className={`topology-panel__kind topology-panel__kind--${selectedNode.kind}`}
        >
          {selectedNode.icon}
        </span>
        <div className="topology-panel__focus-copy">
          <div className="topology-panel__focus-title">{formattedPath}</div>
          <div className="topology-panel__focus-subtitle">
            {selectedNode.kind} · {selectedNode.label}
          </div>
        </div>
      </div>
      <div className="topology-panel__focus-actions">
        <span className="topology-panel__focus-chip topology-panel__focus-chip--calm">
          {view === "mindmap" ? "Mindmap" : "Blast radius"}
        </span>
        {selectedNode.pills.length > 0 ? (
          <span className="topology-panel__focus-chip">
            {selectedNode.pills[0]}
          </span>
        ) : null}
      </div>
    </div>
  );
};
