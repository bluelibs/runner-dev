import React from "react";
import { Tag } from "../../../../../schema/model";
import { Introspector } from "../../../../../resources/models/Introspector";
import { formatId, formatFilePath } from "../utils/formatting";
import "./TagCard.scss";
import { CodeModal } from "./CodeModal";
import {
  graphqlRequest,
  SAMPLE_TASK_FILE_QUERY,
  SAMPLE_RESOURCE_FILE_QUERY,
  SAMPLE_MIDDLEWARE_FILE_QUERY,
  SAMPLE_EVENT_FILE_QUERY,
  SAMPLE_TAG_FILE_QUERY,
} from "../utils/graphqlClient";

import { TaggedElements } from "./tag/TaggedElements";
import { SchemaRenderer } from "./SchemaRenderer";
import { ElementCard, CardSection, InfoBlock } from "./common/ElementCard";
import { isSystemElement } from "../utils/isSystemElement";

export interface TagCardProps {
  tag: Tag;
  introspector: Introspector;
}

export const TagCard: React.FC<TagCardProps> = ({ tag, introspector }) => {
  const allTaggedElements = [
    ...tag.tasks,
    ...tag.resources,
    ...tag.taskMiddlewares,
    ...tag.resourceMiddlewares,
    ...tag.events,
    ...tag.hooks,
    ...tag.errors,
  ];
  const tagHandlers = React.useMemo(
    () => introspector.getTagHandlers(tag.id),
    [introspector, tag.id]
  );
  const totalTagHandlers =
    tagHandlers.tasks.length +
    tagHandlers.hooks.length +
    tagHandlers.resources.length;

  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [modalTitle, setModalTitle] = React.useState<string>("");
  const [modalSubtitle, setModalSubtitle] = React.useState<string | undefined>(
    undefined
  );
  const [fileContent, setFileContent] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saveOnFile, setSaveOnFile] = React.useState<string | null>(null);

  async function _openElementFile(
    kind: "task" | "resource" | "middleware" | "event",
    id: string,
    title?: string | null,
    filePath?: string | null
  ) {
    setIsModalOpen(true);
    setLoading(true);
    setError(null);
    setModalTitle(title || formatId(id));
    setModalSubtitle(filePath || undefined);
    setSaveOnFile(filePath || null);
    try {
      let data: any;
      if (kind === "task") {
        data = await graphqlRequest<{ task: { fileContents: string | null } }>(
          SAMPLE_TASK_FILE_QUERY,
          { id }
        );
        setFileContent(data?.task?.fileContents ?? null);
      } else if (kind === "resource") {
        data = await graphqlRequest<{
          resource: { fileContents: string | null };
        }>(SAMPLE_RESOURCE_FILE_QUERY, { id });
        setFileContent(data?.resource?.fileContents ?? null);
      } else if (kind === "middleware") {
        data = await graphqlRequest<{
          middleware: { fileContents: string | null };
        }>(SAMPLE_MIDDLEWARE_FILE_QUERY, { id });
        setFileContent(data?.middleware?.fileContents ?? null);
      } else if (kind === "event") {
        data = await graphqlRequest<{ event: { fileContents: string | null } }>(
          SAMPLE_EVENT_FILE_QUERY,
          { id }
        );
        setFileContent(data?.event?.fileContents ?? null);
      }
    } catch (e: any) {
      setError(e?.message ?? "Failed to load file");
      setFileContent(null);
    } finally {
      setLoading(false);
    }
  }

  async function openTagFileModal() {
    if (!tag?.id) return;
    setIsModalOpen(true);
    setLoading(true);
    setError(null);
    setModalTitle(tag.meta?.title || formatId(tag.id));
    setModalSubtitle(tag.filePath || undefined);
    setSaveOnFile(tag.filePath || null);
    try {
      const data = await graphqlRequest<{
        tag: { fileContents: string | null };
      }>(SAMPLE_TAG_FILE_QUERY, { id: tag.id });
      setFileContent(data?.tag?.fileContents ?? null);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load file");
      setFileContent(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ElementCard
      prefix="tag-card"
      elementId={tag.id}
      kindLabel="tag"
      isSystem={isSystemElement(tag)}
      title={tag.meta?.title || formatId(tag.id)}
      id={tag.id}
      description={tag.meta?.description}
    >
      <div className="tag-card__grid">
        <CardSection prefix="tag-card" title="Overview">
          <div className="tag-card__summary">
            <div className="tag-card__total">
              <span className="value">{allTaggedElements.length}</span>
              <span className="label">Total Tagged Elements</span>
            </div>
          </div>

          <div className="tag-card__stats">
            <div className="tag-card__stat tag-card__stat--tasks">
              <div className="tag-card__stat__value">{tag.tasks.length}</div>
              <div className="tag-card__stat__label">Tasks</div>
            </div>
            <div className="tag-card__stat tag-card__stat--resources">
              <div className="tag-card__stat__value">
                {tag.resources.length}
              </div>
              <div className="tag-card__stat__label">Resources</div>
            </div>
            <div className="tag-card__stat tag-card__stat--events">
              <div className="tag-card__stat__value">{tag.events.length}</div>
              <div className="tag-card__stat__label">Events</div>
            </div>
            <div className="tag-card__stat tag-card__stat--middlewares">
              <div className="tag-card__stat__value">
                {tag.taskMiddlewares.length + tag.resourceMiddlewares.length}
              </div>
              <div className="tag-card__stat__label">Middlewares</div>
            </div>
            <div className="tag-card__stat tag-card__stat--hooks">
              <div className="tag-card__stat__value">{tag.hooks.length}</div>
              <div className="tag-card__stat__label">Hooks</div>
            </div>
            <div className="tag-card__stat tag-card__stat--errors">
              <div className="tag-card__stat__value">{tag.errors.length}</div>
              <div className="tag-card__stat__label">Errors</div>
            </div>
            <div className="tag-card__stat tag-card__stat--handlers">
              <div className="tag-card__stat__value">{totalTagHandlers}</div>
              <div className="tag-card__stat__label">Handlers</div>
            </div>
          </div>

          <InfoBlock prefix="tag-card" label="File Path:">
            {tag.filePath ? (
              <a
                type="button"
                onClick={openTagFileModal}
                title="View file contents"
              >
                {formatFilePath(tag.filePath)}
              </a>
            ) : (
              formatFilePath(tag.filePath)
            )}
          </InfoBlock>

          <InfoBlock prefix="tag-card" label="Targets:">
            {tag.targets && tag.targets.length > 0
              ? tag.targets.join(", ")
              : "Any"}
          </InfoBlock>
        </CardSection>

        <CardSection
          prefix="tag-card"
          title="Configuration Schema"
          contentClassName="tag-card__config"
        >
          <SchemaRenderer schemaString={tag.configSchema} />
        </CardSection>
      </div>

      <TaggedElements tag={tag} introspector={introspector} />

      <CodeModal
        title={modalTitle}
        subtitle={modalSubtitle}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        code={loading ? "Loading..." : error ? `Error: ${error}` : fileContent}
        enableEdit={Boolean(saveOnFile)}
        saveOnFile={saveOnFile}
      />
    </ElementCard>
  );
};
