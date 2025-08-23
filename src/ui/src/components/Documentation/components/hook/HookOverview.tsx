import React from "react";
import { Hook, Event } from "../../../../../../schema/model";
import { formatArray, formatFilePath, formatId } from "../../utils/formatting";

export interface HookOverviewProps {
  hook: Hook;
  targetEvents: Event[];
  isGlobal: boolean;
}

export const HookOverview: React.FC<HookOverviewProps> = ({
  hook,
  targetEvents,
  isGlobal,
}) => {
  const getHookOrderDisplay = () => {
    if (hook.hookOrder === null || hook.hookOrder === undefined)
      return "Default";
    return hook.hookOrder.toString();
  };

  return (
    <div className="hook-card__section">
      <h4 className="hook-card__section__title">📋 Overview</h4>
      <div className="hook-card__section__content">
        <div className="hook-card__info-block">
          <div className="label">File Path:</div>
          <div className="value">{formatFilePath(hook.filePath)}</div>
        </div>

        {hook.registeredBy && (
          <div className="hook-card__info-block">
            <div className="label">Registered By:</div>
            <div className="value">
              <a
                href={`#element-${hook.registeredBy}`}
                className="hook-card__registrar-link"
              >
                {hook.registeredBy}
              </a>
            </div>
          </div>
        )}

        <div className="hook-card__info-block">
          <div className="label">Target Events:</div>
          <div className="value">
            {isGlobal ? (
              <div className="hook-card__global-event">
                <span className="global-indicator">🌐 ALL EVENTS</span>
                <div className="global-description">
                  This hook listens to every event in the system
                </div>
              </div>
            ) : (
              <>
                {targetEvents.map((evt) => (
                  <div key={evt.id}>
                    <a
                      href={`#element-${evt.id}`}
                      className="hook-card__event-link"
                    >
                      {formatId(evt.id)}
                    </a>
                    {evt.meta?.title && (
                      <div
                        style={{
                          fontSize: "11px",
                          color: "#6c757d",
                          marginTop: "4px",
                          fontStyle: "italic",
                        }}
                      >
                        ({evt.meta.title})
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        <div className="hook-card__info-block">
          <div className="label">Execution Order:</div>
          <div className="value value--order">
            {getHookOrderDisplay()}
            <div className="order-description">
              {hook.hookOrder === null || hook.hookOrder === undefined
                ? "Uses default ordering"
                : `Priority level ${hook.hookOrder}`}
            </div>
          </div>
        </div>

        <div className="hook-card__info-block">
          <div className="label">Emits Events:</div>
          <div className="value">{formatArray(hook.emits)}</div>
        </div>

        {hook.overriddenBy && (
          <div className="hook-card__alert hook-card__alert--warning">
            <div className="title">⚠️ Overridden By:</div>
            <div className="content">{hook.overriddenBy}</div>
          </div>
        )}
      </div>
    </div>
  );
};
