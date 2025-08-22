import React from "react";
import { Task, Resource, Event, BaseElement, Middleware, Hook } from "../../../../../../schema/model";
import { formatId } from "../../utils/formatting";
import "./RelationsSection.scss";

type RelationItem = (Task | Resource | Event | Middleware | Hook | BaseElement) & { meta?: { title?: string | null } };

interface RelationsSectionProps {
  relations: {
    [category: string]: RelationItem[];
  };
  renderItem?: (item: RelationItem, category: string) => React.ReactNode;
  className?: string;
}

const getRelationItemClass = (item: RelationItem) => {
    if ('emits' in item && 'dependsOn' in item) return 'task';
    if ('config' in item && !('emits' in item)) return 'resource';
    if ('payloadSchema' in item) return 'event';
    if ('event' in item) return 'hook';
    if ('type' in item && (item.type === 'task' || item.type === 'resource')) return 'middleware';
    return 'default';
}

export const RelationsSection: React.FC<RelationsSectionProps> = ({
  relations,
  renderItem,
  className = "",
}) => {
  const hasRelations = Object.values(relations).some(
    (items) => items.length > 0
  );
  if (!hasRelations) {
    return null;
  }

  return (
    <div className={`relations-section ${className}`}>
      <h4 className="relations-section__title">🔗 Dependencies & Relations</h4>
      <div className="relations-section__grid">
        {Object.entries(relations).map(([category, items]) => {
          if (items.length === 0) return null;
          return (
            <div key={category} className="relations-section__category">
              <h5>{category}</h5>
              <div className="relations-section__items">
                {items.map((item) => {
                    if (renderItem) {
                        return renderItem(item, category);
                    }
                    const itemClass = getRelationItemClass(item);
                    return (
                        <a
                            key={item.id}
                            href={`#element-${item.id}`}
                            className={`relations-section__item relations-section__item--${itemClass} relations-section__link`}
                        >
                            <div className={`title title--${itemClass}`}>
                                {item.meta?.title || formatId(item.id)}
                            </div>
                            <div className="id">{item.id}</div>
                        </a>
                    )
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};