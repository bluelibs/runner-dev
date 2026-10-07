# Runner-Dev Compact Guide

Runner-Dev is the developer-facing toolkit for inspecting, querying, and debugging Runner apps through a docs UI, GraphQL endpoint, MCP server, live telemetry, and controlled hot-swapping. Use it when the task is about what a Runner app looks like at runtime, what the docs/AI layer sees, or how runner-dev exposes that information.

It also supports a static export path through `exportDocs(app, { output?, overwrite? })` when you want the visual catalog without keeping a live server around.

## Use This When

- The task touches `/docs/data`, docs UI, chat context, agent-facing documentation, or the topology graph / blast-radius / mindmap views.
- The task touches the runtime shell, the `⌘K` command palette, keyboard shortcuts, or the docs tables (search, sort, pager).
- You need GraphQL or MCP access to runtime topology, telemetry, schema, or diagnostics.
- You are debugging telemetry, live events and their `sequence` cursors, durable metadata, hook targets, middleware provenance, or lane surfaces.
- You are changing runner-dev CLI, MCP tools, docs payload shaping, introspection behavior, or the security defaults (code-execution gate, loopback bind, Host check).

## Fastest Path To Success

1. Decide whether the target app is already running.
2. If it is running, prefer MCP or GraphQL before reading lots of source.
3. If it is package work, locate the subsystem first:
   - docs payloads and docs UI
   - introspector/store serialization
   - MCP tools
   - live telemetry
   - swap/hot-reload
4. Patch the smallest surface that explains the behavior.
5. Run the narrowest relevant test first, then widen only if needed.

## Quick Setup

Register runner-dev in the Runner root:

```ts
import { r } from "@bluelibs/runner";
import { dev } from "@bluelibs/runner-dev";

export const app = r
  .resource("app")
  .register([
    dev.with({
      port: 1337, // default
      maxEntries: 10000, // default, per live category; must be a positive integer
      // host: "0.0.0.0", // only to expose it on a network; default is 127.0.0.1
      // allowedHosts: ["devbox.lan"], // DNS names to accept besides localhost and IP addresses
    }),
  ])
  .build();
```

Optional telemetry persistence:

```ts
import { dev, resources } from "@bluelibs/runner-dev";

const devTools = dev.with({
  maxEntries: 10_000,
  persistence: resources.sqlitePersistence.with({
    file: "./.runner-dev/telemetry.sqlite",
  }),
});
```

Register `devTools` in the root. `persistence` accepts a provider resource or configured `.with(...)` entry, following Runner cache wiring: the provider is auto-registered and injected with its dependencies, overrides and isolation. Its initialized value must be a `LivePersistence` store. Resource `init()` initializes the store, and `dispose()` releases it after live stops. `sqlitePersistence({ file })` creates a closeable store for custom resource wiring. `sqlitePersistenceResource` also exports the built-in resource by name. Logs, emissions, errors and task/hook runs restore before serving GraphQL, docs or SSE. The cap applies per category in memory and on disk, including when reduced on restart; sequence cursors continue above the saved maximum even with a backwards clock. Without `persistence`, history is memory-only. `resources.live.with()` accepts the same options.

SQLite uses the built-in `node:sqlite`, loaded lazily, with no npm runtime dependency. Use Node 22.13+ or 24+ (22.5–22.12 needs `--experimental-sqlite`), a stable file path, one file per app/runtime, and a gitignored database directory. Parent directories are created. Each store owns a worker thread for opening, restoration, batched SQL, eviction and closing. Recording synchronously validates/snapshots and queues before notification; disk commits happen asynchronously in atomic batches. Queues hold at most 10,000 pending/in-flight entries, with batches of 1000 and a 1-second flush interval. Queue overflow rejects new entries; write failures latch and surface via status/subsequent recording/flush/close. Graceful disposal drains and closes; abrupt termination may lose pending entries. Open/restore failures reject startup. Direct SQLite users must await load() before restored recording and await close(); flush() acknowledges commits and status() returns pendingEntries/error. The cap counts rows, not bytes; SQLite reuses freed pages. Payloads restore as JSON snapshots (errors retain name/message/stack; bigint/symbols become strings, functions `[Function]`, circular/repeated references `[Circular]`, dates JSON strings).

