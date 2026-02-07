export function hasDurableIdPattern(depId: string): boolean {
  return depId.includes(".durable") || depId.startsWith("base.durable.");
}
