import React from "react";

export type LifecycleMethodTone = "core" | "runtime" | "probe";

export interface ResourceLifecycleMethod {
  label: string;
  detail: string;
  tone: LifecycleMethodTone;
}

export interface ResourceLifecycleMethodsSectionProps {
  methods: ResourceLifecycleMethod[];
}

export const ResourceLifecycleMethodsSection: React.FC<
  ResourceLifecycleMethodsSectionProps
> = ({ methods }) => {
  return (
    <div className="resource-card__lifecycle">
      {methods.length > 0 ? (
        <>
          <div className="resource-card__lifecycle-strip">
            {methods.map((method) => (
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
  );
};
