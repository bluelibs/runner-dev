import React from "react";
import { formatFilePath } from "../utils/formatting";
import type {
  TopologyGraphEdge,
  TopologyGraphNode,
} from "../utils/topologyGraph";
import { TopologyNavigator } from "./TopologyNavigator";
import {
  buildRelationGroups,
  type TopologyRelationGroup,
} from "./topologyPanel.utils";

export interface TopologySidebarProps {
  edges: TopologyGraphEdge[];
  nodesById: Map<string, TopologyGraphNode>;
  selectedNode: TopologyGraphNode;
  nodes: TopologyGraphNode[];
  navigatorQuery: string;
  onNavigatorQueryChange: (query: string) => void;
  onCollapseNavigator: () => void;
  onSelect: (node: TopologyGraphNode) => void;
}

export const TopologySidebar: React.FC<TopologySidebarProps> = ({
  edges,
  nodesById,
  selectedNode,
  nodes,
  navigatorQuery,
  onNavigatorQueryChange,
  onCollapseNavigator,
  onSelect,
}) => {
  const outgoingGroups = React.useMemo(
    () =>
      buildRelationGroups(
        edges,
        nodesById,
        selectedNode?.id ?? null,
        "outgoing"
      ),
    [edges, nodesById, selectedNode?.id]
  );
  const incomingGroups = React.useMemo(
    () =>
      buildRelationGroups(
        edges,
        nodesById,
        selectedNode?.id ?? null,
        "incoming"
      ),
    [edges, nodesById, selectedNode?.id]
  );

  return (
    <aside className="topology-panel__detail">
      <TopologyNavigator
        nodes={nodes}
        selectedNodeId={selectedNode.id}
        query={navigatorQuery}
        onQueryChange={onNavigatorQueryChange}
        onCollapse={onCollapseNavigator}
        onSelect={onSelect}
      />

      <div className="topology-panel__detail-card">
        <div className="topology-panel__detail-header">
          <div>
            <div className="topology-panel__detail-kicker">Selected</div>
            <h3>{selectedNode.label}</h3>
          </div>
          <span
            className={[
              "topology-panel__detail-visibility",
              `topology-panel__detail-visibility--${selectedNode.visibility}`,
            ].join(" ")}
          >
            {selectedNode.visibility}
          </span>
        </div>

        <p className="topology-panel__detail-description">
          {selectedNode.description || "No description available."}
        </p>

        <div className="topology-panel__detail-meta">
          <div>
            <span className="label">ID</span>
            <span className="value">{selectedNode.id}</span>
          </div>
          {selectedNode.filePath && (
            <div>
              <span className="label">File</span>
              <span className="value">
                {formatFilePath(selectedNode.filePath)}
              </span>
            </div>
          )}
          <div>
            <span className="label">Depth</span>
            <span className="value">{selectedNode.depth}</span>
          </div>
          <div>
            <span className="label">Connections</span>
            <span className="value">
              {selectedNode.incomingCount + selectedNode.outgoingCount}
            </span>
          </div>
        </div>

        {selectedNode.pills.length > 0 && (
          <div className="topology-panel__detail-pills">
            {selectedNode.pills.map((pill) => (
              <span key={pill} className="topology-panel__detail-pill">
                {pill}
              </span>
            ))}
          </div>
        )}
      </div>

      <TopologyRelationPanel
        title="Outgoing"
        groups={outgoingGroups}
        onSelect={onSelect}
      />

      <TopologyRelationPanel
        title="Incoming"
        groups={incomingGroups}
        onSelect={onSelect}
      />

      <div className="topology-panel__detail-card topology-panel__detail-card--ghost">
        <div className="topology-panel__detail-kicker">Legend</div>
        <TopologyLegend />
      </div>
    </aside>
  );
};

function TopologyRelationPanel({
  title,
  groups,
  onSelect,
}: {
  title: string;
  groups: TopologyRelationGroup[];
  onSelect: (node: TopologyGraphNode) => void;
}) {
  if (groups.length === 0) return null;

  return (
    <div className="topology-panel__detail-card topology-panel__detail-card--relations">
      <div className="topology-panel__detail-kicker">{title}</div>
      <div className="topology-panel__relations">
        {groups.map((group) => (
          <div key={group.kind} className="topology-panel__relation-group">
            <div className="topology-panel__relation-group-title">
              {group.title}
            </div>
            <div className="topology-panel__relation-group-items">
              {group.nodes.map((node) => (
                <button
                  key={node.id}
                  type="button"
                  className="topology-panel__relation-chip"
                  onClick={() => onSelect(node)}
                  title={node.description || node.subtitle}
                >
                  <span className="icon">{node.icon}</span>
                  <span className="label">{node.label}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TopologyLegend() {
  return (
    <div className="topology-panel__legend">
      <div className="topology-panel__legend-row">
        <span className="topology-panel__legend-swatch topology-panel__legend-swatch--primary" />
        <span>Primary path</span>
      </div>
      <div className="topology-panel__legend-row">
        <span className="topology-panel__legend-swatch topology-panel__legend-swatch--cross" />
        <span>Cross-link</span>
      </div>
    </div>
  );
}
