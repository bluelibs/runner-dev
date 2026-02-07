import readline from "node:readline";
import { promises as fsp } from "node:fs";
import path from "node:path";

type AgentMessageRole = "user" | "assistant" | "system" | "tool";

export interface AgentMessage {
  role: AgentMessageRole;
  content: string;
  name?: string;
  timestampMs?: number;
}

export interface AgentToolCall {
  id: string;
  name: string;
  argumentsJson: string;
}

export interface AgentResponseChunk {
  type: "text" | "tool_call" | "tool_result" | "event";
  text?: string;
  toolCall?: AgentToolCall;
  event?: { name: string; data?: unknown };
}

export interface TerminalConfig {
  prompt?: string;
  historyLimit?: number;
  enableTools?: boolean;
  modelName?: string;
}

export interface AgentTerminalState {
  config: Required<TerminalConfig>;
  history: AgentMessage[];
  isRunning: boolean;
  lastSearchResults: string[];
  savedFiles: string[];
}

export interface AgentTerminalHandlers {
  onChunk?: (chunk: AgentResponseChunk) => void;
  onMessage?: (message: AgentMessage) => void;
  onError?: (error: unknown) => void;
  onExit?: () => void;
}

export interface AgentTerminalControls {
  start: () => Promise<void>;
  stop: () => Promise<void>;
  send: (input: string) => Promise<void>;
  getState: () => AgentTerminalState;
  setConfig: (partial: Partial<TerminalConfig>) => void;
}

function withDefaults(config?: TerminalConfig): Required<TerminalConfig> {
  return {
    prompt: config?.prompt ?? "agent> ",
    historyLimit: config?.historyLimit ?? 1000,
    enableTools: config?.enableTools ?? true,
    modelName: config?.modelName ?? "gpt-xxx",
  };
}

export function createAgentTerminal(
  initialConfig?: TerminalConfig,
  handlers?: AgentTerminalHandlers
): AgentTerminalControls {
  const state: AgentTerminalState = {
    config: withDefaults(initialConfig),
    history: [],
    isRunning: false,
    lastSearchResults: [],
    savedFiles: [],
  };

  let rl: readline.Interface | null = null;

  function emitMessage(message: AgentMessage) {
    state.history.push(message);
    if (state.history.length > state.config.historyLimit) {
      state.history.splice(0, state.history.length - state.config.historyLimit);
    }
    handlers?.onMessage?.(message);
  }

  async function start(): Promise<void> {
    if (state.isRunning) return;
    state.isRunning = true;
    rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: state.config.prompt,
      completer: buildAsyncCompleter(state),
    });
    rl.setPrompt(state.config.prompt);
    rl.prompt();
    rl.on("line", async (line) => {
      await send(line);
      rl?.prompt();
    });
    rl.on("close", async () => {
      await stop();
      handlers?.onExit?.();
    });
  }

  async function stop(): Promise<void> {
    if (!state.isRunning) return;
    state.isRunning = false;
    rl?.close();
    rl = null;
  }

  async function send(input: string): Promise<void> {
    const trimmed = input.trim();
    if (!trimmed) return;

    // Slash commands
    if (trimmed.startsWith("/")) {
      await handleSlashCommand(trimmed);
      return;
    }

    // @ search command
    if (trimmed.startsWith("@")) {
      await handleAtCommand(trimmed.slice(1).trim());
      return;
    }

    // push user message
    emitMessage({ role: "user", content: trimmed, timestampMs: Date.now() });

    // Emulate loading and not-implemented agent reply
    try {
      handlers?.onChunk?.({ type: "text", text: "..." });
      const notImplemented =
        "I am currently not implemented, but thanks for considering";
      handlers?.onChunk?.({ type: "text", text: notImplemented });
      emitMessage({
        role: "assistant",
        content: notImplemented,
        timestampMs: Date.now(),
      });
    } catch (error) {
      handlers?.onError?.(error);
    }
  }

  function getState(): AgentTerminalState {
    return state;
  }

  function setConfig(partial: Partial<TerminalConfig>): void {
    state.config = withDefaults({ ...state.config, ...partial });
    if (rl) {
      rl.setPrompt(state.config.prompt);
    }
  }

  async function handleSlashCommand(cmd: string): Promise<void> {
    const [base, ...rest] = cmd.split(/\s+/);
    switch (base) {
      case "/help": {
        handlers?.onChunk?.({
          type: "text",
          text: [
            "Slash commands:",
            "/help - show this help",
            "/history [n] - show last n messages",
            "/clear - clear message history",
            "/config key=value - update config (prompt, historyLimit, enableTools, modelName)",
            "/save <index> - save a file from last @ search results",
            "/saved - list saved files",
            "/exit - exit terminal",
            "@pattern - search files under cwd; then use /save <index> to save",
          ].join("\n"),
        });
        return;
      }
      case "/history": {
        const n = Number(rest[0] ?? "10");
        const slice =
          Number.isFinite(n) && n > 0 ? state.history.slice(-n) : state.history;
        const lines = slice.map((m) => `${m.role}: ${m.content}`);
        handlers?.onChunk?.({
          type: "text",
          text: lines.join("\n") || "(empty)",
        });
        return;
      }
      case "/clear": {
        state.history = [];
        handlers?.onChunk?.({ type: "text", text: "History cleared." });
        return;
      }
      case "/config": {
        const kv = rest.join(" ");
        const match = kv.match(/^(\w+)=(.+)$/);
        if (!match) {
          handlers?.onChunk?.({
            type: "text",
            text: "Usage: /config key=value",
          });
          return;
        }
        const [, key, value] = match;
        try {
          switch (key) {
            case "prompt":
              setConfig({ prompt: value });
              break;
            case "historyLimit":
              setConfig({ historyLimit: Number(value) });
              break;
            case "enableTools":
              setConfig({ enableTools: value === "true" });
              break;
            case "modelName":
              setConfig({ modelName: value });
              break;
            default:
              handlers?.onChunk?.({
                type: "text",
                text: `Unknown config key: ${key}`,
              });
              return;
          }
          handlers?.onChunk?.({ type: "text", text: `Updated ${key}.` });
        } catch (e) {
          handlers?.onError?.(e);
        }
        return;
      }
      case "/save": {
        const idx = Number(rest[0] ?? "NaN");
        if (
          !Number.isFinite(idx) ||
          idx < 1 ||
          idx > state.lastSearchResults.length
        ) {
          handlers?.onChunk?.({
            type: "text",
            text: "Usage: /save <index> (from last @ search)",
          });
          return;
        }
        const picked = state.lastSearchResults[idx - 1];
        state.savedFiles.push(picked);
        handlers?.onChunk?.({ type: "text", text: `Saved: ${picked}` });
        return;
      }
      case "/saved": {
        if (state.savedFiles.length === 0) {
          handlers?.onChunk?.({ type: "text", text: "(no saved files)" });
          return;
        }
        const lines = state.savedFiles.map((f, i) => `${i + 1}. ${f}`);
        handlers?.onChunk?.({ type: "text", text: lines.join("\n") });
        return;
      }
      case "/exit":
      case "/quit": {
        handlers?.onChunk?.({ type: "text", text: "Exiting..." });
        await stop();
        handlers?.onExit?.();
        return;
      }
      default: {
        handlers?.onChunk?.({
          type: "text",
          text: `Unknown command: ${base}. Type /help`,
        });
        return;
      }
    }
  }

  async function handleAtCommand(pattern: string): Promise<void> {
    if (!pattern) {
      handlers?.onChunk?.({ type: "text", text: "Usage: @<pattern>" });
      return;
    }
    try {
      const cwd = process.cwd();
      const results = await searchFilesByPattern(pattern, cwd, 50);
      state.lastSearchResults = results.map((abs) => path.relative(cwd, abs));
      if (state.lastSearchResults.length === 0) {
        handlers?.onChunk?.({
          type: "text",
          text: `No files matching: ${pattern}`,
        });
        return;
      }
      const lines = [
        `Found ${state.lastSearchResults.length} file(s):`,
        ...state.lastSearchResults.map((p, i) => `${i + 1}. ${p}`),
        "Use /save <index> to save to your list.",
      ];
      handlers?.onChunk?.({ type: "text", text: lines.join("\n") });
    } catch (e) {
      handlers?.onError?.(e);
    }
  }

  return { start, stop, send, getState, setConfig };
}

