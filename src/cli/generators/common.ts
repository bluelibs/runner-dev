export type ArtifactKind =
  | "project"
  | "resource"
  | "task"
  | "event"
  | "hook"
  | "tag"
  | "task-middleware"
  | "resource-middleware";

const RESERVED_LOCAL_IDS = new Set([
  "tasks",
  "resources",
  "events",
  "hooks",
  "tags",
  "errors",
  "asyncContexts",
]);

export function toKebabCase(input: string): string {
  return input
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

export function toCamelCase(input: string): string {
  const s = toKebabCase(input)
    .split("-")
    .map((p, i) => (i === 0 ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join("");
  return s || "item";
}

export function toPascalCase(input: string): string {
  const s = toCamelCase(input);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function validateLocalId(id: string): void {
  const trimmedId = id.trim();

  if (!trimmedId) {
    throw new Error("Definition id cannot be empty.");
  }

  if (trimmedId.includes(".")) {
    throw new Error(
      `Definition id "${trimmedId}" is invalid. Use a local id without dots, for example "create-user".`
    );
  }

  if (RESERVED_LOCAL_IDS.has(trimmedId)) {
    throw new Error(
      `Definition id "${trimmedId}" is reserved. Choose a different local id.`
    );
  }
}
