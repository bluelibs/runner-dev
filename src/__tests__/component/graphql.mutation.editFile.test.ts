import { run } from "@bluelibs/runner";
import { graphql as executeGraphql, type GraphQLSchema } from "graphql";
import * as path from "path";
import { promises as fs } from "fs";
import { createDummyApp } from "../dummy/dummyApp";
import { resources } from "../../index";
import { CODE_EXECUTION_DISABLED_ENV, withEnvAsync } from "../swap/withEnv";

type EditFilePayload = {
  success: boolean;
  error: string | null;
  resolvedPath: string | null;
};

function assertEditFilePayload(
  payload: unknown
): asserts payload is EditFilePayload {
  if (!payload || typeof payload !== "object" || !("success" in payload)) {
    throw new Error("Expected an editFile result");
  }
}

describe("GraphQL mutation: editFile", () => {
  const tmpDir = path.join(__dirname, "tmp-editfile");
  const tmpFile = path.join(tmpDir, "sample.txt");
  let schema: GraphQLSchema;
  let dispose: () => Promise<void>;

  const EDIT_FILE = `
    mutation Edit($path: String!, $content: String!) {
      editFile(path: $path, content: $content) { success error resolvedPath }
    }
  `;

  async function editFile(content: string): Promise<EditFilePayload> {
    const res = await executeGraphql({
      schema,
      source: EDIT_FILE,
      variableValues: { path: tmpFile, content },
    });
    expect(res.errors).toBeUndefined();
    const payload: unknown = res.data?.editFile;
    assertEditFilePayload(payload);
    return payload;
  }

  beforeAll(async () => {
    await fs.mkdir(tmpDir, { recursive: true });
    const rr = await run(
      createDummyApp([
        resources.introspector,
        resources.graphql,
        resources.swapManager,
        resources.live,
      ])
    );
    schema = rr.getResourceValue(resources.graphql).getSchema();
    dispose = () => rr.dispose();
  });

  beforeEach(async () => {
    await fs.writeFile(tmpFile, "hello", "utf8");
  });

  afterAll(async () => {
    await dispose();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  test("writes content to absolute path", async () => {
    const result = await editFile("updated");

    expect(result.success).toBe(true);
    expect(await fs.readFile(tmpFile, "utf8")).toBe("updated");
  });

  test("refuses to write when code execution is disabled", () =>
    withEnvAsync(CODE_EXECUTION_DISABLED_ENV, async () => {
      const result = await editFile("hijacked");

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        "File editing is disabled in this environment. Set RUNNER_DEV_EVAL=1 or NODE_ENV=development on the server to enable it."
      );
      expect(result.resolvedPath).toBeNull();
      expect(await fs.readFile(tmpFile, "utf8")).toBe("hello");
    }));

  test("writes with RUNNER_DEV_EVAL=1 even in production", () =>
    withEnvAsync({ RUNNER_DEV_EVAL: "1", NODE_ENV: "production" }, async () => {
      const result = await editFile("opted-in");

      expect(result.success).toBe(true);
      expect(await fs.readFile(tmpFile, "utf8")).toBe("opted-in");
    }));

  test("codeExecutionEnabled reports the same gate", async () => {
    const probe = async () => {
      const res = await executeGraphql({
        schema,
        source: "{ codeExecutionEnabled shellEnabled }",
      });
      expect(res.errors).toBeUndefined();
      return res.data;
    };

    await withEnvAsync(CODE_EXECUTION_DISABLED_ENV, async () => {
      expect(await probe()).toEqual({
        codeExecutionEnabled: false,
        shellEnabled: false,
      });
    });
    await withEnvAsync({ RUNNER_DEV_EVAL: "1" }, async () => {
      expect(await probe()).toEqual({
        codeExecutionEnabled: true,
        shellEnabled: true,
      });
    });
  });
});
