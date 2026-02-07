import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const TARGET_PACKAGE = "@bluelibs/runner";
const DEP_SECTIONS = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
];

function formatLocation(sectionName, depName) {
  return `${sectionName}["${depName}"]`;
}

function isLocalRunnerSpecifier(spec) {
  if (typeof spec !== "string") return false;
  // catches: ../runner, file:../runner, link:../runner, file:../runner#..., etc.
  return /(^|:)\.\.\/runner(\/|$|#)/.test(spec) || spec.includes("../runner");
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const verbose = args.has("--verbose") || args.has("-v");

  const packageJsonPath = path.resolve(process.cwd(), "package.json");
  const raw = await readFile(packageJsonPath, "utf8");
  /** @type {any} */
  const pkg = JSON.parse(raw);

  const problems = [];

  // 1) Global scan: any dependency spec pointing to ../runner is not publish-safe.
  for (const sectionName of DEP_SECTIONS) {
    const section = pkg[sectionName];
    if (!section || typeof section !== "object") continue;

    for (const [depName, depSpec] of Object.entries(section)) {
      if (isLocalRunnerSpecifier(depSpec)) {
        problems.push(
          `Found local runner reference at ${formatLocation(sectionName, depName)} = ${JSON.stringify(
            depSpec
          )}`
        );
      }
    }
  }

  // 2) Specific enforcement: TARGET_PACKAGE must not be a local path.
  const peerSpec = pkg.peerDependencies?.[TARGET_PACKAGE];
  const depSpec = pkg.dependencies?.[TARGET_PACKAGE];
  const devSpec = pkg.devDependencies?.[TARGET_PACKAGE];
  const effectiveSpec = peerSpec ?? depSpec ?? devSpec;

  if (effectiveSpec == null) {
    problems.push(
      `Missing ${JSON.stringify(
        TARGET_PACKAGE
      )} in dependencies/peerDependencies/devDependencies. Expected a version range (ex: \"^4.5.0\").`
    );
  } else if (isLocalRunnerSpecifier(effectiveSpec)) {
    problems.push(
      `${JSON.stringify(TARGET_PACKAGE)} must not point to ../runner when publishing (found ${JSON.stringify(
        effectiveSpec
      )}).`
    );
  }

  if (problems.length > 0) {
    console.error("[prepublish] runner dependency check failed:\n");
    for (const problem of problems) console.error(`- ${problem}`);
    console.error(
      "\nFix by replacing any ../runner/file:../runner specifier with a real published semver range for @bluelibs/runner."
    );
    process.exit(1);
  }

  if (verbose) {
    console.log("[prepublish] runner dependency check passed");
  }
}

main().catch((error) => {
  console.error("[prepublish] runner dependency check crashed:");
  console.error(error);
  process.exit(1);
});
