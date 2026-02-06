import React from "react";
import { Task } from "../../../../../schema/model";
import { Introspector } from "../../../../../resources/models/Introspector";
import {
  formatFilePath,
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
import { DependenciesSection } from "./common/DependenciesSection";
import "./common/DependenciesSection.scss";
import { ElementCard, CardSection, InfoBlock } from "./common/ElementCard";

export interface TaskCardProps {
  task: Task;
  introspector: Introspector;
}

export const TaskCard: React.FC<TaskCardProps> = ({ task, introspector }) => {
  const dependencies = introspector.getDependencies(task);
  const middlewareUsages = introspector.getMiddlewareUsagesForTask(task.id);
  const emittedEvents = introspector.getEmittedEvents(task);

  // Check if this task is tunneled
  const tunnelResource = introspector.getTunnelForTask(task.id);
  const isTunneled = Boolean(tunnelResource);

  // Check for async context usage (placeholder for future implementation)
  // This will be populated when we parse context usage from source code
  const usedContexts: string[] = []; // Placeholder
  const contextInfo = usedContexts.length > 0
    ? usedContexts.map((contextId) => introspector.getAsyncContext(contextId)).filter(Boolean)
    : [];

  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [fileContent, setFileContent] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [coverageDetailsOpen, setCoverageDetailsOpen] = React.useState(false);
  const [coverageData, setCoverageData] = React.useState<any>(null);
  const [coverageFileContent, setCoverageFileContent] = React.useState<string | null>(null);
  const [coverageLoading, setCoverageLoading] = React.useState(false);
  const [coverageError, setCoverageError] = React.useState<string | null>(null);
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
    if (!task?.id) return;

    setCoverageDetailsOpen(true);
    setCoverageLoading(true);
    setCoverageError(null);

    try {
      // Fetch both coverage data and file content in parallel
      const [coverageResult, fileResult] = await Promise.all([
        graphqlRequest<{
          task: {
            id: string;
            coverage?: {
              percentage?: number | null;
              totalStatements?: number | null;
              coveredStatements?: number | null;
              details?: string | null;
            } | null;
          };
        }>(TASK_COVERAGE_DETAILS_QUERY, { id: task.id }),

        graphqlRequest<{
          task: { fileContents: string | null };
        }>(SAMPLE_TASK_FILE_QUERY, { id: task.id })
      ]);

      setCoverageData(coverageResult?.task?.coverage);
      setCoverageFileContent(fileResult?.task?.fileContents);
    } catch (e: any) {
      setCoverageError(e?.message ?? "Failed to load coverage data");
      setCoverageData(null);
      setCoverageFileContent(null);
    } finally {
      setCoverageLoading(false);
    }
  }

  return (
    <ElementCard
      prefix="task-card"
      elementId={task.id}
      title={
        <>
          {task.meta?.title || formatId(task.id)}
          {isTunneled && (
            <span
              className="task-card__tunnel-badge"
              title={`Tunneled by ${tunnelResource?.id}`}
            >
              🚇
            </span>
          )}
        </>
      }
      id={task.id}
      description={task.meta?.description}
      actions={
        <button
          type="button"
          className="btn"
          onClick={() => setIsExecuteOpen(true)}
          title="Run Task"
        >
          Run
        </button>
      }
    >
      <div className="task-card__grid">
        <CardSection prefix="task-card" title="Overview">
          <InfoBlock prefix="task-card" label="File Path:">
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
          </InfoBlock>

          {task.coverage?.percentage !== undefined && (
            <InfoBlock prefix="task-card" label="Coverage:">
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
            </InfoBlock>
          )}

          {task.registeredBy && (
            <InfoBlock prefix="task-card" label="Registered By:">
              <a
                href={`#element-${task.registeredBy}`}
                className="task-card__registrar-link"
              >
                {task.registeredBy}
              </a>
            </InfoBlock>
          )}

          <InfoBlock prefix="task-card" label="Emits Events:">
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
          </InfoBlock>

          {task.tags && task.tags.length > 0 && (
            <InfoBlock prefix="task-card" label="Tags:">
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
            </InfoBlock>
          )}

          {task.overriddenBy && (
            <div className="task-card__alert task-card__alert--warning">
              <div className="title">Overridden By:</div>
              <div className="content">{task.overriddenBy}</div>
            </div>
          )}
        </CardSection>

        <CardSection
          prefix="task-card"
          title="Input Schema"
          contentClassName="task-card__config"
        >
          <SchemaRenderer schemaString={task.inputSchema} />
        </CardSection>

        {isTunneled && (
          <CardSection
            prefix="task-card"
            title="🚇 Tunnel Information"
            className="task-card__tunnel-info"
            contentClassName="task-card__tunnel-info__content"
          >
            <InfoBlock prefix="task-card" label="Tunneled By:">
              <a
                href={`#element-${tunnelResource?.id}`}
                className="task-card__tunnel-link"
              >
                {tunnelResource?.meta?.title ||
                  formatId(tunnelResource?.id || "Unknown")}
              </a>
            </InfoBlock>
            {tunnelResource?.tunnelInfo && (
              <>
                <InfoBlock prefix="task-card" label="Tunnel Mode:">
                  {tunnelResource.tunnelInfo.mode}
                </InfoBlock>
                <InfoBlock prefix="task-card" label="Transport:">
                  {tunnelResource.tunnelInfo.transport}
                </InfoBlock>
                {tunnelResource.tunnelInfo.endpoint && (
                  <InfoBlock prefix="task-card" label="Remote Endpoint:">
                    {tunnelResource.tunnelInfo.endpoint}
                  </InfoBlock>
                )}
              </>
            )}
          </CardSection>
        )}

        {contextInfo.length > 0 && (
          <CardSection
            prefix="task-card"
            title="🔄 Async Contexts"
            className="task-card__context-info"
            contentClassName="task-card__context-info__content"
          >
            <InfoBlock prefix="task-card" label="Uses Contexts:">
              <div className="task-card__contexts">
                {contextInfo.map((context) => (
                  context && (
                    <a
                      key={context.id}
                      href={`#element-${context.id}`}
                      className="task-card__context-link"
                    >
                      {context.meta?.title || formatId(context.id)}
                    </a>
                  )
                ))}
              </div>
            </InfoBlock>
          </CardSection>
        )}
      </div>

      {dependencies.errors.length > 0 && (
        <CardSection prefix="task-card" title="Error Dependencies">
          <div className="task-card__error-dependencies">
            {dependencies.errors.map((dependencyError) => (
              <a
                key={dependencyError.id}
                href={`#element-${dependencyError.id}`}
                className="task-card__relation-item task-card__relation-item--error task-card__relation-link"
              >
                <div className="title title--error">
                  {dependencyError.meta?.title || formatId(dependencyError.id)}
                </div>
                <div className="id">{dependencyError.id}</div>
              </a>
            ))}
          </div>
        </CardSection>
      )}

      {(dependencies.tasks.length > 0 ||
        dependencies.hooks.length > 0 ||
        dependencies.resources.length > 0 ||
        emittedEvents.length > 0) && (
        <div className="task-card__relations">
          <DependenciesSection
            dependencies={{
              tasks: dependencies.tasks,
              hooks: dependencies.hooks,
              resources: dependencies.resources,
              errors: [], // Errors handled in the dedicated section above
            }}
            emittedEvents={emittedEvents}
            className="task-card__relations"
          />
        </div>
      )}

      {middlewareUsages.length > 0 && (
        <div className="task-card__middleware">
          <h4 className="task-card__middleware__title">Middleware Configuration</h4>
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
        code={
          coverageLoading
            ? "Loading coverage data..."
            : coverageError
            ? `Error: ${coverageError}`
            : coverageFileContent
        }
        enableEdit={false}
        saveOnFile={null}
        coverageData={coverageData}
        showCoverage={true}
      />
    </ElementCard>
  );
};
