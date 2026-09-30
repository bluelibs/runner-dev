/** Snapshot arbitrary telemetry as JSON without losing the whole entry to cycles. */
export function telemetryJson(value: unknown): string {
  const seen = new WeakSet<object>();
  return JSON.stringify(value, (_key, item: unknown) => {
    if (typeof item === "bigint" || typeof item === "symbol")
      return String(item);
    if (typeof item === "function") return "[Function]";
    if (item && typeof item === "object") {
      if (seen.has(item)) return "[Circular]";
      seen.add(item);
      if (item instanceof Error) {
        return { name: item.name, message: item.message, stack: item.stack };
      }
    }
    return item;
  });
}
