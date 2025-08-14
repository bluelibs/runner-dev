import * as path from "path";
import * as os from "os";

export type PathRoot = { name: string; path: string };

function normalizeAbsolute(p: string): string {
  try {
    // Resolve to absolute and normalize separators
    return path.resolve(p);
  } catch {
    return p;
  }
}

function defaultRoots(): PathRoot[] {
  const cwd = normalizeAbsolute(process.cwd());
  const nm = normalizeAbsolute(path.join(cwd, "node_modules"));
  const home = normalizeAbsolute(os.homedir());
  const roots: PathRoot[] = [
    { name: "workspace", path: cwd },
    { name: "node_modules", path: nm },
    { name: "home", path: home },
  ];
  return roots;
}

let cachedRoots: PathRoot[] | null = null;

export function getPathRoots(): PathRoot[] {
  if (cachedRoots) return cachedRoots;
  const roots = [...defaultRoots()]
    // Deduplicate by name, last-one-wins (env overrides default)
    .reduce<Map<string, PathRoot>>((map, r) => {
      if (!r?.name || !r?.path) return map;
      map.set(r.name, { name: r.name, path: normalizeAbsolute(r.path) });
      return map;
    }, new Map())
    .values();
  // Sort by path length desc so more specific roots match first
  cachedRoots = Array.from(roots).sort((a, b) => b.path.length - a.path.length);
  return cachedRoots;
}

function lastSegments(inputPath: string, count: number): string {
  const parts = inputPath.split(path.sep).filter(Boolean);
  return parts.slice(Math.max(0, parts.length - count)).join(path.sep);
}

/**
 * Returns a redacted path suitable for public output.
 * - If absolute path falls under a known root, returns `${root}:${relative}`
 * - If inside node_modules, returns `node_modules:${relative}`
 * - Otherwise returns an elided version like `…/parent/basename`
 */
export function sanitizePath(input: unknown): string | null {
  if (typeof input !== "string" || input.length === 0) return null;
  const abs = normalizeAbsolute(input);

  for (const root of getPathRoots()) {
    const rootPath = root.path.endsWith(path.sep)
      ? root.path
      : root.path + path.sep;
    if (abs === root.path || abs.startsWith(rootPath)) {
      const rel = path.relative(root.path, abs);
      return `${root.name}:${rel || "."}`;
    }
  }

  // Fallback: elide and show only last 2 segments for safety
  const elided = lastSegments(abs, 2);
  return `…/${elided}`;
}

/**
 * Clears cached roots. Useful for tests.
 */
export function __resetPathRootsCache(): void {
  cachedRoots = null;
}
