export const DURABLE_WORKFLOW_TAG_ID = "globals.tags.durableWorkflow";

function readTagId(tagLike: unknown): string | null {
  if (typeof tagLike === "string") return tagLike;
  if (!tagLike || typeof tagLike !== "object") return null;

  const tagRecord = tagLike as { id?: unknown; tag?: { id?: unknown } };
  if (typeof tagRecord.id === "string") return tagRecord.id;
  if (typeof tagRecord.tag?.id === "string") return tagRecord.tag.id;

  return null;
}

export function isDurableWorkflowTagId(
  tagId: string | null | undefined
): boolean {
  return tagId === DURABLE_WORKFLOW_TAG_ID;
}

export function hasDurableWorkflowTag(
  tags: unknown[] | null | undefined
): boolean {
  if (!Array.isArray(tags)) return false;

  return tags.some((tagLike) => {
    const id = readTagId(tagLike);
    return isDurableWorkflowTagId(id);
  });
}

export function hasDurableIdPattern(depId: string): boolean {
  return depId.includes(".durable") || depId.startsWith("base.durable.");
}

export function findDurableDependencyId(
  dependencyIds: string[] | null | undefined
): string | null {
  if (!Array.isArray(dependencyIds)) return null;
  return (
    dependencyIds.find((dependencyId) => hasDurableIdPattern(dependencyId)) ??
    null
  );
}
