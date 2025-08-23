import React from "react";

interface EmissionEntry {
  timestampMs: number;
  eventId: string;
  emitterId?: string;
  payload?: string;
  correlationId?: string;
  eventResolved?: {
    id: string;
    meta?: {
      title?: string;
      description?: string;
      tags: Array<{
        id: string;
        config?: string;
      }>;
    };
  };
}

interface RecentEventsProps {
  emissions: EmissionEntry[];
  detailed?: boolean;
}

export const RecentEvents: React.FC<RecentEventsProps> = ({
  emissions,
  detailed = false,
}) => {
  const formatTimestamp = (timestampMs: number): string => {
    return new Date(timestampMs).toLocaleTimeString();
  };

  if (emissions.length === 0) {
    return null;
  }

  return (
    <div className="live-section">
      <h4>📡 Recent Events ({emissions.length})</h4>
      <div className="live-entries">
        {emissions.slice(-3).map((emission, idx) => (
          <div
            key={`${emission.timestampMs}-${idx}`}
            className="live-entry live-entry--emission"
          >
            <span className="entry-time">
              {formatTimestamp(emission.timestampMs)}
            </span>
            <span className="entry-event">{emission.eventId}</span>
            {emission.emitterId && (
              <span className="entry-emitter">from {emission.emitterId}</span>
            )}
            {emission.payload && detailed && (
              <details className="entry-payload">
                <summary>Payload</summary>
                <pre>{emission.payload}</pre>
              </details>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