Custom persistence resources return exported `LivePersistence` directly. `load({ maxEntries })` may be sync or async; it trims every category and returns `{ entries: LivePersistedEntry[], lastSequence }` in unique ascending sequence order; `lastSequence` includes evicted records, or `0` for a new store. Synchronous `append({ kind, entry }, { maxEntries })` returns `undefined`, accepting an atomic commit or immutable snapshot into a bounded queue, or throws. Buffered providers must drain on disposal and expose failures; committed batches atomically update records, sequences and eviction. Promise writes are rejected at compile time and guarded at runtime; invalid provider values fail startup. Validate before committing (SQLite validates serialized records) to prevent invalid snapshots from poisoning restart recovery. `kind` is `log`, `emission`, `error` or `run`. The provider resource owns setup and cleanup through `init()`/`dispose()`; Runner disposes initialized providers if restoration fails. Use `dev.with({ persistence: myProviderResource })`. `LivePersistenceResource`/`LivePersistenceSource` describe accepted references. See README's custom resource example; avoid provider dependencies on live itself (cycles).

Expected endpoints after the app starts:

- Durable dashboard: `http://localhost:1337/durable` (live application runtimes)
- Docs UI: `http://localhost:1337/docs` (the root `/` redirects to Voyager)
- GraphQL: `http://localhost:1337/graphql`
- Voyager: `http://localhost:1337/voyager`
- Live stream: `http://localhost:1337/live/stream`
- Docs payload: `http://localhost:1337/docs/data`

Requirements: Node.js 22+, `@bluelibs/runner` ^6.6.0 (peer), and optionally `typescript` 5 or 6 for `swapTask`, `eval` and `shell`.

Static export option:

```ts
// scripts/export-docs.ts
import { exportDocs } from "@bluelibs/runner-dev";
import { app } from "../src/app";

await exportDocs(app);
// Optional custom destination:
await exportDocs(app, {
  output: "./artifacts/runner-dev-catalog",
  overwrite: true,
});
```

Add a package script:

```json
{
  "scripts": {
    "docs:export": "tsx scripts/export-docs.ts"
  }
}
```

Then run:

```bash
npm run docs:export
```

Notes:

- default output is `./runner-dev-catalog`
- `exportDocs()` uses Runner dry-run under the hood: it effectively does `run(app, { dryRun: true })` and snapshots the composed in-memory store
- `exportDocs(app)` writes a standalone `index.html` plus `snapshot.json`
- custom non-empty directories require `overwrite: true`
- the exported `index.html` is standalone and can be opened directly over `file://`
- `snapshot.json` is still written as an auxiliary artifact for inspection, debugging, and snapshot-backed MCP
- this works well in CI too: upload the export folder as a build artifact and inspect it after the pipeline finishes
- in this repository, `npm run play:export` is the same pattern wired to the reference commerce app used by `npm run play`


### Durable workflow dashboard

The docs sidebar shows **Durable** only when the backend reports an available application durable runtime in `/docs/data` (`hasDurable`). It opens `/durable` on the same Runner Dev server for a separate Durable Workflows dashboard. It attaches to the application's existing durable runtimes and uses the same Host checks and optional `RUNNER_DEV_HTTP_PASSWORD` authentication as `/docs`. It does not start another runtime or configure a backend.

Select a runtime to browse its workflows, cursor-paginated execution history, current waits, persisted steps, signals, audit, and schedules. Lists contain bounded summaries; full input/result/error payloads are read when opening execution details. The dashboard also exposes start, signal, cancel, retry, recovery, schedule management, and operator repair actions. Retry is available for failed or compensation-failed runs and resumes from memoized progress; recovery applies to the selected runtime's backend. Operators have the same full-access trust boundary as the other DevTools endpoints.

