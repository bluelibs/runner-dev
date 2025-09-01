export type ArtifactKind =
  | "project"
  | "resource"
  | "task"
  | "event"
  | "tag"
  | "taskMiddleware"
  | "resourceMiddleware";

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
