export const DURABLE_WORKFLOW_TAG_ID = "durable.workflow";

function readTagId(tagLike: unknown): string | null {
  if (typeof tagLike === "string") return tagLike;
  if (!tagLike || typeof tagLike !== "object") return null;

  const tagRecord = tagLike as { id?: unknown; tag?: { id?: unknown } };
  if (typeof tagRecord.id === "string") return tagRecord.id;
  if (typeof tagRecord.tag?.id === "string") return tagRecord.tag.id;

  return null;
}

export function hasDurableWorkflowTag(
  tags: unknown[] | null | undefined
): boolean {
  if (!Array.isArray(tags)) return false;
  return tags.some((tagLike) => readTagId(tagLike) === DURABLE_WORKFLOW_TAG_ID);
}

export function hasDurableIdPattern(depId: string): boolean {
  return depId.includes(".durable") || depId.startsWith("base.durable.");
}