Runner 6.6 supports the core views and operations. Execution pause/resume/restart and workflow state are shown only when the runtime supports them. Durable audit must already be enabled by the application; an empty audit view does not imply no activity. Repair reasons are logged by DevTools; the public Runner 6.6 operator API does not persist those reasons into durable audit.

The timeline shows observed persisted steps and the current activity, rather than guessing future branches. The signal dialog uses declared signal metadata or the event ID of the execution's current wait. Optional `tags.durableWorkflow.with({ metadata: { studio: { presets: [{ name, payload }] } } })` supplies named JSON inputs to the start dialog. Runtime selection scopes requests with `runtimeId`; the REST API is under `/durable/api` and is separate from GraphQL/MCP. The dashboard is live-only and is not part of static catalog exports.

For a local example in this repository, run `npm run build:ui` followed by `npm run play:durable`, then open `http://localhost:31339/durable`. This starts a real in-memory application with example executions, audit, and schedules.

### Opt-in task and hook performance (APM)

Enable with `dev.with({ apm: true })` (also supported by `resources.live.with()`).
The **Telemetry** tab shows task and hook APM in separate views. The **Logs** tab provides focused log inspection
and correlation traces. **Live** retains its original process health, logs, events and runs.
Click a nonzero failure rate to inspect retained errors for that task or hook in the selected window and scope. Correlation IDs open the related trace and logs (up to 200 retained entries per category). Failure details start with the latest 50 matching runs and errors; scrolling automatically loads older retained errors in fixed-size pages; aggregate APM history may outlast those records.
APM records every completed application task and hook, including failed calls,
and excludes internal GraphQL tasks. Hook reactions include delegated task work. Timing uses a monotonic clock. Duration is inclusive
of child work; nested durations overlap and must not be summed as request latency.
Direct calls have no parent task, hook or event; nested calls run inside one.
Tasks delegated by hooks retain the hook as their trace parent. Task and hook
counts and percentiles stay separate; their durations overlap.

```ts
const devTools = dev.with({
  apm: {
    maxSamples: 10_000,
    storage: "auto", // default; use "memory" to avoid filesystem writes
    sqliteFile: "./.runner-dev/apm.sqlite", // default; one file per runtime
  },
});
```

SQLite is loaded lazily from Node's built-in `node:sqlite`. If the builtin is
unavailable, collection falls back to memory and the UI reports the actual storage.
Other database failures throw. SQLite samples restore on restart; worker-owned buffered batches
commit during collection and flush on graceful disposal. Gitignore the database
directory. APM uses a separate bounded sample history from trace `maxEntries` and
`persistence`; configuring live persistence alone does not enable APM. Only node ID and kind,
completion timestamp, duration, success and direct/nested classification are stored;
inputs, outputs, error text and correlation IDs are excluded.

The dashboard filters all/direct/nested calls and 5-minute, 30-minute, 1-hour or
24-hour windows, switches between Tasks and Hooks, sorts each by p95 and shows calls, failure rate, mean, p50, p95,
p99 and maximum. Percentiles use exact nearest rank over retained completions in the
selected window, including failures. Small samples are labeled. The global cap
(shared by tasks and hooks; default 10,000, configurable up to 1,000,000) can shorten the selected window during
high traffic; the UI reports the retained count and oldest retained completion.
These are retained-window statistics, not lifetime totals or sampled distributed traces.

```graphql
query TaskPerformance {
  live {
    apm(windowMinutes: 30, scope: all) {
      enabled storage maxSamples retainedSamples oldestTimestampMs
      tasks { taskId count failures errorRate meanMs p50Ms p95Ms p99Ms maxMs }
      hooks { hookId count failures errorRate meanMs p50Ms p95Ms p99Ms maxMs }
    }
  }
}
```

