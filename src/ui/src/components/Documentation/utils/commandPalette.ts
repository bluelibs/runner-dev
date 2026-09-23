/**
 * Command palette entry model, matching, and ranking.
 *
 * Entries are plain descriptors so filtering stays pure and testable. The
 * component layer maps a chosen entry to an action via callbacks.
 */

export type PaletteEntryKind = "element" | "section" | "action";

export interface PaletteElementEntry {
  kind: "element";
  /** Element id, e.g. "runner.logger". */
  id: string;
  /** Element kind: task, resource, event, hook, middleware, tag, error, async-context. */
  elementKind: string;
  title?: string;
}

export interface PaletteSectionEntry {
  kind: "section";
  /** Section id, e.g. "resources". */
  id: string;
  label: string;
  icon: string;
}

export interface PaletteActionEntry {
  kind: "action";
  /** Action id, e.g. "open-shell". */
  id: string;
  label: string;
  icon: string;
  shortcut?: string;
  keywords?: string;
}

export type PaletteEntry =
  | PaletteElementEntry
  | PaletteSectionEntry
  | PaletteActionEntry;

export interface PaletteSource {
  elements: Array<{ id: string; kind: string; title?: string }>;
  sections: Array<{ id: string; label: string; icon: string }>;
  actions: Array<{
    id: string;
    label: string;
    icon: string;
    shortcut?: string;
    keywords?: string;
  }>;
}

export function buildPaletteEntries(source: PaletteSource): PaletteEntry[] {
  return [
    ...source.elements.map(
      (element): PaletteEntry => ({
        kind: "element",
        id: element.id,
        elementKind: element.kind,
        title: element.title,
      })
    ),
    ...source.sections.map(
      (section): PaletteEntry => ({
        kind: "section",
        id: section.id,
        label: section.label,
        icon: section.icon,
      })
    ),
    ...source.actions.map(
      (action): PaletteEntry => ({
        kind: "action",
        id: action.id,
        label: action.label,
        icon: action.icon,
        shortcut: action.shortcut,
        keywords: action.keywords,
      })
    ),
  ];
}

function searchableText(entry: PaletteEntry): string {
  switch (entry.kind) {
    case "element":
      return `${entry.id} ${entry.title ?? ""} ${entry.elementKind}`;
    case "section":
      return `${entry.label} ${entry.id}`;
    case "action":
      return `${entry.label} ${entry.keywords ?? ""}`;
  }
}

function isSubsequence(needle: string, haystack: string): boolean {
  let needleIndex = 0;
  for (
    let hayIndex = 0;
    hayIndex < haystack.length && needleIndex < needle.length;
    hayIndex++
  ) {
    if (haystack[hayIndex] === needle[needleIndex]) needleIndex++;
  }
  return needleIndex === needle.length;
}

/**
 * Score one query token against the haystack. Higher is better, -1 means no
 * match. Prefers exact, prefix, and word-boundary matches over fuzzy ones so
 * typing an id prefix surfaces the right element first.
 */
function scoreToken(token: string, haystack: string): number {
  const words = haystack.split(/[\s._-]+/);
  if (words.some((word) => word === token)) return 80;
  if (haystack.startsWith(token)) return 60;
  if (words.some((word) => word.startsWith(token))) return 50;
  if (haystack.includes(token)) return 30;
  if (isSubsequence(token, haystack)) return 10;
  return -1;
}

export function scoreEntry(entry: PaletteEntry, query: string): number {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return 0;
  const haystack = searchableText(entry).toLowerCase();
  let total = 0;
  for (const token of tokens) {
    const tokenScore = scoreToken(token, haystack);
    if (tokenScore < 0) return -1;
    total += tokenScore;
  }
  return total;
}

/** Tokens shorter than this must appear verbatim (no subsequence fallback). */
const MIN_FUZZY_TOKEN_LENGTH = 3;
/** A subsequence may spread over at most this many times its own length. */
const MAX_FUZZY_SPAN_RATIO = 2;

/**
 * Length of the shortest haystack window holding `needle` as a subsequence,
 * or Infinity when there is none. Greedy matching from each start gives that
 * start's shortest window; if a start cannot complete, later ones cannot.
 */
