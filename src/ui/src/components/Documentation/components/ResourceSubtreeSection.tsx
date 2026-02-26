import React from "react";
import type { Resource } from "../../../../../schema/model";
import { InfoBlock } from "./common/ElementCard";

export interface ResourceSubtreeSectionProps {
  subtree: NonNullable<Resource["subtree"]>;
}

export const ResourceSubtreeSection: React.FC<ResourceSubtreeSectionProps> = ({
  subtree,
}) => {
  return (
    <>
      <InfoBlock prefix="resource-card" label="Subtree Tasks:">
        middleware={subtree.tasks?.middleware.length ?? 0}, validators=
        {subtree.tasks?.validatorCount ?? 0}
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
