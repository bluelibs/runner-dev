import React from "react";
import type {
  TopologyGraphNode,
  TopologyGraphProjection,
  TopologyViewMode,
} from "../utils/topologyGraph";
import { TopologyCanvas } from "./TopologyCanvas";
import { DocIcon } from "./common/DocIcon";
import { TopologyFocusBar } from "./TopologyFocusBar";
import { TopologyDetailPanels, TopologySidebar } from "./TopologySidebar";
import { TopologyToolbar } from "./TopologyToolbar";
import { summarizeImpact } from "./topologyPanel.utils";

export interface TopologyPanelViewProps {
  graph: TopologyGraphProjection;
  nodeMap: Map<string, TopologyGraphNode>;
  selectedNode: TopologyGraphNode;
  view: TopologyViewMode;
  autoOrder: boolean;
  isNavigatorOpen: boolean;
  navigatorQuery: string;
  isFullscreen: boolean;
  canOpenSelectedCard: boolean;
  showHero?: boolean;
  onSelectNode: (node: TopologyGraphNode) => void;
  onNavigatorQueryChange: (query: string) => void;
  onViewChange: (view: TopologyViewMode) => void;
  onRadiusChange: (radius: number) => void;
  onReset: () => void;
  onOpenSelectedCard: () => void;
  onToggleFullscreen: () => void;
  onToggleAutoOrder: () => void;
  onToggleNavigator: () => void;
}

export const TopologyPanelView: React.FC<TopologyPanelViewProps> = ({
  graph,
  nodeMap,
  selectedNode,
  view,
  autoOrder,
  isNavigatorOpen,
  navigatorQuery,
  isFullscreen,
  canOpenSelectedCard,
  showHero = true,
  onSelectNode,
  onNavigatorQueryChange,
  onViewChange,
  onRadiusChange,
  onReset,
  onOpenSelectedCard,
  onToggleFullscreen,
  onToggleAutoOrder,
  onToggleNavigator,
}) => {
  return (
    <>
      {showHero && (
        <div className="topology-panel__hero">
          <div>
            <h2>
              <DocIcon name="topology" size={18} /> Topology
            </h2>
            <p>
              Explore task blast radius and resource mindmaps. Click any node to
              refocus, or jump to the original docs card when you want the full
              story.
            </p>
          </div>

          <div className="topology-panel__hero-stats">
            {view === "blast" ? (
              <BlastHeroStats nodes={graph.nodes} />
            ) : (
              <>
                <div className="topology-panel__stat">
                  <span className="label">Visible</span>
                  <span className="value">
                    {graph.summary.visibleNodes} nodes
                  </span>
                </div>
                <div className="topology-panel__stat">
                  <span className="label">Edges</span>
                  <span className="value">{graph.summary.visibleEdges}</span>
                </div>
                <div className="topology-panel__stat">
                  <span className="label">Hidden</span>
                  <span className="value">{graph.summary.hiddenNodes}</span>
                </div>
                <div className="topology-panel__stat">
                  <span className="label">Depth</span>
                  <span className="value">{graph.radius} hops</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <TopologyToolbar
        view={view}
        radius={graph.radius}
        autoOrder={autoOrder}
        isNavigatorOpen={isNavigatorOpen}
        canOpenSelectedCard={canOpenSelectedCard}
        onViewChange={onViewChange}
        onRadiusChange={onRadiusChange}
        onReset={onReset}
        onOpenSelectedCard={onOpenSelectedCard}
        onToggleAutoOrder={onToggleAutoOrder}
        onToggleNavigator={onToggleNavigator}
      />

      <TopologyFocusBar selectedNode={selectedNode} view={view} />

      <div
        className={[
          "topology-panel__layout",
          isNavigatorOpen
            ? "topology-panel__layout--navigator-open"
            : "topology-panel__layout--navigator-closed",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <TopologyCanvas
          graph={graph}
          selectedNodeId={selectedNode.id}
          isFullscreen={isFullscreen}
          onSelectNode={onSelectNode}
          onToggleFullscreen={onToggleFullscreen}
        />

        {isNavigatorOpen ? (
          <TopologySidebar
            selectedNode={selectedNode}
            nodes={graph.nodes}
            navigatorQuery={navigatorQuery}
            onNavigatorQueryChange={onNavigatorQueryChange}
            onCollapseNavigator={onToggleNavigator}
            onSelect={onSelectNode}
          />
        ) : (
          <button
            type="button"
            className="topology-panel__drawer-toggle"
            onClick={onToggleNavigator}
            aria-expanded={false}
            aria-label="Expand navigator drawer"
            title="Expand navigator"
          >
            <span className="topology-panel__drawer-toggle-text">&gt;&gt;</span>
          </button>
        )}
      </div>

      <TopologyDetailPanels
        edges={graph.edges}
        nodesById={nodeMap}
        selectedNode={selectedNode}
        view={view}
        onSelect={onSelectNode}
      />
    </>
  );
};

function BlastHeroStats({ nodes }: { nodes: TopologyGraphNode[] }) {
  const summary = summarizeImpact(nodes);
  const stats: Array<{ label: string; value: number; hint: string }> = [
    {
      label: "Affected",
      value: summary.affected,
      hint: "Downstream nodes: direct + transitive",
    },
    {
      label: "Direct",
      value: summary.direct,
      hint: "Behaves differently if the focus changes",
    },
    {
      label: "Transitive",
      value: summary.transitive,
      hint: "Affected further down the chain",
    },
    {
      label: "Contract partners",
      value: summary.contract,
      hint: "Not downstream, so not in Affected: emitters, throwers, providers that must still conform",
    },
    {
      label: "Hidden by filters",
      value: summary.hiddenAffected + summary.hiddenContract,
      hint: "Counted above, but hidden on the canvas by the current filters",
    },
  ];
  return (
    <>
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="topology-panel__stat"
          title={stat.hint}
        >
          <span className="label">{stat.label}</span>
          <span className="value">{stat.value}</span>
        </div>
      ))}
    </>
  );
}
