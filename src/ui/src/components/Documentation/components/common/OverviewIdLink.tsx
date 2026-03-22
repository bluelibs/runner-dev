import React from "react";
import {
  getOverviewDisplayId,
  type OverviewIdElement,
  type OverviewIdResource,
} from "../../utils/overviewIds";
import "./OverviewIdLink.scss";

export interface OverviewIdLinkProps {
  element: OverviewIdElement;
  resources: OverviewIdResource[];
  href: string;
  title?: string;
  className?: string;
  onClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void;
  classNames?: {
    shell?: string;
    code?: string;
    codeExpanded?: string;
    label?: string;
    link?: string;
    expand?: string;
    separator?: string;
  };
}

export const OverviewIdLink: React.FC<OverviewIdLinkProps> = ({
  element,
  resources,
  href,
  title,
  className,
  onClick,
  classNames,
}) => {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const displayId = React.useMemo(
    () => getOverviewDisplayId(element, resources),
    [element, resources]
  );
  const visibleLabel = (
    isExpanded ? displayId.fullSegments : displayId.collapsedSegments
  ).join(" > ");

  const shellClassName = classNames?.shell ?? "overview-id-link__shell";
  const codeClassName = [
    classNames?.code ?? "overview-id-link__code",
    isExpanded
      ? classNames?.codeExpanded ?? "overview-id-link__code--expanded"
      : null,
  ]
    .filter(Boolean)
    .join(" ");
  const labelClassName = classNames?.label ?? "overview-id-link__label";
  const linkClassName = [
    classNames?.link ?? "overview-id-link__link",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  const expandClassName = classNames?.expand ?? "overview-id-link__expand";
  const separatorClassName =
    classNames?.separator ?? "overview-id-link__separator";

  return (
    <span className={shellClassName}>
      <code className={codeClassName}>
        {displayId.hasHiddenAncestors && (
          <>
            <button
              type="button"
              className={expandClassName}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setIsExpanded((current) => !current);
              }}
              aria-label={
                isExpanded
                  ? `Collapse full ID for ${element.id}`
                  : `Expand full ID for ${element.id}`
              }
              title={
                isExpanded
                  ? `Collapse full ID for ${element.id}`
                  : `Expand full ID for ${element.id}`
              }
            >
              {isExpanded ? "−" : "..."}
            </button>
            {!isExpanded && <span className={separatorClassName}>&gt;</span>}
          </>
        )}
        <a
          href={href}
          title={title ?? element.id}
          className={linkClassName}
          onClick={onClick}
        >
          <span className={labelClassName}>{visibleLabel}</span>
        </a>
      </code>
    </span>
  );
};
