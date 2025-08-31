import React from "react";
import { Hook, Event } from "../../../../../schema/model";
import { Introspector } from "../../../../../resources/models/Introspector";
import { TagsSection } from "./TagsSection";
import "./HookCard.scss";
import { HookHeader } from "./hook/HookHeader";
import { HookOverview } from "./hook/HookOverview";
import { HookTargetEvents } from "./hook/HookTargetEvents";
import { HookRelations } from "./hook/HookRelations";
import { CodeModal } from "./CodeModal";
import { graphqlRequest, SAMPLE_HOOK_FILE_QUERY } from "../utils/graphqlClient";
import { formatFilePath, formatId } from "../utils/formatting";

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
    <div id={`element-${hook.id}`} className="hook-card">
      <HookHeader
        hook={hook}
        emittedEventsCount={emittedEvents.length}
        isGlobal={isGlobalHook}
      />

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

        <HookRelations
          dependencies={dependencies}
          emittedEvents={emittedEvents}
        />

        <TagsSection
          element={hook}
          introspector={introspector}
          className="hook-card__tags-section"
        />
      </div>
    </div>
  );
};
