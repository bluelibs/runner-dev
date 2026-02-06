import React from "react";
import { Hook, Event } from "../../../../../schema/model";
import { Introspector } from "../../../../../resources/models/Introspector";
import { formatId } from "../utils/formatting";
import { TagsSection } from "./TagsSection";
import "./HookCard.scss";
import { HookOverview } from "./hook/HookOverview";
import { HookTargetEvents } from "./hook/HookTargetEvents";
import { DependenciesSection } from "./common/DependenciesSection";
import "./common/DependenciesSection.scss";
import { ElementCard } from "./common/ElementCard";

export interface HookCardProps {
  hook: Hook;
  introspector: Introspector;
}

export const HookCard: React.FC<HookCardProps> = ({ hook, introspector }) => {
  const dependencies = introspector.getDependencies(hook);
  const emittedEvents = introspector.getEmittedEvents(hook);
  const targetEvents: Event[] = introspector.getEventsByIds(hook.events);

  const isGlobalHook = hook.events.includes("*");

  return (
    <ElementCard
      prefix="hook-card"
      elementId={hook.id}
      title={
        <>
          {isGlobalHook ? "🌐" : "🪝"} {hook.meta?.title || formatId(hook.id)}
          {isGlobalHook && (
            <span className="hook-card__global-badge">GLOBAL</span>
          )}
        </>
      }
      id={hook.id}
      description={hook.meta?.description}
      meta={
        <div className="hook-card__stats">
          {hook.hookOrder !== null && hook.hookOrder !== undefined && (
            <div className="hook-card__order-badge">#{hook.hookOrder}</div>
          )}
          <div className="hook-card__stat-badge">
            <span className="icon">📤</span>
            <span className="count">{emittedEvents.length}</span>
          </div>
        </div>
      }
    >
      <div className="hook-card__content">
        <div className="hook-card__grid">
          <div>
            <HookOverview
              hook={hook}
              targetEvents={targetEvents}
              isGlobal={isGlobalHook}
              introspector={introspector}
            />
          </div>

          <div>
            <HookTargetEvents
              isGlobal={isGlobalHook}
              targetEvents={targetEvents}
              introspector={introspector}
            />
          </div>
        </div>

        <DependenciesSection
          dependencies={dependencies}
          emittedEvents={emittedEvents}
          className="hook-card__relations"
        />

        <TagsSection
          element={hook}
          introspector={introspector}
          className="hook-card__tags-section"
        />
      </div>
    </ElementCard>
  );
};
