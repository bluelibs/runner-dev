import { parentPort, workerData } from "node:worker_threads";
import z from "zod";
import { openSqliteLiveStore } from "./sqliteLiveStore";
import { openSqliteApmStore } from "./sqliteApmStore";
import type {
  SqliteRequest,
  SqliteResponse,
  SqliteResult,
} from "./sqliteWorker.protocol";

const config = z
  .object({ kind: z.enum(["live", "apm"]), file: z.string().min(1) })
  .parse(workerData);
const port = parentPort;
if (!port) throw new Error("SQLite persistence must run in a worker.");
const store =
  config.kind === "live"
    ? {
        kind: "live" as const,
        value: openSqliteLiveStore({ file: config.file }),
      }
    : { kind: "apm" as const, value: openSqliteApmStore(config.file) };
function dispatch(request: SqliteRequest): SqliteResult {
  if (request.operation === "close") {
    store.value.close();
    return { operation: "closed" };
  }
  if (store.kind === "live") {
    if (request.operation === "live-load")
      return {
        operation: "live-load",
        snapshot: store.value.load({ maxEntries: request.maxEntries }),
      };
    if (request.operation === "live-write") {
      store.value.writeBatch(request.items);
      return { operation: "written" };
    }
  } else {
    if (request.operation === "apm-load")
      return {
        operation: "apm-load",
        snapshot: store.value.load(request.options),
      };
    if (request.operation === "apm-write") {
      store.value.writeBatch(request.samples);
      return { operation: "written" };
    }
  }
  throw new Error("SQLite request does not match this store.");
}
port.on("message", (request: SqliteRequest) => {
  let response: SqliteResponse;
  try {
    response = { id: request.id, ...dispatch(request) };
  } catch (error) {
    response = {
      id: request.id,
      error:
        error instanceof Error ? error.message : "SQLite persistence failed.",
    };
  }
  port.postMessage(response);
  if (request.operation === "close") port.close();
});
