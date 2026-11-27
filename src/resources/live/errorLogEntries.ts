import type { ErrorEntry, LogEntry } from "./types";

const logErrors = new WeakMap<LogEntry, ErrorEntry>();

function fromLog(log: LogEntry): ErrorEntry {
  const cached = logErrors.get(log);
  if (cached) return cached;
  const data = log.data;
  const error =
    data && typeof data === "object" && "error" in data
      ? data.error
      : undefined;
  const stack =
    error &&
    typeof error === "object" &&
    "stack" in error &&
    typeof error.stack === "string"
      ? error.stack
      : undefined;
  const entry: ErrorEntry = {
    ...log,
    sourceKind: "LOG",
    sourceId: log.sourceId ?? "logger",
    stack,
  };
  logErrors.set(log, entry);
  return entry;
}

export function combineErrorRecords(errors: ErrorEntry[], logs: LogEntry[]) {
  // Pair one logged copy with one captured exception only when both identify the same failure.
  const identity = (e: ErrorEntry) =>
    e.correlationId &&
    JSON.stringify([
      e.correlationId,
      e.sourceId,
      e.message,
      e.stack?.match(/^\s*at (.+)$/m)?.[1] ?? "",
    ]);
  const copies = new Map<string, number>();
  for (const error of errors) {
    const key = identity(error);
    if (key) copies.set(key, (copies.get(key) ?? 0) + 1);
  }
  const combined = [...errors];
  for (const log of logs) {
    const entry = fromLog(log);
    const key = identity(entry);
    const remaining = key ? copies.get(key) ?? 0 : 0;
    if (key && remaining) copies.set(key, remaining - 1);
    else combined.push(entry);
  }
  return combined.sort((a, b) => a.sequence - b.sequence);
}
