export const DURABLE_WORKFLOW_TAG_ID = "runner.tags.durableWorkflow";

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
  return (
    tagId === "durableWorkflow" ||
    tagId === DURABLE_WORKFLOW_TAG_ID ||
    tagId?.endsWith(".durableWorkflow") === true ||
    tagId?.endsWith(`.${DURABLE_WORKFLOW_TAG_ID}`) === true
  );
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
  return (
    depId.includes(".durable") ||
    depId.startsWith("base.durable.") ||
    /(^|[.-])durable([.-]|$)/.test(depId)
  );
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

interface TagUsageLike {
  id: string;
  config?: string | null;
}

/**
 * Extracts the explicit durable workflow key from the durableWorkflow tag config.
 * Returns `null` when no explicit key is set (falls back to canonical task id at runtime).
 */
export function getDurableWorkflowKeyFromTags(
  tagsDetailed: TagUsageLike[] | null | undefined
): string | null {
  if (!Array.isArray(tagsDetailed)) return null;

  const durableTag = tagsDetailed.find((tag) => isDurableWorkflowTagId(tag.id));
  if (!durableTag?.config) return null;

  try {
    const parsed = JSON.parse(durableTag.config) as { key?: unknown };
    return typeof parsed.key === "string" && parsed.key.length > 0
      ? parsed.key
      : null;
  } catch {
    return null;
  }
}
