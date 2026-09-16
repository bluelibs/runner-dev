import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const temporaryDirectory = await mkdtemp(
  path.join(tmpdir(), "runner-dev-audit-")
);
const npm = process.platform === "win32" ? "npm.cmd" : "npm";

function run(command, args, cwd) {
  execFileSync(command, args, { cwd, stdio: "inherit" });
}

try {
  const manifest = JSON.parse(
    await readFile(path.join(root, "package.json"), "utf8")
  );
  // Exercise the real pack lifecycle so the check includes shipped skill files.
  run(npm, ["pack", "--pack-destination", temporaryDirectory], root);
  const tarball = path.join(
    temporaryDirectory,
    `bluelibs-runner-dev-${manifest.version}.tgz`
  );
  run(
    process.execPath,
    [path.join(root, "dist/cli.js"), "new", "audit-app"],
    temporaryDirectory
  );
  const projectDirectory = path.join(temporaryDirectory, "audit-app");
  const packagePath = path.join(projectDirectory, "package.json");
  const generated = JSON.parse(await readFile(packagePath, "utf8"));
  // Test the pending release, not the previous version available on npm.
  generated.devDependencies[manifest.name] = `file:${tarball}`;
  await writeFile(packagePath, `${JSON.stringify(generated, null, 2)}\n`);
  run(npm, ["install", "--no-fund"], projectDirectory);
  run(npm, ["audit"], projectDirectory);
  run(npm, ["run", "qa"], projectDirectory);
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
