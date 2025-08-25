import React from "react";
import { Hook, Event } from "../../../../../../schema/model";
import { formatArray, formatFilePath, formatId } from "../../utils/formatting";
import { CodeModal } from "../CodeModal";
import {
  graphqlRequest,
  SAMPLE_HOOK_FILE_QUERY,
} from "../../utils/graphqlClient";
import { Introspector } from "../../../../../../resources/models/Introspector";

export interface HookOverviewProps {
  hook: Hook;
  targetEvents: Event[];
  isGlobal: boolean;
  introspector: Introspector;
}

export const HookOverview: React.FC<HookOverviewProps> = ({
  hook,
  targetEvents,
  isGlobal,
  introspector,
}) => {
  const getHookOrderDisplay = () => {
    if (hook.hookOrder === null || hook.hookOrder === undefined)
      return "Default";
    return hook.hookOrder.toString();
  };

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
    <div className="hook-card__section">
      <h4 className="hook-card__section__title">📋 Overview</h4>
      <div className="hook-card__section__content">
        <div className="hook-card__info-block">
          <div className="label">File Path:</div>
          <div className="value">
            <a onClick={openFileModal}>{formatFilePath(hook.filePath)}</a>
          </div>
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

        {hook.tags && hook.tags.length > 0 && (
          <div className="hook-card__info-block">
            <div className="label">Tags:</div>
            <div className="value">
              <div className="hook-card__tags">
                {introspector.getTagsByIds(hook.tags).map((tag) => (
                  <a
                    href={`#element-${tag.id}`}
                    key={tag.id}
                    className="clean-button"
                  >
                    {formatId(tag.id)}
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}

        {hook.overriddenBy && (
          <div className="hook-card__alert hook-card__alert--warning">
            <div className="title">⚠️ Overridden By:</div>
            <div className="content">{hook.overriddenBy}</div>
          </div>
        )}
      </div>

      <CodeModal
        title={hook.meta?.title || formatId(hook.id)}
        subtitle={hook.filePath || undefined}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        code={loading ? "Loading..." : error ? `Error: ${error}` : fileContent}
        enableEdit={Boolean(hook.filePath)}
        saveOnFile={hook.filePath || null}
      />
    </div>
  );
};
