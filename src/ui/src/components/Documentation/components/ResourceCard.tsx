import React from "react";
import { Resource } from "../../../../../schema/model";
import { Introspector } from "../../../../../resources/models/Introspector";
import {
  formatFilePath,
  formatId,
  shouldDisplayConfig,
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
import { DependenciesSection } from "./common/DependenciesSection";
import "./common/DependenciesSection.scss";
import { ElementCard, CardSection, InfoBlock } from "./common/ElementCard";
import { BaseModal } from "./modals";
import { isSystemElement } from "../utils/isSystemElement";
import { matchesWildcardPattern } from "../utils/wildcard-utils";
import { ResourceIsolationSection } from "./ResourceIsolationSection";
import { ResourceSubtreeSection } from "./ResourceSubtreeSection";
import { ResourceEventLanesSection } from "./ResourceEventLanesSection";
import { ResourceRpcLanesSection } from "./ResourceRpcLanesSection";
import { SearchableList } from "./common/SearchableList";
import { resolveReferenceElement } from "../utils/resolveReferenceElement";
import {
  isEventLanesResource,
  isRpcLanesResource,
} from "../../../../../utils/lane-resources";
import { TopologyActionButton } from "./TopologyActionButton";
import { RegisteredByInfoBlock } from "./common/RegisteredByInfoBlock";
import { StructuredConfigBlock } from "./common/StructuredConfigBlock";
import { useIsCatalogDocumentation } from "../context/DocumentationModeContext";

export interface ResourceCardProps {
  resource: Resource;
  introspector: Introspector;
}

type IsolationRuleSource = "exports" | "deny" | "only";
type LifecycleMethodTone = "core" | "runtime" | "probe";

const LIFECYCLE_METHODS: Array<{
  key: "hasInit" | "hasReady" | "hasCooldown" | "hasDispose" | "hasHealthCheck";
  label: string;
  detail: string;
  tone: LifecycleMethodTone;
}> = [
  {
    key: "hasInit",
    label: "init",
    detail: "Bootstraps the resource value.",
    tone: "core",
  },
  {
    key: "hasReady",
    label: "ready",
    detail: "Runs after startup dependencies settle.",
    tone: "runtime",
  },
  {
    key: "hasCooldown",
    label: "cooldown",
    detail: "Stops fresh work before teardown.",
    tone: "runtime",
  },
  {
    key: "hasDispose",
    label: "dispose",
    detail: "Releases resources during shutdown.",
    tone: "core",
  },
  {
    key: "hasHealthCheck",
    label: "health",
    detail: "Exposes a runtime health probe.",
    tone: "probe",
  },
];

export const ResourceCard: React.FC<ResourceCardProps> = ({
  resource,
  introspector,
}) => {
  const isCatalogMode = useIsCatalogDocumentation();
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
  const [isolationRuleModal, setIsolationRuleModal] = React.useState<{
    source: IsolationRuleSource;
    rule: string;
    matchedResources: Resource[];
  } | null>(null);

  const hasEventLanesSurface = isEventLanesResource(resource);
  const hasRpcLanesSurface = isRpcLanesResource(resource);
  const rootResource = introspector.getRoot();
  const isRootResource = rootResource.id === resource.id;
  const resources = introspector.getResources();
  const lifecycleMethods = React.useMemo(() => {
    return LIFECYCLE_METHODS.filter((method) => Boolean(resource[method.key]));
  }, [resource]);

  const resolveAdaptiveReferenceElement = React.useCallback(
    (id: string) => resolveReferenceElement(introspector, id),
    [introspector]
  );

  const openIsolationWildcardModal = React.useCallback(
    (source: IsolationRuleSource, rule: string) => {
      const matchedResources = introspector
        .getResources()
        .filter((item) => matchesWildcardPattern(item.id, rule));

      setIsolationRuleModal({ source, rule, matchedResources });
    },
    [introspector]
  );

  const closeIsolationWildcardModal = React.useCallback(() => {
    setIsolationRuleModal(null);
  }, []);

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
      className={isRootResource ? "resource-card--root" : undefined}
      headerClassName={
        isRootResource ? "resource-card__header--root" : undefined
      }
      title={
        <>
          <span className="resource-card__title-shell">
            {resource.meta?.title || formatId(resource.id)}
            {isRootResource && (
              <span className="resource-card__root-pill">Application Root</span>
            )}
          </span>
          {hasRpcLanesSurface && (
            <span
              className="resource-card__rpc-lanes-badge"
              title="RPC Lanes Resource"
            >
              RPC LANES
            </span>
          )}
        </>
      }
      id={resource.id}
      description={resource.meta?.description}
      meta={
        isRootResource ? (
          <div className="resource-card__root-meta">
            <span className="resource-card__root-meta-badge">
              Root Resource
            </span>
            <span className="resource-card__root-meta-copy">
              Main registration spine for runtime startup, topology, and docs
              discovery.
            </span>
          </div>
        ) : undefined
      }
      actions={
        <TopologyActionButton
          focus={{ kind: "resource", id: resource.id }}
          title="Open resource mindmap"
          className="btn--primary"
        />
      }
    >
      <div className="resource-card__grid">
        <CardSection prefix="resource-card" title="Overview">
          <InfoBlock prefix="resource-card" label="File Path:">
            {resource.filePath && !isCatalogMode ? (
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
              </span>
              {!isCatalogMode && (
                <>
                  {" "}
                  <button
                    type="button"
                    onClick={openCoverageDetails}
                    title="View coverage details"
                  >
                    (View Coverage)
                  </button>
                </>
              )}
            </InfoBlock>
          )}

          <RegisteredByInfoBlock
            prefix="resource-card"
            elementId={resource.id}
            registeredBy={resource.registeredBy}
            introspector={introspector}
            isCurrentRootResource={isRootResource}
          />

          <InfoBlock prefix="resource-card" label="Visibility:">
            {resource.isPrivate ? "Private" : "Public"}
          </InfoBlock>

          <InfoBlock prefix="resource-card" label="Isolation Exports Mode:">
            {resource.isolation?.exportsMode ?? "unset"}
          </InfoBlock>

          <InfoBlock prefix="resource-card" label="Lifecycle Methods:">
            <div className="resource-card__lifecycle">
              {lifecycleMethods.length > 0 ? (
                <>
                  <div className="resource-card__lifecycle-strip">
                    {lifecycleMethods.map((method) => (
                      <div
                        key={method.label}
                        className={`resource-card__lifecycle-chip resource-card__lifecycle-chip--${method.tone}`}
                        title={method.detail}
                      >
                        <span className="resource-card__lifecycle-chip__name">
                          {method.label}
                        </span>
                        <span className="resource-card__lifecycle-chip__detail">
                          {method.detail}
                        </span>
                      </div>
                    ))}
                  </div>
                  <span className="resource-card__lifecycle-caption">
                    Declared resource lifecycle surface detected from the
                    implementation.
                  </span>
                </>
              ) : (
                <span className="resource-card__lifecycle-empty">
                  No custom lifecycle methods declared.
                </span>
              )}
            </div>
          </InfoBlock>

          {resource.isolation && (
            <ResourceIsolationSection
              isolation={resource.isolation}
              onOpenWildcard={openIsolationWildcardModal}
              resolveReferenceElement={resolveAdaptiveReferenceElement}
              resources={resources}
            />
          )}

          {resource.context && (
            <InfoBlock prefix="resource-card" label="Context:">
              {resource.context}
            </InfoBlock>
          )}

          {resource.subtree && (
            <ResourceSubtreeSection subtree={resource.subtree} />
          )}

          {hasEventLanesSurface && (
            <ResourceEventLanesSection resourceConfig={resource.config} />
          )}

          {hasRpcLanesSurface && (
            <ResourceRpcLanesSection resourceConfig={resource.config} />
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
            <StructuredConfigBlock
              value={resource.config}
              className="resource-card__config__block"
            />
          </div>

          <CardSection
            prefix="resource-card"
            title="Configuration Schema"
            className="resource-card__config__subsection"
          >
            <SchemaRenderer schemaString={resource.configSchema} />
          </CardSection>
        </CardSection>
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
                <SearchableList
                  items={registeredElements.map((el) => ({
                    id: el.id,
                    title: el.meta?.title || formatId(el.id),
                  }))}
                  placeholder="Filter registered elements..."
                  emptyMessage="No registered elements match this search."
                  itemVariant="registered"
                />
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
                {shouldDisplayConfig(usage.config) && (
                  <div>
                    <div className="config-title">Configuration:</div>
                    <StructuredConfigBlock
                      value={usage.config}
                      className="config-block"
                    />
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

      <BaseModal
        isOpen={Boolean(isolationRuleModal)}
        onClose={closeIsolationWildcardModal}
        title="Isolation Wildcard Matches"
        subtitle={
          isolationRuleModal
            ? `${isolationRuleModal.source} rule: ${isolationRuleModal.rule}`
            : undefined
        }
        size="lg"
        className="resource-card__isolation-modal"
        ariaLabel="Isolation wildcard matches"
      >
        <div className="resource-card__isolation-modal-content">
          {isolationRuleModal && (
            <SearchableList
              items={isolationRuleModal.matchedResources.map((r) => ({
                id: r.id,
                title: r.meta?.title || formatId(r.id),
              }))}
              placeholder="Filter matched resources..."
              emptyMessage="No resources match this wildcard rule."
              itemVariant="resource"
              onItemClick={closeIsolationWildcardModal}
            />
          )}
        </div>
      </BaseModal>

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
        } - Coverage Details`}
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
