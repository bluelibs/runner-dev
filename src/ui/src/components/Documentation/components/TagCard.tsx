import React from "react";
import { Tag } from "../../../../../schema/model";
import { Introspector } from "../../../../../resources/models/Introspector";
import { formatSchema, formatId, formatFilePath } from "../utils/formatting";
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

export interface TagCardProps {
  tag: Tag;
  introspector: Introspector;
}

export const TagCard: React.FC<TagCardProps> = ({ tag, introspector }) => {
  const allTaggedElements = [
    ...tag.tasks,
    ...tag.resources,
    ...tag.middlewares,
    ...tag.events,
    ...tag.hooks,
  ];

  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [modalTitle, setModalTitle] = React.useState<string>("");
  const [modalSubtitle, setModalSubtitle] = React.useState<string | undefined>(
    undefined
  );
  const [fileContent, setFileContent] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saveOnFile, setSaveOnFile] = React.useState<string | null>(null);

  async function openElementFile(
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
    <div id={`element-${tag.id}`} className="tag-card">
      <div className="tag-card__header">
        <div className="tag-card__header-content">
          <div className="main">
            <h3 className="tag-card__title">{formatId(tag.id)}</h3>
            <div className="tag-card__id">{tag.meta?.title || tag.id}</div>
          </div>
        </div>
      </div>

      <div className="tag-card__content">
        <div className="tag-card__grid">
          <div>
            <div className="tag-card__section">
              <h4 className="tag-card__section__title">Overview</h4>
              <div className="tag-card__section__content">
                <div className="tag-card__summary">
                  <div className="tag-card__total">
                    <span className="value">{allTaggedElements.length}</span>
                    <span className="label">Total Tagged Elements</span>
                  </div>
                </div>
                <div className="tag-card__stats">
                  <div className="tag-card__stat tag-card__stat--tasks">
                    <div className="tag-card__stat__value">
                      {tag.tasks.length}
                    </div>
                    <div className="tag-card__stat__label">Tasks</div>
                  </div>
                  <div className="tag-card__stat tag-card__stat--resources">
                    <div className="tag-card__stat__value">
                      {tag.resources.length}
                    </div>
                    <div className="tag-card__stat__label">Resources</div>
                  </div>
                  <div className="tag-card__stat tag-card__stat--events">
                    <div className="tag-card__stat__value">
                      {tag.events.length}
                    </div>
                    <div className="tag-card__stat__label">Events</div>
                  </div>
                  <div className="tag-card__stat tag-card__stat--middlewares">
                    <div className="tag-card__stat__value">
                      {tag.middlewares.length}
                    </div>
                    <div className="tag-card__stat__label">Middlewares</div>
                  </div>
                  <div className="tag-card__stat tag-card__stat--hooks">
                    <div className="tag-card__stat__value">
                      {tag.hooks.length}
                    </div>
                    <div className="tag-card__stat__label">Hooks</div>
                  </div>
                </div>
                <div className="tag-card__info-block">
                  <div className="label">File Path:</div>
                  <div className="value">
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
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className="tag-card__section">
              <h4 className="tag-card__section__title">
                Configuration Schema
              </h4>
              <div className="tag-card__config">
                <SchemaRenderer schemaString={tag.configSchema} />
              </div>
            </div>
          </div>
        </div>

        <TaggedElements tag={tag} introspector={introspector} />
      </div>

      <CodeModal
        title={modalTitle}
        subtitle={modalSubtitle}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        code={loading ? "Loading..." : error ? `Error: ${error}` : fileContent}
        enableEdit={Boolean(saveOnFile)}
        saveOnFile={saveOnFile}
      />
    </div>
  );
};