`scope` is `all` (default), `direct` or `nested`. `windowMinutes` defaults to 30
and accepts integers from 1 through 525600. Event reactions are nested because
the emitted event is their parent. APM is disabled by default.

### APM persistence and retention

Configure retention once under `apm`; the same policy applies to the dashboard and
stored samples. Choose a sample count or a byte budget, and optionally an age limit:

```ts
import { dev, resources } from "@bluelibs/runner-dev";

const devTools = dev.with({
  apm: {
    retentionDays: 7,
    maxStorage: "1mb",
    // maxSamples: 100_000, // optional additional cap
    persistence: resources.clickHouseApmPersistence.with({
      url: "http://localhost:8123",
      streamId: "orders-worker", // stable, unique per runtime; never share concurrently
    }),
  },
});
```

`maxStorage` accepts integer bytes or strings such as `"512kb"`, `"1mb"`, and
`"1.5 MiB"` (binary units). The minimum is 512 KiB. It measures UTF-8 compact sample
JSON, excluding database/index/file overhead, write queues and JavaScript object
bookkeeping. It is a retained-data budget, not a hard process-memory or physical
file-size limit. Oldest samples are evicted first. Without a byte budget,
`maxSamples` defaults to 10,000; with one, the count has a 10,000,000 safety ceiling
unless explicitly set lower. Both limits apply when supplied. Percentile query cost
grows with retained history; buffers allocate lazily.

`retentionDays` is a sliding age limit. ISO `cutoffDate` is an optional absolute
lower boundary; the stricter date wins. In-memory queries immediately exclude expired
samples; adapters trim on restoration and committed batches. SQLite is automatically
available on supported Node versions, otherwise memory. SQLite APM and live history use separate worker-owned connections with bounded
batches and drain on graceful shutdown; existing APM files migrate automatically.
Live logs/traces retain their independent history caps.

ClickHouse uses Node's native HTTP client through `fetch`; choosing it requires no
additional npm dependency. Set `CLICKHOUSE_USER` / `CLICKHOUSE_PASSWORD` in the
environment, keeping credentials out of URLs/config. Provision the database first
(`database` defaults to `default`; `table` to `runner_dev_apm`). The resource creates
or upgrades the table with per-row expiration, so workers in the same table can use
different age limits. Count/byte/date eviction is scoped to `streamId`; ClickHouse TTL
also removes expired rows during merges. Mutations finish before flush acknowledges
retention, while physical disk reclamation follows database housekeeping. Sequence
metadata survives eviction. Existing rows keep their previous TTL until rewritten.

For Redis, install the optional peer dependency `ioredis` and substitute:

```ts
persistence: resources.redisApmPersistence.with({
  url: "redis://localhost:6379",
  streamId: "orders-worker",
})
```

Redis loads lazily only when selected. Credentials use `REDIS_USERNAME` /
`REDIS_PASSWORD`. A Lua transaction atomically appends samples and applies age,
count and byte eviction. Keys share a Redis Cluster hash tag; stream IDs isolate
workers. Sample keys expire after the configured retention period when idle;
sequence metadata remains. Redis server persistence (AOF/RDB) determines survival
across Redis server restarts. Use one active runtime per stream or SQLite file.

Defaults for buffered adapters: batches of 1000, 1-second flush interval, 10,000
queued/in-flight samples and 10-second remote request timeout. Configure `batchSize`,
`flushIntervalMs`, `maxPendingSamples` and `timeoutMs` on remote adapter resources.
Writes are acknowledged after committing; failures are latched and exposed in the
Telemetry panel and subsequent append/flush calls. There are no automatic retries
or silent fallback. Overflow throws. Abrupt termination can lose unflushed samples;
graceful Runner disposal drains them before closing. APM stores compact timings only;
related error logs still depend on live telemetry retention.

