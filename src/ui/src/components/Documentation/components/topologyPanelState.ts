import {
  DEFAULT_TOPOLOGY_RADIUS,
  MAX_TOPOLOGY_RADIUS,
  defaultViewForKind,
  getDefaultTopologyFocus,
  parseTopologyHash,
  type TopologyFocus,
  type TopologyViewMode,
} from "../utils/topologyGraph.state";
import type { Introspector } from "../../../../../resources/models/Introspector";
export { MAX_TOPOLOGY_RADIUS } from "../utils/topologyGraph.state";

export interface TopologyPanelState {
  focus: TopologyFocus;
  view: TopologyViewMode;
  radius: number;
  autoOrder: boolean;
  isNavigatorOpen: boolean;
}

export const TOPOLOGY_PANEL_STORAGE_KEY = "docs-topology-state";
export const DEFAULT_TOPOLOGY_AUTO_ORDER = true;
export const DEFAULT_TOPOLOGY_NAVIGATOR_OPEN = true;

export function normalizeTopologyRadius(radius: number): number {
  return Math.max(1, Math.min(MAX_TOPOLOGY_RADIUS, Math.round(radius)));
}

export function buildInitialTopologyPanelState(
  introspector: Introspector
): TopologyPanelState {
  const parsedHash = parseTopologyHash(
    typeof window !== "undefined" ? window.location.hash : null
  );
  const storedState = readStoredTopologyPanelState();
  const defaultFocus = getDefaultTopologyFocus(introspector);
  const fallbackFocus = defaultFocus ?? {
    kind: "resource" as const,
    id: "topology.root",
  };
  const fallbackView =
    storedState?.view ?? defaultViewForKind(fallbackFocus.kind) ?? "blast";
  const fallbackAutoOrder =
    storedState?.autoOrder ?? DEFAULT_TOPOLOGY_AUTO_ORDER;
  const fallbackNavigatorOpen =
    storedState?.isNavigatorOpen ?? DEFAULT_TOPOLOGY_NAVIGATOR_OPEN;

  if (parsedHash?.focus) {
    return {
      focus: parsedHash.focus,
      view: parsedHash.view ?? defaultViewForKind(parsedHash.focus.kind),
      radius: storedState?.radius ?? DEFAULT_TOPOLOGY_RADIUS,
      autoOrder: fallbackAutoOrder,
      isNavigatorOpen: fallbackNavigatorOpen,
    };
  }

  if (storedState) {
    return storedState;
  }

  return {
    focus: fallbackFocus,
    view: fallbackView,
    radius: DEFAULT_TOPOLOGY_RADIUS,
    autoOrder: fallbackAutoOrder,
    isNavigatorOpen: fallbackNavigatorOpen,
  };
}

export function readStoredTopologyPanelState(): TopologyPanelState | null {
  try {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem(TOPOLOGY_PANEL_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<TopologyPanelState>;
    if (!parsed.focus?.id || !parsed.focus?.kind) return null;
    return {
      focus: parsed.focus,
      view: parsed.view === "mindmap" ? "mindmap" : "blast",
      radius: normalizeTopologyRadius(parsed.radius ?? DEFAULT_TOPOLOGY_RADIUS),
      autoOrder:
        typeof parsed.autoOrder === "boolean"
          ? parsed.autoOrder
          : DEFAULT_TOPOLOGY_AUTO_ORDER,
      isNavigatorOpen:
        typeof parsed.isNavigatorOpen === "boolean"
          ? parsed.isNavigatorOpen
          : DEFAULT_TOPOLOGY_NAVIGATOR_OPEN,
    };
  } catch {
    return null;
  }
}

export function persistTopologyPanelState(state: TopologyPanelState): void {
  try {
    if (typeof window === "undefined") return;
    localStorage.setItem(TOPOLOGY_PANEL_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* intentionally empty */
  }
}
