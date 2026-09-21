import type { CompletionContext } from "@codemirror/autocomplete";
import { createShellCompletionSource } from "./shellCompletion";
import { graphqlRequest } from "./graphqlClient";

jest.mock("./graphqlClient", () => ({
  ...jest.requireActual("./graphqlClient"),
  graphqlRequest: jest.fn(),
}));

const mockedRequest = graphqlRequest as unknown as jest.Mock;

function makeContext(code: string, pos: number): CompletionContext {
  return {
    pos,
    state: {
      doc: {
        toString: () => code,
        sliceString: (from: number, to?: number) => code.slice(from, to),
        length: code.length,
      },
    },
  } as unknown as CompletionContext;
}

describe("createShellCompletionSource", () => {
  beforeEach(() => {
    mockedRequest.mockReset();
  });

  it("maps server completions with the resource scope", async () => {
    mockedRequest.mockResolvedValueOnce({
      shellComplete: {
        from: 8,
        options: [
          { label: "runTask", type: "method", detail: "function" },
          { label: "root", type: "property", detail: null },
        ],
      },
    });

    const source = createShellCompletionSource(() => "app.db");
    const result = await source(makeContext("runtime.run", 11), null as never);

    expect(mockedRequest).toHaveBeenCalledWith(
      expect.stringContaining("query ShellComplete"),
      { code: "runtime.run", position: 11, resourceId: "app.db" }
    );
    expect(result).toMatchObject({
      from: 8,
      options: [
        { label: "runTask", type: "method", detail: "function" },
        { label: "root", type: "property", detail: undefined },
      ],
    });
    // No `validFor`: every keystroke refetches from the server, which
    // filters by the live prefix. Client-side reuse froze stale lists.
    expect(result).not.toHaveProperty("validFor");
  });

  it("yields nothing without options", async () => {
    mockedRequest.mockResolvedValueOnce({
      shellComplete: { from: 3, options: [] },
    });

    const source = createShellCompletionSource(() => null);
    const result = await source(makeContext("   ", 3), null as never);

    expect(result).toBeNull();
  });

  it("yields nothing on transport errors", async () => {
    mockedRequest.mockRejectedValueOnce(new Error("network down"));

    const source = createShellCompletionSource(() => null);
    const result = await source(makeContext("r.", 2), null as never);

    expect(result).toBeNull();
  });
});
