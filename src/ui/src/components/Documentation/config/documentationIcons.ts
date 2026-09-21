import type { DocIconName } from "../components/common/DocIcon";

/**
 * Icon names for documentation surfaces. Values are `DocIcon` names
 * (rendered as minimal SVGs); `DocIcon` falls back to raw text for any
 * unknown string so fixtures and placeholders keep working.
 */
export const DOCUMENTATION_ICONS: Record<string, DocIconName> = {
  overview: "overview",
  docs: "book",
  live: "live",
  diagnostics: "diagnostics",
  topology: "topology",
  task: "task",
  resource: "resource",
  event: "event",
  hook: "hook",
  middleware: "middleware",
  tag: "tag",
  error: "error",
  asyncContext: "asyncContext",
  folder: "folder",
  fallback: "file",
} as const;

export function getDocumentationIcon(kind: string): string {
  switch (kind) {
    case "overview":
      return DOCUMENTATION_ICONS.overview;
    case "docs":
      return DOCUMENTATION_ICONS.docs;
    case "live":
      return DOCUMENTATION_ICONS.live;
    case "diagnostics":
      return DOCUMENTATION_ICONS.diagnostics;
    case "topology":
      return DOCUMENTATION_ICONS.topology;
    case "task":
    case "tasks":
      return DOCUMENTATION_ICONS.task;
    case "resource":
    case "resources":
      return DOCUMENTATION_ICONS.resource;
    case "event":
    case "events":
      return DOCUMENTATION_ICONS.event;
    case "hook":
    case "hooks":
      return DOCUMENTATION_ICONS.hook;
    case "middleware":
    case "middlewares":
      return DOCUMENTATION_ICONS.middleware;
    case "tag":
    case "tags":
      return DOCUMENTATION_ICONS.tag;
    case "error":
    case "errors":
      return DOCUMENTATION_ICONS.error;
    case "asyncContext":
    case "asyncContexts":
    case "async-context":
      return DOCUMENTATION_ICONS.asyncContext;
    case "mixed":
    case "folder":
      return DOCUMENTATION_ICONS.folder;
    default:
      return DOCUMENTATION_ICONS.fallback;
  }
}
