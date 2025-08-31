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

  return (
    <div className="" style={{ marginBottom: "20px" }}>
      <h4>📡 Recent Events ({emissions.length})</h4>
      <div
        className="live-entries"
        style={{
          maxHeight: "300px",
          overflowY: "auto",
        }}
      >
        {emissions.length === 0 ? (
          <div className="live-entry">
            <span>No recent events</span>
          </div>
        ) : (
          <>
            {emissions
              .slice(-10)
              .reverse()
              .map((emission, idx) => (
                <div
                  key={`${emission.timestampMs}-${idx}`}
                  className="live-entry live-entry--emission"
                >
                  <span className="entry-time">
                    {formatTimestamp(emission.timestampMs)}
                  </span>
                  <a 
                    href={`#element-${emission.eventId}`}
                    className="entry-event entry-event--link"
                    style={{ textDecoration: 'none', color: 'inherit' }}
                  >
                    {emission.eventId}
                  </a>
                  {emission.emitterId && (
                    <span className="entry-emitter">
                      from{" "}
                      <a 
                        href={`#element-${emission.emitterId}`}
                        className="entry-emitter--link"
                        style={{ textDecoration: 'none', color: 'inherit' }}
                      >
                        {emission.emitterId}
                      </a>
                    </span>
                  )}
                  {emission.payload && (
                    <button
                      className="clean-button"
                      onClick={() =>
                        openPayloadModal(
                          JSON.stringify(
                            JSON.parse(emission.payload!),
                            null,
                            2
                          ),
                          emission.eventId
                        )
                      }
                    >
                      View Payload
                    </button>
                  )}
                </div>
              ))}
          </>
        )}
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
