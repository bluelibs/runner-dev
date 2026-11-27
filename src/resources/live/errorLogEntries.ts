import { errorStackIdentity } from "./errorGroups";
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
      ...errorStackIdentity(e),
    ]);
  const copies = new Map<string, ErrorEntry[]>();
  const pairedLogs = new Map<ErrorEntry, LogEntry>();
  for (let i = errors.length - 1; i >= 0; i--) {
    const error = errors[i];
    const key = identity(error);
    if (!key) continue;
    const queue = copies.get(key) ?? [];
    queue.push(error);
    copies.set(key, queue);
  }
  const combined = [...errors];
  for (const log of logs) {
    const entry = fromLog(log);
    const key = identity(entry);
    const captured = key ? copies.get(key)?.pop() : undefined;
    if (captured) pairedLogs.set(captured, log);
    else combined.push(entry);
  }
  return {
    entries: combined.sort((a, b) => a.sequence - b.sequence),
    pairedLogs,
  };
}
