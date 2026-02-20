import React from "react";
import { ElementKindBadge, ElementKind, SystemBadge } from "./ElementKindBadge";

type ClassValue = string | undefined | false;

function joinClasses(...values: ClassValue[]) {
  return values.filter(Boolean).join(" ");
}

export interface ElementCardProps {
  prefix: string;
  elementId: string;
  title: React.ReactNode;
  id?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  meta?: React.ReactNode;
  /** Displays a kind badge (e.g. "Resource", "Task") in the top-right corner */
  kindLabel?: ElementKind;
  /** Shows a grey "SYSTEM" badge next to the kind badge for system elements */
  isSystem?: boolean;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
  children: React.ReactNode;
}

export const ElementCard: React.FC<ElementCardProps> = ({
  prefix,
  elementId,
  title,
  id,
  description,
  actions,
  meta,
  kindLabel,
  isSystem,
  className,
  headerClassName,
  contentClassName,
  children,
}) => {
  const descriptionContent = React.useMemo(() => {
    if (!description) return null;
    if (typeof description === "string" || typeof description === "number") {
      return <p className={`${prefix}__description`}>{description}</p>;
    }
    return <div className={`${prefix}__description`}>{description}</div>;
  }, [description, prefix]);

  return (
    <div id={`element-${elementId}`} className={joinClasses(prefix, className)}>
      <div className={joinClasses(`${prefix}__header`, headerClassName)}>
        <div className={`${prefix}__header-content`}>
          <div className="main">
            <h3 className={`${prefix}__title`}>{title}</h3>
            {id && <div className={`${prefix}__id`}>{id}</div>}
            {descriptionContent}
          </div>
          {actions && <div className={`${prefix}__actions`}>{actions}</div>}
          {meta && <div className="meta">{meta}</div>}
          {isSystem && <SystemBadge />}
          {kindLabel && <ElementKindBadge kind={kindLabel} />}
        </div>
      </div>

      <div className={joinClasses(`${prefix}__content`, contentClassName)}>
        {children}
      </div>
    </div>
  );
};

export interface CardSectionProps {
  prefix: string;
  title: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}

export const CardSection: React.FC<CardSectionProps> = ({
  prefix,
  title,
  children,
  className,
  contentClassName,
}) => {
  return (
    <div className={joinClasses(`${prefix}__section`, className)}>
      <h4 className={`${prefix}__section__title`}>{title}</h4>
      <div
        className={joinClasses(`${prefix}__section__content`, contentClassName)}
      >
        {children}
      </div>
    </div>
  );
};

export interface InfoBlockProps {
  prefix: string;
  label: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  valueClassName?: string;
}

function isEmptyInfoValue(children: React.ReactNode): boolean {
  return (
    typeof children === "string" && children.trim().toLowerCase() === "none"
  );
}

export const InfoBlock: React.FC<InfoBlockProps> = ({
  prefix,
  label,
  children,
  className,
  valueClassName,
}) => {
  const isEmptyValue = isEmptyInfoValue(children);

  return (
    <div className={joinClasses(`${prefix}__info-block`, className)}>
      <div className="label">{label}</div>
      <div
        className={joinClasses(
          "value",
          valueClassName,
          isEmptyValue && "value--empty"
        )}
      >
        {children}
      </div>
    </div>
  );
};
