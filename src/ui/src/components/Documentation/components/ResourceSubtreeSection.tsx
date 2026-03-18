import React from "react";
import type { Resource } from "../../../../../schema/model";
import { InfoBlock } from "./common/ElementCard";

export interface ResourceSubtreeSectionProps {
  subtree: NonNullable<Resource["subtree"]>;
}

function formatTaskIdentityGate(
  gate: NonNullable<
    NonNullable<NonNullable<Resource["subtree"]>["tasks"]>["identity"]
  >[number]
): string {
  const parts: string[] = [];
  if (gate.tenant) {
    parts.push("tenant");
  }
  if (gate.user) {
    parts.push("user");
  }
  if (gate.roles.length > 0) {
    parts.push(`roles=${gate.roles.join(" | ")}`);
  }
  return parts.length > 0 ? parts.join(", ") : "none";
}

function formatIdentityScope(
  identityScope: NonNullable<
    NonNullable<NonNullable<Resource["subtree"]>["middleware"]>["identityScope"]
  >
): string {
  const parts: string[] = [];
  if (identityScope.tenant) {
    parts.push("tenant");
  }
  if (identityScope.user) {
    parts.push("user");
  }
  if (parts.length === 0) {
    return "none";
  }
  parts.push(identityScope.required ? "required" : "optional");
  return parts.join(", ");
}

export const ResourceSubtreeSection: React.FC<ResourceSubtreeSectionProps> = ({
  subtree,
}) => {
  return (
    <>
      <InfoBlock prefix="resource-card" label="Subtree Tasks:">
        middleware={subtree.tasks?.middleware.length ?? 0}, validators=
        {subtree.tasks?.validatorCount ?? 0}, identity=
        {subtree.tasks?.identity?.length
          ? subtree.tasks.identity.map(formatTaskIdentityGate).join(" ; ")
          : "none"}
      </InfoBlock>
      <InfoBlock prefix="resource-card" label="Subtree Middleware Scope:">
        {subtree.middleware?.identityScope
          ? formatIdentityScope(subtree.middleware.identityScope)
          : "none"}
      </InfoBlock>
      <InfoBlock prefix="resource-card" label="Subtree Resources:">
        middleware={subtree.resources?.middleware.length ?? 0}, validators=
        {subtree.resources?.validatorCount ?? 0}
      </InfoBlock>
      <InfoBlock prefix="resource-card" label="Subtree Validators:">
        hooks={subtree.hooks?.validatorCount ?? 0}, task-mw=
        {subtree.taskMiddleware?.validatorCount ?? 0}, resource-mw=
        {subtree.resourceMiddleware?.validatorCount ?? 0}, events=
        {subtree.events?.validatorCount ?? 0}, tags=
        {subtree.tags?.validatorCount ?? 0}
      </InfoBlock>
    </>
  );
};
