export function getHashScrollTargetId(
  hash: string | null | undefined
): string | null {
  if (!hash || hash.length <= 1) return null;

  if (hash === "#topology") {
    return "topology";
  }

  if (hash.startsWith("#topology/") || hash.startsWith("#topology?")) {
    return null;
  }

  return hash.slice(1);
}
