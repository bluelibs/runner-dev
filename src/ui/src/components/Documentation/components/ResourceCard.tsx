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
import "./ResourceCard.scss";
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


  return (
    <div className="resource-card">
      <div className="resource-card__header">
        <div className="resource-card__header-content">
          <div className="main">
            <h3 className="resource-card__title">
              🔧 {resource.meta?.title || formatId(resource.id)}
            </h3>
            <div className="resource-card__id">
              {resource.id}
            </div>
            {resource.meta?.description && (
              <p className="resource-card__description">
                {resource.meta.description}
              </p>
            )}
          </div>
          {resource.meta?.tags && resource.meta.tags.length > 0 && (
            <div className="resource-card__tags">
              {resource.meta.tags.map((tag) => (
                <span key={tag} className="resource-card__tag">
                  {tag}
                </span>
              ))}
            </div>
          )}
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
                  <div className="value">{formatFilePath(resource.filePath)}</div>
                </div>

                {resource.registeredBy && (
                  <div className="resource-card__info-block">
                    <div className="label">Registered By:</div>
                    <div className="value">{resource.registeredBy}</div>
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
              <h4 className="resource-card__section__title">⚙️ Configuration</h4>
              <div className="resource-card__config">
                <div className="resource-card__config__subsection">
                  <h5>Current Configuration</h5>
                  <pre className="resource-card__config__block">
                    {formatConfig(resource.config)}
                  </pre>
                </div>

                <div className="resource-card__config__subsection">
                  <h5>Configuration Schema</h5>
                  <pre className="resource-card__config__block">
                    {formatSchema(resource.configSchema)}
                  </pre>
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
                      <div key={dep.id} className="resource-card__relation-item resource-card__relation-item--resource">
                        <div className="title title--resource">
                          {dep.meta?.title || formatId(dep.id)}
                        </div>
                        <div className="id">{dep.id}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {dependentTasks.length > 0 && (
                <div className="resource-card__relations__category">
                  <h5>Used By Tasks</h5>
                  <div className="resource-card__relations__items">
                    {dependentTasks.map((task) => (
                      <div key={task.id} className="resource-card__relation-item resource-card__relation-item--task">
                        <div className="title title--task">
                          {task.meta?.title || formatId(task.id)}
                        </div>
                        <div className="id">{task.id}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {registeredElements.length > 0 && (
                <div className="resource-card__relations__category">
                  <h5>Registered Elements</h5>
                  <div className="resource-card__relations__items">
                    {registeredElements.map((element) => (
                      <div key={element.id} className="resource-card__relation-item resource-card__relation-item--registered">
                        <div className="title title--registered">
                          {element.meta?.title || formatId(element.id)}
                        </div>
                        <div className="id">{element.id}</div>
                      </div>
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
                <div key={usage.id} className="resource-card__middleware__item">
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
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
