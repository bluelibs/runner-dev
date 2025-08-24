import { run } from "@bluelibs/runner";
import { graphql as executeGraphql } from "graphql";
import * as path from "path";
import { promises as fs } from "fs";
import { createDummyApp } from "../dummy/dummyApp";
import { resources } from "../../index";

describe("GraphQL mutation: editFile", () => {
  const tmpDir = path.join(__dirname, "tmp-editfile");
  const tmpFile = path.join(tmpDir, "sample.txt");

  beforeAll(async () => {
    await fs.mkdir(tmpDir, { recursive: true });
    await fs.writeFile(tmpFile, "hello", "utf8");
  });

  afterAll(async () => {
    try {
      await fs.unlink(tmpFile);
      await fs.rmdir(tmpDir);
    } catch {}
  });

  test("writes content to absolute path", async () => {
    const app = createDummyApp([
      resources.introspector,
      resources.graphql,
      resources.swapManager,
      resources.live,
    ]);
    const rr = await run(app);

    const mutation = `
      mutation Edit($path: String!, $content: String!) {
        editFile(path: $path, content: $content) { success error resolvedPath }
      }
    `;
    const schema = rr.getResourceValue(resources.graphql).getSchema();
    const res = await executeGraphql({
      schema,
      source: mutation,
      variableValues: { path: tmpFile, content: "updated" },
    });

    expect(res.errors).toBeUndefined();
    const ok = (res.data as any)?.editFile?.success;
    expect(ok).toBe(true);
    const contents = await fs.readFile(tmpFile, "utf8");
    expect(contents).toBe("updated");

    await rr.dispose();
  });
});
