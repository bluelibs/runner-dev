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

Expected endpoints after the app starts:

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

## Security Defaults

- The server listens on `127.0.0.1` unless `host` is set. On every bind, requests whose `Host` header is a DNS name other than `localhost`, the configured `host` or an `allowedHosts` entry get `403` (DNS-rebinding guard); IP addresses always pass, while hosts-file aliases and `*.localhost` names are refused unless listed.
- To reach it from Docker, a remote box or a LAN, set `dev.with({ host: "0.0.0.0" })` (or `resources.server.with({ host })`), plus `allowedHosts: ["devbox.lan"]` for access by DNS name. There is no auth, and the server logs a startup warning when the bound address is not loopback and code execution is also enabled.
- The served docs UI calls the API on the origin it was loaded from, so LAN names and remapped Docker ports work; the `API_URL` env var overrides it.
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
- Set `HEADERS` if the GraphQL endpoint requires auth.
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
- Live telemetry: logs, emissions, errors, runs, and correlation-driven inspection
- Live telemetry cursors: every entry has a store-wide, strictly increasing `sequence`; `afterSequence` (live lists, `Task.runs`, `Hook.runs`) pages without gaps over the retained entries. `/live/stream` keeps a sequence cursor per category, delivers same-millisecond bursts in full, replays the store on connect, pauses while the socket is backpressured, and ends its streams on server shutdown. Retention caps all of it: each category keeps its latest `maxEntries`, and an entry evicted before it is read is skipped with no gap signal
- Middleware provenance: `TaskMiddlewareUsage`, `ResourceMiddlewareUsage` and the middleware-side usage types expose `origin` (`local`/`subtree`) and `subtreeOwnerId` (identity gates from subtree `tasks.identity` count as subtree-applied; a stack Runner rejects is reported as the target's own middleware, all local); the task and resource cards show a `Subtree Policy` badge and a `Source:` link
- Middleware `emits`: in GraphQL, the events emitted by the wrapped nodes (tasks/hooks for task middleware, the wrapped resources' own emits for resource middleware, never their consumers'); in the topology lenses, an `emits` edge is an event the middleware emits itself
- Swap tooling: controlled runtime task replacement and restoration
- Runtime shell: per-resource (`r` is the live value) and global (`runtime` access) REPL via UI and the `shell` mutation; `shellComplete` powers as-you-type completion and `shellEnabled` reports whether the shell can run
- Code-execution gate: `eval`, `shell`, `shellComplete`, `swapTask`, `editFile` and `evalInput: true` run only with `RUNNER_DEV_EVAL=1` or `NODE_ENV=development`/`test` (closed when `NODE_ENV` is unset); `query { codeExecutionEnabled }` reports it, and the docs source viewer stays read-only with an enable hint when it is closed. `eval`/`shell` share `RUNNER_DEV_SHELL_TIMEOUT_MS` (default 30000) and a 256 KB result cap
- `typescript` is an optional peer (`>=5.0.0`, so npm installs next to TypeScript 5 or newer, including 7; a project on TypeScript 4.x gets ERESOLVE unless it upgrades or installs with `--legacy-peer-deps`): loading runner-dev never needs it, but `swapTask`, `eval` and `shell` need TypeScript 5 or 6 and return an install hint without it (or an incompatibility error with TypeScript 7)
- Docs UX: `⌘K` command palette (fuzzy element/section/action search), `?` shortcuts overlay, `g`-section jumps, `/` sidebar filter focus, `Esc` back navigation
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
- CI runs lint, typecheck, build, Jest with coverage thresholds (a ratchet, currently 52/40/50/54 for statements/branches/functions/lines) and `npm run check:runtime-deps` on Node 22 and 24. Do not lower the thresholds or exclude source files to pass.
- Use `pure: true` when validating swapped task behavior safely.
- Avoid huge live queries, broad schema dumps, or mutation access unless the task truly needs them.

## Go Deeper

- Read `README.md` for installation, CLI, and broader examples.
- Read the Runner skill for framework-level architecture and contracts.
- Read source near the touched surface before broadening to unrelated subsystems.

## Scaffold dependency checks

New projects target Runner 6.6 and Vitest 4.1.11+ and require Node.js 22.12+ or 24+ (runner-dev itself needs Node.js 22+). Their `npm run dev` (`tsx watch`) does not set `NODE_ENV`, so the docs UI shell, file editing, `swapTask` and `eval` stay off there until the app is started with `RUNNER_DEV_EVAL=1` or `NODE_ENV=development`. Run `npm run audit` in generated projects to check production and development dependencies. Before a release, run `npm run build`, `npm run audit`, and `npm run audit:scaffold`; the latter verifies a fresh project against the packed local release, including its build and tests. The repository audit covers backend dependencies and frontend tooling. Do not suppress audit findings or use `--omit=dev` for this check. `npm run check:runtime-deps` (run by CI after the build and by `npm pack` after a clean build) fails when `dist` requires a package that is not a dependency or peer, or when loading the package entry pulls in an optional peer such as `typescript`.

Runner 6.6 durable apps must register `resources.durable` (also exported as `durableSupportResource`) from `@bluelibs/runner/node` alongside the durable runtime; the workflow tag alone does not register the required runtime tags, events, and lifecycle hook.
