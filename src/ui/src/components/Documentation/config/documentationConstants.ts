export const DOCUMENTATION_CONSTANTS = {
  // LocalStorage keys
  STORAGE_KEYS: {
    SHOW_SYSTEM: "docs-show-system",
    SIDEBAR_WIDTH: "docs-sidebar-width",
    CHAT_SIDEBAR_WIDTH: "docs-chat-sidebar-width",
    CHAT_OPEN: "docs-chat-open",
    VIEW_MODE: "docs-view-mode",
    TREE_TYPE: "docs-tree-type",
  },

  // Default values
  DEFAULTS: {
    SIDEBAR_WIDTH: 280,
    CHAT_SIDEBAR_WIDTH: 320,
    CHAT_OPEN: false,
    VIEW_MODE: "list" as const,
    TREE_TYPE: "namespace" as const,
    SHOW_SYSTEM: false,
  },

  // Constraints
  CONSTRAINTS: {
    MIN_SIDEBAR_WIDTH: 200,
    MAX_SIDEBAR_WIDTH: 600,
    MIN_CHAT_WIDTH: 240,
    MAX_CHAT_WIDTH: 600,
    HIGHLIGHT_DURATION: 2000, // milliseconds
  },

  // CSS class names
  CSS_CLASSES: {
    HIGHLIGHT_TARGET: "docs-highlight-target",
    SIDEBAR_RESIZER_ACTIVE: "docs-sidebar-resizer--active",
  },

  // System tag identifier
  SYSTEM_TAG_ID: "globals.tags.system",
} as const;
