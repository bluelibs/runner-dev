import React from "react";
import { Resource } from "../../../../../schema/model";
import { Introspector } from "../../../../../resources/models/Introspector";
import { formatConfig, formatFilePath, formatId } from "../utils/formatting";
import { CodeModal } from "./CodeModal";
import {
  graphqlRequest,
  SAMPLE_RESOURCE_FILE_QUERY,
  RESOURCE_COVERAGE_DETAILS_QUERY,
} from "../utils/graphqlClient";
import { TagsSection } from "./TagsSection";
import "./ResourceCard.scss";
import { SchemaRenderer } from "./SchemaRenderer";
import { DependenciesSection } from "./common/DependenciesSection";
import "./common/DependenciesSection.scss";
import { ElementCard, CardSection, InfoBlock } from "./common/ElementCard";
import { hasTunnelTag } from "../../../../../resources/models/tunnel.tools";
import { isSystemElement } from "../utils/isSystemElement";

export interface ResourceCardProps {
  resource: Resource;
  introspector: Introspector;
}

export const ResourceCard: React.FC<ResourceCardProps> = ({
  resource,
  introspector,
}) => {
  const middlewareUsages = introspector.getMiddlewareUsagesForResource(
    resource.id
  );
  const dependentTasks = introspector.getTasksUsingResource(resource.id);
  const dependencies = introspector.getDependencies(resource);
  const registeredElements = [
    ...introspector.getTasksByIds(resource.registers),
    ...introspector.getResourcesByIds(resource.registers),
    ...introspector.getMiddlewaresByIds(resource.registers),
    ...introspector.getEventsByIds(resource.registers),
    ...introspector.getHooksByIds(resource.registers),
  ];

  // Check if this is a tunnel resource
  const isTunnel = hasTunnelTag(resource.tags || null);
  const tunneledTasks = isTunnel
    ? introspector.getTunneledTasks(resource.id)
    : [];
  const tunneledEvents = isTunnel
    ? introspector.getTunneledEvents(resource.id)
    : [];

  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [fileContent, setFileContent] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [coverageDetailsOpen, setCoverageDetailsOpen] = React.useState(false);
  const [coverageData, setCoverageData] = React.useState<any>(null);
  const [coverageFileContent, setCoverageFileContent] = React.useState<
    string | null
  >(null);
  const [coverageLoading, setCoverageLoading] = React.useState(false);
  const [coverageError, setCoverageError] = React.useState<string | null>(null);

  async function openFileModal() {
    if (!resource?.id) return;
    setIsModalOpen(true);
    setLoading(true);
    setError(null);
    try {
      const data = await graphqlRequest<{
        resource: { fileContents: string | null };
      }>(SAMPLE_RESOURCE_FILE_QUERY, { id: resource.id });
      setFileContent(data?.resource?.fileContents ?? null);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load file");
      setFileContent(null);
    } finally {
      setLoading(false);
    }
  }

  async function openCoverageDetails() {
    if (!resource?.id) return;

    setCoverageDetailsOpen(true);
    setCoverageLoading(true);
    setCoverageError(null);

    try {
      // Fetch both coverage data and file content in parallel
      const [coverageResult, fileResult] = await Promise.all([
        graphqlRequest<{
          resource: {
            id: string;
            coverage?: {
              percentage?: number | null;
              totalStatements?: number | null;
              coveredStatements?: number | null;
              details?: string | null;
            } | null;
          };
        }>(RESOURCE_COVERAGE_DETAILS_QUERY, { id: resource.id }),

        graphqlRequest<{
          resource: { fileContents: string | null };
        }>(SAMPLE_RESOURCE_FILE_QUERY, { id: resource.id }),
      ]);

      setCoverageData(coverageResult?.resource?.coverage);
      setCoverageFileContent(fileResult?.resource?.fileContents);
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
      prefix="resource-card"
      elementId={resource.id}
      kindLabel="resource"
      isSystem={isSystemElement(resource)}
      title={
        <>
          {resource.meta?.title || formatId(resource.id)}
          {isTunnel && (
            <span
              className="resource-card__tunnel-badge"
              title="Tunnel Resource"
            >
              🚇
            </span>
          )}
        </>
      }
      id={resource.id}
      description={resource.meta?.description}
    >
      <div className="resource-card__grid">
        <CardSection prefix="resource-card" title="Overview">
          <InfoBlock prefix="resource-card" label="File Path:">
            {resource.filePath ? (
              <a
                type="button"
                onClick={openFileModal}
                title="View file contents"
              >
                {formatFilePath(resource.filePath)}
              </a>
            ) : (
              formatFilePath(resource.filePath)
            )}
          </InfoBlock>

          {resource.coverage?.percentage !== undefined && (
            <InfoBlock prefix="resource-card" label="Coverage:">
              <span
                style={{
                  fontWeight: 600,
                  color:
                    resource.coverage.percentage >= 100
                      ? "#2e7d32"
                      : resource.coverage.percentage >= 80
                      ? "#ef6c00"
                      : "#c62828",
                }}
              >
                {resource.coverage.percentage}%
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

          {resource.registeredBy && (
            <InfoBlock prefix="resource-card" label="Registered By:">
              <a
                href={`#element-${resource.registeredBy}`}
                className="resource-card__registrar-link"
              >
                {resource.registeredBy}
              </a>
            </InfoBlock>
          )}

          <InfoBlock prefix="resource-card" label="Visibility:">
            {resource.isPrivate ? "Private" : "Public"}
          </InfoBlock>

          <InfoBlock prefix="resource-card" label="Exports:">
            {Array.isArray(resource.exports) && resource.exports.length > 0 ? (
              <div className="resource-card__tags">
                {resource.exports.map((exportedId) => (
                  <a
                    href={`#element-${exportedId}`}
                    key={exportedId}
                    className="clean-button"
                  >
                    {formatId(exportedId)}
                  </a>
                ))}
              </div>
            ) : (
              "Not configured (all registered items are public by default)"
            )}
          </InfoBlock>

          {resource.context && (
            <InfoBlock prefix="resource-card" label="Context:">
              {resource.context}
            </InfoBlock>
          )}

          <InfoBlock prefix="resource-card" label="Used By Tasks:">
            {dependentTasks.length} task(s)
          </InfoBlock>

          {resource.tags && resource.tags.length > 0 && (
            <InfoBlock prefix="resource-card" label="Tags:">
              <div className="resource-card__tags">
                {introspector.getTagsByIds(resource.tags).map((tag) => (
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

          {resource.overriddenBy && (
            <div className="resource-card__alert resource-card__alert--warning">
              <div className="title">Overridden By:</div>
              <div className="content">{resource.overriddenBy}</div>
            </div>
          )}
        </CardSection>

        <CardSection
          prefix="resource-card"
          title="Configuration"
          contentClassName="resource-card__config"
        >
          <div className="resource-card__config__subsection">
            <h5>Current Configuration</h5>
            <pre className="resource-card__config__block">
              {formatConfig(resource.config)}
            </pre>
          </div>

          <div className="resource-card__config__subsection">
            <h5>Configuration Schema</h5>
            <SchemaRenderer schemaString={resource.configSchema} />
          </div>
        </CardSection>

        {isTunnel && (
          <CardSection
            prefix="resource-card"
            title="🚇 Tunnel Configuration"
            className="resource-card__tunnel-section"
            contentClassName="resource-card__tunnel"
          >
            <div className="resource-card__tunnel__overview">
              <InfoBlock prefix="resource-card" label="Mode:">
                <span className="resource-card__tunnel__mode">
                  {resource.tunnelInfo?.mode || "Unknown"}
                </span>
              </InfoBlock>
              <InfoBlock prefix="resource-card" label="Transport:">
                {resource.tunnelInfo?.transport || "Unknown"}
              </InfoBlock>
              {resource.tunnelInfo?.endpoint && (
                <InfoBlock prefix="resource-card" label="Endpoint:">
                  {resource.tunnelInfo.endpoint}
                </InfoBlock>
              )}
              {resource.tunnelInfo?.auth && (
                <InfoBlock prefix="resource-card" label="Authentication:">
                  {resource.tunnelInfo.auth}
                </InfoBlock>
              )}
            </div>

            {(tunneledTasks.length > 0 || tunneledEvents.length > 0) && (
              <div className="resource-card__tunnel__routes">
                <h5>Tunneled Elements</h5>
                <div className="resource-card__tunnel__elements">
                  {tunneledTasks.length > 0 && (
                    <div className="resource-card__tunnel__category">
                      <h6>Tasks ({tunneledTasks.length})</h6>
                      <div className="resource-card__tunnel__list">
                        {tunneledTasks.map((task) => (
                          <a
                            key={task.id}
                            href={`#element-${task.id}`}
                            className="resource-card__tunnel__item resource-card__tunnel__item--task"
                          >
                            <div className="title">
                              {task.meta?.title || formatId(task.id)}
                            </div>
                            <div className="id">{task.id}</div>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {tunneledEvents.length > 0 && (
                    <div className="resource-card__tunnel__category">
                      <h6>Events ({tunneledEvents.length})</h6>
                      <div className="resource-card__tunnel__list">
                        {tunneledEvents.map((event) => (
                          <a
                            key={event.id}
                            href={`#element-${event.id}`}
                            className="resource-card__tunnel__item resource-card__tunnel__item--event"
                          >
                            <div className="title">
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
          </CardSection>
        )}
      </div>

      {(dependencies.tasks.length > 0 ||
        dependencies.hooks.length > 0 ||
        dependencies.resources.length > 0 ||
        dependencies.errors.length > 0) && (
        <div className="resource-card__relations">
          <DependenciesSection
            dependencies={dependencies}
            className="resource-card__dependencies-section"
          />
        </div>
      )}

      {(dependentTasks.length > 0 || registeredElements.length > 0) && (
        <div className="resource-card__relations">
          <h4 className="resource-card__relations__title">
            Resource Relations
          </h4>
          <div className="resource-card__relations__grid">
            {dependentTasks.length > 0 && (
              <div className="resource-card__relations__category">
                <h5>Used By Tasks</h5>
                <div className="resource-card__relations__items">
                  {dependentTasks.map((task) => (
                    <a
                      key={task.id}
                      href={`#element-${task.id}`}
                      className="resource-card__relation-item resource-card__relation-item--task resource-card__relation-link"
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

            {registeredElements.length > 0 && (
              <div className="resource-card__relations__category">
                <h5>Registered Elements</h5>
                <div className="resource-card__relations__items">
                  {registeredElements.map((element) => (
                    <a
                      key={element.id}
                      href={`#element-${element.id}`}
                      className="resource-card__relation-item resource-card__relation-item--registered resource-card__relation-link"
                    >
                      <div className="title title--registered">
                        {element.meta?.title || formatId(element.id)}
                      </div>
                      <div className="id">{element.id}</div>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {middlewareUsages.length > 0 && (
        <div className="resource-card__middleware">
          <h4 className="resource-card__middleware__title">
            Middleware Configuration
          </h4>
          <div className="resource-card__middleware__items">
            {middlewareUsages.map((usage) => (
              <a
                key={usage.id}
                href={`#element-${usage.id}`}
                className="resource-card__middleware__item resource-card__middleware-link"
              >
                <div className="title">
                  {usage.node.meta?.title || formatId(usage.id)}
                </div>
                <div className="id">{usage.id}</div>
                {usage.config && (
                  <div>
                    <div className="config-title">Configuration:</div>
                    <pre className="config-block">{usage.config}</pre>
                  </div>
                )}
              </a>
            ))}
          </div>
        </div>
      )}

      <TagsSection
        element={resource}
        introspector={introspector}
        className="resource-card__tags-section"
      />

      <CodeModal
        title={resource.meta?.title || formatId(resource.id)}
        subtitle={resource.filePath || undefined}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        code={loading ? "Loading..." : error ? `Error: ${error}` : fileContent}
        enableEdit={Boolean(resource.filePath)}
        saveOnFile={resource.filePath || null}
      />

      <CodeModal
        title={`${
          resource.meta?.title || formatId(resource.id)
        } — Coverage Details`}
        subtitle={resource.filePath || undefined}
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
