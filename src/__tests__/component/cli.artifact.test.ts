import os from "os";
import path from "path";
import fs from "fs/promises";
import { scaffoldArtifact } from "../../cli/generators/artifact";

describe("CLI artifact scaffold", () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "runner-dev-artifact-"));
  });

  afterAll(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  test("uses local ids in dry-run artifact templates", async () => {
    const result = await scaffoldArtifact({
      kind: "task",
      name: "create-user",
      namespace: "app.users",
      baseDir: path.join(tempDir, "src"),
      dryRun: true,
    });

    expect(result.id).toBe("create-user");
    expect(result.content).toContain(".task<CreateUserInput>('create-user')");
    expect(result.content).not.toContain("app.users.tasks.create-user");
    expect(result.relDir).toBe(
      path.join(tempDir, "src", "app", "users", "tasks")
    );
  });

  test("rejects dotted explicit ids", async () => {
    await expect(
      scaffoldArtifact({
        kind: "resource",
        name: "user-service",
        namespace: "app",
        baseDir: path.join(tempDir, "src"),
        dryRun: true,
        explicitId: "app.resources.user-service",
      })
    ).rejects.toThrow("Use a local id without dots");
  });
});
