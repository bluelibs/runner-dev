export const DOCUMENTATION_ICONS = {
  overview: "📋",
  live: "📡",
  diagnostics: "🔍",
  task: "▶️",
  resource: "🧱",
  event: "📡",
  hook: "🪝",
  middleware: "🔗",
  tag: "🏷️",
  error: "🚨",
  asyncContext: "🔄",
  folder: "📁",
  fallback: "📄",
} as const;

export function getDocumentationIcon(kind: string): string {
  switch (kind) {
    case "overview":
      return DOCUMENTATION_ICONS.overview;
    case "live":
      return DOCUMENTATION_ICONS.live;
    case "diagnostics":
      return DOCUMENTATION_ICONS.diagnostics;
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
    case "folder":
      return DOCUMENTATION_ICONS.folder;
    default:
      return DOCUMENTATION_ICONS.fallback;
  }
}
