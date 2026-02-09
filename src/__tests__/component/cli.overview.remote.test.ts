import { main } from "../../cli/overview";
import { callGraphQL } from "../../mcp/http";

jest.mock("../../mcp/http", () => {
  const actual = jest.requireActual("../../mcp/http");
  return {
    ...actual,
    callGraphQL: jest.fn(),
  };
});

describe("CLI overview (remote)", () => {
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

  test("prints markdown with counts", async () => {
    mockedCallGraphQL.mockResolvedValueOnce({
      data: {
        tasks: [
          {
            id: "task.a",
            meta: {},
            dependsOn: ["resource.a"],
            middleware: ["mw.a"],
          },
        ],
        hooks: [{ id: "hook.a", meta: {}, dependsOn: [], middleware: [] }],
        resources: [
          { id: "resource.a", meta: {}, dependsOn: [], middleware: [] },
        ],
        middlewares: [{ id: "mw.a", meta: {} }],
        events: [{ id: "event.a", meta: {}, emittedBy: [], listenedToBy: [] }],
        diagnostics: [],
        live: { logs: [], emissions: [], errors: [], runs: [] },
      },
    });

    await main(["node", "dist/cli.js", "overview", "--details", "5"]);

    expect(mockedCallGraphQL).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledTimes(1);
    const out = String(logSpy.mock.calls[0][0]);
    expect(out).toContain("# Runner Dev Project Overview");
    expect(out).toMatch(/Tasks: \d+/);
    expect(out).toMatch(/Hooks: \d+/);
    expect(out).toMatch(/Resources: \d+/);
    expect(out).toMatch(/Events: \d+/);
    expect(out).toContain("Connections: 2");
  });
});
