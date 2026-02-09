import React from "react";
import "./ElementKindBadge.scss";

export type ElementKind =
  | "task"
  | "resource"
  | "event"
  | "hook"
  | "middleware"
  | "tag"
  | "error"
  | "async-context";

const KIND_LABELS: Record<ElementKind, string> = {
  task: "Task",
  resource: "Resource",
  event: "Event",
  hook: "Hook",
  middleware: "Middleware",
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
