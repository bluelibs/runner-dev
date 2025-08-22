export const formatSchema = (schema: string | null | undefined): string => {
  if (!schema) return "No schema defined";

  try {
    const parsed = JSON.parse(schema);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return schema;
  }
};

export const formatConfig = (config: string | null | undefined): string => {
  if (!config) return "No configuration";

  try {
    const parsed = JSON.parse(config);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return config;
  }
};

export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "...";
};

export const formatFilePath = (filePath: string | null | undefined): string => {
  if (!filePath) return "Unknown location";

  // Preserve friendly prefixes coming from sanitizePath()
  // Examples: "workspace:src/index.ts", "node_modules:pkg/index.js", "home:..."
  const knownPrefixes = ["workspace", "node_modules", "home"];
  const colonIdx = filePath.indexOf(":");

  const splitPath = (p: string): string[] => p.split(/[\\/]+/).filter(Boolean);

  if (colonIdx > 0) {
    const prefix = filePath.slice(0, colonIdx);
    const rest = filePath.slice(colonIdx + 1);
    if (knownPrefixes.includes(prefix)) {
      const parts = splitPath(rest);
      if (prefix === "node_modules" && parts[0]?.startsWith("@")) {
        // Preserve scoped package display rules
        // If short (<=4 parts), show entire path; otherwise, truncate tail to last 3
        if (parts.length <= 4) {
          return `${prefix}:${parts.join("/")}`;
        }
        return `${prefix}:/.../${parts.slice(-3).join("/")}`;
      } else {
        if (parts.length > 3) {
          return `${prefix}:/.../${parts.slice(-3).join("/")}`;
        }
        const restDisplay = parts.join("/");
        return `${prefix}:${restDisplay || "."}`;
      }
    }
  }

  // Generic truncation for non-prefixed paths (e.g., \u2026/parent/name)
  const parts = splitPath(filePath);
  if (parts.length > 3) {
    return ".../" + parts.slice(-3).join("/");
  }
  return parts.join("/");
};

export const getSeverityColor = (severity: string): string => {
  switch (severity.toLowerCase()) {
    case "error":
      return "#e74c3c";
    case "warning":
      return "#f39c12";
    case "info":
      return "#3498db";
    default:
      return "#95a5a6";
  }
};

export const getSeverityIcon = (severity: string): string => {
  switch (severity.toLowerCase()) {
    case "error":
      return "❌";
    case "warning":
      return "⚠️";
    case "info":
      return "ℹ️";
    default:
      return "📝";
  }
};

export const formatId = (id: string): string => {
  return id.replace(/\./g, " › ");
};

export const formatArray = (arr: string[] | null | undefined): string => {
  if (!arr || arr.length === 0) return "None";
  if (arr.length === 1) return arr[0];
  if (arr.length <= 3) return arr.join(", ");
  return `${arr.slice(0, 3).join(", ")} and ${arr.length - 3} more`;
};
