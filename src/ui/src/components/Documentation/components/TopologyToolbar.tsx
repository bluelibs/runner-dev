import React from "react";
import { MAX_TOPOLOGY_RADIUS } from "./topologyPanelState";
import type { TopologyViewMode } from "../utils/topologyGraph";

export interface TopologyToolbarProps {
  view: TopologyViewMode;
  radius: number;
  autoOrder: boolean;
  isNavigatorOpen: boolean;
  canOpenSelectedCard: boolean;
  onViewChange: (view: TopologyViewMode) => void;
  onRadiusChange: (radius: number) => void;
  onReset: () => void;
  onOpenSelectedCard: () => void;
  onToggleAutoOrder: () => void;
  onToggleNavigator: () => void;
}

export const TopologyToolbar: React.FC<TopologyToolbarProps> = ({
  view,
  radius,
  autoOrder,
  isNavigatorOpen,
  canOpenSelectedCard,
  onViewChange,
  onRadiusChange,
  onReset,
  onOpenSelectedCard,
  onToggleAutoOrder,
  onToggleNavigator,
}) => {
  return (
    <div className="topology-panel__toolbar">
      <div className="topology-panel__toolbar-group">
        <span className="topology-panel__toolbar-label">Lens</span>
        <button
          type="button"
          className={`topology-panel__pill ${
            view === "blast" ? "topology-panel__pill--active" : ""
          }`}
          onClick={() => onViewChange("blast")}
        >
          Blast Radius
        </button>
        <button
          type="button"
          className={`topology-panel__pill ${
            view === "mindmap" ? "topology-panel__pill--active" : ""
          }`}
          onClick={() => onViewChange("mindmap")}
        >
          Mindmap
        </button>
      </div>

      <div className="topology-panel__toolbar-group">
        <span className="topology-panel__toolbar-label">Depth</span>
        <input
          className="topology-panel__radius"
          type="range"
          min={1}
          max={MAX_TOPOLOGY_RADIUS}
          step={1}
          value={radius}
          onChange={(event) => onRadiusChange(Number(event.target.value))}
        />
        <span className="topology-panel__radius-value">{radius}</span>
      </div>

      <div className="topology-panel__toolbar-group">
        <span className="topology-panel__toolbar-label">Order</span>
        <button
          type="button"
          className={`topology-panel__pill ${
            autoOrder ? "topology-panel__pill--active" : ""
          }`}
          aria-pressed={autoOrder}
          onClick={onToggleAutoOrder}
        >
          Auto-order
        </button>
      </div>
      <div className="topology-panel__toolbar-group topology-panel__toolbar-group--actions">
        <button
          type="button"
          className="clean-button"
          onClick={onToggleNavigator}
        >
          {isNavigatorOpen ? "Collapse Navigator" : "Expand Navigator"}
        </button>
        <button type="button" className="clean-button" onClick={onReset}>
          Reset
        </button>
        <button
          type="button"
          className="clean-button"
          onClick={onOpenSelectedCard}
          disabled={!canOpenSelectedCard}
        >
          Open Card
        </button>
      </div>
    </div>
  );
};
