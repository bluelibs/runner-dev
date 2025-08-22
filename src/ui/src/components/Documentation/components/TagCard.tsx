import React from "react";
import { Introspector } from "../../../../../resources/models/Introspector";
import './TagCard.scss';

export interface TagCardProps {
  tag: any;
  introspector: Introspector;
}

export const TagCard: React.FC<TagCardProps> = ({ tag }) => {
  return (
    <div key={tag.id} className="tag-card">
      <h3 className="tag-card__title">🏷️ {tag.id}</h3>
      <div className="tag-card__stats">
        <div className="tag-card__stat tag-card__stat--tasks">
          <div className="tag-card__stat__value">{tag.tasks.length}</div>
          <div className="tag-card__stat__label">Tasks</div>
        </div>
        <div className="tag-card__stat tag-card__stat--resources">
          <div className="tag-card__stat__value">{tag.resources.length}</div>
          <div className="tag-card__stat__label">Resources</div>
        </div>
        <div className="tag-card__stat tag-card__stat--events">
          <div className="tag-card__stat__value">{tag.events.length}</div>
          <div className="tag-card__stat__label">Events</div>
        </div>
        <div className="tag-card__stat tag-card__stat--middlewares">
          <div className="tag-card__stat__value">{tag.middlewares.length}</div>
          <div className="tag-card__stat__label">Middlewares</div>
        </div>
        <div className="tag-card__stat tag-card__stat--hooks">
          <div className="tag-card__stat__value">{tag.hooks.length}</div>
          <div className="tag-card__stat__label">Hooks</div>
        </div>
      </div>
    </div>
  );
};
