import React from "react";
import { Task } from "../../../../../schema/model";
import { Introspector } from "../../../../../resources/models/Introspector";
import {
  formatSchema,
  formatFilePath,
  formatArray,
  formatId,
} from "../utils/formatting";
import { CodeModal } from "./CodeModal";
import {
  graphqlRequest,
  SAMPLE_TASK_FILE_QUERY,
  TASK_COVERAGE_DETAILS_QUERY,
} from "../utils/graphqlClient";
import { TagsSection } from "./TagsSection";
import "./TaskCard.scss";
import { SchemaRenderer } from "./SchemaRenderer";
import ExecuteModal from "./ExecuteModal";
export interface TaskCardProps {
  task: Task;
  introspector: Introspector;
}

export const TaskCard: React.FC<TaskCardProps> = ({ task, introspector }) => {
  const dependencies = introspector.getDependencies(task);
  const middlewareUsages = introspector.getMiddlewareUsagesForTask(task.id);
  const emittedEvents = introspector.getEmittedEvents(task);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [fileContent, setFileContent] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [coverageDetailsOpen, setCoverageDetailsOpen] = React.useState(false);
  const [coverageDetailsText, setCoverageDetailsText] = React.useState<
    string | null
  >(null);
  const [isExecuteOpen, setIsExecuteOpen] = React.useState(false);

  async function openFileModal() {
    if (!task?.id) return;
    setIsModalOpen(true);
    setLoading(true);
    setError(null);
    try {
      const data = await graphqlRequest<{
        task: { fileContents: string | null };
      }>(SAMPLE_TASK_FILE_QUERY, { id: task.id });
      setFileContent(data?.task?.fileContents ?? null);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load file");
      setFileContent(null);
    } finally {
      setLoading(false);
    }
  }

  // Listen for execute requests from ElementTable
  React.useEffect(() => {
    const handler = (e: any) => {
      const ce = e as CustomEvent<{ type: string; id: string }>;
      if (ce?.detail?.type === "task" && ce.detail.id === task.id) {
        setIsExecuteOpen(true);
        // Note: Scrolling handled by main Documentation component hash navigation
      }
    };
    window.addEventListener("docs:execute-element", handler);
    return () => window.removeEventListener("docs:execute-element", handler);
  }, [task.id]);

  async function openCoverageDetails() {
    try {
      const data = await graphqlRequest<{
        task: {
          id: string;
          coverage?: {
            percentage?: number | null;
            totalStatements?: number | null;
            coveredStatements?: number | null;
            details?: string | null;
          } | null;
        };
      }>(TASK_COVERAGE_DETAILS_QUERY, { id: task.id });
      const c = data?.task?.coverage;
      const text = c
        ? `Percentage: ${c.percentage ?? 0}%\nStatements: ${
            c.coveredStatements ?? 0
          }/${c.totalStatements ?? 0}\n\nDetails (raw):\n${c.details ?? "N/A"}`
        : "No coverage details.";
      setCoverageDetailsText(text);
      setCoverageDetailsOpen(true);
    } catch (e: any) {
      setCoverageDetailsText(
        `Error loading coverage: ${e?.message ?? String(e)}`
      );
      setCoverageDetailsOpen(true);
    }
  }

  return (
    <div id={`element-${task.id}`} className="task-card">
      <div className="task-card__header">
        <div className="task-card__header-content">
          <div className="main">
            <h3 className="task-card__title">
              {task.meta?.title || formatId(task.id)}
            </h3>
            <div className="task-card__id">{task.id}</div>
            {task.meta?.description && (
              <p className="task-card__description">{task.meta.description}</p>
            )}
          </div>
          <div className="task-card__actions">
            <button
              type="button"
              className="btn"
              onClick={() => setIsExecuteOpen(true)}
              title="Run Task"
            >
              Run
            </button>
          </div>
        </div>
      </div>

      <div className="task-card__content">
        <div className="task-card__grid">
          <div>
            <div className="task-card__section">
              <h4 className="task-card__section__title">Overview</h4>
              <div className="task-card__section__content">
                <div className="task-card__info-block">
                  <div className="label">File Path:</div>
                  <div className="value">
                    {task.filePath ? (
                      <a
                        type="button"
                        onClick={openFileModal}
                        title="View file contents"
                      >
                        {formatFilePath(task.filePath)}
                      </a>
                    ) : (
                      formatFilePath(task.filePath)
                    )}
                  </div>
                </div>

                {task.coverage?.percentage !== undefined && (
                  <div className="task-card__info-block">
                    <div className="label">Coverage:</div>
                    <div className="value">
                      <span
                        style={{
                          fontWeight: 600,
                          color:
                            task.coverage.percentage >= 100
                              ? "#2e7d32"
                              : task.coverage.percentage >= 80
                              ? "#ef6c00"
                              : "#c62828",
                        }}
                      >
                        {task.coverage.percentage}%
                      </span>{" "}
                      <button
                        type="button"
                        onClick={openCoverageDetails}
                        title="View coverage details"
                      >
                        (View Coverage)
                      </button>
                    </div>
                  </div>
                )}

                {task.registeredBy && (
                  <div className="task-card__info-block">
                    <div className="label">Registered By:</div>
                    <div className="value">
                      <a
                        href={`#element-${task.registeredBy}`}
                        className="task-card__registrar-link"
                      >
                        {task.registeredBy}
                      </a>
                    </div>
                  </div>
                )}

                <div className="task-card__info-block">
                  <div className="label">Emits Events:</div>
                  <div className="value">
                    {task.emits && task.emits.length > 0 ? (
                      <div className="task-card__emits-events">
                        {task.emits.map((eventName) => {
                          const event = introspector.getEvent(eventName);
                          return event ? (
                            <a
                              key={eventName}
                              href={`#element-${event.id}`}
                              className="task-card__emit-event-link"
                            >
                              {eventName}
                            </a>
                          ) : (
                            <span
                              key={eventName}
                              className="task-card__emit-event-text"
                            >
                              {eventName}
                            </span>
                          );
                        })}
                      </div>
                    ) : (
                      <span className="task-card__no-events">None</span>
                    )}
                  </div>
                </div>

                {task.tags && task.tags.length > 0 && (
                  <div className="task-card__info-block">
                    <div className="label">Tags:</div>
                    <div className="value">
                      <div className="task-card__tags">
                        {introspector.getTagsByIds(task.tags).map((tag) => (
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

                {task.overriddenBy && (
                  <div className="task-card__alert task-card__alert--warning">
                    <div className="title">Overridden By:</div>
                    <div className="content">{task.overriddenBy}</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div>
            <div className="task-card__section">
              <h4 className="task-card__section__title">Input Schema</h4>
              <div className="task-card__config">
                <SchemaRenderer schemaString={task.inputSchema} />
              </div>
            </div>
          </div>
        </div>

        {(dependencies.tasks.length > 0 ||
          dependencies.resources.length > 0 ||
          emittedEvents.length > 0) && (
          <div className="task-card__relations">
            <h4 className="task-card__relations__title">
              Dependencies & Relations
            </h4>
            <div className="task-card__relations__grid">
              {dependencies.tasks.length > 0 && (
                <div className="task-card__relations__category">
                  <h5>Task Dependencies</h5>
                  <div className="task-card__relations__items">
                    {dependencies.tasks.map((dep) => (
                      <a
                        key={dep.id}
                        href={`#element-${dep.id}`}
                        className="task-card__relation-item task-card__relation-item--task task-card__relation-link"
                      >
                        <div className="title title--task">
                          {dep.meta?.title || formatId(dep.id)}
                        </div>
                        <div className="id">{dep.id}</div>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {dependencies.resources.length > 0 && (
                <div className="task-card__relations__category">
                  <h5>Resource Dependencies</h5>
                  <div className="task-card__relations__items">
                    {dependencies.resources.map((dep) => (
                      <a
                        key={dep.id}
                        href={`#element-${dep.id}`}
                        className="task-card__relation-item task-card__relation-item--resource task-card__relation-link"
                      >
                        <div className="title title--resource">
                          {dep.meta?.title || formatId(dep.id)}
                        </div>
                        <div className="id">{dep.id}</div>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {emittedEvents.length > 0 && (
                <div className="task-card__relations__category">
                  <h5>Emitted Events</h5>
                  <div className="task-card__relations__items">
                    {emittedEvents.map((event) => (
                      <a
                        key={event.id}
                        href={`#element-${event.id}`}
                        className="task-card__relation-item task-card__relation-item--event task-card__relation-link"
                      >
                        <div className="title title--event">
                          {event.meta?.title || formatId(event.id)}
                        </div>
                        <div className="id">{event.id}</div>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {middlewareUsages.length > 0 && (
          <div className="task-card__middleware">
            <h4 className="task-card__middleware__title">
              Middleware Configuration
            </h4>
            <div className="task-card__middleware__items">
              {middlewareUsages.map((usage) => (
                <div key={usage.id} className="task-card__middleware__item">
                  <a
                    href={`#element-${usage.id}`}
                    className="task-card__middleware-link"
                  >
                    <div className="title">
                      {usage.node.meta?.title || formatId(usage.id)}
                    </div>
                    <div className="id">{usage.id}</div>
                  </a>
                  {usage.config && (
                    <div>
                      <div className="config-title">Configuration:</div>
                      <pre className="config-block">{usage.config}</pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <TagsSection
          element={task}
          introspector={introspector}
          className="task-card__tags-section"
        />
      </div>

      <CodeModal
        title={task.meta?.title || formatId(task.id)}
        subtitle={task.filePath || undefined}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        code={loading ? "Loading..." : error ? `Error: ${error}` : fileContent}
        enableEdit={Boolean(task.filePath)}
        saveOnFile={task.filePath || null}
      />

      <ExecuteModal
        isOpen={isExecuteOpen}
        title={task.meta?.title || formatId(task.id)}
        schemaString={task.inputSchema}
        onClose={() => setIsExecuteOpen(false)}
        onInvoke={async ({ inputJson }) => {
          const INVOKE_TASK_MUTATION = `
            mutation InvokeTask($taskId: ID!, $inputJson: String, $evalInput: Boolean) {
              invokeTask(taskId: $taskId, inputJson: $inputJson, evalInput: $evalInput) {
                success
                error
                result
                invocationId
              }
            }
          `;

          try {
            const res = await graphqlRequest<{
              invokeTask: {
                success: boolean;
                error?: string | null;
                result?: string | null;
                invocationId?: string | null;
              };
            }>(INVOKE_TASK_MUTATION, {
              taskId: task.id,
              inputJson: inputJson?.trim() || undefined,
              evalInput: false,
            });

            return {
              output: res.invokeTask.result ?? undefined,
              error: res.invokeTask.error ?? undefined,
            };
          } catch (e: any) {
            return { error: e?.message ?? String(e) };
          }
        }}
      />

      <CodeModal
        title={`${task.meta?.title || formatId(task.id)} — Coverage Details`}
        subtitle={task.filePath || undefined}
        isOpen={coverageDetailsOpen}
        onClose={() => setCoverageDetailsOpen(false)}
        code={coverageDetailsText}
        enableEdit={false}
        saveOnFile={null}
      />
    </div>
  );
};
