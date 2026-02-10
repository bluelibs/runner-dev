import React from "react";
import "./ElementKindBadge.scss";

export type ElementKind =
  | "task"
  | "resource"
  | "event"
  | "hook"
  | "middleware"
  | "task-middleware"
  | "resource-middleware"
  | "tag"
  | "error"
  | "async-context";

const KIND_LABELS: Record<ElementKind, string> = {
  task: "Task",
  resource: "Resource",
  event: "Event",
  hook: "Hook",
  middleware: "Middleware",
  "task-middleware": "Task Middleware",
  "resource-middleware": "Resource Middleware",
  tag: "Tag",
  error: "Error",
  "async-context": "Async Context",
};

export interface ElementKindBadgeProps {
  kind: ElementKind;
}

export const ElementKindBadge: React.FC<ElementKindBadgeProps> = ({ kind }) => {
  return (
    <span className={`element-kind-badge element-kind-badge--${kind}`}>
      {KIND_LABELS[kind]}
    </span>
  );
};

/** Grey badge shown alongside the kind badge for system elements */
export const SystemBadge: React.FC = () => {
  return (
    <span className="element-kind-badge element-kind-badge--system">
      System
    </span>
  );
};
