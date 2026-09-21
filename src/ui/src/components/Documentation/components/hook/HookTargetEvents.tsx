import React from "react";
import { Event } from "../../../../../../schema/model";
import { Introspector } from "../../../../../../resources/models/Introspector";
import { formatId } from "../../utils/formatting";
import SchemaRenderer from "../SchemaRenderer";
import { CardSection } from "../common/ElementCard";
import { DocIcon } from "../common/DocIcon";

export interface HookTargetEventsProps {
  isGlobal: boolean;
  targetEvents: Event[];
  introspector: Introspector;
}

export const HookTargetEvents: React.FC<HookTargetEventsProps> = ({
  isGlobal,
  targetEvents,
  introspector,
}) => {
  if (isGlobal) {
    return (
      <CardSection
        prefix="hook-card"
        title={
          <>
            <DocIcon name="globe" size={13} className="doc-icon--accent" />{" "}
            Global Hook Details
          </>
        }
        contentClassName="hook-card__global-info"
      >
        <div className="hook-card__global-message">
          <div className="hook-card__global-message__header">
            <span className="icon">
              <DocIcon name="globe" size={15} />
            </span>
            <h5 className="title">Universal Event Listener</h5>
          </div>
          <div className="hook-card__global-message__content">
            This hook is triggered by <strong>every event</strong> that occurs
            in the system. It acts as a universal listener that can respond to
            any event type.
          </div>
        </div>

        <div className="hook-card__schema-block">
          <div className="title">Global Hook Benefits</div>
          <div className="hook-card__global-benefits">
            <div className="benefit">
              <span className="icon">
                <DocIcon name="diagnostics" size={14} />
              </span>
              <span className="text">Monitor all system activity</span>
            </div>
            <div className="benefit">
              <span className="icon">
                <DocIcon name="chart" size={14} />
              </span>
              <span className="text">Collect comprehensive metrics</span>
            </div>
            <div className="benefit">
              <span className="icon">
                <DocIcon name="shield" size={14} />
              </span>
              <span className="text">Implement cross-cutting concerns</span>
            </div>
          </div>
        </div>
      </CardSection>
    );
  }

  if (!targetEvents || targetEvents.length === 0) {
    return (
      <CardSection
        prefix="hook-card"
        title={
          <>
            <DocIcon name="event" size={13} className="doc-icon--accent" />{" "}
            Target Event Details
          </>
        }
      >
        <div className="hook-card__not-found">
          <div className="icon">
            <DocIcon name="error" size={16} />
          </div>
          <h5 className="title">Event Not Found</h5>
          <p className="message">No target events found for this hook.</p>
        </div>
      </CardSection>
    );
  }

  return (
    <CardSection
      prefix="hook-card"
      title={
        <>
          <DocIcon name="event" size={13} className="doc-icon--accent" /> Target
          Event Details
        </>
      }
    >
      {targetEvents.map((evt) => (
        <div key={evt.id}>
          <a href={`#element-${evt.id}`}>
            <div className="hook-card__target-event">
              <div className="hook-card__target-event__header">
                <span className="icon">
                  <DocIcon
                    name="event"
                    size={14}
                    className="doc-icon--accent"
                  />
                </span>
                <h5 className="title">{evt.meta?.title || formatId(evt.id)}</h5>
              </div>
              <div className="hook-card__target-event__id">{evt.id}</div>
              {evt.meta?.description && (
                <div className="hook-card__target-event__description">
                  {evt.meta.description}
                </div>
              )}
            </div>
          </a>

          <div className="hook-card__section__content">
            <div className="hook-card__schema-block">
              <div className="title">Payload Schema</div>
              <SchemaRenderer schemaString={evt.payloadSchema} />
            </div>

            <div className="hook-card__schema-block">
              <div className="title">Event Statistics</div>
              <div className="hook-card__event-stats">
                <div className="hook-card__event-stats__stat">
                  <div className="value value--emitters">
                    {introspector.getEmittersOfEvent(evt.id).length}
                  </div>
                  <div className="label">Emitters</div>
                </div>
                <div className="hook-card__event-stats__stat">
                  <div className="value value--hooks">
                    {introspector.getHooksOfEvent(evt.id).length}
                  </div>
                  <div className="label">Hooks</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </CardSection>
  );
};
