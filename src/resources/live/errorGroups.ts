import { createHash } from "node:crypto";
import type { ErrorEntry } from "./types";

const fingerprints = new WeakMap<ErrorEntry, string>();

export function errorStackIdentity(error: ErrorEntry) {
  const stack = error.stack ?? "";
  const frame = stack.match(/^\s*at (.+)$/m)?.[1]?.trim() ?? "";
  const name = stack.match(/^([\w.$]+):/)?.[1] ?? "";
  return [name, frame] as const;
}

function fingerprint(error: ErrorEntry): string {
  const cached = fingerprints.get(error);
  if (cached) return cached;
  const [name, frame] = errorStackIdentity(error);
  // Ignore per-request UUIDs, while preserving error codes and numeric values.
  const message = error.message.replace(
    /\b[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}\b/gi,
    "{uuid}"
  );
  const id = createHash("sha256")
    .update(
      JSON.stringify([error.sourceKind, error.sourceId, name, message, frame])
    )
    .digest("hex");
  fingerprints.set(error, id);
  return id;
}

export interface ErrorGroup {
  id: string;
  latest: ErrorEntry;
  firstSeenMs: number;
  lastSeenMs: number;
  occurrences: ErrorEntry[];
}

/** The store supplies retained entries in sequence order, including after restoration. */
export function groupErrors(
  entries: ErrorEntry[],
  selectedId?: string | null
): ErrorGroup[] {
  const groups = new Map<string, ErrorGroup>();
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    const id = fingerprint(entry);
    if (selectedId && id !== selectedId) continue;
    const group = groups.get(id);
    if (group) {
      group.occurrences.push(entry);
      group.firstSeenMs = Math.min(group.firstSeenMs, entry.timestampMs);
      group.lastSeenMs = Math.max(group.lastSeenMs, entry.timestampMs);
    } else {
      groups.set(id, {
        id,
        latest: entry,
        firstSeenMs: entry.timestampMs,
        lastSeenMs: entry.timestampMs,
        occurrences: [entry],
      });
    }
  }
  return Array.from(groups.values());
}