Custom resources return `ApmPersistence`: `storage`, async
`load({ maxSamples, maxStorage, retentionDays, cutoffTimestampMs })`, synchronous
enqueue-only `append(sample)`, async `flush()`, and optional `status()`. `maxStorage`
is normalized to bytes before `load`; adapters must enforce the supplied policy.
`load` returns ascending unique `samples` and highest committed `lastSequence`,
including evicted samples. Startup validates the snapshot. Config auto-registers
and injects the provider, so Runner overrides, isolation and disposal apply.

See [the performance measurements](TELEMETRY_PERFORMANCE.md) for overhead,
methodology and a repeatable comparison script.


## Security Defaults

- The server listens on `127.0.0.1` unless `host` is set. On every bind, requests whose `Host` header is a DNS name other than `localhost`, the configured `host` or an `allowedHosts` entry get `403` (DNS-rebinding guard); IP addresses always pass, while hosts-file aliases and `*.localhost` names are refused unless listed.
- To reach it from Docker, a remote box or a LAN, set `dev.with({ host: "0.0.0.0" })` (or `resources.server.with({ host })`), plus `allowedHosts: ["devbox.lan"]` for access by DNS name; entries are exact hostnames, and both entry points reject a scheme, port or wildcard at `.with()` (Unicode names match their punycode form). The server logs a startup warning when the bound address is not loopback and code execution is also enabled.
- Set `RUNNER_DEV_HTTP_PASSWORD` before server startup to enable HTTP Basic auth on every route (UI/assets, GraphQL, Voyager, SSE and HTTP-tagged tasks). Browser login: username `runner`, password from the variable. Production requires it: resolved Runner mode `prod` (including explicit `run(app, { mode: "prod" })`) or `NODE_ENV=production` fails before Apollo or HTTP startup if it is missing. Empty or whitespace-only fails in every mode; unset disables auth outside production. The secret stays outside resource config and exported docs; restart to rotate it. Remote access needs HTTPS at a proxy or a secure tunnel, since Basic auth does not encrypt credentials; preserve the browser-facing Host header. Authenticated browser calls must use the same origin, including port: cross-site requests are rejected. Twenty failed credential attempts block the connecting IP for up to one minute (`429`, `Retry-After`), shared by clients behind a proxy. The password grants full DevTools access; it does not add a production read-only mode.
- The served docs UI calls the API on the origin it was loaded from, so IP addresses, remapped Docker ports and DNS names listed in `allowedHosts` work (an unlisted name gets `403` first); the `API_URL` env var overrides it.
- Code-execution gate: `eval`, `shell`, `shellComplete`, `swapTask`, `editFile` and `evalInput: true` on `invokeTask`/`invokeEvent` run only with `RUNNER_DEV_EVAL=1` or `NODE_ENV` exactly `development`/`test`. An unset `NODE_ENV` (plain `node`, `tsx watch`, a scaffolded `npm run dev`) keeps it closed. Closed calls return `success: false` with `<Feature> is disabled in this environment. Set RUNNER_DEV_EVAL=1 or NODE_ENV=development on the server to enable it.`
- Probe it with `query { codeExecutionEnabled }`; `shellEnabled` is the same value.
- Not gated: queries (including `fileContents` of registered elements), plain-JSON `invokeTask`/`invokeEvent`, `unswapTask`, `unswapAllTasks`.
- `eval` and `shell` runs time out after `RUNNER_DEV_SHELL_TIMEOUT_MS` (default 30000; the code keeps running after the timeout) and results are cut past 256 KB with `… [truncated N chars]`. A `shell` budget also covers initializing a lazy `resourceId` (`Resource '<id>' did not finish initializing. …`).

## MCP Quickstart

Use MCP against either a live Dev GraphQL endpoint or an exported `snapshot.json`.

Minimal client config:

