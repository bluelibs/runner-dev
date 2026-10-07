import { Worker } from "node:worker_threads";
import { extname, join, resolve } from "node:path";
import type {
  SqliteCommand,
  SqliteResponse,
  SqliteResult,
} from "./sqliteWorker.protocol";

/** One connection owner serializes database work without occupying the application thread. */
export function sqliteWorkerClient(kind: "live" | "apm", file: string) {
  try {
    // Probe availability only; opening and accessing the database happens in the worker.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("node:sqlite");
  } catch (cause) {
    throw new Error("SQLite persistence requires the Node SQLite builtin.", {
      cause,
    });
  }
  const extension = extname(__filename);
  const entry = join(__dirname, `sqliteWorker${extension}`);
  // Source checkouts use their development TS loader; published builds run plain JS.
  const loader = extension === ".ts" ? require.resolve("tsx/cjs") : undefined;
  const worker = new Worker(
    'const { workerData } = require("node:worker_threads"); if (workerData.loader) require(workerData.loader); require(workerData.entry);',
    {
      eval: true,
      workerData: {
        kind,
        file: file === ":memory:" ? file : resolve(file),
        entry,
        loader,
      },
    }
  );
  let failure: Error | null = null;
  let closing = false;
  let closed = false;
  let sequence = 0;
  const pending = new Map<
    number,
    { resolve: (value: SqliteResult) => void; reject: (error: Error) => void }
  >();
  function fail(error: Error) {
    failure ??= error;
    for (const request of pending.values()) request.reject(failure);
    pending.clear();
    worker.unref();
  }
  worker.on("error", fail);
  worker.on("exit", (code) => {
    closed = true;
    if (!closing || pending.size)
      fail(new Error(`SQLite worker exited unexpectedly (${code}).`));
  });
  worker.on("message", (response: SqliteResponse) => {
    const request = pending.get(response.id);
    if (!request) return;
    pending.delete(response.id);
    if ("error" in response) request.reject(new Error(response.error));
    else request.resolve(response);
    if (!pending.size) worker.unref();
  });
  worker.unref();
  function assertReady() {
    if (failure) throw failure;
    if (closing || closed) throw new Error("SQLite persistence is closed.");
  }
  function request(command: SqliteCommand): Promise<SqliteResult> {
    assertReady();
    const id = ++sequence;
    return new Promise((resolveRequest, reject) => {
      pending.set(id, { resolve: resolveRequest, reject });
      worker.ref();
      try {
        worker.postMessage({ id, ...command });
      } catch (cause) {
        fail(
          cause instanceof Error ? cause : new Error("SQLite request failed.")
        );
      }
    });
  }
  return {
    request,
    assertReady,
    error: () => failure?.message ?? null,
    async close() {
      if (closed) {
        if (failure) throw failure;
        return;
      }
      try {
        if (failure) throw failure;
        const operation = request({ operation: "close" });
        closing = true;
        await operation;
      } finally {
        closing = true;
        await worker.terminate();
        closed = true;
      }
    },
  };
}
