import React from "react";
import { Error } from "../../../../../schema/model";
import { Introspector } from "../../../../../resources/models/Introspector";
import { formatFilePath, formatId } from "../utils/formatting";
import { CodeModal } from "./CodeModal";
import {
  graphqlRequest,
  SAMPLE_ERROR_FILE_QUERY,
} from "../utils/graphqlClient";
import { TagsSection } from "./TagsSection";
import "./ErrorCard.scss";
import { SchemaRenderer } from "./SchemaRenderer";
import { ElementKindBadge, SystemBadge } from "./common/ElementKindBadge";
import { isSystemElement } from "../utils/isSystemElement";

export interface ErrorCardProps {
  error: Error;
  introspector: Introspector;
}

// Helper function to determine CSS class based on element type
function getElementClass(element: any): string {
  if ("emits" in element && "dependsOn" in element && !("events" in element)) {
    return "error-card__thrower-link--task";
  }
  if ("events" in element) {
    return "error-card__thrower-link--hook";
  }
  if ("registers" in element) {
    return "error-card__thrower-link--resource";
  }
  if (
    "type" in element &&
    (element.type === "task" || element.type === "resource")
  ) {
    return "error-card__thrower-link--middleware";
  }
  return "";
}

export const ErrorCard: React.FC<ErrorCardProps> = ({
  error,
  introspector,
}) => {
  const thrownByTasks = introspector.getTasksUsingError(error.id);
  const thrownByResources = introspector.getResourcesUsingError(error.id);
  const thrownByHooks = introspector.getHooksUsingError(error.id);
  const thrownByMiddlewares = introspector.getMiddlewaresUsingError(error.id);
  const allThrowers = [
    ...thrownByTasks,
    ...thrownByResources,
    ...thrownByHooks,
    ...thrownByMiddlewares,
  ];

  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [fileContent, setFileContent] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [errorState, setErrorState] = React.useState<string | null>(null);

  async function openFileModal() {
    if (!error?.id) return;
    setIsModalOpen(true);
    setLoading(true);
    setErrorState(null);
    try {
      const data = await graphqlRequest<{
        error: { fileContents: string | null };
      }>(SAMPLE_ERROR_FILE_QUERY, { id: error.id });
      setFileContent(data?.error?.fileContents ?? null);
    } catch (e: any) {
      setErrorState(e?.message ?? "Failed to load file");
      setFileContent(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div id={`element-${error.id}`} className="error-card">
      <div className="error-card__header">
        <div className="error-card__header-content">
          <div className="main">
            <h3 className="error-card__title">
              {error.meta?.title || formatId(error.id)}
            </h3>
            <div className="error-card__id">{error.id}</div>
            {error.meta?.description && (
              <p className="error-card__description">
                {error.meta.description}
              </p>
            )}
          </div>
          {isSystemElement(error) && <SystemBadge />}
          <ElementKindBadge kind="error" />
        </div>
      </div>

      <div className="error-card__content">
        <div className="error-card__grid">
          <div>
            <div className="error-card__section">
              <h4 className="error-card__section__title">Overview</h4>
              <div className="error-card__section__content">
                <div className="error-card__info-block">
                  <div className="label">File Path:</div>
                  <div className="value">
                    {error.filePath ? (
                      <a
                        type="button"
                        onClick={openFileModal}
                        title="View file contents"
                      >
                        {formatFilePath(error.filePath)}
                      </a>
                    ) : (
                      formatFilePath(error.filePath)
                    )}
                  </div>
                </div>

                {error.registeredBy && (
                  <div className="error-card__info-block">
                    <div className="label">Registered By:</div>
                    <div className="value">
                      <a
                        href={`#element-${error.registeredBy}`}
                        className="error-card__registrar-link"
                      >
                        {error.registeredBy}
                      </a>
                    </div>
                  </div>
                )}

                {error.tags && error.tags.length > 0 && (
                  <div className="error-card__info-block">
                    <div className="label">Tags:</div>
                    <div className="value">
                      <div className="error-card__tags">
                        {introspector.getTagsByIds(error.tags).map((tag) => (
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

                <div className="error-card__info-block">
                  <div className="label">Thrown By:</div>
                  <div className="value">
                    {allThrowers.length > 0 ? (
                      <div className="error-card__throwers">
                        {allThrowers.map((thrower) => (
                          <a
                            key={thrower.id}
                            href={`#element-${thrower.id}`}
                            className={`error-card__thrower-link ${getElementClass(
                              thrower
                            )}`}
                          >
                            <div className="title">
                              {thrower.meta?.title || formatId(thrower.id)}
                            </div>
                            <div className="id">{thrower.id}</div>
                          </a>
                        ))}
                      </div>
                    ) : (
                      <span className="error-card__no-throwers">None</span>
                    )}
                  </div>
                </div>

                {error.overriddenBy && (
                  <div className="error-card__alert error-card__alert--warning">
                    <div className="title">Overridden By:</div>
                    <div className="content">{error.overriddenBy}</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div>
            <div className="error-card__section">
              <h4 className="error-card__section__title">Error Data Schema</h4>
              <div className="error-card__schema">
                {error.dataSchema ? (
                  <SchemaRenderer schemaString={error.dataSchema} />
                ) : (
                  <div className="error-card__no-schema">
                    No schema defined for error data
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {allThrowers.length > 0 && (
          <div className="error-card__relations">
            <h4 className="error-card__relations__title">
              Usage Relationships
            </h4>
            <div className="error-card__relations__grid">
              {thrownByTasks.length > 0 && (
                <div className="error-card__relations__category">
                  <h5>Thrown By Tasks ({thrownByTasks.length})</h5>
                  <div className="error-card__relations__items">
                    {thrownByTasks.map((task) => (
                      <a
                        key={task.id}
                        href={`#element-${task.id}`}
                        className="error-card__relation-item error-card__relation-item--task error-card__relation-link"
                      >
                        <div className="title title--task">
                          {task.meta?.title || formatId(task.id)}
                        </div>
                        <div className="id">{task.id}</div>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {thrownByResources.length > 0 && (
                <div className="error-card__relations__category">
                  <h5>Thrown By Resources ({thrownByResources.length})</h5>
                  <div className="error-card__relations__items">
                    {thrownByResources.map((resource) => (
                      <a
                        key={resource.id}
                        href={`#element-${resource.id}`}
                        className="error-card__relation-item error-card__relation-item--resource error-card__relation-link"
                      >
                        <div className="title title--resource">
                          {resource.meta?.title || formatId(resource.id)}
                        </div>
                        <div className="id">{resource.id}</div>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {thrownByHooks.length > 0 && (
                <div className="error-card__relations__category">
                  <h5>Thrown By Hooks ({thrownByHooks.length})</h5>
                  <div className="error-card__relations__items">
                    {thrownByHooks.map((hook) => (
                      <a
                        key={hook.id}
                        href={`#element-${hook.id}`}
                        className="error-card__relation-item error-card__relation-item--hook error-card__relation-link"
                      >
                        <div className="title title--hook">
                          {hook.meta?.title || formatId(hook.id)}
                        </div>
                        <div className="id">{hook.id}</div>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {thrownByMiddlewares.length > 0 && (
                <div className="error-card__relations__category">
                  <h5>Thrown By Middlewares ({thrownByMiddlewares.length})</h5>
                  <div className="error-card__relations__items">
                    {thrownByMiddlewares.map((middleware) => (
                      <a
                        key={middleware.id}
                        href={`#element-${middleware.id}`}
                        className="error-card__relation-item error-card__relation-item--middleware error-card__relation-link"
                      >
                        <div className="title title--middleware">
                          {middleware.meta?.title || formatId(middleware.id)}
                        </div>
                        <div className="id">{middleware.id}</div>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <TagsSection
          element={error}
          introspector={introspector}
          className="error-card__tags-section"
        />
      </div>

      <CodeModal
        title={error.meta?.title || formatId(error.id)}
        subtitle={error.filePath || undefined}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        code={
          loading
            ? "Loading..."
            : errorState
            ? `Error: ${errorState}`
            : fileContent
        }
        enableEdit={Boolean(error.filePath)}
        saveOnFile={error.filePath || null}
      />
    </div>
  );
};
