/* Build first. Compare identical SQLite transactions on the main thread and in a worker. */
const { Worker } = require("node:worker_threads");
const { performance } = require("node:perf_hooks");
const { mkdtempSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { setTimeout: delay } = require("node:timers/promises");
const {
  openSqliteLiveStore,
} = require("../dist/resources/live/sqliteLiveStore");
const { openSqliteApmStore } = require("../dist/resources/live/sqliteApmStore");
const {
  sqlitePersistence,
} = require("../dist/resources/live/sqlitePersistence");
const {
  sqliteApmPersistence,
} = require("../dist/resources/live/sqliteApmPersistence");
const median = (values) =>
  [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const sample = {
  sequence: 1,
  timestampMs: 1,
  nodeId: "task",
  nodeKind: "TASK",
  durationMs: 1,
  ok: true,
};

async function measure(kind, mode, file) {
  const store =
    kind === "live"
      ? mode === "worker"
        ? sqlitePersistence({ file })
        : openSqliteLiveStore({ file })
      : mode === "worker"
      ? sqliteApmPersistence(file)
      : openSqliteApmStore(file);
  let lock;
  let heartbeat;
  try {
    await store.load(kind === "live" ? { maxEntries: 10 } : { maxSamples: 10 });
    lock = new Worker(
      `
      const { parentPort, workerData } = require('node:worker_threads');
      const { DatabaseSync } = require('node:sqlite');
      const db = new DatabaseSync(workerData);
      db.exec('BEGIN IMMEDIATE');
      parentPort.on('message', () => {
        setTimeout(() => { db.exec('ROLLBACK'); db.close(); parentPort.close(); }, 100);
      });
      parentPort.postMessage('locked');
    `,
      { eval: true, workerData: file }
    );
    await new Promise((resolve, reject) => {
      lock.once("message", resolve);
      lock.once("error", reject);
    });
    let last = performance.now();
    let maxTimerLagMs = 0;
    let ticks = 0;
    heartbeat = setInterval(() => {
      const now = performance.now();
      maxTimerLagMs = Math.max(maxTimerLagMs, now - last - 5);
      last = now;
      ticks++;
    }, 5);
    await delay(20);
    const ticksBefore = ticks;
    lock.postMessage("release-after-100ms");
    const start = performance.now();
    if (mode === "worker") {
      if (kind === "live")
        store.append(
          {
            kind: "log",
            entry: {
              sequence: 1,
              timestampMs: 1,
              level: "info",
              message: "entry",
            },
          },
          { maxEntries: 10 }
        );
      else store.append(sample);
      await store.flush();
    } else {
      if (kind === "live")
        store.writeBatch([
          {
            record: {
              kind: "log",
              entry: {
                sequence: 1,
                timestampMs: 1,
                level: "info",
                message: "entry",
              },
            },
            maxEntries: 10,
          },
        ]);
      else store.writeBatch([sample]);
    }
    const commitMs = performance.now() - start;
    const ticksDuringWrite = ticks - ticksBefore;
    await delay(10);
    return { kind, mode, commitMs, maxTimerLagMs, ticksDuringWrite };
  } finally {
    clearInterval(heartbeat);
    if (lock) await lock.terminate();
    await store.close();
  }
}
async function main() {
  const directory = mkdtempSync(join(tmpdir(), "runner-dev-worker-bench-"));
  try {
    const runs = [];
    for (let trial = 0; trial < 3; trial++) {
      for (const kind of ["live", "apm"]) {
        for (const mode of trial % 2
          ? ["worker", "main"]
          : ["main", "worker"]) {
          runs.push(
            await measure(
              kind,
              mode,
              join(directory, `${kind}-${mode}-${trial}.sqlite`)
            )
          );
        }
      }
    }
    const summary = [];
    for (const kind of ["live", "apm"])
      for (const mode of ["main", "worker"]) {
        const selected = runs.filter(
          (run) => run.kind === kind && run.mode === mode
        );
        summary.push({
          kind,
          mode,
          medianCommitMs: median(selected.map((run) => run.commitMs)),
          medianMaxTimerLagMs: median(selected.map((run) => run.maxTimerLagMs)),
          medianTicksDuringWrite: median(
            selected.map((run) => run.ticksDuringWrite)
          ),
        });
      }
    console.log(
      JSON.stringify(
        {
          node: process.version,
          platform: `${process.platform}-${process.arch}`,
          lockMs: 100,
          heartbeatMs: 5,
          runs,
          summary,
        },
        null,
        2
      )
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
