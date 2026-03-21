import path from "path";
import { writeJson, writeFile, writeGitignore, ensureDir } from "./initUtils";
import * as templates from "./scaffold/templates";

type ScaffoldOptions = {
  projectName: string;
  targetDir: string;
};

export async function scaffold(opts: ScaffoldOptions): Promise<void> {
  const { targetDir, projectName } = opts;

  // Generation is fully delegated to templates.*

  // Use template renderers
  await writeJson(
    path.join(targetDir, "package.json"),
    templates.packageJson(projectName)
  );
  await writeJson(path.join(targetDir, "tsconfig.json"), templates.tsconfig());

  await ensureDir(path.join(targetDir, "src"));
  await writeFile(
    path.join(targetDir, "src", "app.ts"),
    templates.appTs(projectName)
  );
  await writeFile(
    path.join(targetDir, "src", "main.ts"),
    templates.mainTs(projectName)
  );
  await writeFile(
    path.join(targetDir, "src", "app.test.ts"),
    templates.appTest()
  );
  await writeFile(
    path.join(targetDir, "README.md"),
    templates.readme(projectName)
  );
  await writeGitignore(targetDir);
}
