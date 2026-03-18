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
  return (
    <div className="topology-panel__focus-bar">
      <div className="topology-panel__focus-meta">
        <span
          className={`topology-panel__kind topology-panel__kind--${selectedNode.kind}`}
        >
          {selectedNode.icon}
        </span>
        <div>
          <div className="topology-panel__focus-title">
            {selectedNode.label}
          </div>
          <div className="topology-panel__focus-subtitle">
            {formatId(selectedNode.id)}
          </div>
        </div>
      </div>
      <div className="topology-panel__focus-actions">
        <span className="topology-panel__focus-chip topology-panel__focus-chip--calm">
          {view === "mindmap" ? "Mindmap" : "Blast radius"}
        </span>
        <span className="topology-panel__focus-chip">
          {selectedNode.pills[0] ?? "neutral"}
        </span>
      </div>
    </div>
  );
};
