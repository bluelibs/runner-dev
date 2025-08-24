import { createAgentTerminal } from "../code";

describe("agent terminal scaffold", () => {
  it("initializes with defaults and updates config", () => {
    const term = createAgentTerminal({ prompt: "> " });
    const state1 = term.getState();
    expect(state1.config.prompt).toBe("> ");
    expect(state1.isRunning).toBe(false);
    expect(state1.history).toEqual([]);

    term.setConfig({ prompt: "ai> ", historyLimit: 2 });
    const state2 = term.getState();
    expect(state2.config.prompt).toBe("ai> ");
    expect(state2.config.historyLimit).toBe(2);
  });

  it("collects history and enforces history limit", async () => {
    const received: string[] = [];
    const term = createAgentTerminal(
      { historyLimit: 2 },
      {
        onChunk: (c) => c.text && received.push(c.text),
      }
    );

    await term.send("hello");
    await term.send("world");
    await term.send("again");

    const { history } = term.getState();
    // historyLimit applies to messages, not turns
    expect(history.length).toBe(2);
    expect(history[0].role).toBe("user");
    expect(history[0].content).toBe("again");
    expect(history[1].role).toBe("assistant");
    expect(history[1].content).toContain("I am currently not implemented");
    expect(received).toContain("...");
  });

  it("start/stop are idempotent and do not throw", async () => {
    const term = createAgentTerminal();
    await term.start();
    await term.start();
    await term.stop();
    await term.stop();
    // Avoid leaving readline open in test env
  });

  it("supports /help, /history, /clear, /config, /exit", async () => {
    const chunks: string[] = [];
    const term = createAgentTerminal(undefined, {
      onChunk: (c) => c.text && chunks.push(c.text),
    });
    await term.send("/help");
    expect(chunks.join("\n")).toContain("Slash commands:");

    await term.send("hello");
    await term.send("/history 1");
    expect(chunks.join("\n")).toContain("assistant:");

    await term.send("/config prompt=ai> ");
    expect(chunks.join("\n")).toContain("Updated prompt.");

    await term.send("/clear");
    expect(chunks).toContain("History cleared.");

    await term.send("/exit");
    expect(chunks).toContain("Exiting...");
  });

  it("supports @pattern search and /save flow", async () => {
    const chunks: string[] = [];
    const term = createAgentTerminal(undefined, {
      onChunk: (c) => c.text && chunks.push(c.text),
    });
    await term.send("@code.ts");
    const stateAfterSearch = term.getState();
    // At least this test file should be discoverable relative to cwd
    expect(stateAfterSearch.lastSearchResults.length).toBeGreaterThan(0);

    await term.send("/save 1");
    const stateAfterSave = term.getState();
    expect(stateAfterSave.savedFiles.length).toBe(1);

    await term.send("/saved");
    expect(chunks.join("\n")).toContain("Saved:");
  });
});