// Small CLI entry if invoked directly: runs the minimal terminal.
// Check if this file is being run directly (works in both CommonJS and ESM after compilation)
if (typeof require !== "undefined" && require.main === module) {
  const terminal = createAgentTerminal(undefined, {
    onChunk: (c) => {
      if (c.text) process.stdout.write(c.text + "\n");
    },
    onError: (e) => {
      console.error(e);
    },
    onExit: () => {
      process.exit(0);
    },
  });
  terminal.start().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}

async function searchFilesByPattern(
  pattern: string,
  rootDir: string,
  maxResults: number
): Promise<string[]> {
  const queue: string[] = [rootDir];
  const results: string[] = [];
  const lowered = pattern.toLowerCase();
  const IGNORE_DIRS = new Set([
    "node_modules",
    ".git",
    "dist",
    "coverage",
    "build",
    ".next",
    ".turbo",
  ]);

  while (queue.length > 0 && results.length < maxResults) {
    const current = queue.shift()!;
    let entries: Array<import("node:fs").Dirent> = [];
    try {
      entries = await fsp.readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (IGNORE_DIRS.has(entry.name)) continue;
        queue.push(fullPath);
      } else if (entry.isFile()) {
        const rel = path.relative(rootDir, fullPath);
        if (rel.toLowerCase().includes(lowered)) {
          results.push(fullPath);
          if (results.length >= maxResults) break;
        }
      }
    }
  }

  return results;
}

export function buildAsyncCompleter(_state: AgentTerminalState) {
  const slashCommands = [
    "/help",
    "/history",
    "/clear",
    "/config",
    "/save",
    "/saved",
    "/exit",
    "/quit",
  ];

  return (
    line: string,
    cb: (err: Error | null, result: [string[], string]) => void
  ) => {
    const trimmed = line.trim();

    try {
      // Slash command completions
      if (trimmed.startsWith("/")) {
        const matches = slashCommands.filter((c) => c.startsWith(trimmed));
        cb(null, [matches.length ? matches : slashCommands, line]);
        return;
      }

      // @ file search completions after 2 chars
      if (trimmed.startsWith("@")) {
        const pattern = trimmed.slice(1);
        if (pattern.length >= 2) {
          // Use async search but handle it properly
          searchFilesByPattern(pattern, process.cwd(), 50)
            .then((files) => {
              const rels = files.map((abs) =>
                path.relative(process.cwd(), abs)
              );
              cb(null, [rels, line]);
            })
            .catch(() => {
              cb(null, [["@<pattern>"], line]);
            });
        } else {
          cb(null, [["@<pattern>"], line]);
        }
        return;
      }

      // default: no suggestions
      cb(null, [["/help", "@<pattern>"], line]);
    } catch (_e) {
      cb(null, [["/help"], line]);
    }
  };
}