function shortestSubsequenceSpan(needle: string, haystack: string): number {
  let shortest = Number.POSITIVE_INFINITY;
  for (
    let start = haystack.indexOf(needle[0]);
    start !== -1;
    start = haystack.indexOf(needle[0], start + 1)
  ) {
    let needleIndex = 1;
    let cursor = start + 1;
    while (needleIndex < needle.length && cursor < haystack.length) {
      if (haystack[cursor] === needle[needleIndex]) needleIndex++;
      cursor++;
    }
    if (needleIndex < needle.length) break;
    shortest = Math.min(shortest, cursor - start);
  }
  return shortest;
}

/**
 * Table filter token match. A loose subsequence fallback makes short tokens
 * match nearly every long dotted id ("log" hides in p-l-atf-o-rm.confi-g),
 * which turns a filter into noise. So: a contiguous substring always
 * matches; otherwise only tokens of 3+ characters may match as a
 * subsequence, and only when the matched characters sit close together
 * (within 2x the token length). That keeps abbreviations like "crus" →
 * createUser or "zlst" → z-last, and rejects characters scattered across
 * segments. The palette keeps its own looser ranking (scoreToken).
 */
function matchesFilterToken(token: string, haystack: string): boolean {
  if (haystack.includes(token)) return true;
  if (token.length < MIN_FUZZY_TOKEN_LENGTH) return false;
  return (
    shortestSubsequenceSpan(token, haystack) <=
    token.length * MAX_FUZZY_SPAN_RATIO
  );
}

/**
 * Case-insensitive fuzzy filter of a free-text query against one haystack:
 * every whitespace-separated token must match (see matchesFilterToken), in
 * any order. Empty queries match everything.
 */
export function matchesFuzzyText(query: string, text: string): boolean {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  const haystack = text.toLowerCase();
  return tokens.every((token) => matchesFilterToken(token, haystack));
}

function entryLength(entry: PaletteEntry): number {
  return entry.id.length;
}

export interface RankedPaletteEntry {
  entry: PaletteEntry;
  score: number;
}

/**
 * Filter and rank entries for a query. Empty query returns everything
 * unranked (sections and actions first, then elements alphabetically).
 */
export function filterPaletteEntries(
  entries: PaletteEntry[],
  query: string,
  limits: { elements?: number; sections?: number; actions?: number } = {}
): RankedPaletteEntry[] {
  const trimmed = query.trim();
  if (!trimmed) {
    const sections = entries.filter((entry) => entry.kind === "section");
    const actions = entries.filter((entry) => entry.kind === "action");
    const elements = entries
      .filter((entry) => entry.kind === "element")
      .sort((a, b) =>
        (a as PaletteElementEntry).id.localeCompare(
          (b as PaletteElementEntry).id
        )
      );
    const ordered = [...sections, ...actions, ...elements];
    return applyLimits(
      ordered.map((entry) => ({ entry, score: 0 })),
      limits
    );
  }

  const ranked = entries
    .map((entry) => ({ entry, score: scoreEntry(entry, trimmed) }))
    .filter((rankedEntry) => rankedEntry.score >= 0)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      const lengthDelta = entryLength(left.entry) - entryLength(right.entry);
      if (lengthDelta !== 0) return lengthDelta;
      return left.entry.id.localeCompare(right.entry.id);
    });
  return applyLimits(ranked, limits);
}

function applyLimits(
  ranked: RankedPaletteEntry[],
  limits: { elements?: number; sections?: number; actions?: number }
): RankedPaletteEntry[] {
  const seen: Record<PaletteEntryKind, number> = {
    element: 0,
    section: 0,
    action: 0,
  };
  const cap: Record<PaletteEntryKind, number> = {
    element: limits.elements ?? 12,
    section: limits.sections ?? Number.POSITIVE_INFINITY,
    action: limits.actions ?? Number.POSITIVE_INFINITY,
  };
  return ranked.filter((rankedEntry) => {
    const kind = rankedEntry.entry.kind;
    if (seen[kind] >= cap[kind]) return false;
    seen[kind]++;
    return true;
  });
}
