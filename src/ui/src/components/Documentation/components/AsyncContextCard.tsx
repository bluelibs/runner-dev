import React from "react";
import { AsyncContext } from "../../../../../schema/model";
import { Introspector } from "../../../../../resources/models/Introspector";
import { formatFilePath, formatId } from "../utils/formatting";
import { CodeModal } from "./CodeModal";
import {
  graphqlRequest,
  SAMPLE_ASYNC_CONTEXT_FILE_QUERY,
} from "../utils/graphqlClient";
import { TagsSection } from "./TagsSection";
import "./AsyncContextCard.scss";
import { ElementKindBadge, SystemBadge } from "./common/ElementKindBadge";
import { isSystemElement } from "../utils/isSystemElement";

export interface AsyncContextCardProps {
  asyncContext: AsyncContext;
  introspector: Introspector;
}

export const AsyncContextCard: React.FC<AsyncContextCardProps> = ({
  asyncContext,
  introspector,
}) => {
  const usedByTasks = introspector.getTasksUsingContext(asyncContext.id);
  const usedByResources = introspector.getResourcesUsingContext(
    asyncContext.id
  );
  const usedByHooks = introspector.getHooksUsingContext(asyncContext.id);
  const usedByMiddlewares = introspector.getMiddlewaresUsingContext(
    asyncContext.id
  );
  const requiredByTasks = introspector.getTasksRequiringContext(
    asyncContext.id
  );
  const providedByResources = introspector.getResourcesProvidingContext(
    asyncContext.id
  );

  // Build a set of IDs that use .require() for quick lookup
  const requiredByIds = new Set(requiredByTasks.map((t) => t.id));

  // Merge requiredBy tasks that aren't already in usedByTasks
  const usedByTaskIds = new Set(usedByTasks.map((t) => t.id));
  const requireOnlyTasks = requiredByTasks.filter(
    (t) => !usedByTaskIds.has(t.id)
  );

  const allUsers = [
    ...usedByTasks,
    ...requireOnlyTasks,
    ...usedByResources,
    ...usedByHooks,
    ...usedByMiddlewares,
  ];

  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [fileContent, setFileContent] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [errorState, setErrorState] = React.useState<string | null>(null);

  async function openFileModal() {
    if (!asyncContext?.id) return;
    setIsModalOpen(true);
    setLoading(true);
    setErrorState(null);
    try {
      const data = await graphqlRequest<{
        asyncContext: { fileContents: string | null };
      }>(SAMPLE_ASYNC_CONTEXT_FILE_QUERY, { id: asyncContext.id });
      setFileContent(data?.asyncContext?.fileContents ?? null);
    } catch (e: any) {
      setErrorState(e?.message ?? "Failed to load file");
      setFileContent(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div id={`element-${asyncContext.id}`} className="async-context-card">
      <div className="async-context-card__header">
        <div className="async-context-card__header-content">
          <div className="main">
            <h3 className="async-context-card__title">
              {asyncContext.meta?.title || formatId(asyncContext.id)}
            </h3>
            <div className="async-context-card__id">{asyncContext.id}</div>
            {asyncContext.meta?.description && (
              <p className="async-context-card__description">
                {asyncContext.meta.description}
              </p>
            )}
          </div>
          {isSystemElement(asyncContext) && <SystemBadge />}
          <ElementKindBadge kind="async-context" />
        </div>
      </div>

      <div className="async-context-card__content">
        <div className="async-context-card__grid">
          <div>
            <div className="async-context-card__section">
              <h4 className="async-context-card__section__title">Overview</h4>
              <div className="async-context-card__section__content">
                <div className="async-context-card__info-block">
                  <div className="label">File Path:</div>
                  <div className="value">
                    {asyncContext.filePath ? (
                      <a
                        type="button"
                        onClick={openFileModal}
                        title="View file contents"
                      >
                        {formatFilePath(asyncContext.filePath)}
                      </a>
                    ) : (
                      formatFilePath(asyncContext.filePath)
                    )}
                  </div>
                </div>

                {asyncContext.registeredBy && (
                  <div className="async-context-card__info-block">
                    <div className="label">Registered By:</div>
                    <div className="value">
                      <a
                        href={`#element-${asyncContext.registeredBy}`}
                        className="async-context-card__registrar-link"
                      >
                        {asyncContext.registeredBy}
                      </a>
                    </div>
                  </div>
                )}

                {asyncContext.tags && asyncContext.tags.length > 0 && (
                  <div className="async-context-card__info-block">
                    <div className="label">Tags:</div>
                    <div className="value">
                      <div className="async-context-card__tags">
                        {introspector
                          .getTagsByIds(asyncContext.tags)
                          .map((tag) => (
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

                <div className="async-context-card__info-block">
                  <div className="label">Usage Count:</div>
                  <div className="value">
                    Used by {allUsers.length} element(s)
                  </div>
                </div>

                {asyncContext.overriddenBy && (
                  <div className="async-context-card__alert async-context-card__alert--warning">
                    <div className="title">Overridden By:</div>
                    <div className="content">{asyncContext.overriddenBy}</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div>
            <div className="async-context-card__section">
              <h4 className="async-context-card__section__title">
                Serialization Methods
              </h4>
              <div className="async-context-card__serialization">
                {asyncContext.serialize && (
                  <div className="async-context-card__method">
                    <div className="async-context-card__method__header">
                      <h5>Serialize Method</h5>
                    </div>
                    <pre className="async-context-card__method__code">
                      {asyncContext.serialize}
                    </pre>
                  </div>
                )}

                {asyncContext.parse && (
                  <div className="async-context-card__method">
                    <div className="async-context-card__method__header">
                      <h5>Parse Method</h5>
                    </div>
                    <pre className="async-context-card__method__code">
                      {asyncContext.parse}
                    </pre>
                  </div>
                )}

                {!asyncContext.serialize && !asyncContext.parse && (
                  <div className="async-context-card__no-methods">
                    No custom serialization methods defined. Using default EJSON
                    serialization.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {(allUsers.length > 0 || providedByResources.length > 0) && (
          <div className="async-context-card__relations">
            <h4 className="async-context-card__relations__title">
              Context Relationships
            </h4>
            <div className="async-context-card__relations__grid">
              {providedByResources.length > 0 && (
                <div className="async-context-card__relations__category">
                  <h5>Provided By Resources ({providedByResources.length})</h5>
                  <div className="async-context-card__relations__items">
                    {providedByResources.map((resource) => (
                      <a
                        key={resource.id}
                        href={`#element-${resource.id}`}
                        className="async-context-card__relation-item async-context-card__relation-item--provider async-context-card__relation-link"
                      >
                        <div className="title title--provider">
                          {resource.meta?.title || formatId(resource.id)}
                        </div>
                        <div className="id">{resource.id}</div>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {(usedByTasks.length > 0 || requireOnlyTasks.length > 0) && (
                <div className="async-context-card__relations__category">
                  <h5>
                    Used By Tasks (
                    {usedByTasks.length + requireOnlyTasks.length})
                  </h5>
                  <div className="async-context-card__relations__items">
                    {[...usedByTasks, ...requireOnlyTasks].map((task) => (
                      <a
                        key={task.id}
                        href={`#element-${task.id}`}
                        className="async-context-card__relation-item async-context-card__relation-item--task async-context-card__relation-link"
                      >
                        <div className="title title--task">
                          {task.meta?.title || formatId(task.id)}
                          {requiredByIds.has(task.id) && (
                            <span
                              className="async-context-card__require-badge"
                              title="Uses .require() middleware — context must be provided or the task will throw"
                            >
                              .require()
                            </span>
                          )}
                        </div>
                        <div className="id">
                          {task.id}
                          {!usedByTaskIds.has(task.id) && (
                            <span className="async-context-card__require-only">
                              via middleware only
                            </span>
                          )}
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {usedByResources.length > 0 && (
                <div className="async-context-card__relations__category">
                  <h5>Used By Resources ({usedByResources.length})</h5>
                  <div className="async-context-card__relations__items">
                    {usedByResources.map((resource) => (
                      <a
                        key={resource.id}
                        href={`#element-${resource.id}`}
                        className="async-context-card__relation-item async-context-card__relation-item--resource async-context-card__relation-link"
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

              {usedByHooks.length > 0 && (
                <div className="async-context-card__relations__category">
                  <h5>Used By Hooks ({usedByHooks.length})</h5>
                  <div className="async-context-card__relations__items">
                    {usedByHooks.map((hook) => (
                      <a
                        key={hook.id}
                        href={`#element-${hook.id}`}
                        className="async-context-card__relation-item async-context-card__relation-item--hook async-context-card__relation-link"
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

              {usedByMiddlewares.length > 0 && (
                <div className="async-context-card__relations__category">
                  <h5>Used By Middlewares ({usedByMiddlewares.length})</h5>
                  <div className="async-context-card__relations__items">
                    {usedByMiddlewares.map((middleware) => (
                      <a
                        key={middleware.id}
                        href={`#element-${middleware.id}`}
                        className="async-context-card__relation-item async-context-card__relation-item--middleware async-context-card__relation-link"
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
          element={asyncContext}
          introspector={introspector}
          className="async-context-card__tags-section"
        />
      </div>

      <CodeModal
        title={asyncContext.meta?.title || formatId(asyncContext.id)}
        subtitle={asyncContext.filePath || undefined}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        code={
          loading
            ? "Loading..."
            : errorState
            ? `Error: ${errorState}`
            : fileContent
        }
        enableEdit={Boolean(asyncContext.filePath)}
        saveOnFile={asyncContext.filePath || null}
      />
    </div>
  );
};
