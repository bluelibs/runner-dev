import React from "react";
import "./Card.scss";

export type CardVariant =
  | "task"
  | "resource"
  | "event"
  | "hook"
  | "middleware"
  | "tag";

export interface CardProps {
  id: string;
  title: string;
  description?: string;
  icon: string;
  variant: CardVariant;
  headerMeta?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export const Card: React.FC<CardProps> = ({
  id,
  title,
  description,
  icon,
  variant,
  headerMeta,
  children,
  className = "",
}) => {
  return (
    <div id={`element-${id}`} className={`card card--${variant} ${className}`}>
      <div className="card__header">
        <div className="card__header-content">
          <div className="main">
            <h3 className="card__title">
              {icon} {title}
            </h3>
            <div className="card__id">{id}</div>
            {description && (
              <p className="card__description">{description}</p>
            )}
          </div>
          {headerMeta && <div className="meta">{headerMeta}</div>}
        </div>
      </div>
      <div className="card__content">{children}</div>
    </div>
  );
};
