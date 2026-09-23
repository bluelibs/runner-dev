import fs from "node:fs";
import path from "node:path";

interface PackageManifest {
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional?: boolean }>;
}

function readManifest(): PackageManifest {
  const manifestPath = path.join(process.cwd(), "package.json");
  const manifest: PackageManifest = JSON.parse(
    fs.readFileSync(manifestPath, "utf8")
  );
  return manifest;
}

describe("package manifest", () => {
  // npm checks optional peers against whatever version is installed, and
  // any range but "*" excludes prereleases: ">=5.0.0" refused (ERESOLVE)
  // typescript@next or a pinned RC, and a lower bound refused TypeScript 4,
  // even for users who never compile code. Compatibility is checked at
  // runtime instead: loadTypeScript reports a compiler without
  // transpileModule (TypeScript 7) with an install hint.
  test("declares typescript as an optional peer that accepts any version", () => {
    const manifest = readManifest();
    expect(manifest.peerDependenciesMeta?.typescript?.optional).toBe(true);
    expect(manifest.peerDependencies?.typescript).toBe("*");
  });
});
