import React from "react";
import { Hook } from "../../../../../../schema/model";
import { formatId } from "../../utils/formatting";
export interface HookHeaderProps {
  hook: Hook;
  emittedEventsCount: number;
  isGlobal: boolean;
}

export const HookHeader: React.FC<HookHeaderProps> = ({
  hook,
  emittedEventsCount,
  isGlobal,
}) => {
  return (
    <div className="hook-card__header">
      <div className="hook-card__header-content">
        <div className="main">
          <h3 className="hook-card__title">
            {isGlobal ? "🌐" : "🪝"} {hook.meta?.title || formatId(hook.id)}
            {isGlobal && (
              <span className="hook-card__global-badge">GLOBAL</span>
            )}
          </h3>
          <div className="hook-card__id">{hook.id}</div>
          {hook.meta?.description && (
            <p className="hook-card__description">{hook.meta.description}</p>
          )}
        </div>
        <div className="hook-card__stats">
          {hook.hookOrder !== null && hook.hookOrder !== undefined && (
            <div className="hook-card__order-badge">#{hook.hookOrder}</div>
          )}
          <div className="hook-card__stat-badge">
            <span className="icon">📤</span>
            <span className="count">{emittedEventsCount}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
