/**
 * Upper bound on memoized lookups. Known node ids are a small fixed set, but
 * callers can pass arbitrary strings (e.g. free-form log sources), and the
 * memo must not turn those into an unbounded leak.
 */
export const DEFAULT_CANONICAL_ID_MEMO_LIMIT = 5_000;

/** True when `candidateId` is `referenceId` or ends with its `.`-namespaced form. */
export function idsMatch(candidateId: string, referenceId: string): boolean {
  return candidateId === referenceId || candidateId.endsWith(`.${referenceId}`);
}

export type IdCanonicalizer = (id: string | null | undefined) => string | null;

/**
 * Resolves short or partial ids (e.g. "server") to the full registered id
 * (e.g. "app.tasks.server"); unknown ids come back unchanged.
 *
 * Resolution scans every candidate, which is too slow to repeat on every
 * telemetry record, so results are memoized. The candidate ids are copied at
 * creation, so a memoized answer can never go stale: a different id set
 * means building a new canonicalizer (and with it an empty memo).
 */
export function createIdCanonicalizer(
  candidateIds: readonly string[],
  memoLimit = DEFAULT_CANONICAL_ID_MEMO_LIMIT
): IdCanonicalizer {
  const candidates = [...candidateIds];
  const exactIds = new Set(candidates);
  const memo = new Map<string, string>();

  const resolve = (id: string): string => {
    if (exactIds.has(id)) return id;
    return candidates.find((candidateId) => idsMatch(candidateId, id)) ?? id;
  };

  const remember = (id: string, canonicalId: string) => {
    // Wholesale reset keeps the bound trivial; known ids re-resolve once.
    if (memo.size >= memoLimit) memo.clear();
    memo.set(id, canonicalId);
  };

  return (id) => {
    if (!id) return null;
    const memoized = memo.get(id);
    if (memoized !== undefined) return memoized;

    const canonicalId = resolve(id);
    remember(id, canonicalId);
    return canonicalId;
  };
}
