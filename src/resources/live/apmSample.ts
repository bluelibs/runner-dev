import { parsePersistedEntry } from "./persistence.schema";
import type { RunRecord } from "./types";
/** Adapters also support direct callers, so validate and strip sensitive fields here. */
export function compactApmSample(
  sample: RunRecord,
  maxStorage?: number
): RunRecord {
  const parsed = parsePersistedEntry({ kind: "run", entry: sample });
  if (parsed.kind !== "run" || parsed.entry.durationMs < 0)
    throw new Error("Invalid APM sample.");
  const compact: RunRecord = {
    sequence: parsed.entry.sequence,
    timestampMs: parsed.entry.timestampMs,
    nodeId: parsed.entry.nodeId,
    nodeKind: parsed.entry.nodeKind,
    durationMs: parsed.entry.durationMs,
    ok: parsed.entry.ok,
    parentId: parsed.entry.parentId ? "nested" : null,
  };
  if (maxStorage && Buffer.byteLength(JSON.stringify(compact)) > maxStorage)
    throw new Error("APM sample exceeds maxStorage.");
  return compact;
}
