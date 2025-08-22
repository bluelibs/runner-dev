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

/**
 * Attempts to resolve a sanitized/friendly path (eg. "workspace:src/index.ts",
 * "node_modules:@scope/pkg/index.js", "home:.") back to an absolute path.
 * If the input is already absolute, it is normalized and returned.
 * Returns null when it cannot be resolved.
 */
export function resolvePathInput(input: unknown): string | null {
  if (typeof input !== "string" || input.length === 0) return null;
  // If already absolute, normalize and return
  try {
    const absTry = path.resolve(input);
    // heuristic: if input starts with '/' (posix) or has drive letter (win), treat as absolute
    const isAbsolute = path.isAbsolute(input) || /^[A-Za-z]:[\\/]/.test(input);
    if (isAbsolute) return absTry;
  } catch {
    // continue
  }

  const idx = input.indexOf(":");
  if (idx > 0) {
    const prefix = input.slice(0, idx);
    const rest = input.slice(idx + 1);
    const roots = getPathRoots();
    const root = roots.find((r) => r.name === prefix);
    if (!root) return null;
    const rel = rest === "." ? "" : rest.replace(/^\/*/, "");
    return path.join(root.path, rel);
  }

  // Inputs like "…/a/b/c" cannot be resolved reliably
  if (input.startsWith("…/")) return null;

  // Fallback: treat as relative to cwd
  try {
    return path.resolve(input);
  } catch {
    return null;
  }
}
