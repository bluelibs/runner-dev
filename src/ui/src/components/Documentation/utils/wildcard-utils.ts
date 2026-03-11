function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function hasWildcard(value: string): boolean {
  return String(value).includes("*");
}

export function wildcardToRegExp(pattern: string): RegExp {
  const source = String(pattern)
    .split("*")
    .map((chunk) => escapeRegex(chunk))
    .join(".*");
  return new RegExp(`^${source}$`, "i");
}

export function matchesWildcardPattern(
  candidate: string,
  pattern: string
): boolean {
  if (!hasWildcard(pattern)) {
    return candidate.toLowerCase().includes(pattern.toLowerCase());
  }
  return wildcardToRegExp(pattern).test(candidate);
}
