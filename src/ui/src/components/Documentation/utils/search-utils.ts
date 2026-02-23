import { matchesWildcardPattern } from "./wildcard-utils";

export type SearchGroup = {
  include: string[];
  exclude: string[];
}; // Include and exclude terms
export interface ParsedSearch {
  isTagSearch: boolean;
  groups: SearchGroup[]; // OR over groups; each group has include/exclude terms
}

function normalize(str: string): string {
  return String(str || "").toLowerCase();
}

// Parse a raw query into OR groups. Commas represent AND within groups, "|" separates OR groups, "!" means exclude.
export function parseSearchQuery(raw: string): ParsedSearch {
  const q = String(raw ?? "");
  const isTagSearch = q.trim().startsWith(":");
  const body = isTagSearch ? q.trim().slice(1) : q.trim();

  if (!body) return { isTagSearch, groups: [] };

  // Split by OR first (|), then by commas within each group (AND)
  const groups = body
    .split(/\s*\|\s*/)
    .map((g) => {
      const terms = g
        .split(/\s*,\s*/)
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      const include: string[] = [];
      const exclude: string[] = [];

      terms.forEach((term) => {
        if (term.startsWith("!")) {
          const excludeTerm = normalize(term.slice(1));
          if (excludeTerm) exclude.push(excludeTerm);
        } else {
          const includeTerm = normalize(term);
          if (includeTerm) include.push(includeTerm);
        }
      });

      return { include, exclude };
    })
    .filter((g) => g.include.length > 0 || g.exclude.length > 0);

  return { isTagSearch, groups };
}

// Test if an element (id + optional tags) matches a parsed query
export function elementMatchesParsed(
  element: { id: string; tags?: string[] | null },
  parsed: ParsedSearch
): boolean {
  // Empty query matches everything
  if (!parsed.groups.length) return true;

  const id = normalize(element.id);
  const tags = Array.isArray(element.tags) ? element.tags.map(normalize) : [];

  const groupMatches = (group: SearchGroup): boolean => {
    if (group.include.length === 0 && group.exclude.length === 0) return true;

    if (parsed.isTagSearch) {
      // Tag search mode: check against tags
      // Include terms: all must match (AND logic)
      const includeMatch =
        group.include.length === 0 ||
        group.include.every((token) =>
          tags.some((tag) => matchesWildcardPattern(tag, token))
        );

      // Exclude terms: none must match
      const excludeMatch =
        group.exclude.length === 0 ||
        !group.exclude.some((token) =>
          tags.some((tag) => matchesWildcardPattern(tag, token))
        );

      return includeMatch && excludeMatch;
    } else {
      // Name/id search mode: check against id
      // Include terms: all must match (AND logic)
      const includeMatch =
        group.include.length === 0 ||
        group.include.every((token) => matchesWildcardPattern(id, token));

      // Exclude terms: none must match
      const excludeMatch =
        group.exclude.length === 0 ||
        !group.exclude.some((token) => matchesWildcardPattern(id, token));

      return includeMatch && excludeMatch;
    }
  };

  // OR over groups
  return parsed.groups.some(groupMatches);
}

// Tree node matcher helper so consumers don't need to duplicate logic
export function treeNodeMatchesParsed(
  node: {
    label: string;
    elementId?: string;
    element?: { id: string; tags?: string[] | null } | any;
  },
  parsed: ParsedSearch
): boolean {
  if (!parsed.groups.length) return true;

  const label = normalize(node.label);
  const elementId = normalize(node.elementId || "");
  const element = node.element as
    | { id?: string; tags?: string[] | null }
    | undefined;

  const elementForMatch = {
    id: normalize(element?.id || elementId || label),
    tags: Array.isArray(element?.tags) ? (element!.tags as string[]) : [],
  };

  const groupMatches = (group: SearchGroup): boolean => {
    if (group.include.length === 0 && group.exclude.length === 0) return true;

    if (parsed.isTagSearch) {
      // Tag search mode: only consider tags
      const tags = (elementForMatch.tags || []).map(normalize);

      // Include terms: all must match (AND logic)
      const includeMatch =
        group.include.length === 0 ||
        group.include.every((token) =>
          tags.some((t) => matchesWildcardPattern(t, token))
        );

      // Exclude terms: none must match
      const excludeMatch =
        group.exclude.length === 0 ||
        !group.exclude.some((token) =>
          tags.some((t) => matchesWildcardPattern(t, token))
        );

      return includeMatch && excludeMatch;
    } else {
      // Name mode: allow matching on label or elementId (AND logic)
      // Include terms: all must match
      const includeMatch =
        group.include.length === 0 ||
        group.include.every(
          (token) =>
            matchesWildcardPattern(label, token) ||
            matchesWildcardPattern(elementId, token)
        );

      // Exclude terms: none must match
      const excludeMatch =
        group.exclude.length === 0 ||
        !group.exclude.some(
          (token) =>
            matchesWildcardPattern(label, token) ||
            matchesWildcardPattern(elementId, token)
        );

      return includeMatch && excludeMatch;
    }
  };

  return parsed.groups.some(groupMatches);
}
