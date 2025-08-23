import React, { useState } from "react";
import { CodeModal } from "../CodeModal";

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
  const [selectedPayload, setSelectedPayload] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  const openPayloadModal = (payload: string, eventId: string) => {
    setSelectedPayload(payload);
    setSelectedEventId(eventId);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedPayload(null);
    setSelectedEventId(null);
  };
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
            {emission.payload && (
              <button
                className="entry-payload-button"
                onClick={() =>
                  openPayloadModal(
                    JSON.stringify(JSON.parse(emission.payload!), null, 2),
                    emission.eventId
                  )
                }
              >
                View Payload
              </button>
            )}
          </div>
        ))}
      </div>
      <CodeModal
        title="Event Payload"
        subtitle={selectedEventId || undefined}
        isOpen={showModal}
        onClose={closeModal}
        code={selectedPayload}
      />
    </div>
  );
};
