import { RingBuffer } from "./RingBuffer";
import type { LivePersistedEntry } from "./persistence";
import type { EmissionEntry, ErrorEntry, LogEntry, RunRecord } from "./types";

export function createEntryBuffers(maxEntries: number) {
  const logs = new RingBuffer<LogEntry>(maxEntries);
  const emissions = new RingBuffer<EmissionEntry>(maxEntries);
  const errors = new RingBuffer<ErrorEntry>(maxEntries);
  const runs = new RingBuffer<RunRecord>(maxEntries);
  return {
    logs,
    emissions,
    errors,
    runs,
    append(record: LivePersistedEntry) {
      switch (record.kind) {
        case "log":
          logs.push(record.entry);
          break;
        case "emission":
          emissions.push(record.entry);
          break;
        case "error":
          errors.push(record.entry);
          break;
        case "run":
          runs.push(record.entry);
          break;
      }
    },
  };
}