```json
{
  "mcpServers": {
    "runner-dev": {
      "command": "npx",
      "args": ["@bluelibs/runner-dev", "mcp"],
      "env": {
        "ENDPOINT": "http://localhost:1337/graphql",
        "ALLOW_MUTATIONS": "false"
      }
    }
  }
}
```

Authenticated variant:

```json
{
  "mcpServers": {
    "runner-dev": {
      "command": "npx",
      "args": ["@bluelibs/runner-dev", "mcp"],
      "env": {
        "ENDPOINT": "http://localhost:1337/graphql",
        "HEADERS": "{\"Authorization\":\"Bearer <token>\"}",
        "ALLOW_MUTATIONS": "false"
      }
    }
  }
}
```

Direct launch:

```bash
ENDPOINT=http://localhost:1337/graphql npx -y @bluelibs/runner-dev mcp
SNAPSHOT_FILE=./runner-dev-catalog/snapshot.json npx -y @bluelibs/runner-dev mcp
```

Tools (names use underscores):

- `graphql_ping` — check the configured endpoint or snapshot
- `project_overview` — Markdown topology and recent-telemetry summary
- `graphql_query` — read-only queries
- `graphql_schema_sdl` — schema as SDL (compact); `graphql_introspect` — schema as introspection JSON
- `graphql_mutation` — mutations, only with `ALLOW_MUTATIONS=true` against a live endpoint; code-executing mutations also need the server's code-execution gate open

Resources: `graphql://schema` (introspection JSON) and `graphql://schema.sdl`.

First checks, in order:

1. `graphql_ping`
2. `project_overview`
3. `graphql_query`

Shell equivalents:

```bash
ENDPOINT=http://localhost:1337/graphql npx @bluelibs/runner-dev ping
ENDPOINT=http://localhost:1337/graphql npx @bluelibs/runner-dev overview --details 5
ENDPOINT=http://localhost:1337/graphql npx @bluelibs/runner-dev query 'query { tasks { id } resources { id } }' --format pretty
```

Notes:

- Keep `ALLOW_MUTATIONS=false` unless you intentionally need write access.
- Set `HEADERS` if the GraphQL endpoint requires auth. For `RUNNER_DEV_HTTP_PASSWORD`, use `{"Authorization":"Basic <base64 of runner:password>"}` in the client environment, outside committed configuration. Missing or wrong credentials return `401`.
- `SNAPSHOT_FILE` enables read-only MCP over an exported catalog without starting the app.
- If `graphql_ping` fails, check that the app is running, the port is correct, and `HEADERS` is valid JSON. A `403` mentioning DNS rebinding means the endpoint's host is a DNS name the server does not accept: use `localhost` or an IP address, or add the name to `allowedHosts`.

## First Things To Inspect

If the app is running:

- Start from `/docs/data` when the question is about what the docs UI or AI sees.
- Use `project_overview` for a fast topology summary.
- Use GraphQL for focused reads, not giant dumps.
- Use live telemetry only with narrow limits such as `last: 10`. Without a cursor, `last: N` is the most recent N; with `afterSequence`/`afterTimestamp` it is the oldest N after the cursor. Page with `afterSequence: <last seen sequence>`, which never skips a retained entry; entries evicted past `maxEntries` per category before you read them are skipped silently.

Minimal topology query:

```graphql
query FirstLook {
  tasks {
    id
  }
  resources {
    id
  }
  hooks {
    id
  }
  diagnostics {
    severity
    code
    message
  }
}
```

Minimal live query:

```graphql
query LiveFirstLook {
  live {
    logs(last: 10) {
      sequence
      level
      message
      correlationId
    }
    errors(last: 10) {
      sequence
      sourceKind
      message
      correlationId
    }
  }
}
```

Boundary-surface query:

```graphql
query BoundarySurface {
  boundary(ownerId: "app.billing") {
    ownerId
    exportsDeclared
    declaredExports
    effectiveExports
    privateDefinitions
  }
}
```

## High-Value Source Files

When working inside `@bluelibs/runner-dev`, start here:

