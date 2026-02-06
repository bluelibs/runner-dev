import { main } from "../../cli/query";
import { callGraphQL } from "../../mcp/http";

jest.mock("../../mcp/http", () => {
  const actual = jest.requireActual("../../mcp/http");
  return {
    ...actual,
    callGraphQL: jest.fn(),
  };
});

describe("CLI query (remote)", () => {
  const mockedCallGraphQL = callGraphQL as jest.MockedFunction<
    typeof callGraphQL
  >;
  let logSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    process.env.ENDPOINT = "http://example.test/graphql";
    logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    mockedCallGraphQL.mockReset();
  });

  afterEach(() => {
    delete process.env.ENDPOINT;
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  test("runs a simple query", async () => {
    mockedCallGraphQL.mockResolvedValueOnce({
      data: { tasks: [{ id: "task.alpha" }] },
    });

    await main(["node", "dist/cli.js", "query", "query { tasks { id } }"]);

    expect(mockedCallGraphQL).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(String(logSpy.mock.calls[0][0]));
    expect(Array.isArray(parsed.tasks)).toBe(true);
  });

  test("namespace filter adds idIncludes", async () => {
    mockedCallGraphQL.mockResolvedValueOnce({
      data: { tasks: [{ id: "task.alpha" }] },
    });

    await main([
      "node",
      "dist/cli.js",
      "query",
      "query { tasks { id } }",
      "--namespace",
      "task.",
    ]);

    expect(mockedCallGraphQL).toHaveBeenCalledTimes(1);
    expect(mockedCallGraphQL.mock.calls[0][0].query).toContain("idIncludes");
    const parsed = JSON.parse(String(logSpy.mock.calls[0][0]));
    expect(Array.isArray(parsed.tasks)).toBe(true);
    expect(parsed.tasks.some((t: any) => String(t.id).startsWith("task."))).toBe(
      true
    );
  });
});
