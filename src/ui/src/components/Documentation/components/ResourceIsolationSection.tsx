import React from "react";
import type { Resource } from "../../../../../schema/model";
import { hasWildcard } from "../utils/wildcard-utils";
import { formatId } from "../utils/formatting";
import { InfoBlock } from "./common/ElementCard";

type IsolationRuleSource = "exports" | "deny" | "only";

export interface ResourceIsolationSectionProps {
  isolation: NonNullable<Resource["isolation"]>;
  onOpenWildcard: (source: IsolationRuleSource, rule: string) => void;
}

export const ResourceIsolationSection: React.FC<
  ResourceIsolationSectionProps
> = ({ isolation, onOpenWildcard }) => {
  const hasIsolationWildcardRules = React.useMemo(() => {
    const allRules = [
      ...isolation.exports,
      ...isolation.deny,
      ...isolation.only,
    ];
    return allRules.some((rule) => hasWildcard(rule));
  }, [isolation]);

  const renderIsolationEntry = (
    source: IsolationRuleSource,
    value: string,
    asLink: boolean = false
  ) => {
    if (hasWildcard(value)) {
      return (
        <button
          type="button"
          key={`${source}-${value}`}
          className="clean-button resource-card__wildcard-rule"
          onClick={() => onOpenWildcard(source, value)}
          title={`Show resources matching ${value}`}
        >
          {formatId(value)}
        </button>
      );
    }

    if (asLink) {
      return (
        <a
          href={`#element-${value}`}
          key={`${source}-${value}`}
          className="clean-button"
        >
          {formatId(value)}
        </a>
      );
    }

    return <span key={`${source}-${value}`}>{formatId(value)}</span>;
  };

  return (
    <>
      <InfoBlock prefix="resource-card" label="Isolation Exports:">
        {isolation.exports.length > 0 ? (
          <div className="resource-card__tags">
            {isolation.exports.map((exportedId) =>
              renderIsolationEntry("exports", exportedId, true)
            )}
          </div>
        ) : (
          "None"
        )}
      </InfoBlock>

      <InfoBlock prefix="resource-card" label="Isolation Deny:">
        {isolation.deny.length > 0 ? (
          <div className="resource-card__tags">
            {isolation.deny.map((id) => renderIsolationEntry("deny", id))}
          </div>
        ) : (
          "None"
        )}
      </InfoBlock>

      <InfoBlock prefix="resource-card" label="Isolation Only:">
        {isolation.only.length > 0 ? (
          <div className="resource-card__tags">
            {isolation.only.map((id) => renderIsolationEntry("only", id))}
          </div>
        ) : (
          "None"
        )}
      </InfoBlock>

      {hasIsolationWildcardRules && (
        <InfoBlock prefix="resource-card" label="Wildcard Rules:">
          <span className="resource-card__wildcard-hint">
            Click a wildcard rule to inspect matched resources.
          </span>
        </InfoBlock>
      )}
    </>
  );
};
