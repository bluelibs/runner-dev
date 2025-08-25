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
import {
  graphqlRequest,
  SAMPLE_HOOK_FILE_QUERY,
} from "../utils/graphqlClient";
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

  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [fileContent, setFileContent] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function openFileModal() {
    if (!hook?.id) return;
    setIsModalOpen(true);
    setLoading(true);
    setError(null);
    try {
      const data = await graphqlRequest<{
        hook: { fileContents: string | null };
      }>(SAMPLE_HOOK_FILE_QUERY, { id: hook.id });
      setFileContent(data?.hook?.fileContents ?? null);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load file");
      setFileContent(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div id={`element-${hook.id}`} className="hook-card">
      <HookHeader
        hook={hook}
        emittedEventsCount={emittedEvents.length}
        isGlobal={isGlobalHook}
        introspector={introspector}
      />

      <div className="hook-card__content">
        <div className="hook-card__grid">
          <div>
            <HookOverview
              hook={hook}
              targetEvents={targetEvents}
              isGlobal={isGlobalHook}
            />
            <div className="hook-card__info-block">
                <div className="label">File Path:</div>
                <div className="value">
                  {hook.filePath ? (
                    <button
                      type="button"
                      onClick={openFileModal}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "#7b1fa2",
                        cursor: "pointer",
                        textDecoration: "underline",
                        padding: 0,
                        fontFamily: "inherit",
                        fontSize: "inherit",
                      }}
                      title="View file contents"
                    >
                      {formatFilePath(hook.filePath)}
                    </button>
                  ) : (
                    formatFilePath(hook.filePath)
                  )}
                </div>
              </div>
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
      <CodeModal
        title={hook.meta?.title || formatId(hook.id)}
        subtitle={hook.filePath || undefined}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        code={loading ? "Loading..." : error ? `Error: {error}` : fileContent}
        enableEdit={Boolean(hook.filePath)}
        saveOnFile={hook.filePath || null}
      />
    </div>
  );
};
