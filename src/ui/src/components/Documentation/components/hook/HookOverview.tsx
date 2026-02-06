import React from "react";
import { Hook, Event } from "../../../../../../schema/model";
import { formatArray, formatFilePath, formatId } from "../../utils/formatting";
import { CodeModal } from "../CodeModal";
import {
  graphqlRequest,
  SAMPLE_HOOK_FILE_QUERY,
} from "../../utils/graphqlClient";
import { Introspector } from "../../../../../../resources/models/Introspector";
import { CardSection, InfoBlock } from "../common/ElementCard";

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
    <>
      <CardSection
        prefix="hook-card"
        title="📋 Overview"
        contentClassName="hook-card__section__content"
      >
        <InfoBlock prefix="hook-card" label="File Path:">
          <a onClick={openFileModal}>{formatFilePath(hook.filePath)}</a>
        </InfoBlock>

        {hook.registeredBy && (
          <InfoBlock prefix="hook-card" label="Registered By:">
            <a
              href={`#element-${hook.registeredBy}`}
              className="hook-card__registrar-link"
            >
              {hook.registeredBy}
            </a>
          </InfoBlock>
        )}

        <InfoBlock prefix="hook-card" label="Target Events:">
          {isGlobal ? (
            <div className="hook-card__global-event">
              <span className="global-indicator">🌐 ALL EVENTS</span>
              <div className="global-description">
                This hook listens to every event in the system
              </div>
            </div>
          ) : (
            targetEvents.map((evt) => (
              <div key={evt.id}>
                <a
                  href={`#element-${evt.id}`}
                  className="hook-card__event-link"
                >
                  {formatId(evt.id)}
                </a>
                {evt.meta?.title && <div>({evt.meta.title})</div>}
              </div>
            ))
          )}
        </InfoBlock>

        <InfoBlock
          prefix="hook-card"
          label="Execution Order:"
          valueClassName="value--order"
        >
          {getHookOrderDisplay()}
          <div className="order-description">
            {hook.hookOrder === null || hook.hookOrder === undefined
              ? "Uses default ordering"
              : `Priority level ${hook.hookOrder}`}
          </div>
        </InfoBlock>

        <InfoBlock prefix="hook-card" label="Emits Events:">
          {formatArray(hook.emits)}
        </InfoBlock>

        {hook.tags && hook.tags.length > 0 && (
          <InfoBlock prefix="hook-card" label="Tags:">
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
          </InfoBlock>
        )}

        {hook.overriddenBy && (
          <div className="hook-card__alert hook-card__alert--warning">
            <div className="title">⚠️ Overridden By:</div>
            <div className="content">{hook.overriddenBy}</div>
          </div>
        )}
      </CardSection>

      <CodeModal
        title={hook.meta?.title || formatId(hook.id)}
        subtitle={hook.filePath || undefined}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        code={loading ? "Loading..." : error ? `Error: ${error}` : fileContent}
        enableEdit={Boolean(hook.filePath)}
        saveOnFile={hook.filePath || null}
      />
    </>
  );
};
