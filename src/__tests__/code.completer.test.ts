import { buildAsyncCompleter } from "../code";

describe("terminal completer", () => {
  const mkState = () => ({
    config: {
      prompt: "agent> ",
      historyLimit: 1000,
      enableTools: true,
      modelName: "gpt-xxx",
    },
    history: [],
    isRunning: false,
    lastSearchResults: [],
    savedFiles: [],
  });

  it("suggests slash commands on / prefix", async () => {
    const completer = buildAsyncCompleter(mkState() as any);
    const result = await new Promise<[string[], string]>((resolve) => {
      completer("/he", (_err, res) => resolve(res));
    });
    expect(result[0].some((s) => s.startsWith("/he"))).toBe(true);
  });

  it("suggests @ when less than 2 chars, and files when >=2 chars", async () => {
    const completer = buildAsyncCompleter(mkState() as any);
    const r1 = await new Promise<[string[], string]>((resolve) => {
      completer("@a", (_err, res) => resolve(res));
    });
    expect(r1[0][0]).toContain("@<pattern>");

    const r2 = await new Promise<[string[], string]>((resolve) => {
      completer("@co", (_err, res) => resolve(res));
    });
    // We cannot assert exact files, but should be an array
    expect(Array.isArray(r2[0])).toBe(true);
  });
});
