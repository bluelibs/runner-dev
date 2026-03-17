export function isSystemNamespaceId(id: string | null | undefined): boolean {
  if (!id) return false;

  return id === "system" || id.startsWith("system.");
}
