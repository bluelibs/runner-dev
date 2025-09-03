import React from "react";
import { BaseElement } from "../../../../../schema/model";
import { Introspector } from "../../../../../resources/models/Introspector";
import { formatId } from "../utils/formatting";
import "./TagsSection.scss";

export interface TagsSectionProps {
  element: BaseElement;
  introspector: Introspector;
  className?: string;
}

export const TagsSection: React.FC<TagsSectionProps> = ({
  element,
  introspector,
  className = "",
}) => {
  if (!element.tags || element.tags.length === 0) {
    return null;
  }

  const tags = introspector.getTagsByIds(element.tags);

  return (
    <div className={`tags-section ${className}`}>
      <h4 className="tags-section__title">Tags</h4>
      <div className="tags-section__content">
        {/* <div className="tags-section__items">
          {tags.map((tag) => (
            <a
              key={tag.id}
              href={`#element-${tag.id}`}
              className="tags-section__tag tags-section__tag-link"
            >
              <div className="tags-section__tag__title">{formatId(tag.id)}</div>
              <div className="tags-section__tag__id">{tag.id}</div>
              <div className="tags-section__tag__stats">
                <span className="stat">
                  {tag.tasks.length +
                    tag.resources.length +
                    tag.middlewares.length +
                    tag.events.length +
                    tag.hooks.length}{" "}
                  elements
                </span>
              </div>
            </a>
          ))}
        </div> */}

        {element.tagsDetailed && element.tagsDetailed.length > 0 && (
          <div className="tags-section__detailed">
            <div className="tags-section__detailed__items">
              {element.tagsDetailed.map((tagUsage) => {
                const tag = tags.find((t) => t.id === tagUsage.id);
                return (
                  <div
                    key={tagUsage.id}
                    className="tags-section__detailed__item"
                  >
                    <div className="tag-name">
                      <a
                        href={`#element-${tagUsage.id}`}
                        className="tags-section__tag-link"
                      >
                        {tag ? formatId(tag.id) : tagUsage.id}
                      </a>
                    </div>
                    {tagUsage.config && (
                      <div className="tag-config">
                        <div className="config-title">Configuration:</div>
                        <pre className="config-block">{tagUsage.config}</pre>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
