/* Compare built artifacts in fresh processes; run from the repository root after build. */
const { createRequire } = require("node:module");
const { performance } = require("node:perf_hooks");
const { spawnSync } = require("node:child_process");
const { mkdtempSync, rmSync, writeFileSync } = require("node:fs");
const { join, resolve } = require("node:path");
const { tmpdir } = require("node:os");
const { setTimeout: delay } = require("node:timers/promises");
const args = process.argv.slice(2);
const option = (name, fallback) =>
  args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const median = (values) =>
  [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
async function measure() {
  const root = resolve(option("--root", ".")),
    mode = option("--mode", "runner");
  const load = createRequire(join(root, "package.json"));
  const { defineResource, defineTask, run } = load("@bluelibs/runner");
  const { dev, resources } = load(join(root, "dist/index.js"));
  const directory = mkdtempSync(join(tmpdir(), "runner-dev-perf-"));
  const noop = defineTask({
    id: "noop",
    async run() {
      return 1;
    },
  });
  const nested = defineTask({
    id: "nested",
    dependencies: { noop },
    async run(_, { noop }) {
      return noop();
    },
  });
  const io = defineTask({
    id: "io",
    async run() {
      await delay(1);
      return 1;
    },
  });
  let apm =
    mode === "apm-memory"
      ? { storage: "memory" }
      : mode === "apm-sqlite"
      ? { sqliteFile: join(directory, "apm.sqlite") }
      : false;
  if (args.includes("--max-storage")) {
    if (!apm) throw new Error("--max-storage requires an APM mode.");
    apm = { ...apm, maxStorage: option("--max-storage") };
  }
  const port = 19447;
  const register =
    mode === "runner"
      ? []
      : mode === "live"
      ? [resources.live.with({ apm }), resources.telemetry]
      : [dev.with({ host: "127.0.0.1", port, apm })];
  const app = defineResource({
    id: "benchmark",
    register: [noop, nested, io, ...register],
  });
  const startup = performance.now();
  const runtime = await run(app, { logs: { printThreshold: null } });
  const startupMs = performance.now() - startup;
  const trials = [];
  let disposed = false;
  let snapshotMs = 0,
    httpSnapshotMs = null;
  try {
    for (const [workload, target] of [
      ["noop", noop],
      ["nested", nested],
      ["io-1ms", io],
    ]) {
      const warmup =
        workload === "noop" ? 10000 : workload === "nested" ? 3000 : 20;
      for (let index = 0; index < warmup; index++)
        await runtime.runTask(target);
      const count = workload === "io-1ms" ? 150 : 1000;
      for (let trial = 0; trial < (workload === "io-1ms" ? 3 : 7); trial++) {
        const start = performance.now();
        for (let index = 0; index < count; index++)
          await runtime.runTask(target);
        trials.push({
          workload,
          trial,
          count,
          usPerCall: ((performance.now() - start) * 1000) / count,
        });
      }
    }
    if (mode !== "runner") {
      const live = runtime.getResourceValue(resources.live);
      const queries = [];
      for (let index = 0; index < 7; index++) {
        const start = performance.now();
        live.getApm();
        queries.push(performance.now() - start);
      }
      snapshotMs = median(queries);
      if (mode !== "live") {
        const start = performance.now();
        const response = await fetch(`http://127.0.0.1:${port}/graphql`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query:
              "{ live { apm { retainedSamples tasks { taskId count p95Ms p99Ms } } } }",
          }),
        });
        const body = await response.json();
        if (!response.ok || body.errors) throw new Error(JSON.stringify(body));
        httpSnapshotMs = performance.now() - start;
      }
    }
    const memory = process.memoryUsage();
    const shutdown = performance.now();
    await runtime.dispose();
    disposed = true;
    const result = {
      mode,
      node: process.version,
      startupMs,
      shutdownMs: performance.now() - shutdown,
      heapUsed: memory.heapUsed,
      rss: memory.rss,
      snapshotMs,
      httpSnapshotMs,
      trials,
    };
    writeFileSync(
      option("--output", join(directory, "result.json")),
      JSON.stringify(result, null, 2)
    );
    console.log(
      JSON.stringify({
        mode,
        medians: ["noop", "nested", "io-1ms"].map((workload) => [
          workload,
          median(
            trials
              .filter((trial) => trial.workload === workload)
              .map((trial) => trial.usPerCall)
          ),
        ]),
        snapshotMs,
      })
    );
  } finally {
    if (!disposed) await runtime.dispose();
    rmSync(directory, { recursive: true, force: true });
  }
}
function matrix() {
  const baseline = resolve(option("--baseline", ".")),
    candidate = resolve(option("--candidate", "."));
  const directory = resolve(
    option("--output", "/tmp/runner-dev-performance.json")
  );
  const results = [];
  for (let repetition = 0; repetition < 3; repetition++) {
    const versions =
      repetition % 2
        ? [
            ["candidate", candidate],
            ["baseline", baseline],
          ]
        : [
            ["baseline", baseline],
            ["candidate", candidate],
          ];
    for (const [version, root] of versions) {
      const modes =
        repetition % 2
          ? ["apm-sqlite", "apm-memory", "dev", "live", "runner"]
          : ["runner", "live", "dev", "apm-memory", "apm-sqlite"];
      for (const mode of modes) {
        const file = `${directory}.${version}.${repetition}.${mode}.json`;
        const child = spawnSync(
          process.execPath,
          [__filename, "--root", root, "--mode", mode, "--output", file],
          { encoding: "utf8" }
        );
        if (child.status !== 0) throw new Error(child.stderr + child.stdout);
        results.push({
          version,
          repetition,
          ...JSON.parse(require("node:fs").readFileSync(file, "utf8")),
        });
        console.log(`${version} ${repetition}: ${child.stdout.trim()}`);
      }
    }
  }
  writeFileSync(
    directory,
    JSON.stringify(
      {
        measuredAt: new Date().toISOString(),
        platform: process.platform,
        arch: process.arch,
        results,
      },
      null,
      2
    )
  );
}
const keepAlive = setInterval(() => {}, 1000);
Promise.resolve()
  .then(() => (args.includes("--matrix") ? matrix() : measure()))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => clearInterval(keepAlive));
