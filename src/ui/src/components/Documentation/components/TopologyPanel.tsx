import React from "react";
import {
  type Event,
  type Hook,
  type Middleware,
  type Resource,
  type Tag,
  type Task,
} from "../../../../../schema/model";
import { Introspector } from "../../../../../resources/models/Introspector";
import {
  buildTopologyProjection,
  collectSearchTopologyVisibleIds,
  type TopologyGraphNode,
  type TopologyViewMode,
} from "../utils/topologyGraph";
import {
  buildTopologyHash,
  DEFAULT_TOPOLOGY_RADIUS,
  defaultViewForKind,
  getDefaultTopologyFocus,
  parseTopologyHash,
} from "../utils/topologyGraph.state";
import { BaseModal } from "./modals";
import {
  buildInitialTopologyPanelState,
  normalizeTopologyRadius,
  persistTopologyPanelState,
  readStoredTopologyPanelState,
  type TopologyPanelState,
} from "./topologyPanelState";
import { TopologyPanelView } from "./TopologyPanelView";
import { getMatchingTopologyNodeIds } from "./topologyNavigator.utils";
import "./TopologyPanel.scss";

export interface TopologyPanelProps {
  introspector: Introspector;
  tasks: Task[];
  resources: Resource[];
  events: Event[];
  hooks: Hook[];
  middlewares: Middleware[];
  errors: Array<{ id: string }>;
  asyncContexts: Array<{ id: string }>;
  tags: Tag[];
}

