import { telemetryJson } from "./telemetryJson";
import type { ErrorEntry, LogEntry } from "./types";

export function historySearch(query?: string | null) {
  const terms = query?.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms?.length) return undefined;
  return (entry: LogEntry | ErrorEntry) => {
    const fields = [
      entry.sourceId,
      entry.message,
      entry.correlationId,
      "level" in entry ? entry.level : entry.sourceKind,
      "stack" in entry ? entry.stack : "",
    ];
    let text = fields.join(" ").toLowerCase();
    if (terms.every((term) => text.includes(term))) return true;
    if (entry.data == null) return false;
    try {
      text += " " + telemetryJson(entry.data).toLowerCase();
    } catch {
      return false;
    }
    return terms.every((term) => text.includes(term));
  };
}
