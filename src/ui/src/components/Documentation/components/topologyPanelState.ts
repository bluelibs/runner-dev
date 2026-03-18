import {
  DEFAULT_TOPOLOGY_RADIUS,
  MAX_TOPOLOGY_RADIUS,
  defaultViewForKind,
  getDefaultTopologyFocus,
  parseTopologyHash,
  type TopologyFocus,
  type TopologyViewMode,
} from "../utils/topologyGraph.state";
import type { TopologyFocusKind } from "../utils/topologyGraph";
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
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || !isRecord(parsed.focus)) return null;

    const focusId = parsed.focus.id;
    const focusKind = parsed.focus.kind;
    if (typeof focusId !== "string" || !isTopologyFocusKind(focusKind)) {
      return null;
    }

    return {
      focus: { id: focusId, kind: focusKind },
      view: parsed.view === "mindmap" ? "mindmap" : "blast",
      radius: normalizeTopologyRadius(
        typeof parsed.radius === "number"
          ? parsed.radius
          : DEFAULT_TOPOLOGY_RADIUS
      ),
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isTopologyFocusKind(value: unknown): value is TopologyFocusKind {
  switch (value) {
    case "task":
    case "resource":
    case "hook":
    case "event":
    case "middleware":
    case "error":
    case "asyncContext":
    case "tag":
      return true;
    default:
      return false;
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
