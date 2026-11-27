import { graphqlRequest } from "../../utils/graphqlClient";
import type { RetainedTrace } from "./apmFailureDetails";

export const ERROR_FIELDS =
  "sequence timestampMs sourceKind sourceId message stack data correlationId";

const HISTORY_QUERY = `query ExportTelemetry {
  live {
    historyPersisted
    errors { ${ERROR_FIELDS} }
    logs { sequence timestampMs level message data sourceId correlationId }
    emissions { sequence timestampMs eventId emitterId payload correlationId }
    runs { sequence timestampMs nodeId nodeKind ok durationMs error correlationId parentId rootId }
  }
}`;

export function downloadTelemetry(name: string, data: unknown) {
  const exportedAt = new Date().toISOString();
  const blob = new Blob([JSON.stringify({ exportedAt, data }, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `runner-${name}-${exportedAt.replace(/:/g, "-")}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function exportHistory() {
  const { live } = await graphqlRequest<{
    live: RetainedTrace & { historyPersisted: boolean | null };
  }>(HISTORY_QUERY);
  downloadTelemetry("telemetry", live);
}
