import React from "react";
import { formatId } from "../utils/formatting";
import type { TopologyGraphNode } from "../utils/topologyGraph";
import { buildTopologyNavigatorEntries } from "./topologyNavigator.utils";

export interface TopologyNavigatorProps {
  nodes: TopologyGraphNode[];
  selectedNodeId: string;
  query: string;
  onQueryChange: (query: string) => void;
  onCollapse: () => void;
  onSelect: (node: TopologyGraphNode) => void;
}

export const TopologyNavigator: React.FC<TopologyNavigatorProps> = ({
  nodes,
  selectedNodeId,
  query,
  onQueryChange,
  onCollapse,
  onSelect,
}) => {
  const deferredQuery = React.useDeferredValue(query);
  const hasActiveQuery = deferredQuery.trim().length > 0;

  const allEntries = React.useMemo(
    () => buildTopologyNavigatorEntries(nodes, selectedNodeId, deferredQuery),
    [deferredQuery, nodes, selectedNodeId]
  );
  const entries = React.useMemo(() => allEntries.slice(0, 24), [allEntries]);
  const hasAdditionalMatches = allEntries.some(
    (entry) => entry.node.id !== selectedNodeId
  );
  const matchCount = hasActiveQuery
    ? Math.max(0, allEntries.length - 1)
    : nodes.length;
  const summaryLabel = hasActiveQuery
    ? `${matchCount} match${matchCount === 1 ? "" : "es"}`
    : `${matchCount} node${matchCount === 1 ? "" : "s"}`;

  return (
    <div className="topology-panel__detail-card topology-panel__detail-card--navigator">
      <div className="topology-panel__navigator-topbar">
        <div className="topology-panel__detail-kicker">Navigator</div>
        <button
          type="button"
          className="topology-panel__navigator-collapse"
          onClick={onCollapse}
          aria-label="Collapse navigator drawer"
          title="Collapse navigator"
        >
          &gt;&gt;
        </button>
      </div>
      <div className="topology-panel__navigator">
        <div className="topology-panel__navigator-header">
          <div>
            <div className="topology-panel__navigator-title">Find a node</div>
            <div className="topology-panel__navigator-hint">
              Search titles, ids, kinds, pills, and file paths when the mindmap
              gets crowded.
            </div>
          </div>
          <span className="topology-panel__navigator-count">
            {summaryLabel}
          </span>
        </div>

        <div className="topology-panel__navigator-search">
          <label
            className="topology-panel__navigator-search-label"
            htmlFor="topology-search"
          >
            Search
          </label>
          <div className="topology-panel__navigator-search-row">
            <input
              id="topology-search"
              type="search"
              value={query}
              placeholder="Type to narrow the graph"
              onChange={(event) => onQueryChange(event.target.value)}
            />
            {query.length > 0 && (
              <button
                type="button"
                className="topology-panel__navigator-clear"
                onClick={() => onQueryChange("")}
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {hasActiveQuery && !hasAdditionalMatches ? (
          <div className="topology-panel__navigator-empty">
            No additional matches. The selected node stays pinned for
            orientation.
          </div>
        ) : entries.length === 0 ? (
          <div className="topology-panel__navigator-empty">
            No nodes match <strong>{query}</strong>.
          </div>
        ) : (
          <div className="topology-panel__navigator-list">
            {entries.map((entry) => {
              const node = entry.node;
              const isSelected = node.id === selectedNodeId;
              const connections = node.incomingCount + node.outgoingCount;
              // Keep filtered nodes discoverable in the navigator, but label
              // them explicitly so the sidebar stays honest about visibility.
              const isHidden = !node.isVisible;

              return (
                <button
                  key={node.id}
                  type="button"
                  className={[
                    "topology-panel__navigator-item",
                    isSelected
                      ? "topology-panel__navigator-item--selected"
                      : "",
                    isHidden ? "topology-panel__navigator-item--hidden" : "",
                    entry.isMatch && hasActiveQuery
                      ? "topology-panel__navigator-item--match"
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => onSelect(node)}
                  title={node.description || node.subtitle}
                >
                  <div className="topology-panel__navigator-item-top">
                    <span
                      className={[
                        "topology-panel__kind",
                        `topology-panel__kind--${node.kind}`,
                      ].join(" ")}
                    >
                      {node.icon}
                    </span>
                    <div className="topology-panel__navigator-item-body">
                      <div className="topology-panel__navigator-item-title">
                        {node.label}
                      </div>
                      <div className="topology-panel__navigator-item-subtitle">
                        {formatId(node.id)}
                      </div>
                    </div>
                    {isSelected && (
                      <span className="topology-panel__navigator-item-badge">
                        Selected
                      </span>
                    )}
                    {isHidden && (
                      <span className="topology-panel__navigator-item-badge topology-panel__navigator-item-badge--hidden">
                        Hidden
                      </span>
                    )}
                  </div>

                  <div className="topology-panel__navigator-item-meta">
                    <span>{node.kind}</span>
                    <span>{node.isVisible ? "Visible" : "Hidden"}</span>
                    <span>{connections} links</span>
                    {node.hiddenNeighborCount > 0 && (
                      <span>+{node.hiddenNeighborCount} hidden</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
