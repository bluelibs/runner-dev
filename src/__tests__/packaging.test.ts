import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const repoRoot = process.cwd();
const PACK_SCRIPT = path.join(repoRoot, "scripts", "pack-npm-skills.mjs");

/** Links inside the published skill and what they point at. */
const SKILL_LINKS = [
  { link: "skills/core/references/README.md", target: "../../../README.md" },
  { link: "skills/core/references/readmes", target: "../../../readmes" },
];

/**
 * A miniature repository with the skill's symlinks and a copy of the pack
 * script, so materialize/restore run for real without touching this checkout.
 */
function createSkillFixture(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "runner-dev-pack-"));
  fs.mkdirSync(path.join(root, "scripts"));
  fs.copyFileSync(
    PACK_SCRIPT,
    path.join(root, "scripts", "pack-npm-skills.mjs")
  );
  fs.writeFileSync(path.join(root, "README.md"), "# readme\n");
  fs.mkdirSync(path.join(root, "readmes"));
  fs.writeFileSync(path.join(root, "readmes", "COMPACT_GUIDE.md"), "# guide\n");
  fs.mkdirSync(path.join(root, "skills", "core", "references"), {
    recursive: true,
  });
  for (const { link, target } of SKILL_LINKS) {
    fs.symlinkSync(target, path.join(root, link));
  }
  return root;
}

function runPackScript(root: string, mode: "materialize" | "restore") {
  execFileSync(
    process.execPath,
    [path.join(root, "scripts", "pack-npm-skills.mjs"), mode],
    { stdio: "ignore" }
  );
}

/** Runs the pack script expecting it to fail, and returns its stderr. */
function packScriptFailure(root: string, mode: "materialize" | "restore") {
  try {
    execFileSync(
      process.execPath,
      [path.join(root, "scripts", "pack-npm-skills.mjs"), mode],
      { encoding: "utf8", stdio: ["ignore", "ignore", "pipe"] }
    );
  } catch (error) {
    // Not `instanceof Error`: Jest runs tests in another realm than the one
    // child_process creates its errors in.
    if (typeof error === "object" && error !== null && "stderr" in error) {
      return String(error.stderr);
    }
    throw error;
  }
  throw new Error(`pack-npm-skills ${mode} succeeded but was expected to fail`);
}

function listPackedFiles(): string[] {
  const output = execFileSync(
    "npm",
    ["pack", "--dry-run", "--json", "--ignore-scripts"],
    { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
  );
  const packed: unknown = JSON.parse(output);
  if (!Array.isArray(packed) || !Array.isArray(packed[0]?.files)) {
    throw new Error(`npm pack --json returned an unexpected shape: ${output}`);
  }
  return packed[0].files.map((file: { path: string }) => file.path);
}

/** Relative link targets in a Markdown file, without anchors. */
function relativeMarkdownLinks(markdown: string): string[] {
  return [...markdown.matchAll(/\]\(([^)\s]+)\)/g)]
    .map((match) => match[1])
    .filter((href) => !/^(?:[a-z]+:|#)/i.test(href))
    .map((href) => href.split("#")[0]);
}

describe("npm packaging", () => {
  // npm drops symlinks, so a link left in place ships as nothing and the
  // skill's "./references/README.md" pointer dangles in consumer projects.
  test("copies every skill link in for packing and restores the links", () => {
    const root = createSkillFixture();
    try {
      runPackScript(root, "materialize");
      for (const { link } of SKILL_LINKS) {
        expect(fs.lstatSync(path.join(root, link)).isSymbolicLink()).toBe(
          false
        );
      }
      expect(
        fs.readFileSync(
          path.join(root, "skills/core/references/README.md"),
          "utf8"
        )
      ).toBe("# readme\n");
      expect(
        fs.existsSync(
          path.join(root, "skills/core/references/readmes/COMPACT_GUIDE.md")
        )
      ).toBe(true);

      runPackScript(root, "restore");
      for (const { link, target } of SKILL_LINKS) {
        expect(fs.readlinkSync(path.join(root, link))).toBe(target);
      }
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  // The links are tracked in git: a pack that failed after materialize left
  // copies behind that a later commit would record in their place.
  test("this checkout's skill references are symlinks", () => {
    for (const { link, target } of SKILL_LINKS) {
      expect({
        link,
        target: fs.readlinkSync(path.join(repoRoot, link)),
      }).toEqual({ link, target });
    }
  });

  // prebuild runs restore, so it must not touch links that are already right.
  test("restore leaves correct links untouched", () => {
    const root = createSkillFixture();
    try {
      const inodesBefore = SKILL_LINKS.map(
        ({ link }) => fs.lstatSync(path.join(root, link)).ino
      );
      runPackScript(root, "restore");
      const inodesAfter = SKILL_LINKS.map(
        ({ link }) => fs.lstatSync(path.join(root, link)).ino
      );
      expect(inodesAfter).toEqual(inodesBefore);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  // An edit made to a leftover copy would otherwise vanish on the next build.
  test("restore refuses to delete a copy that no longer equals its source", () => {
    const root = createSkillFixture();
    try {
      runPackScript(root, "materialize");
      const editedGuide = path.join(
        root,
        "skills/core/references/readmes/COMPACT_GUIDE.md"
      );
      fs.writeFileSync(editedGuide, "# guide, edited in the copy\n");

      const stderr = packScriptFailure(root, "restore");

      expect(stderr).toContain(
        "skills/core/references/readmes is a copy that differs from readmes"
      );
      expect(fs.readFileSync(editedGuide, "utf8")).toBe(
        "# guide, edited in the copy\n"
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test("every build first restores links a failed pack left as copies", () => {
    const manifest: { scripts: Record<string, string> } = JSON.parse(
      fs.readFileSync(path.join(repoRoot, "package.json"), "utf8")
    );
    expect(manifest.scripts.prebuild).toMatch(
      /^npm run skills:pack:restore && /
    );
  });

  test("ships the changelog and every file the README links to", () => {
    const packedFiles = new Set(listPackedFiles());
    const readme = fs.readFileSync(path.join(repoRoot, "README.md"), "utf8");

    expect(packedFiles.has("CHANGELOG.md")).toBe(true);
    for (const linkedFile of relativeMarkdownLinks(readme)) {
      expect({ linkedFile, shipped: packedFiles.has(linkedFile) }).toEqual({
        linkedFile,
        shipped: true,
      });
    }
  });
});