export const TopologyPanel: React.FC<TopologyPanelProps> = ({
  introspector,
  tasks,
  resources,
  events,
  hooks,
  middlewares,
  errors,
  asyncContexts,
  tags,
}) => {
  const visibleIds = React.useMemo(() => {
    const ids = new Set<string>();
    for (const item of [
      ...tasks,
      ...resources,
      ...events,
      ...hooks,
      ...middlewares,
      ...errors,
      ...asyncContexts,
      ...tags,
    ] as Array<{ id: string }>) {
      ids.add(item.id);
    }
    return ids;
  }, [
    asyncContexts,
    events,
    hooks,
    middlewares,
    resources,
    tasks,
    tags,
    errors,
  ]);

  const initialState = React.useMemo<TopologyPanelState>(
    () => buildInitialTopologyPanelState(introspector),
    [introspector]
  );

  const [state, setState] = React.useState<TopologyPanelState>(initialState);
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [navigatorQuery, setNavigatorQuery] = React.useState("");
  const stateRef = React.useRef(state);
  React.useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const baseGraph = React.useMemo(
    () =>
      buildTopologyProjection(introspector, {
        focusId: state.focus.id,
        focusKind: state.focus.kind,
        view: state.view,
        radius: state.radius,
        autoOrder: state.autoOrder,
        visibleIds,
      }),
    [
      introspector,
      state.autoOrder,
      state.focus.id,
      state.focus.kind,
      state.radius,
      state.view,
      visibleIds,
    ]
  );

  const searchedVisibleIds = React.useMemo(() => {
    const matchingIds = getMatchingTopologyNodeIds(
      baseGraph.nodes,
      state.focus.id,
      navigatorQuery
    );
    if (!matchingIds) return visibleIds;

    return collectSearchTopologyVisibleIds(
      baseGraph.nodes,
      state.focus.id,
      matchingIds
    );
  }, [baseGraph.nodes, navigatorQuery, state.focus.id, visibleIds]);

  const graph = React.useMemo(
    () =>
      buildTopologyProjection(introspector, {
        focusId: state.focus.id,
        focusKind: state.focus.kind,
        view: state.view,
        radius: state.radius,
        autoOrder: state.autoOrder,
        visibleIds: searchedVisibleIds,
      }),
    [
      introspector,
      searchedVisibleIds,
      state.autoOrder,
      state.focus.id,
      state.focus.kind,
      state.radius,
      state.view,
    ]
  );

  const selectedNode = graph.selectedNode;
  const nodeMap = React.useMemo(
    () => new Map(graph.nodes.map((node) => [node.id, node] as const)),
    [graph.nodes]
  );
  const canOpenSelectedCard = nodeMap.has(selectedNode.id);

  const commitState = React.useCallback(
    (patch: Partial<TopologyPanelState>, updateHash = true) => {
      const next = {
        ...stateRef.current,
        ...patch,
      };
      stateRef.current = next;
      setState(next);
      persistTopologyPanelState(next);

      if (updateHash && typeof window !== "undefined") {
        const nextHash = buildTopologyHash({
          focus: next.focus,
          view: next.view,
        });
        if (window.location.hash !== nextHash) {
          window.location.hash = nextHash;
        }
      }
    },
    []
  );

  React.useEffect(() => {
    const handleHashChange = () => {
      const parsedHash = parseTopologyHash(window.location.hash);
      const storedState = readStoredTopologyPanelState();
      const current = stateRef.current;

      if (parsedHash?.focus) {
        const next: TopologyPanelState = {
          focus: parsedHash.focus,
          view: parsedHash.view ?? defaultViewForKind(parsedHash.focus.kind),
          radius: current.radius,
          autoOrder: current.autoOrder,
          isNavigatorOpen: current.isNavigatorOpen,
        };
        stateRef.current = next;
        setState(next);
        persistTopologyPanelState(next);
        return;
      }

      if (window.location.hash.startsWith("#topology")) {
        const next = storedState ?? {
          focus: getDefaultTopologyFocus(introspector) ?? current.focus,
          view: current.view,
          radius: current.radius,
          autoOrder: current.autoOrder,
          isNavigatorOpen: current.isNavigatorOpen,
        };
        stateRef.current = next;
        setState(next);
        persistTopologyPanelState(next);
      }
    };

    window.addEventListener("hashchange", handleHashChange);
    handleHashChange();
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, [introspector]);

  const setRadius = (radius: number) => {
    commitState(
      {
        radius: normalizeTopologyRadius(radius),
      },
      false
    );
  };

  const setView = (view: TopologyViewMode) => {
    commitState({ view }, true);
  };

  const toggleAutoOrder = () => {
    commitState(
      {
        autoOrder: !stateRef.current.autoOrder,
      },
      false
    );
  };

  const toggleNavigator = () => {
    commitState(
      {
        isNavigatorOpen: !stateRef.current.isNavigatorOpen,
      },
      false
    );
  };

  const refocus = (node: TopologyGraphNode) => {
    commitState(
      {
        focus: {
          kind: node.kind,
          id: node.id,
        },
      },
      true
    );
  };

  const resetToRoot = () => {
    const defaultFocus = getDefaultTopologyFocus(introspector) ?? state.focus;
    commitState(
      {
        focus: defaultFocus,
        view: defaultViewForKind(defaultFocus.kind),
        radius: DEFAULT_TOPOLOGY_RADIUS,
        autoOrder: true,
        isNavigatorOpen: stateRef.current.isNavigatorOpen,
      },
      false
    );
    if (typeof window !== "undefined") {
      const nextHash = buildTopologyHash({
        focus: defaultFocus,
        view: defaultViewForKind(defaultFocus.kind),
      });
      window.location.hash = nextHash;
    }
  };

  const openSelectedCard = () => {
    if (!canOpenSelectedCard) return;
    if (typeof window === "undefined") return;
    window.location.hash = `#element-${selectedNode.id}`;
  };

  const openFullscreen = () => setIsFullscreen(true);
  const closeFullscreen = () => setIsFullscreen(false);

  const fullscreenTitle = "Topology";
  const fullscreenSubtitle = `${
    state.view === "mindmap" ? "Mindmap" : "Blast radius"
  } · ${graph.summary.visibleNodes} visible nodes`;

  return (
    <>
      <section id="topology" className="docs-section topology-panel">
        <TopologyPanelView
          graph={graph}
          nodeMap={nodeMap}
          selectedNode={selectedNode}
          view={state.view}
          autoOrder={state.autoOrder}
          isNavigatorOpen={state.isNavigatorOpen}
          navigatorQuery={navigatorQuery}
          isFullscreen={isFullscreen}
          canOpenSelectedCard={canOpenSelectedCard}
          onSelectNode={refocus}
          onNavigatorQueryChange={setNavigatorQuery}
          onViewChange={setView}
          onRadiusChange={setRadius}
          onReset={resetToRoot}
          onOpenSelectedCard={openSelectedCard}
          onToggleFullscreen={openFullscreen}
          onToggleAutoOrder={toggleAutoOrder}
          onToggleNavigator={toggleNavigator}
        />
      </section>

      <BaseModal
        isOpen={isFullscreen}
        onClose={closeFullscreen}
        title={fullscreenTitle}
        subtitle={fullscreenSubtitle}
        size="fullscreen"
        className="topology-panel__modal"
        ariaLabel="Topology fullscreen view"
      >
        <div className="topology-panel topology-panel--fullscreen">
          <TopologyPanelView
            graph={graph}
            nodeMap={nodeMap}
            selectedNode={selectedNode}
            view={state.view}
            autoOrder={state.autoOrder}
            isNavigatorOpen={state.isNavigatorOpen}
            navigatorQuery={navigatorQuery}
            isFullscreen={isFullscreen}
            canOpenSelectedCard={canOpenSelectedCard}
            showHero={false}
            onSelectNode={refocus}
            onNavigatorQueryChange={setNavigatorQuery}
            onViewChange={setView}
            onRadiusChange={setRadius}
            onReset={resetToRoot}
            onOpenSelectedCard={openSelectedCard}
            onToggleFullscreen={closeFullscreen}
            onToggleAutoOrder={toggleAutoOrder}
            onToggleNavigator={toggleNavigator}
          />
        </div>
      </BaseModal>
    </>
  );
};
