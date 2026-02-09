export const TUNNEL_TAG_ID = "globals.tags.tunnel";
export const LEGACY_TUNNEL_TAG_ID = "runner-dev.tunnel";

function readTagId(tagLike: unknown): string | null {
  if (typeof tagLike === "string") return tagLike;
  if (!tagLike || typeof tagLike !== "object") return null;

  const tagRecord = tagLike as { id?: unknown; tag?: { id?: unknown } };
  if (typeof tagRecord.id === "string") return tagRecord.id;
  if (typeof tagRecord.tag?.id === "string") return tagRecord.tag.id;

  return null;
}

export function hasTunnelTag(tags: unknown[] | null | undefined): boolean {
  if (!Array.isArray(tags)) return false;

  return tags.some((tagLike) => {
    const tagId = readTagId(tagLike);
    if (!tagId) return false;

    const lowerTagId = tagId.toLowerCase();
    if (lowerTagId === TUNNEL_TAG_ID) return true;
    if (lowerTagId === LEGACY_TUNNEL_TAG_ID) return true;

    // Backward-compatible fallback for older custom tags, but avoid known false positives.
    return /\btunnel\b/i.test(tagId) && !/tunnelpolicy/i.test(tagId);
  });
}
