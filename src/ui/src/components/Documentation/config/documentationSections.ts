export interface SectionConfig {
  id: string;
  label: string;
  icon: string;
  count: number | null;
  hasContent: boolean;
}

export const createSections = (counts: {
  tasks: number;
  resources: number;
  events: number;
  hooks: number;
  middlewares: number;
  tags: number;
  errors: number;
  asyncContexts: number;
}): SectionConfig[] => {
  const sections = [
    {
      id: "live",
      label: "Live",
      icon: "📡",
      count: null,
      hasContent: true,
    },
    {
      id: "diagnostics",
      label: "Diagnostics",
      icon: "🔍",
      count: null,
      hasContent: true,
    },
    {
      id: "overview",
      label: "Overview",
      icon: "📋",
      count: null,
      hasContent: true,
    },
    {
      id: "tasks",
      label: "Tasks",
      icon: "⚙️",
      count: counts.tasks,
      hasContent: counts.tasks > 0,
    },
    {
      id: "resources",
      label: "Resources",
      icon: "🔧",
      count: counts.resources,
      hasContent: counts.resources > 0,
    },
    {
      id: "events",
      label: "Events",
      icon: "📡",
      count: counts.events,
      hasContent: counts.events > 0,
    },
    {
      id: "hooks",
      label: "Hooks",
      icon: "🪝",
      count: counts.hooks,
      hasContent: counts.hooks > 0,
    },
    {
      id: "middlewares",
      label: "Middlewares",
      icon: "🔗",
      count: counts.middlewares,
      hasContent: counts.middlewares > 0,
    },
    {
      id: "errors",
      label: "Errors",
      icon: "❌",
      count: counts.errors,
      hasContent: counts.errors > 0,
    },
    {
      id: "asyncContexts",
      label: "Async Contexts",
      icon: "🔄",
      count: counts.asyncContexts,
      hasContent: counts.asyncContexts > 0,
    },
    {
      id: "tags",
      label: "Tags",
      icon: "🏷️",
      count: counts.tags,
      hasContent: counts.tags > 0,
    },
  ];

  return sections.filter((section) => section.hasContent);
};
