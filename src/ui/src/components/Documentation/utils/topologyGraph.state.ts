import { Introspector } from "../../../../../resources/models/Introspector";
import {
  type TopologyFocus,
  type TopologyFocusKind,
  type TopologyHashState,
  type TopologyViewMode,
} from "./topologyGraph";

export const TOPOLOGY_STORAGE_KEY = "docs-topology-state";
export const DEFAULT_TOPOLOGY_RADIUS = 2;
export const MAX_TOPOLOGY_RADIUS = 4;

export function getDefaultTopologyState(
  introspector: Introspector
): TopologyHashState {
  const focus = getDefaultTopologyFocus(introspector);
  return {
    focus,
    view: focus?.kind === "resource" ? "mindmap" : "blast",
  };
}

export function getDefaultTopologyFocus(
  introspector: Introspector
): TopologyFocus | null {
  const root = safeGetRoot(introspector);
  if (root) {
    return { kind: "resource", id: root.id };
  }

  const firstTask = introspector.getTasks()[0];
  if (firstTask) return { kind: "task", id: firstTask.id };

  const firstResource = introspector.getResources()[0];
  if (firstResource) return { kind: "resource", id: firstResource.id };

  const firstHook = introspector.getHooks()[0];
  if (firstHook) return { kind: "hook", id: firstHook.id };

  const firstEvent = introspector.getEvents()[0];
  if (firstEvent) return { kind: "event", id: firstEvent.id };

  const firstMiddleware = introspector.getMiddlewares()[0];
  if (firstMiddleware) return { kind: "middleware", id: firstMiddleware.id };

  const firstError = introspector.getErrors()[0];
  if (firstError) return { kind: "error", id: firstError.id };

  const firstContext = introspector.getAsyncContexts()[0];
  if (firstContext) return { kind: "asyncContext", id: firstContext.id };

  const firstTag = introspector.getAllTags()[0];
  if (firstTag) return { kind: "tag", id: firstTag.id };

  return null;
}

export function buildTopologyHash(input: {
  focus: TopologyFocus | null;
  view: TopologyViewMode;
}): string {
  const params = new URLSearchParams();
  if (input.view !== "blast") {
    params.set("view", input.view);
  }

  const focusPath = input.focus
    ? `${input.focus.kind}/${encodeURIComponent(input.focus.id)}`
    : "";

  const query = params.toString();
  const path = focusPath ? `/${focusPath}` : "";

  return `#topology${path}${query ? `?${query}` : ""}`;
}

export function parseTopologyHash(
  hash: string | null | undefined
): TopologyHashState | null {
  if (!hash || !hash.startsWith("#topology")) return null;

  const raw = hash.slice(1);
  const [pathPart, queryPart = ""] = raw.split("?");
  const segments = pathPart.split("/").filter(Boolean);
  if (segments[0] !== "topology") return null;

  const focusKind = parseFocusKind(segments[1] ?? null);
  const focusId = segments[2] ? safeDecode(segments[2]) : null;
  const query = new URLSearchParams(queryPart);
  const view = query.get("view") === "mindmap" ? "mindmap" : "blast";

  return {
    focus: focusKind && focusId ? { kind: focusKind, id: focusId } : null,
    view,
  };
}

export function openTopologyFocus(input: {
  focus: TopologyFocus;
  view?: TopologyViewMode;
}): void {
  if (typeof window === "undefined") return;
  window.location.hash = buildTopologyHash({
    focus: input.focus,
    view: input.view ?? defaultViewForKind(input.focus.kind),
  });
}

export function defaultViewForKind(kind: TopologyFocusKind): TopologyViewMode {
  return kind === "resource" ? "mindmap" : "blast";
}

function parseFocusKind(value: string | null): TopologyFocusKind | null {
  switch (value) {
    case "task":
    case "resource":
    case "hook":
    case "event":
    case "middleware":
    case "error":
    case "asyncContext":
    case "tag":
      return value;
    default:
      return null;
  }
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function safeGetRoot(introspector: Introspector): { id: string } | null {
  try {
    return introspector.getRoot();
  } catch {
    return null;
  }
}
