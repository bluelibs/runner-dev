import React from "react";
import type { Middleware } from "../../../../../../schema/model";
import type { ResolvedMiddlewareUsage } from "../../../../../../resources/models/Introspector";
import { formatId, shouldDisplayConfig } from "../../utils/formatting";
import { StructuredConfigBlock } from "./StructuredConfigBlock";
import "./MiddlewareUsagesSection.scss";

export type MiddlewareUsageView = ResolvedMiddlewareUsage<
  Pick<Middleware, "meta">
>;

export interface SubtreeProvenance {
  badgeTitle: string;
  ownerId: string | null;
}

/**
 * Subtree-applied middleware is not declared on the element itself, so the
 * card has to say where it came from; locally declared middleware needs no
 * explanation. Snapshots without provenance read as local.
 */
export function describeSubtreeProvenance(
  usage: Pick<MiddlewareUsageView, "origin" | "subtreeOwnerId">
): SubtreeProvenance | null {
  if (usage.origin !== "subtree") return null;
  return {
    badgeTitle: usage.subtreeOwnerId
      ? `Applied by subtree policy from ${usage.subtreeOwnerId}`
      : "Applied by subtree policy",
    ownerId: usage.subtreeOwnerId,
  };
}

export interface MiddlewareUsagesSectionProps {
  usages: MiddlewareUsageView[];
}

/** Middleware applied to a task or resource, with config and provenance. */
export const MiddlewareUsagesSection: React.FC<
  MiddlewareUsagesSectionProps
> = ({ usages }) => {
  if (usages.length === 0) return null;

  return (
    <div className="middleware-usages">
      <h4 className="middleware-usages__title">Middleware Configuration</h4>
      <div className="middleware-usages__items">
        {usages.map((usage) => (
          <MiddlewareUsageItem key={usage.id} usage={usage} />
        ))}
      </div>
    </div>
  );
};

const MiddlewareUsageItem: React.FC<{ usage: MiddlewareUsageView }> = ({
  usage,
}) => {
  const provenance = describeSubtreeProvenance(usage);

  // The owner link sits beside the middleware link, never inside it: nested
  // anchors are invalid HTML and browsers split them apart.
  return (
    <div className="middleware-usages__item">
      <div className="middleware-usages__item-header">
        <a href={`#element-${usage.id}`} className="middleware-usages__link">
          <div className="title">
            {usage.node.meta?.title || formatId(usage.id)}
          </div>
          <div className="id">{usage.id}</div>
        </a>
        {provenance && (
          <span
            className="middleware-usages__badge"
            title={provenance.badgeTitle}
          >
            Subtree Policy
          </span>
        )}
      </div>
      {provenance?.ownerId && (
        <div className="middleware-usages__source">
          Source:{" "}
          <a href={`#element-${provenance.ownerId}`}>
            {formatId(provenance.ownerId)}
          </a>
        </div>
      )}
      {shouldDisplayConfig(usage.config) && (
        <div>
          <div className="config-title">Configuration:</div>
          <StructuredConfigBlock
            value={usage.config}
            className="config-block"
          />
        </div>
      )}
    </div>
  );
};
