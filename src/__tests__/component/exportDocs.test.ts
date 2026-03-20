import { defineResource, defineTask } from "@bluelibs/runner";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import os from "node:os";
import path from "node:path";
import { exportDocs } from "../../exportDocs";
import * as docsUiAssets from "../../resources/docsUiAssets";
import * as packageDocs from "../../docs/packageDocs";

describe("exportDocs", () => {
  let tmpRoot: string;
  let uiDir: string;

  beforeEach(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "runner-dev-export-"));
    uiDir = path.join(tmpRoot, "ui");

    await fs.mkdir(path.join(uiDir, "assets"), { recursive: true });
    await fs.mkdir(path.join(uiDir, "docs"), { recursive: true });
    await fs.writeFile(
      path.join(uiDir, "assets", "docs.js"),
      "console.log(1);"
    );
    await fs.writeFile(path.join(uiDir, "assets", "docs.css"), "body{}");
    await fs.writeFile(path.join(uiDir, "docs", "favicon.ico"), "ico");

    jest.spyOn(docsUiAssets, "resolveDocsBuildAssets").mockResolvedValue({
      uiDir,
      entry: {
        file: "assets/docs.js",
        css: ["assets/docs.css"],
      },
    });
    jest
      .spyOn(packageDocs, "readFirstAvailablePackageDoc")
      .mockImplementation(
        async () => ({ content: "# Runner Docs", path: "mock" } as any)
      );
    jest
      .spyOn(packageDocs, "readPackageDoc")
      .mockImplementation(
        async () => ({ content: "# Runner Dev Docs", path: "mock" } as any)
      );
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await fs.rm(tmpRoot, { recursive: true, force: true });
  });

  function createApp() {
    const helloTask = defineTask({
      id: "hello",
      meta: {
        title: "Hello Task",
        description: "Says hello",
      },
      async run() {
        return "hello";
      },
    });

    return defineResource({
      id: "tests-export-docs-app",
      register: [helloTask],
    });
  }

  test("exports a static catalog to a custom directory", async () => {
    const outputDir = path.join(tmpRoot, "catalog");

    const result = await exportDocs(createApp(), { output: outputDir });

    const snapshot = JSON.parse(
      await fs.readFile(result.snapshotPath, "utf8")
    ) as any;
    const indexHtml = await fs.readFile(result.entryHtmlPath, "utf8");

    expect(result.outputDir).toBe(outputDir);
    expect(snapshot.mode).toBe("catalog");
    expect(snapshot.introspectorData.tasks.map((task: any) => task.id)).toEqual(
      expect.arrayContaining(["tests-export-docs-app.tasks.hello"])
    );
    expect(typeof snapshot.graphqlSdl).toBe("string");
    expect(snapshot.graphqlSdl).toContain("type Query");
    expect(indexHtml).toContain("window.__DOCS_PROPS__=");
    expect(indexHtml).toContain("console.log(1);");
    expect(indexHtml).toContain("<style>body{}</style>");
    expect(indexHtml).toContain('href="data:image/x-icon;base64,');
    expect(indexHtml).not.toContain("__API_URL__");
  });

  test("uses ./runner-dev-catalog by default", async () => {
    const cwd = process.cwd();
    process.chdir(tmpRoot);

    try {
      const result = await exportDocs(createApp());
      expect(result.outputDir).toContain(path.sep + "runner-dev-catalog");
      await expect(
        fs.readFile(result.entryHtmlPath, "utf8")
      ).resolves.toContain("window.__DOCS_PROPS__=");
    } finally {
      process.chdir(cwd);
    }
  });

  test("treats a plain runner-dev-catalog path like the default output folder", async () => {
    const cwd = process.cwd();
    process.chdir(tmpRoot);

    try {
      const outputDir = path.join(tmpRoot, "runner-dev-catalog");
      await fs.mkdir(outputDir, { recursive: true });
      await fs.writeFile(path.join(outputDir, "stale.txt"), "stale", "utf8");

      const result = await exportDocs(createApp(), {
        output: "runner-dev-catalog",
      });

      expect(fsSync.realpathSync(result.outputDir)).toBe(
        fsSync.realpathSync(outputDir)
      );
      await expect(
        fs.access(path.join(outputDir, "stale.txt"))
      ).rejects.toThrow();
      await expect(
        fs.readFile(result.entryHtmlPath, "utf8")
      ).resolves.toContain("window.__DOCS_PROPS__=");
    } finally {
      process.chdir(cwd);
    }
  });

  test("fails clearly when docs UI assets cannot be resolved", async () => {
    jest.restoreAllMocks();
    jest
      .spyOn(docsUiAssets, "resolveDocsBuildAssets")
      .mockRejectedValue(new Error("missing ui"));

    await expect(
      exportDocs(createApp(), { output: path.join(tmpRoot, "bad") })
    ).rejects.toThrow("missing ui");
  });

  test("refuses to overwrite a non-empty custom directory without overwrite=true", async () => {
    const outputDir = path.join(tmpRoot, "custom-catalog");
    await fs.mkdir(outputDir, { recursive: true });
    await fs.writeFile(path.join(outputDir, "keep.txt"), "important", "utf8");

    await expect(
      exportDocs(createApp(), { output: outputDir })
    ).rejects.toThrow("overwrite");
  });

  test("overwrites a non-empty custom directory when overwrite=true", async () => {
    const outputDir = path.join(tmpRoot, "custom-catalog");
    await fs.mkdir(outputDir, { recursive: true });
    await fs.writeFile(path.join(outputDir, "stale.txt"), "stale", "utf8");

    const result = await exportDocs(createApp(), {
      output: outputDir,
      overwrite: true,
    });

    await expect(fs.readFile(result.entryHtmlPath, "utf8")).resolves.toContain(
      "window.__DOCS_PROPS__="
    );
    await expect(
      fs.access(path.join(outputDir, "stale.txt"))
    ).rejects.toThrow();
  });
});