- `src/resources/routeHandlers/getDocsData.ts` for docs payloads and bundled context
- `src/resources/models/Introspector.ts` and related store initialization for topology; `src/resources/models/middlewareUsages.ts` for middleware subtree provenance
- `src/mcp/tools/*` and `src/mcp/projectOverview.ts` for MCP tools
- `src/resources/live.resource.ts`, `src/resources/live/*` (sequence clock, cursor queries) and telemetry resources for live data; `src/resources/routeHandlers/createLiveStreamHandler.ts` for SSE
- `src/schema/codeExecutionGate.ts` for the code-execution gate and `src/resources/routeHandlers/hostGuard.ts` for the Host check and loopback detection
- `src/ui/src/components/Documentation/*` for docs/chat UI behavior
- `src/ui/src/components/Documentation/components/TopologyPanel.tsx` and `src/ui/src/components/Documentation/utils/topologyGraph.ts` for topology graph projections and rendering
- `src/resources/swap.resource.ts` and `src/resources/swap.tools.ts` for hot-swapping surfaces; `shell.timeout.ts`, `shell.console.ts` and `typescript.runtime.ts` next to them for run limits, console capture and the lazy `typescript` load

## Core Surfaces

- Docs UI: the browser surface for architecture, live data, and AI assistance
- Topology graph: a focused lens for blast-radius analysis and resource mindmaps
- `/docs/data`: the JSON payload feeding docs UI and in-app AI context
- GraphQL: the main runtime introspection surface
- Resource boundaries: GraphQL queries for declared exports, effective exports, and private definitions
- MCP: the fastest AI-native access path when the app is already running
- Live telemetry: logs, emissions, errors, runs, and correlation-driven inspection. The Live UI also shows server-host CPU, cores, RAM, platform and Node.js version from `live.systemInfo`, above process health metrics; host RAM is not the process memory limit in containers.
- Live telemetry cursors: every entry has a store-wide, strictly increasing `sequence`; `afterSequence` (live lists, `Task.runs`, `Hook.runs`) pages without gaps over the retained entries. `/live/stream` keeps a sequence cursor per category, delivers same-millisecond bursts in full, replays the store on connect, pauses while the socket is backpressured, and ends its streams on server shutdown. Retention caps all of it: each category keeps its latest `maxEntries`, and an entry evicted before it is read is skipped with no gap signal
- Middleware provenance: `TaskMiddlewareUsage`, `ResourceMiddlewareUsage` and the middleware-side usage types expose `origin` (`local`/`subtree`) and `subtreeOwnerId` (identity gates from subtree `tasks.identity` count as subtree-applied; a stack Runner rejects is reported as the target's own middleware, all local); the task and resource cards show a `Subtree Policy` badge and a `Source:` link
- Middleware `emits`: in GraphQL, the events emitted by the wrapped nodes (tasks/hooks for task middleware, the wrapped resources' own emits for resource middleware, never their consumers'); in the topology lenses, an `emits` edge is an event the middleware emits itself
- Swap tooling: controlled runtime task replacement and restoration
- Runtime shell: per-resource (`r` is the live value) and global (`runtime` access) REPL via UI and the `shell` mutation; `shellComplete` powers as-you-type completion and `shellEnabled` reports whether the shell can run
- Code-execution gate: `eval`, `shell`, `shellComplete`, `swapTask`, `editFile` and `evalInput: true` run only with `RUNNER_DEV_EVAL=1` or `NODE_ENV=development`/`test` (closed when `NODE_ENV` is unset); `query { codeExecutionEnabled }` reports it, and the docs source viewer stays read-only with an enable hint when it is closed. `eval`/`shell` share `RUNNER_DEV_SHELL_TIMEOUT_MS` (default 30000) and a 256 KB result cap
- `typescript` is an optional peer declared as `*`, so npm installs runner-dev next to any TypeScript version, prereleases included, without ERESOLVE or replacing the project's compiler: loading runner-dev never needs it, but `swapTask`, `eval` and `shell` need TypeScript 5 or 6 and return an install hint without it (or an incompatibility error with TypeScript 7)
- Docs UX: `⌘K` command palette (fuzzy element/section/action search), `?` shortcuts overlay, `g`-section jumps, `/` sidebar filter focus, `Esc` back navigation
- Docs on phones (≤768px): the sidebar is an off-canvas drawer behind a top bar (menu + search), closed by navigation or `Esc`; tables stack into per-element cards below 560px; the topology canvas uses compact insets and can fit down to 0.25 zoom on narrow canvases
- Docs tables: the ID search autofocuses only after pointer navigation or a fresh load (keyboard navigation keeps shortcuts live); ID/Title filters are fuzzy (substring, or a tight subsequence for tokens of 3+ chars); sort buttons share one Tab stop with Arrow/Home/End between columns; the detail pager follows the table's sort and filters and hides only when the list is empty or holds just the shown element (an element outside the list pages to its edges)
- Blast lens: Affected = Direct + Transitive downstream; contract partners (emitters, throwers, providers) are listed separately; counts include nodes hidden by filters (shown as "Hidden by filters"); a tag's blast includes every element carrying it

## Current Compatibility Notes

Assume current Runner reality, not old examples:

- Identity moved from `asyncContexts.tenant` to `asyncContexts.identity`; related middleware uses `identityScope`.
- Hook targets may come from selectors such as `subtreeOf(...)` or predicates, not only raw `hook.on`.
- Event Lane routing comes from `r.eventLane(...).applyTo([...])`, not old lane-tag assumptions.
- Runner supports `run(app, { signal })`, `run(app, { identity })`, and `runtime.dispose({ force: true })`.

## AI Working Strategy

- Use the Runner skill for framework design or core Runner contracts.
- Use runner-dev context for tooling behavior, docs payloads, MCP, GraphQL, telemetry, and UI integration.
- Prefer focused tests first: `npm run test -- docs.data`, `npm run test -- mcp`, `npm run test -- live`, or another narrow suite near the touched surface.
- CI runs lint, typecheck, build, Jest with coverage thresholds (a ratchet, currently 57/44/54/58 for statements/branches/functions/lines) and `npm run check:runtime-deps` on Node 22 and 24. Do not lower the thresholds or exclude source files to pass.
- Use `pure: true` when validating swapped task behavior safely.
- Avoid huge live queries, broad schema dumps, or mutation access unless the task truly needs them.

## Go Deeper

- Read `README.md` for installation, CLI, and broader examples.
- Read the Runner skill for framework-level architecture and contracts.
- Read source near the touched surface before broadening to unrelated subsystems.

## Scaffold dependency checks

New projects target Runner 6.6 and Vitest 4.1.11+ and require Node.js 22.12+ or 24+ (runner-dev itself needs Node.js 22+). Their `npm run dev` (`tsx watch`) does not set `NODE_ENV`, so the docs UI shell, file editing, `swapTask` and `eval` stay off there until the app is started with `RUNNER_DEV_EVAL=1` or `NODE_ENV=development`. Run `npm run audit` in generated projects to check production and development dependencies. Before a release, run `npm run build`, `npm run audit`, and `npm run audit:scaffold`; the latter verifies a fresh project against the packed local release, including its build and tests. The repository audit covers backend dependencies and frontend tooling. Do not suppress audit findings or use `--omit=dev` for this check. `npm run check:runtime-deps` (run by CI after the build and by `npm pack` after a clean build) fails when `dist` requires a package that is not a dependency or peer, or when loading the package entry pulls in an optional peer such as `typescript`.

Runner 6.6 durable apps must register `resources.durable` (also exported as `durableSupportResource`) from `@bluelibs/runner/node` alongside the durable runtime; the workflow tag alone does not register the required runtime tags, events, and lifecycle hook.
