export function isRunnerNamespaceId(id: string | null | undefined): boolean {
  if (!id) return false;

  return id === "runner" || id.startsWith("runner.");
}
