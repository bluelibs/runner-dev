import React from "react";
import { Resource } from "../../../../../schema/model";
import { Introspector } from "../../../../../resources/models/Introspector";
import {
  formatSchema,
  formatConfig,
  formatFilePath,
  formatArray,
  formatId,
} from "../utils/formatting";
import { CodeModal } from "./CodeModal";
import {
  graphqlRequest,
  SAMPLE_RESOURCE_FILE_QUERY,
  RESOURCE_COVERAGE_DETAILS_QUERY,
} from "../utils/graphqlClient";
import { TagsSection } from "./TagsSection";
import "./ResourceCard.scss";
import { SchemaRenderer } from "./SchemaRenderer";
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
  const dependencies = introspector.getResourcesByIds(resource.dependsOn);
  const registeredElements = [
    ...introspector.getTasksByIds(resource.registers),
    ...introspector.getResourcesByIds(resource.registers),
    ...introspector.getMiddlewaresByIds(resource.registers),
    ...introspector.getEventsByIds(resource.registers),
    ...introspector.getHooksByIds(resource.registers),
  ];
  const overriddenElements = introspector.getResourcesByIds(resource.overrides);

  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [fileContent, setFileContent] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [coverageDetailsOpen, setCoverageDetailsOpen] = React.useState(false);
  const [coverageDetailsText, setCoverageDetailsText] = React.useState<
    string | null
  >(null);

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
    try {
      const data = await graphqlRequest<{
        resource: {
          id: string;
          coverage?: {
            percentage?: number | null;
            totalStatements?: number | null;
            coveredStatements?: number | null;
            details?: string | null;
          } | null;
        };
      }>(RESOURCE_COVERAGE_DETAILS_QUERY, { id: resource.id });
      const c = data?.resource?.coverage;
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
    <div id={`element-${resource.id}`} className="resource-card">
      <div className="resource-card__header">
        <div className="resource-card__header-content">
          <div className="main">
            <h3 className="resource-card__title">
              🔧 {resource.meta?.title || formatId(resource.id)}
            </h3>
            <div className="resource-card__id">{resource.id}</div>
            {resource.meta?.description && (
              <p className="resource-card__description">
                {resource.meta.description}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="resource-card__content">
        <div className="resource-card__grid">
          <div>
            <div className="resource-card__section">
              <h4 className="resource-card__section__title">📋 Overview</h4>
              <div className="resource-card__section__content">
                <div className="resource-card__info-block">
                  <div className="label">File Path:</div>
                  <div className="value">
                    {resource.filePath ? (
                      <button
                        type="button"
                        onClick={openFileModal}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "#2e7d32",
                          cursor: "pointer",
                          textDecoration: "underline",
                          padding: 0,
                          fontFamily: "inherit",
                          fontSize: "inherit",
                        }}
                        title="View file contents"
                      >
                        {formatFilePath(resource.filePath)}
                      </button>
                    ) : (
                      formatFilePath(resource.filePath)
                    )}
                  </div>
                </div>

                {resource.coverage?.percentage !== undefined && (
                  <div className="resource-card__info-block">
                    <div className="label">Coverage:</div>
                    <div className="value">
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
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "#2e7d32",
                          cursor: "pointer",
                          textDecoration: "underline",
                          padding: 0,
                          fontFamily: "inherit",
                          fontSize: "inherit",
                        }}
                        title="View coverage details"
                      >
                        (View Coverage)
                      </button>
                    </div>
                  </div>
                )}

                {resource.registeredBy && (
                  <div className="resource-card__info-block">
                    <div className="label">Registered By:</div>
                    <div className="value">
                      <a
                        href={`#element-${resource.registeredBy}`}
                        className="resource-card__registrar-link"
                      >
                        {resource.registeredBy}
                      </a>
                    </div>
                  </div>
                )}

                {resource.context && (
                  <div className="resource-card__info-block">
                    <div className="label">Context:</div>
                    <div className="value">{resource.context}</div>
                  </div>
                )}

                <div className="resource-card__info-block">
                  <div className="label">Used By Tasks:</div>
                  <div className="value">{dependentTasks.length} task(s)</div>
                </div>

                {resource.tags && resource.tags.length > 0 && (
                  <div className="resource-card__info-block">
                    <div className="label">Tags:</div>
                    <div className="value">
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
                    </div>
                  </div>
                )}

                {resource.overriddenBy && (
                  <div className="resource-card__alert resource-card__alert--warning">
                    <div className="title">⚠️ Overridden By:</div>
                    <div className="content">{resource.overriddenBy}</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div>
            <div className="resource-card__section">
              <h4 className="resource-card__section__title">
                ⚙️ Configuration
              </h4>
              <div className="resource-card__config">
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
              </div>
            </div>
          </div>
        </div>

        {(dependencies.length > 0 ||
          dependentTasks.length > 0 ||
          registeredElements.length > 0) && (
          <div className="resource-card__relations">
            <h4 className="resource-card__relations__title">
              🔗 Dependencies & Relations
            </h4>
            <div className="resource-card__relations__grid">
              {dependencies.length > 0 && (
                <div className="resource-card__relations__category">
                  <h5>Resource Dependencies</h5>
                  <div className="resource-card__relations__items">
                    {dependencies.map((dep) => (
                      <a
                        key={dep.id}
                        href={`#element-${dep.id}`}
                        className="resource-card__relation-item resource-card__relation-item--resource resource-card__relation-link"
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
              🔗 Middleware Configuration
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
      </div>

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
        code={coverageDetailsText}
        enableEdit={false}
        saveOnFile={null}
      />
    </div>
  );
};
