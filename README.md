# @bluelibs/runner-dev

[![npm version](https://img.shields.io/npm/v/@bluelibs/runner-dev.svg)](https://www.npmjs.com/package/@bluelibs/runner-dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> DevTools for [@bluelibs/runner](https://runner.bluelibs.com) — introspection, live telemetry, hot-swapping, and a GraphQL API for your running app.

## Welcome

Runner Dev Tools provide introspection, live telemetry, and a GraphQL API to explore and query your running Runner app.

The way it works, is that this is a resource that opens a graphql server which opens your application to introspection.

If your runner primitives expose `toJSONSchema()` (for example matcher-based normalized schemas), runner-dev uses that as first-class schema export. `zod` schemas are also supported and converted to JSON Schema.

## Large graph performance

Docs keep every registered task, resource and other element; `maxEntries` caps retained live telemetry only. Embedded Runner definitions in config, context, tag and middleware display values are shown as `{ "$runner": "resource", "id": "..." }` references instead of expanding their dependency graphs. Configured references retain their settings. Display previews allow 10,000 values, 40 nested levels and 128,000 total string characters; larger previews include `[Truncated]` markers. These display limits do not change runtime configuration or cap the graph.

Live `/docs/data` and exported catalogs carry compact tag relations; the bundled UI reconstructs them from the full element lists. Older exports still load. GraphQL tag queries retain their existing relation shape.

The live docs response is prepared once for simultaneous requests and reused for five seconds for the current namespace. Hot swaps and coverage changes can take up to five seconds to appear; failed builds are retried. Eligible HTTP responses, including GraphQL and Durable API JSON, negotiate compression by default (1 KiB threshold, fast gzip/deflate and Brotli). SSE stays uncompressed for immediate delivery. Docs JSON and UI JavaScript/CSS reuse prepared gzip when accepted and `Cache-Control: private, no-cache` with ETags. Authentication still runs before every request, including revalidation. Reverse proxies should forward `Accept-Encoding` and `If-None-Match`, and preserve `Content-Encoding`, `Vary`, `ETag` and `Cache-Control`; a proxy that forces `no-store` or strips these headers bypasses the transport benefits.

See [the repeatable large-graph simulation](readmes/DOCS_PERFORMANCE.md) for measured payload sizes and methodology.

## Install

```bash
npm install -g @bluelibs/runner-dev
# or
npx @bluelibs/runner-dev
```

Requirements: Node.js 22.15+ (`engines: ">=22.15.0"`, required by the patched GraphQL dependencies) and `@bluelibs/runner` ^6.6.0 as a peer dependency. `typescript` is an optional peer declared as `*`, so npm installs runner-dev next to any TypeScript version, including prereleases such as `typescript@next`, and never replaces yours; only `swapTask`, `eval` and `shell` need it, and they need TypeScript 5 or 6 (see [Hot-Swapping](#hot-swapping-debugging-system)).

For local `AGENTS.md`-style workflows, this repo now extracts Runner skills from `@bluelibs/runner` into `.agents/skills` via `npm-skills` on `postinstall`.
Runner-Dev also publishes its own skill from `skills/core`. Treat `README.md`, `skills/core/SKILL.md`, `skills/core/references/README.md` and `skills/core/references/readmes/COMPACT_GUIDE.md` as one documentation unit and keep them aligned (together with `readmes/API_REFERENCE.md`). `skills/core/references/README.md` and `skills/core/references/readmes/` are symlinks to this `README.md` and to `readmes/`, so edit the originals and leave the links in place; `npm pack` copies both in for the published package, since npm drops symlinks, and puts the links back afterwards. If a pack fails or is interrupted in between, the next `npm run build` restores them (or run `npm run skills:pack:restore`); a copy that no longer matches its original is left in place with an error, so move any edits made to it into the original first. The docs UI now includes a topology view for browsing element relationships and tracing downstream impact. Release notes live in [CHANGELOG.md](https://github.com/bluelibs/runner-dev/blob/main/CHANGELOG.md).

```ts
import { r } from "@bluelibs/runner";
import { dev } from "@bluelibs/runner-dev";

const app = r
  .resource("app")
  .register([
    // your resources,
    dev, // if you are fine with defaults or
    dev.with({
      port: 1337, // default,
      host: "127.0.0.1", // default: this machine only; see "Network and code-execution defaults"
      allowedHosts: [], // extra DNS names requests may use besides localhost and IP addresses (exact hostnames, no port or wildcard)
      maxEntries: 10000, // default: entries kept per live category (a positive integer)
    }),
  ])
  .build();
```

## What you get

- Fully-featured UI with AI assistance to explore your app, call tasks, emit events, diagnostics, logs and more.
- Runtime shell (REPL) in the UI and via the `shell` GraphQL mutation: per-resource shells bind `r` to the live resource value, plus a global shell with full `runtime` access.
- Static catalog export via `exportDocs(app, { output?, overwrite? })` for a standalone frozen docs site under `./runner-dev-catalog` by default.
- Overview tables across UI sections now include sortable and searchable columns (`ID`, `Title`, `Description`, `Used By`) with per-element usage counters, keyboard-reachable sorting, and a detail pager that follows the table's order (see [Docs UI tables and blast radius](#docs-ui-tables-and-blast-radius)).
- Overview tables mark private elements with a tag under the title (visibility derived from Runner resource `isolate()` boundaries).
- Task and resource cards show where each middleware comes from: middleware applied by an owner's `subtree(...)` policy gets a `Subtree Policy` badge and a `Source:` link to the owning resource.
- Introspector: programmatic API to inspect tasks, hooks, resources, events, middleware, and diagnostics (including file paths, contents)
- Task introspection includes runtime `interceptorCount` / `hasInterceptors` (registered via `taskDependency.intercept(...)` in resource init).
- Resource introspection includes `isolation` (`deny`, `only`, `exports`, `exportsMode`) from `.isolate(...)`.
- GraphQL exposes effective resource boundary surfaces, including declared exports, definitions reachable through exported resources, and private definitions.
- Resource introspection includes `subtree` governance summaries (middleware attachment counts and validator counts per branch).
- Resource introspection indicates whether a resource exposes a `cooldown()` hook for shutdown lifecycle.
- Isolation wildcard rules are clickable in the docs UI and open a modal showing matched resources with inline filtering when lists are large.
- Event introspection includes `transactional`, `parallel`, optional `eventLane { laneId }`, and optional `rpcLane { laneId }`.
- Task introspection includes optional `rpcLane { laneId }`.
- Tag pages distinguish between directly tagged elements and tag handlers (elements that depend on the tag id).
- Live: in-memory logs, event emissions, errors and task/hook runs, with a `sequence` cursor that pages and streams the retained entries without gaps
- Live File Previews and Saving (saving needs the [code-execution gate](#code-execution-gate) open).
- GraphQL server: deep graph navigation over your app’s topology and live data
- CLI with scaffolding, query-ing capabilities on a live endpoint or via dry-run mode.
- MCP server: allow your AI to do introspection for you.
- Safe defaults: the server listens on `127.0.0.1`, a Host header check guards every bind against DNS rebinding, and code execution (`eval`, `shell`, `swapTask`, `evalInput`, `editFile`) stays off unless you opt in.

## Runner 6.0 Migration Notes

| Before                | After (hard switch)                                                                          |
| --------------------- | -------------------------------------------------------------------------------------------- |
| `Resource.exports`    | `Resource.isolation { deny, only, exports, exportsMode }`                                    |
| `Middleware.global`   | `Middleware.autoApply { enabled, scope, hasPredicate }`                                      |
| `Tag.middlewares`     | `Tag.taskMiddlewares` + `Tag.resourceMiddlewares`                                            |
| N/A                   | `Tag.errors`, `Tag.targets`                                                                  |
| `RunOptions.initMode` | `RunOptions.lifecycleMode` + `dispose.{ totalBudgetMs, drainingBudgetMs, cooldownWindowMs }` |
| N/A                   | `Resource.subtree`, `Resource.cooldown`                                                      |
| N/A                   | `Event.transactional`, `Event.parallel`, `Event.eventLane`, `Event.rpcLane`, `Task.rpcLane`  |
| `Resource.tunnelInfo` | Removed (hard switch to lane surfaces)                                                       |

## Runner 6.1 Migration Notes

- Temporal middleware now supports per-key partitioning through `keyBuilder(taskId, input)` on `rateLimit`, `debounce`, and `throttle`.
- Resource ownership is now fully structural for user resources:
  - normal resources can be registered directly at the root and passed to `run(...)`
  - canonical runtime IDs now retain each user resource segment
  - `runtime-framework-root` is reserved for internal Runner use
- `resource.subtree(...)` can now compose multiple policies with an array, and runner-dev merges them into one summarized introspection view.
- `gateway: true` has been removed from user resources. Update any string-based task/resource references that previously relied on transparent user resources.
- Advanced Node integrations should use the internal RPC lanes resource id `runner.node.rpcLanes`.

## Runner 6.2 Migration Notes

- Built-in async contexts in 6.2 use `asyncContexts.tenant`; in Runner 6.3 they were renamed to `asyncContexts.identity`.
- Built-in task middleware such as `cache`, `concurrency`, and `rateLimit` can partition internal state via `tenantScope` in 6.2, and via `identityScope` from 6.3 onward.
- Lazy resource initialization now fails fast once shutdown begins; runner-dev will surface the new typed shutdown errors through normal error introspection.
- Subtree middleware conflicts now fail fast inside Runner instead of remaining a post-compose diagnostic concern.
- The internal framework root is now described as the synthetic framework root, with clearer internal `runner` and `system` namespace resources.

## Runner 6.3 Migration Notes

- Built-in identity moved from `asyncContexts.tenant` to `asyncContexts.identity`, and identity-aware middleware now uses `identityScope`.
- Hook introspection now resolves selector-based targets such as `subtreeOf(...)` and predicates through Runner's store API instead of relying on raw `hook.on` shapes.
- Event Lane routing now comes from `r.eventLane(...).applyTo([...])` instead of `tags.eventLane`, and Event Lane topology profiles use `consume: [{ lane, hooks?: { only } }]`.
- Runner now supports `run(app, { signal })`, `run(app, { identity })`, and `runtime.dispose({ force: true })`; runner-dev remains compatible with those lifecycle additions while avoiding deprecated lane-tag assumptions.

## Runner 6.6 & 6.10 Compatibility

Register `resources.durable` (also exported as `durableSupportResource`) from `@bluelibs/runner/node` alongside durable runtime resources. It registers the durable runtime/workflow tags, events, and lifecycle hook; registering only `durableWorkflowTag` is insufficient.

Upgrading runner-dev past 6.6.0? Read the "Breaking changes" in [CHANGELOG.md](https://github.com/bluelibs/runner-dev/blob/main/CHANGELOG.md) first: code execution (`eval`, `shell`, `swapTask`, `evalInput`, `editFile`) is now off unless `RUNNER_DEV_EVAL=1` or `NODE_ENV=development`/`test`, the server listens on `127.0.0.1` by default (set `host: "0.0.0.0"` for Docker or remote access), and requests whose `Host` header is a DNS name other than `localhost` or an `allowedHosts` entry get `403`.

Runner 6.10 adds built-in SQLite (`SqliteStore` / `resources.sqliteWorkflow`) and PostgreSQL (`PostgresStore` / `resources.postgresWorkflow`) durable backends, explicit workflow `version` registration under a shared workflow `key`, tracked workflow `commands` (`durable.command(...)`), ordered execution history (`listExecutionHistory`), checkpoint branching (`operator.reset(...)`) and replay fixture exports (`operator.exportReplay(...)`), two-stage completion/receipt `retention`, `tags.durableEvent` bridge metadata, and `timers: { pollIntervalMs }` configuration. Runner-Dev keeps `@bluelibs/runner` `^6.6.0` as its peer range and detects 6.10 store/operator capabilities dynamically, while `runner-dev new` scaffolds new projects targeting `@bluelibs/runner` `^6.10.0`.

## Table of Contents

- [Quickstart Guide](#quickstart)
- [Network and Code-Execution Defaults](#network-and-code-execution-defaults)
- [Model Context Protocol (MCP) Server](#cli-usage-mcp-server)
- [CLI Tooling & Scaffolding](#cli-usage-direct)
- [Live Telemetry & Correlation](#live-telemetry)
- [Hot-Swapping Debugging System](#hot-swapping-debugging-system)
- [GraphQL API Examples](#graphql-api-examples)
- [API Reference](readmes/API_REFERENCE.md)
- [Changelog](https://github.com/bluelibs/runner-dev/blob/main/CHANGELOG.md)
- [Contributing & Local Dev](https://github.com/bluelibs/runner-dev/blob/main/CONTRIBUTING.md)

## Durable Workflow Dashboard

Open **Durable → Workflow catalog** to see the selected runtime’s registered workflow versions and durable event routes, including definitions with no executions. Select a workflow to open its executions across versions in the current runtime. Empty results include a reminder to check the top-right runtime selector. Search by title, key or description. Each row shows the description from the task or event metadata. Bridge-selected events appear here automatically and run when the application emits them.

In **Durable → Schedules**, choose the owning runtime in the top-right selector. The application creates schedules. Studio lists recurring cron and interval schedules and supports editing, pausing, resuming and deleting them. Select a recurring schedule ID to see its retained runs. Cron rows show the expression and configured time zone. Open a run to inspect its execution, or browse older history using the runtime cursor. The list uses the schedule-specific timer identity so two crons for the same workflow have separate histories.

The docs sidebar shows **Durable** only when the backend reports an available application durable runtime in `/docs/data` (`hasDurable`). It opens `/durable` on the same Runner Dev server for a separate Durable Workflows dashboard. It attaches to the application's existing durable runtimes and uses the same Host checks and optional `RUNNER_DEV_HTTP_PASSWORD` authentication as `/docs`. It does not start another runtime or configure a backend.

Select a runtime (identified with its backend badge such as `SQLITE`, `POSTGRES`, `REDIS`, `FILE MEMORY`, `MEMORY`, or `CUSTOM`) to browse its workflows, version variants, cursor-paginated execution history, ordered timeline, current waits, persisted steps, signals, audit, retention metadata, and schedules. Lists contain bounded summaries; full input/result/error payloads are read when opening execution details. Switching executions keeps the previous detail and active tab visible while the selected run loads; detail controls stay disabled until its data arrives. The dashboard also exposes version-targeted execution starts, tracked `Send command` submission (`POST /durable/api/executions/:id/commands`), signal, cancel, retry, pause/resume/restart, `Reset to checkpoint` / inline `Reset before` branching (`POST /durable/api/executions/:id/reset`), portable replay fixture downloads (`GET /durable/api/executions/:id/replay`), recovery, schedule management, and operator repair actions. Retry is available for failed or compensation-failed runs and resumes from memoized progress; recovery applies to the selected runtime's backend. Operators have the same full-access trust boundary as the other DevTools endpoints.

Views, selected executions, workflow/status filters, and exact-ID searches are reflected in the URL and support browser Back/Forward. Read failures keep the last successful data visible with a local retry and freshness indicator. Multiple failed feeds share a collapsed summary that expands to show each error and its Retry action; authentication failures require signing in again. Durable API GET reads time out after 30 seconds and can be retried; writes have no client deadline because cancellation cannot prove they were not applied. A failed cadence preview can be retried with the current draft. Schedule drafts stay open on failed saves, deletion requires confirmation, and execution actions are disabled while an operation is pending. Dialogs contain keyboard focus and restore it on close. Overview metrics describe loaded history; success rates show no value until a run finishes. On narrow screens, workflow navigation collapses behind **Browse workflows** and schedule rows stack their details above their actions.

Runner 6.6 supports the core views and operations; Runner 6.10 runtimes unlock ordered history (`command`, `state`, `continue`, nested child steps), multi-version workflows sharing one key, tracked commands, checkpoint branching with `Branched from` lineage, replay exports, and two-stage retention visibility (blocking uncollectable resets and restarts once history is collected while preserving receipts and results). Execution pause/resume/restart, workflow state, command, reset, and replay controls are shown only when the runtime advertises support for them. Durable audit must already be enabled by the application; an empty audit view does not imply no activity. Repair and checkpoint-reset reasons are logged by DevTools; `resetReason` is also retained on the branched execution record.

The timeline shows observed persisted history and the current activity, rather than guessing future branches. The signal dialog uses declared signal metadata or the event ID of the execution's current wait. Optional `tags.durableWorkflow.with({ metadata: { studio: { presets: [{ name, payload }] } } })` supplies named JSON inputs to the start dialog, including per-version presets. Runtime selection scopes requests with `runtimeId`; the REST API is under `/durable/api` and is separate from GraphQL/MCP. Docs UI `TaskCard` and `EventCard` also surface durable workflow `Version` and `DURABLE` event bridge metadata (`key`, `compensation`). The dashboard is live-only and is not part of static catalog exports.

For a local example in this repository, run `npm run build:ui` followed by `npm run play:durable`, then open `http://localhost:31339/durable`. This starts a two-runtime application (`operations-sqlite` on in-memory SQLite + `finance-memory` on memory) with multi-version workflows, tracked commands, a checkpoint branch, a paused run, and a history-collected retention example.

## Quickstart

Register the Dev resources in your Runner root:

```ts
import { r } from "@bluelibs/runner";
import { dev } from "@bluelibs/runner-dev";

export const app = r
  .resource("app")
  .register([
    // You can omit .with() if you are fine with defaults.
    dev.with({
      port: 1337, // default
      maxEntries: 10000, // default: logs, emissions, errors and runs kept each
    }),
    // rest of your app.
  ])
  .build();
```

### Accessing the UI

Once your application is running with the `dev` resource, you can access the visual DevTools UI:

Open [http://localhost:1337/docs](http://localhost:1337/docs) in your browser. The server root (`/`) redirects to the GraphQL Voyager view at `/voyager`, and GraphQL itself is served at `/graphql`.

Inside the UI, you can:

- Explore the resource graph.
- Manually invoke tasks with custom inputs.
- Inspect live logs and event emissions in real-time.
- View source files, and edit them when the [code-execution gate](#code-execution-gate) is open (otherwise the viewer is read-only and shows how to enable editing).
- Open a runtime shell per resource (`Shell` button, `r` is the live resource value) or a global shell from the sidebar (``Ctrl+` ``) with full `runtime` access. The shell also needs the code-execution gate.
- Press `⌘K`/`Ctrl+K` for the command palette (fuzzy-jump to any element, section, or action) and `?` for the full keyboard shortcut map (`g` + key section jumps, `/` focuses the sidebar filter, `Esc` walks back).
- Use it from a phone or tablet: at 768px and below the sidebar becomes a slide-in menu behind a top bar (menu and search buttons), overview tables stack into one card per element, and topology relationship lists stack vertically.

### Network and code-execution defaults

runner-dev exposes introspection and, when enabled, code execution, so its defaults are conservative:

- **Loopback bind.** Without a `host`, the server listens on `127.0.0.1` only. URLs are still printed as `http://localhost:<port>`.
- **Host header check, on every bind.** Every route answers `403` unless the request's `Host` names `localhost`, an IP address (`127.0.0.1`, `[::1]`, `192.168.1.50`, ...), the configured `host`, or a name listed in `allowedHosts`; a missing Host header is refused too. This blocks DNS-rebinding attacks from web pages: a rebinding page always arrives with its own DNS name in the `Host` header, including when the server listens on `0.0.0.0` and a published Docker port is reachable on the developer's `127.0.0.1`. A hosts-file alias, a `*.localhost` name or a service such as `127.0.0.1.nip.io` is rejected unless you list it. The 403 body is GraphQL-shaped (`{ "errors": [{ "message": "Forbidden: ..." }] }`) and names the `allowedHosts` entry that would let the request through.
- **Exposing it on purpose.** For Docker port mapping, a remote dev box or a LAN, set an explicit host: `dev.with({ host: "0.0.0.0" })`, or `resources.server.with({ host: "0.0.0.0" })` when you register the resources yourself. Browsing by IP address or `localhost` works as is; to use a DNS name (a LAN name, a Docker Compose service name), list it: `dev.with({ host: "0.0.0.0", allowedHosts: ["devbox.lan"] })`. Entries are exact hostnames: `dev` and `resources.server` both reject a scheme, port or wildcard (`*.lan`, `.lan`) at `.with()`, so list each subdomain on its own. A Unicode name such as `bücher.lan` matches the punycode form browsers send. If the server ends up listening on a non-loopback address and the code-execution gate is also open, it logs a warning at startup that code execution is reachable from the network.
- **HTTP password.** Set `RUNNER_DEV_HTTP_PASSWORD` in the server's environment before startup to protect every route with HTTP Basic authentication: docs and assets, GraphQL, Voyager, the live stream, and HTTP-tagged tasks. Log in through the browser's built-in prompt with username `runner` and that password; the same-origin UI and live stream reuse the login. Production mode requires the password: a resolved Runner mode of `prod` (including `run(app, { mode: "prod" })`) or `NODE_ENV=production` fails startup when the variable is missing, before Apollo starts or an HTTP port is bound. An empty or whitespace-only value fails in every mode. Outside production, an unset variable leaves authentication disabled. The password is read once, kept outside resource configuration and never injected into the UI or exported catalog. Restart the server to rotate it. Use a long random password, and HTTPS through a reverse proxy or a secure tunnel for remote access: Basic authentication does not encrypt credentials. Preserve the browser-facing `Host` header at the proxy. Password-protected browser requests must use the same origin (including the port); cross-site requests are rejected before running tasks. Twenty failed credential attempts block the connecting IP for up to one minute with `429` and `Retry-After`; clients behind a proxy share that limit.
- **The docs UI follows the address you use.** The served UI calls the API on the origin it was loaded from, so `http://192.168.1.50:1337/docs`, a remapped Docker port (`-p 8080:1337`, then `http://localhost:8080/docs`) or a DNS name you listed in `allowedHosts` (such as `http://devbox.lan:1337/docs`) works without extra UI setup. An unlisted DNS name gets `403` from the Host header check before the UI loads. Set the `API_URL` environment variable on the server only when the API lives at another address.
- **Code execution is opt-in.** `eval`, `shell`, `shellComplete`, `swapTask`, `editFile` and `evalInput: true` on `invokeTask`/`invokeEvent` run only when the server starts with `RUNNER_DEV_EVAL=1`, or with `NODE_ENV` exactly `development` or `test`. An unset `NODE_ENV` keeps them off. Details: [Code-execution gate](#code-execution-gate).

Queries and plain-JSON `invokeTask`/`invokeEvent` are not gated by the code-execution setting. A password grants access to the full DevTools surface allowed by that setting; it does not make production read-only. Outside production, without a password, anyone who can reach the port can read the app's topology and registered source files and run its tasks with JSON input.

### Docs UI tables and blast radius

Overview tables are search-first, but they stay out of the way of keyboard shortcuts:

- The ID search is focused automatically only after pointer navigation or on a fresh page load. After keyboard navigation (`g` chains, picking from the palette with the keyboard, `Esc` back to a list) focus stays on the page, so the next shortcut still works. `Esc` in any field blurs it back to shortcut mode.
- ID and Title filters are fuzzy: case-insensitive, whitespace-separated tokens in any order. A token matches when it appears as a contiguous substring. Tokens of 3 or more characters may also match as a subsequence whose characters fall within a window of at most twice the token length (`crus` finds `createUser`); shorter tokens never fuzzy-match. Description and Used By filters are plain substring matches. The `⌘K` palette keeps its own, looser ranking.
- Sorting works from the keyboard: the four sort buttons share one Tab stop on the ID column, just before the ID search (Shift+Tab from the search reaches it). ArrowLeft/ArrowRight (wrapping), Home and End move between columns, and Enter/Space cycles ascending, descending, unsorted.
- The detail pager (previous/next) walks the rows in the table's current sort, search and middleware scope, and is hidden only when there is nowhere else to go: the list is empty, or its only row is the element shown. An element the list does not contain (filtered out, opened from the palette) pages to the list's first and last rows. Going list → detail → back keeps the sort and search; switching sections resets them.

Open **Topology** to browse by registration owner, or use **Jump to element** to search the catalog by ID, title or kind. Search results include the full element ID so workflows with the same title are distinguishable. Select an element to see its **Relationships**, grouped by direction, such as **Depends on**, **Used by** and **Handled by**. Follow a row to explore that element. In **Impact paths**, select a depth from one to four steps and choose **View path** to see how a result connects to the starting element. **Copy link** shares that path.

**Impact paths** answers “what changes if this element changes?”

- **Affected** = **Direct** (depth 1) + **Transitive** (deeper) downstream nodes.
- **Contract partners** (event emitters, error throwers, async-context providers) are counted and listed separately and are not part of Affected. They are recorded from the focus and not expanded, unless a real downstream edge also reaches them within the radius; then they count as affected at that depth and are expanded.
- Each group shows its full count and how many entries the sidebar or list filter hides. Opening a path shows every intermediate step.
- A tag's blast radius includes the elements that depend on the tag and every element carrying it (tasks, hooks, resources, events, task and resource middleware, errors), and follows them further downstream.
- A middleware's `emits` edges are the events the middleware emits itself through its own event dependencies. Events of the nodes it wraps show up one hop later, under those nodes. This differs on purpose from GraphQL `Middleware.emits` (see [the middleware example](#graphql-api-examples)).

### Static Catalog Export

If you want the visual docs without running the project server, you can export a standalone static catalog directly from a built Runner app.

The recommended setup is a tiny script plus an npm command.

Create `scripts/export-docs.ts`:

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

What gets written:

- `./runner-dev-catalog/index.html`
- `./runner-dev-catalog/snapshot.json`
- a standalone `index.html` with the docs payload, CSS, JS, and favicon embedded for direct opening

Output behavior:

- `exportDocs(app)` writes to `./runner-dev-catalog` by default
- the default `./runner-dev-catalog` destination is treated as a dedicated export folder and can be regenerated safely
- custom directories are protected by default; pass `overwrite: true` if you intentionally want to replace an existing non-empty directory
- `index.html` is standalone and can be opened directly over `file://`
- `snapshot.json` is still written as an auxiliary artifact for inspection, debugging, and snapshot-backed MCP, but the standalone HTML does not depend on it at runtime

What the exported catalog includes:

- overview
- topology
- tasks, resources, events, hooks, and middlewares
- tags, errors, async contexts, diagnostics, and markdown docs

What it intentionally does not include:

- live telemetry
- GraphQL server endpoints
- task or event execution
- swap or eval actions
- file-saving mutations

`exportDocs()` uses Runner's real dry-run path under the hood. In other words, it effectively does a `run(app, { dryRun: true })`, builds the in-memory docs snapshot from that composed Runner store, and emits a frozen catalog. It is not source-only static analysis, which is important both for accuracy and for understanding what code paths still participate during export.

This also works well as a CI artifact:

- generate the catalog during CI
- upload `./runner-dev-catalog` or `./artifacts/runner-dev-catalog` as a build artifact
- inspect the visual docs after the pipeline finishes without starting the app again

For local package work inside this repository, `npm run play:export` is the same idea wired to the reference commerce app used by `npm run play`:

```bash
npm run play:export
npm run play:export -- ./my-export-dir
```

Add it as an Model Context Protocol Server (for AIs) via normal socket:

```json
{
  "mcpServers": {
    "mcp-graphql": {
      "description": "MCP Server for Active Running Context App",
      "command": "npx",
      "args": ["@bluelibs/runner-dev", "mcp"],
      "env": {
        "ENDPOINT": "http://localhost:1337/graphql",
        "ALLOW_MUTATIONS": "true"
      }
    }
  }
}
```

Then start your app as usual. The Dev GraphQL server will be available at http://localhost:1337/graphql.

For a frozen exported catalog, you can point MCP at the generated snapshot instead of a live endpoint:

```json
{
  "mcpServers": {
    "mcp-graphql": {
      "description": "MCP Server for an exported Runner Dev snapshot",
      "command": "npx",
      "args": ["@bluelibs/runner-dev", "mcp"],
      "env": {
        "SNAPSHOT_FILE": "./runner-dev-catalog/snapshot.json"
      }
    }
  }
}
```

### CLI usage (MCP server)

After installing, you can start the MCP server from this package via stdio.

Using npx:

```bash
ENDPOINT=http://localhost:1337/graphql npx -y @bluelibs/runner-dev mcp
SNAPSHOT_FILE=./runner-dev-catalog/snapshot.json npx -y @bluelibs/runner-dev mcp
```

Optional environment variables:

- `SNAPSHOT_FILE=./runner-dev-catalog/snapshot.json` to serve MCP from an exported static snapshot instead of a live endpoint
- `ALLOW_MUTATIONS=true` to enable `graphql_mutation`
- `HEADERS='{"Authorization":"Bearer token"}'` to pass extra headers
- For a server protected by `RUNNER_DEV_HTTP_PASSWORD`, use `HEADERS='{"Authorization":"Basic <base64 of runner:password>"}'`. Keep this value in your client environment, outside committed configuration; a `401` means credentials are missing or incorrect.
- `GRAPHQL_ENDPOINT` is accepted as an alias for `ENDPOINT`

Available tools once connected:

- `graphql_query` — run read-only queries against the live endpoint or snapshot
- `graphql_mutation` — run mutations (requires `ALLOW_MUTATIONS=true`, live endpoint only). Code-executing mutations (`eval`, `shell`, `swapTask`, `editFile`, `evalInput`) still need the server's [code-execution gate](#code-execution-gate) open.
- `graphql_introspect` — fetch the schema as introspection JSON
- `graphql_schema_sdl` — fetch the schema as SDL (more compact than the introspection JSON)
- `graphql_ping` — source check for the configured endpoint or snapshot
- `project_overview` — dynamic Markdown overview aggregated from the configured source

The server also exposes the schema as MCP resources: `graphql://schema` (introspection JSON) and `graphql://schema.sdl` (SDL).

### CLI usage (direct)

This package also ships a CLI that can query the same GraphQL API or generate an overview directly from your terminal.

Prerequisites:

- Ensure your app registers the Dev GraphQL server (`dev.with({ port: 1337 })`) or otherwise expose a compatible endpoint.
- Alternatively, you can run queries in a new **dry‑run mode** with a TypeScript entry file (no server required).
- Build this package (or install it) so the binary is available.

Programmatic export is available even when you do not want a live server:

```ts
import { exportDocs } from "@bluelibs/runner-dev";

await exportDocs(app);
```

Help:

```bash
runner-dev --help
```

Create new project:

```bash
# Create a new Runner project
runner-dev new <project-name>

# Example
runner-dev new my-awesome-app
```

This command creates a new Runner project with:

- Complete TypeScript setup with `tsx watch` for development
- Runner 6.10 and Vitest 5.0.1+ for the generated runtime and smoke tests
- Node.js 22.15+ or 24+ (required by runner-dev's patched GraphQL dependencies)
- Package.json with all necessary dependencies
- Basic project structure with main.ts entry point
- README and .gitignore files

Run `npm run audit` in the generated project to check all dependencies, including development tools. Install-time audit reporting stays enabled.

The generated `npm run dev` (`tsx watch`) does not set `NODE_ENV`, so the docs UI shell, file editing, `swapTask` and `eval` stay off until you start it with `RUNNER_DEV_EVAL=1 npm run dev` or `NODE_ENV=development npm run dev` (see [Code-execution gate](#code-execution-gate)).

Repository development also requires Node.js 22.15+ or 24+ for schema generator tooling. Before releasing runner-dev, run `npm run qa`, `npm run audit`, and `npm run audit:scaffold`. The scaffold check installs the packed release into a fresh project, audits its full dependency tree, and runs its build and tests. The repository audit also covers the bundled frontend tooling. `npm run check:runtime-deps` (run by CI after the build, and by `npm pack` after a clean build) fails when `dist` requires a package that is not a dependency or peer, or when loading the package entry pulls in an optional peer such as `typescript`. A scoped Lodash override keeps the existing GraphQL codegen plugins on patched Lodash 4.18.1+ despite their older minor-version constraint.

The development dependency overrides also keep `shell-quote` on 1.12+ and the coverage configuration loader on `js-yaml` 4, removing its vulnerable `sprintf-js` chain. Until upstream `braces` publishes a depth fix, glob tooling uses the exact reviewed `@dieub/braces-depth-guard@3.0.3-pn.3` derivative. It rejects nesting above 100 levels, including direct AST traversal, and guards invalid limits and cyclic expansion parents; it does not bound expansion cardinality or AST width. Regression tests exercise those guards and ordinary glob/YAML behavior. Keep the exact pin and review a replacement before changing it. Repository overrides are not inherited by consumers; the scaffold audit checks their separate dependency tree.

Modern glob tooling (`glob` 9+ and `minimatch` 7+) uses patched `glob` 14.0.5+ and `minimatch` 11.0.8+; older consumers retain their existing APIs. TypeDoc alone uses the maintained `minimatch` 6.2.3+ line: it preserves the partial-match API TypeDoc requires and does not include the affected globparts optimizer. Jest's configuration merger uses the exact reviewed `@stackline/deepmerge@1.1.2` replacement to block prototype poisoning while preserving nested defaults and array concatenation. Review replacement artifacts before changing this pin. Runtime validation uses Zod 4.6.7+, with schema export support for both Zod 3 and 4. Apollo Server stays pinned to 5.5.1 because 5.5.2 restricts GraphQL utilities to vulnerable versions; 5.5.1 permits the patched dependency chain.

Flags for `new`:

- `--install`: install dependencies after scaffolding
- `--run-tests`: run the generated test suite (`npm run test`) after install
- `--run`: start the dev server (`npm run dev`) after install/tests; this keeps the process running

Examples:

```bash
# Create and auto-install dependencies, then run tests
runner-dev new my-awesome-app --install --run-tests

# Create and start the dev server immediately (blocks)
runner-dev new my-awesome-app --install --run
```

Scaffold artifacts (resource | task | event | tag | taskMiddleware | resourceMiddleware):

```bash
# General form
runner-dev new <kind> <name> [--ns app] [--dir src] [--export] [--dry]

# Examples
runner-dev new resource user-service --ns app --dir src --export
runner-dev new task create-user --ns app.users --dir src --export
runner-dev new event user-registered --ns app.users --dir src --export
runner-dev new tag http --ns app.web --dir src --export
runner-dev new task-middleware auth --ns app --dir src --export
runner-dev new resource-middleware soft-delete --ns app --dir src --export
```

Flags for artifact scaffolding:

- `--ns` / `--namespace`: namespace used for folders only, mapped to `<dir>/<ns>/<type>` (default: `app`)
- `--id <id>`: explicit local id override (for example: `save-user`)
- `--dir <dir>`: base directory under which files are created (default: `src`)
- `--export`: append a re-export to an `index.ts` in the target folder for better auto-import UX
- `--dry` / `--dry-run`: print the generated file without writing it

Conventions:

- Generated ids are local ids only and default to the kebab-cased artifact name
- Folders:
  - resources: `src/resources`
  - tasks: `src/tasks`
  - events: `src/events`
  - tags: `src/tags`
  - task middleware: `src/middleware/task`
  - resource middleware: `src/middleware/resource`
- The `--export` flag will add `export * from './<name>';` to the folder's `index.ts` (created if missing).

Tip: run `npx @bluelibs/runner-dev new help` to see the full usage and examples for artifact scaffolding.

Note: the `new` command requires the target directory to be empty. If the directory exists and is not empty, the command aborts with an error.

The project name must contain only letters, numbers, dashes, and underscores.

After creation, follow the next steps:

- `cd <project-name>`
- `npm install`
- `npm run dev`

Ping endpoint:

```bash
ENDPOINT=http://localhost:1337/graphql runner-dev ping
```

Run a query (two modes):

```bash
# Remote mode (HTTP endpoint)
ENDPOINT=http://localhost:1337/graphql runner-dev query 'query { tasks { id } }'

# With variables and pretty output
ENDPOINT=http://localhost:1337/graphql \
  runner-dev query \
  'query Q($ns: ID){ tasks(idIncludes: $ns) { id } }' \
  --variables '{"ns":"task."}' \
  --format pretty

# Add a namespace sugar to inject idIncludes/filter automatically
ENDPOINT=http://localhost:1337/graphql runner-dev query 'query { tasks { id } }' --namespace task.

# Dry‑run mode (no server) — uses a TS entry file
runner-dev query 'query { tasks { id } }' --entry-file ./src/main.ts
```

Dry‑run (no server) details:

```bash
# Using a TS entry file default export
runner-dev query 'query { tasks { id } }' \
  --entry-file ./src/main.ts

# Using a named export (e.g., exported as `app`)
runner-dev query 'query { tasks { id } }' \
  --entry-file ./src/main.ts --export app

# Notes
# - Dry‑run compiles your entry, builds the Runner Store in-memory, and executes the query against
#   an in-memory GraphQL schema. No HTTP server is started.
# - A .ts entry needs a TypeScript runtime in your project: tsx (tried first) or ts-node.
#   Without one, the command fails with install hints. A compiled .js entry works too.
# - Selection logic:
#   - If --entry-file is provided, dry‑run mode is used (no server).
#   - Otherwise, remote mode is used via --endpoint or ENDPOINT/GRAPHQL_ENDPOINT.
#   - If neither an endpoint nor an entry file is provided, the command errors.
```

Project overview (Markdown):

```bash
ENDPOINT=http://localhost:1337/graphql runner-dev overview --details 10 --include-live
```

Schema tools:

```bash
# SDL string
ENDPOINT=http://localhost:1337/graphql runner-dev schema sdl

# Introspection JSON
ENDPOINT=http://localhost:1337/graphql runner-dev schema json
```

Environment variables used by all commands:

- `ENDPOINT` (or `GRAPHQL_ENDPOINT`): GraphQL endpoint URL
- `HEADERS`: JSON for extra headers, e.g. `{"Authorization":"Bearer ..."}`

Flags:

- `--endpoint <url>`: override endpoint
- `--headers '<json>'`: override headers
- `--variables '<json>'`: JSON variables for query
- `--operation <name>`: operation name for documents with multiple operations
- `--format data|json|pretty`: output mode (default `data`)
- `--raw`: print full GraphQL envelope including errors
- `--namespace <str>`: convenience filter that injects `idIncludes` or `events(filter: { idIncludes })` at the top-level fields when possible
- `--entry-file <path>`: TypeScript entry file for dry‑run mode (no server)
- `--export <name>`: named export to use from the entry (default export preferred)

Precedence:

- If `--entry-file` is present, dry‑run mode is used.
- Otherwise, remote mode via `--endpoint`/`ENDPOINT` is used.

### CLI Summary

| Category        | Description                                               |
| --------------- | --------------------------------------------------------- |
| **New Project** | `runner-dev new <project-name>`                           |
| **Scaffolding** | `runner-dev new <resource\|task\|event\|tag\|middleware>` |
| **Queries**     | `runner-dev query 'query { ... }'`                        |
| **Overview**    | `runner-dev overview --details 10`                        |
| **Schema**      | `runner-dev schema sdl`                                   |

---

## GraphQL API Examples

For a full list of types and fields, see the [API Reference](readmes/API_REFERENCE.md).

### Explore tasks and dependencies deeply

- Explore tasks and dependencies deeply

```graphql
query {
  tasks {
    id
    filePath
    emits
    emitsResolved {
      id
    }
    dependsOn
    middleware
    middlewareResolved {
      id
    }
    dependsOnResolved {
      tasks {
        id
      }
      resources {
        id
      }
      emitters {
        id
      }
    }
  }
}
```

- Resource boundary surfaces

```graphql
query {
  boundary(ownerId: "app.billing") {
    ownerId
    exportsDeclared
    declaredExports
    effectiveExports
    privateDefinitions
  }
  boundaries(ownerIdIncludes: "app.billing") {
    ownerId
    effectiveExports
  }
  resource(id: "app.billing") {
    surface {
      ownerId
      privateDefinitions
    }
  }
}
```

- Diagnostics

```graphql
query {
  diagnostics {
    severity
    code
    message
    nodeId
    nodeKind
  }
}
```

- Traverse from middleware to dependents, then back to their middleware

```graphql
query {
  middlewares {
    id
    usedByTasksResolved {
      id
      middlewareResolved {
        id
      }
    }
    usedByResourcesResolved {
      id
    }
    emits {
      id
    }
  }
}
```

`Middleware.emits` lists the events emitted by the nodes the middleware wraps: tasks and hooks for task middleware, the wrapped resources' own `emits` for resource middleware. Tasks and hooks that only depend on a wrapped resource are not included. The topology view's middleware `emits` edges answer a different question (what the middleware emits itself), see [Docs UI tables and blast radius](#docs-ui-tables-and-blast-radius).

- Where does a task's or resource's middleware come from?

```graphql
query {
  tasks {
    id
    middlewareResolvedDetailed {
      id
      origin # "local" or "subtree"
      subtreeOwnerId # the resource whose subtree(...) policy applied it
    }
  }
  resources {
    id
    middlewareResolvedDetailed {
      id
      origin
      subtreeOwnerId
    }
  }
}
```

Every `identityChecker` gate a subtree `tasks.identity` requirement adds to a task is reported with `origin: "subtree"` and the owner that declared the requirement, even when another owner also lists `identityChecker` in its `tasks.middleware`. When Runner rejects a task's stack (a subtree middleware conflicting with a task-local one, which Runner reports only when the task runs), introspection lists the task's own middleware, all with `origin: "local"`.

Resource middleware carries the same provenance as task middleware. An owner's own `subtree({ resources: { middleware } })` also applies to the owner itself, so it shows up there with `origin: "subtree"` and the owner as `subtreeOwnerId`. `Middleware.usedByResourcesDetailed` / `ResourceMiddleware.usedByDetailed` expose the same two fields from the middleware side.

- Events and hooks

```graphql
query {
  events {
    id
    emittedBy
    emittedByResolved {
      id
    }
    listenedToBy
    listenedToByResolved {
      id
    }
  }
}
```

## Live Telemetry

The `live` resource records telemetry in memory, with optional persistence:

- Logs written through Runner's logger (`resources.logger`), including `critical` ones
- All event emissions (via an event manager interceptor)
- Errors and runs of tasks and hooks (via the telemetry interceptors that `dev` registers)

Each category keeps the latest `maxEntries` entries (default 10000, set through `dev.with({ maxEntries })`, which must be a positive integer). Older entries are evicted without notice, including entries a cursor or stream has not read yet: `afterSequence` then resumes at the oldest entry still kept. Readers that must see every entry have to stay within the last `maxEntries` entries of each category; raise `maxEntries` for high-volume apps.


### Log explorer and error tracker

Open **Logs** to search the full retained history. Every word in the search must match somewhere in the message, level, source, correlation ID, or structured data. Matches start with the latest 50. Choose **Show older matches** to extend the list or **Export matching logs** to download every match as JSON.

The error tracker keeps paired log data searchable and counts each matching exception once. Recording failures appear in the tracker and in `live.historyError`. The host continues running tasks, hooks and events when storage fails. ClickHouse checks for stale revisions before each write. Because this check and the insert are separate operations, configure one writer per live-history stream.

Telemetry and Logs show placeholders while loading results. Opening a correlated trace displays its dialog immediately.

Open the funnel icon in the log explorer toolbar and choose **Errors · grouped** or **Telemetry → Error tracker** to see the same issues. The tracker combines captured exceptions with error, critical and fatal logs. Repeated failures share a group when the source, exception type, message (with UUIDs normalized) and first stack frame match. A correlated logged copy with the same source, message and frame as a captured exception counts once. Counts and first/last seen reflect retained history. Inspect the latest 50 occurrences, their captured data, and the selected occurrence’s correlated logs or trace. **Copy agent prompt** includes the selected evidence and up to ten log messages. **Export issue JSON** includes every retained occurrence in the group and the selected trace (up to 200 entries per category).

**Export trace JSON** downloads the entries in the open correlation timeline. **Export telemetry JSON** downloads the full retained logs, errors, events and runs. Under **Telemetry → Performance**, **Export performance JSON** downloads the task and hook aggregates for the displayed window and scope.

[Log search](readmes/screenshots/telemetry/log-explorer-search.png) · [Log level filter](readmes/screenshots/telemetry/log-level-filter-menu.png) · [Grouped errors](readmes/screenshots/telemetry/telemetry-error-tracker.png) · [Issue details](readmes/screenshots/telemetry/telemetry-issue-details.png)

### Opt-in task and hook performance (APM)

Enable with `dev.with({ apm: true })` (also supported by `resources.live.with()`).
The **Telemetry** tab shows task and hook APM in separate views. The storage badge identifies the APM backend. **Live** shows process health, logs, events and runs.

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

See [the performance measurements](readmes/TELEMETRY_PERFORMANCE.md) for overhead,
methodology and a repeatable comparison script.

### Persistence across restarts

Enable SQLite through the `persistence` option:

```ts
import { dev, resources } from "@bluelibs/runner-dev";

const devTools = dev.with({
  maxEntries: 10_000,
  persistence: resources.sqlitePersistence.with({
    file: "./.runner-dev/telemetry.sqlite",
  }),
});
```

Register `devTools` in your app as usual. Like Runner's cache providers, `persistence` accepts a resource definition or its configured `.with(...)` entry. Runner-Dev automatically registers the provider and injects its initialized `LivePersistence` store. Provider dependencies, overrides and isolation participate in Runner's normal graph. The provider resource initializes its store and releases it in `dispose()`, entirely within Runner's lifecycle.

The same option works on `resources.live.with({ persistence, maxEntries })` when composing the resources separately. Use `sqlitePersistence({ file })` inside a custom resource's `init()` if you need custom SQLite wiring, await its `load()` before recording, and await its `close()` in that resource's `dispose()`. `sqlitePersistenceResource` is the named export of `resources.sqlitePersistence`. Without `persistence`, telemetry stays in memory and is lost on restart.

SQLite restores retained logs, emissions, errors and runs before the runtime starts serving queries or live streams. Each category keeps at most `maxEntries` rows on disk and entries in memory; lowering the cap trims existing rows on the next startup. Sequences resume above the highest committed sequence, including when the clock moves backwards. GraphQL, the docs UI, and `/live/stream` all see the restored history through their existing APIs.

The adapter uses Node's built-in `node:sqlite`, loaded only when enabled: use Node.js 22.13+ or 24+ (Node 22.5–22.12 requires `--experimental-sqlite`). No SQLite npm dependency is needed. Parent directories are created automatically. Keep the same file path between restarts, use a separate file for each app/runtime, and add the database directory to your `.gitignore`. The cap limits retained rows rather than file bytes; SQLite reuses freed database pages.

Each SQLite store owns a dedicated worker thread. Opening, restoration, SQL writes, retention and connection cleanup run there. Recording validates and snapshots the entry, then synchronously accepts it into a bounded queue before notifying live readers; readers may see records before their disk commit. Batches of up to 1000 entries flush every second or when full, with at most 10,000 pending/in-flight entries per store. Each batch commits records, sequence metadata and retention atomically. A full queue rejects the new entry; a background write failure is latched and exposed through `status()`, subsequent recording and `flush()`/`close()`. Graceful Runner disposal drains the queue and closes the worker. Abrupt termination can lose pending records; committed history survives. Open/restore failures reject startup.

For direct `sqlitePersistence({ file })` users, `load()` is now async and must be awaited before recording restored sequences; `flush()` acknowledges accepted disk commits, `status()` returns `{ pendingEntries, error }`, and `close()` must be awaited. Existing synchronous custom providers remain supported. Large payload snapshotting and in-memory queries still consume application-thread CPU; the worker removes SQLite I/O and lock waits from that thread.

Payloads and log data are saved as JSON snapshots: ordinary JSON fields survive; dates use their JSON representation, bigint and symbols become strings, functions become `"[Function]"`, and circular/repeated object references become `"[Circular]"`. Errors keep their name, message and stack. JavaScript object identity and prototypes are not restored.

### Shared log and error storage

Use the same `persistence` option for the log explorer, error tracker and trace history. Without a provider, DevTools searches the in-memory history. With a provider, DevTools restores the latest `maxEntries` per category before serving reads. Durable workflows and APM are optional.

| Provider | Configuration for `dev.with({ persistence: ... })` | Connection |
| --- | --- | --- |
| SQLite | `resources.sqlitePersistence.with({ file: "./.runner-dev/history.sqlite" })` | Built-in Node SQLite |
| Redis | `resources.redisPersistence.with({ url: "redis://localhost:6379", streamId: "checkout" })` | Install optional `ioredis`. Set `REDIS_USERNAME` and `REDIS_PASSWORD` as needed. |
| ClickHouse | `resources.clickHousePersistence.with({ url: "http://localhost:8123", database: "default", streamId: "checkout" })` | Native HTTP. Set `CLICKHOUSE_USER` and `CLICKHOUSE_PASSWORD` as needed. |
| PostgreSQL | `resources.postgresPersistence.with({ streamId: "checkout" })` | Install optional `pg`. Set `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD` and standard pg SSL settings. |

Give each active runtime a separate file or stream ID. Remote adapters snapshot records into a 10,000-entry bounded queue, flush every second or at 1,000 entries, and drain on graceful shutdown. A full queue rejects new entries. A failed write surfaces on subsequent writes, flush or shutdown. Abrupt termination can lose queued entries. Restarting with a lower cap evicts older records. PostgreSQL and ClickHouse create a table named `runner_dev_live_history`. ClickHouse reads the latest version of each slot with `FINAL`; background merges reclaim superseded rows. Redis stores one hash per stream and depends on the Redis server's persistence settings for recovery after Redis restarts.

### Custom persistence adapters

Exported `LivePersistence`, `LivePersistenceOptions`, `LivePersistenceSnapshot`, and `LivePersistedEntry` types define the store contract. `LivePersistenceResource`/`LivePersistenceSource` describe the accepted provider references. Return your store directly from a resource:

```ts
import { r } from "@bluelibs/runner";
import { dev, type LivePersistence } from "@bluelibs/runner-dev";
import { database } from "./database";
import { createTelemetryStore } from "./myTelemetryStore";

const myPersistence = r
  .resource("telemetryPersistence")
  .dependencies({ database })
  .init(async (_config, { database }) => {
    const store = await createTelemetryStore(database);
    return store satisfies LivePersistence;
  })
  .dispose(async (store) => { await store.close(); })
  .build();

const devTools = dev.with({ persistence: myPersistence });
```

Register `database` in its owning app/module as usual, or register it inside the provider for a self-contained subtree. Runner-Dev registers the persistence provider automatically. Runner calls its `dispose()` after the live service stops, including cleanup after a restore failure. Resource `init()` must clean up any partial initialization before throwing. Avoid a provider dependency on `resources.live`, which would create a cycle.

Your store implements two methods; connection setup and cleanup belong to its resource:

- `load({ maxEntries })` trims each category to its cap and returns, synchronously or through a promise, `{ entries, lastSequence }`. Entries are `{ kind, entry }` records where `kind` is `log`, `emission`, `error` or `run`, in strictly increasing, unique sequence order. `lastSequence` is the highest committed sequence, even if its entry was evicted; use `0` for a new store. Restore validates stamps and category fields and fails startup on invalid data.
- `append(record, { maxEntries })` synchronously accepts the entry: either atomically commit the record, sequence and eviction, or enqueue an immutable snapshot in a bounded buffer whose committed batches provide those guarantees. Buffered providers must drain during resource disposal and expose write failures. It returns `undefined` and throws if acceptance fails. Promise returns are rejected by TypeScript and guarded at runtime because live recording is synchronous. Invalid provider values fail startup. Validate records before committing so a bad entry cannot poison the next restart.

### Queries and cursors

Every entry has a `sequence`: a number that is strictly increasing across all four categories and never reused, so it identifies one entry store-wide. It is an ordering key, not a count: it is seeded from the wall clock (about `Date.now() * 1000`), so it normally keeps increasing across memory-only restarts; persistence also seeds it from the highest saved sequence. Use it as the cursor when paging.

GraphQL (basic):

```graphql
query {
  live {
    logs(last: 50) {
      sequence
      timestampMs
      level
      message
      data # stringified JSON if object, otherwise null
    }
    emissions(last: 50) {
      sequence
      timestampMs
      eventId
      emitterId
      payload # stringified JSON if object, otherwise null
    }
    errors(last: 50) {
      sequence
      timestampMs
      sourceId
      sourceKind
      message
    }
    runs(last: 50) {
      sequence
      timestampMs
      nodeId
      nodeKind
      durationMs
      ok
      parentId
      rootId
      correlationId
    }
  }
}
```

Window semantics of `last`:

- Without a cursor, `last: N` returns the **most recent** N matching entries.
- With a cursor (`afterSequence` or `afterTimestamp`), `last: N` returns the **oldest** N matching entries after the cursor, so you can page forward without skipping anything.
- Results are always in ascending order (oldest first).

To follow new entries, pass the last `sequence` you received as `afterSequence` (exclusive) and repeat until a page comes back shorter than `last`:

```graphql
query NextLogs($after: Float!) {
  live {
    logs(afterSequence: $after, last: 100) {
      sequence
      timestampMs
      level
      message
    }
  }
}
```

`afterTimestamp` (milliseconds since epoch, exclusive) still works, but entries that share one millisecond can straddle a page cut and be skipped; use `afterSequence` when every entry matters. `Task.runs` and `Hook.runs` accept the same `afterSequence`, `afterTimestamp` and `last` arguments.

GraphQL (with filters and last):

```graphql
query {
  live {
    logs(
      last: 100
      filter: { levels: [debug, error], messageIncludes: "probe" }
    ) {
      timestampMs
      level
      message
      correlationId
    }
    emissions(
      last: 50
      filter: { eventIds: ["evt.hello"], emitterIds: ["task.id"] }
    ) {
      eventId
      emitterId
    }
    errors(
      last: 10
      filter: { sourceKinds: [TASK, RESOURCE], messageIncludes: "boom" }
    ) {
      sourceKind
      message
    }
    # The 5 most recent successful task runs (no cursor, so `last` counts back from the newest).
    runs(last: 5, filter: { ok: true, nodeKinds: [TASK] }) {
      nodeId
      durationMs
      ok
      correlationId
    }
  }
}
```

### Live system health

- **systemInfo: `SystemInfo!`** — the server host's CPU model, logical core count, total RAM, platform, architecture, and Node.js version. The Live UI shows this once above the updating process-health metrics. It describes the server machine, not the browser; container resource limits may differ from host totals.
- **memory: `MemoryStats!`**
  - Fields: `heapUsed` (bytes), `heapTotal` (bytes), `rss` (bytes)
- **cpu: `CpuStats!`**
  - Fields: `usage` (0..1 event loop utilization), `loadAverage` (1‑minute load avg)
- **eventLoop(reset: Boolean): `EventLoopStats!`**
  - Fields: `lag` (ms, avg delay via `monitorEventLoopDelay`)
  - Args: `reset` optionally clears the histogram after reading
- **gc(windowMs: Float): `GcStats!`**
  - Fields: `collections` (count), `duration` (ms)
  - Args: `windowMs` returns stats only within the last window; omitted = totals since process start

Example query:

```graphql
query SystemHealth {
  live {
    systemInfo {
      cpuModel
      logicalCores
      totalMemory
      platform
      architecture
      nodeVersion
    }
    memory {
      heapUsed
      heapTotal
      rss
    }
    cpu {
      usage
      loadAverage
    }
    eventLoop(reset: true) {
      lag
    }
    gc(windowMs: 10000) {
      collections
      duration
    }
  }
}
```

Notes:

- `heap*` and `rss` are bytes.
- `cpu.usage` is a ratio; `loadAverage` is 1‑minute OS load.
- `eventLoop.lag` may be 0 if `monitorEventLoopDelay` is unavailable.

### SSE Live Streaming

In addition to GraphQL polling, the server exposes a **Server-Sent Events** endpoint at `GET /live/stream` for near-instant telemetry delivery:

```http
GET /live/stream
Accept: text/event-stream
```

The endpoint pushes two event types:

| Event       | Cadence                                      | Payload                                                     |
| ----------- | -------------------------------------------- | ----------------------------------------------------------- |
| `telemetry` | ~100ms after each `record*` call (debounced) | `{ logs, emissions, errors, runs }` (delta since last push) |
| `health`    | Every 2s                                     | `{ memory, cpu, eventLoop, gc }`                            |

A heartbeat comment (`: heartbeat`) is sent every 15s to keep the connection alive through proxies.

Delivery guarantees:

- Telemetry entries carry their `sequence`. The stream keeps one sequence cursor per category, so bursts, including many entries in the same millisecond, arrive in full and in order as long as they are still retained when the push runs. Large backlogs are drained in bounded pushes (up to 10 pages of 1000 entries per category per push, then the next push continues).
- Retention caps every guarantee: each category keeps only its latest `maxEntries` entries, so an entry evicted before a reader reaches it is skipped without any signal. Sequences jump (they are clock-seeded and shared by all four categories), so a gap in them does not reveal the loss either. A single category can overflow within one 100 ms push window (a burst larger than `maxEntries`) or while the stream is paused on backpressure; raise `maxEntries` if that matters.
- On connect, the stream sends a `health` event and then replays the entries already in the store. After a reconnect, drop anything at or below the last `sequence` you saw.
- The stream respects backpressure: while the socket buffer is full it pauses telemetry, health and heartbeat frames until the socket drains, instead of buffering without limit.
- When the server shuts down (`runtime.dispose()`, Ctrl+C), it ends every open stream, and a stream requested while it is closing gets an empty response that closes its connection. Any connection still open 3 seconds after the server stopped listening is cut, so no client holds up shutdown longer than that. `EventSource` then retries on its own, on a new connection.

**JavaScript client example:**

```js
const lastSeen = { logs: 0, emissions: 0, errors: 0, runs: 0 };
const es = new EventSource("http://localhost:1337/live/stream");
es.addEventListener("telemetry", (e) => {
  const page = JSON.parse(e.data);
  for (const category of Object.keys(lastSeen)) {
    // Skip entries a reconnect replays.
    const fresh = page[category].filter((x) => x.sequence > lastSeen[category]);
    if (fresh.length) lastSeen[category] = fresh[fresh.length - 1].sequence;
    // merge `fresh` into your state
  }
});
es.addEventListener("health", (e) => {
  const { memory, cpu, eventLoop, gc } = JSON.parse(e.data);
});
```

The built-in Live Panel UI uses SSE when available and falls back to polling at a configurable interval (500ms–10s slider) when SSE is unavailable or fails. It keeps one sequence cursor per category, shared by SSE and polling, so polling continues from where the stream stopped. Each poll tick re-queries the categories that are behind (pages of 100, at most 10 requests per tick), and replayed or overlapping entries are dropped.

**Programmatic notification hook:** The `Live` interface exposes `onRecord(callback)` which fires synchronously whenever a `record*` method is called, returning an unsubscribe function. This is the mechanism the SSE endpoint uses internally.

### Correlation and call chains

- What is correlationId? An opaque UUID (via `crypto.randomUUID()`) created for the first task in a run chain.
- How is it formed?
  - When a task starts, a middleware opens an AsyncLocalStorage scope containing:
    - `correlationId`: a UUID for the chain
    - `chain`: ordered array of node ids representing the call path
  - Nested tasks and listeners reuse the same AsyncLocalStorage scope, so the same `correlationId` flows throughout the chain.
- What does it contain? Only a UUID string. No payload, no PII.
- Where is it recorded?
  - `logs.correlationId`
  - `emissions.correlationId`
  - `errors.correlationId`
  - `runs.correlationId` plus `runs.parentId` and `runs.rootId` for chain topology
- How to use it
  - Read a recent run to discover a correlation id, then filter logs by it:

```graphql
query TraceByCorrelation($cid: String!) {
  live {
    # No cursor: the 10 most recent runs.
    runs(last: 10) {
      nodeId
      parentId
      rootId
      correlationId
    }
    logs(last: 100, filter: { correlationIds: [$cid] }) {
      timestampMs
      level
      message
      correlationId
    }
  }
}
```

#### Trace View (UI)

The Live Panel includes a built-in **Trace View** — click any `correlationId` badge in the Logs, Events, Errors, or Runs sub-tabs to open a unified timeline modal showing every entry that shares that ID, ordered chronologically. Each entry is color-coded by kind (log, event, error, run) with a vertical timeline gutter, relative offset labels, and expandable details. This provides an in-process "distributed tracing" experience similar to Jaeger or Zipkin, but entirely within the Dev UI.

#### Unified Modal System

All Dev UI modals (code viewer, execute, trace view, log details, stats overlay) share a common `BaseModal` primitive that provides portal rendering, backdrop blur, focus trap, scroll lock, slide-up animation, and ARIA dialog semantics. A `ModalStackContext` manages stacking so modals can open on top of other modals — each layer gets a higher z-index and the global <kbd>Esc</kbd> key always closes the topmost one first.

## Emitting Events (Runner-native)

- Define an event:

```ts
import { r } from "@bluelibs/runner";

export const userCreated = r
  .event<{ id: string; name: string }>("userCreated")
  .build();
```

- Use it in a task:

```ts
import { r } from "@bluelibs/runner";
import { userCreated } from "./events";

export const createUser = r
  .task<{ name: string }>("createUser")
  .dependencies({ userCreated })
  .run(async (input, { userCreated }) => {
    const id = crypto.randomUUID();
    await userCreated({ id, name: input.name });
    return { id };
  })
  .build();
```

- Emit logs:

```ts
import { r, resources } from "@bluelibs/runner";

export const logSomething = r
  .task("logSomething")
  .dependencies({ logger: resources.logger })
  .run(async (_i, { logger }) => {
    logger.info("Hello world!");
  })
  .build();
```

## Notes on Overrides

- If a resource overrides another registerable, the overridden node remains discoverable but marked with `overriddenBy`.
- Only the active definition exists; we do not retain a shadow copy of the original.

## Guidelines & DX

- No `any` in APIs; strong types for nodes and relations
- Non-null lists with non-null items (`[T!]!`) in GraphQL
- Deep “resolved” fields for easy graph traversal
- File-aware enhancements (`filePath`, `fileContents`, etc.)

For full details on development, testing, and codegen, see [CONTRIBUTING.md](https://github.com/bluelibs/runner-dev/blob/main/CONTRIBUTING.md).

## Hot-Swapping Debugging System

**Revolutionary live debugging feature that allows AI assistants and developers to dynamically replace task run functions in live applications.**

### Overview

The hot-swapping system enables:

- **Live Function Replacement**: Replace any task's `run` function with new TypeScript/JavaScript code without restarting the application
- **TypeScript Compilation**: Automatic compilation and validation of swapped code
- **GraphQL API**: Remote swap operations via GraphQL mutations
- **Live Telemetry Integration**: Real-time capture of debug logs from swapped functions
- **Rollback Support**: Easy restoration to original functions
- **Type Safety**: 100% type-safe implementation with comprehensive error handling

### Quick Setup

The `dev` resource already registers the swap manager. To wire the pieces yourself instead:

```ts
import { r } from "@bluelibs/runner";
import { resources as dev } from "@bluelibs/runner-dev";

export const app = r
  .resource("app")
  .register([
    // Core dev resources
    dev.live,
    dev.introspector,

    // Add the swap manager for hot-swapping
    dev.swapManager,

    // GraphQL schema and server with swap mutations (the server depends on both)
    dev.graphql,
    dev.server.with({ port: 1337 }),
  ])
  .build();
```

Swapping runs code on the server, so it needs the [code-execution gate](#code-execution-gate) open: start the app with `RUNNER_DEV_EVAL=1` or `NODE_ENV=development`.

`swapTask`, `eval` and `shell` compile code with the `typescript` package. It is an optional peer dependency, so loading runner-dev never needs it, and its range is `*` so npm installs runner-dev next to whatever TypeScript your project has, prereleases included (any narrower range excludes prereleases and makes npm refuse with ERESOLVE); install it in your project (`npm install --save-dev typescript@6`) to use those features. Without it they return `Install typescript 5 or 6 to use swapTask, eval and shell: ...` instead of running. TypeScript 7's native compiler does not expose the `transpileModule` API they use: with it installed they return an incompatibility error that suggests `typescript@6`.

### GraphQL API

#### Queries

**Get the effective run options (how the app was started):**

```graphql
query {
  runOptions {
    mode
    debug
    rootId
  }
}
```

**Get currently swapped tasks:**

```graphql
query {
  swappedTasks {
    taskId
    swappedAt
    originalCode
  }
}
```

#### Mutations

**Swap a task's run function:**

```graphql
mutation SwapTask($taskId: ID!, $runCode: String!) {
  swapTask(taskId: $taskId, runCode: $runCode) {
    success
    error
    taskId
  }
}
```

**Restore original function:**

```graphql
mutation UnswapTask($taskId: ID!) {
  unswapTask(taskId: $taskId) {
    success
    error
    taskId
  }
}
```

**Restore all swapped tasks:**

```graphql
mutation UnswapAllTasks {
  unswapAllTasks {
    success
    error
    taskId
  }
}
```

### Usage Examples

#### Basic Function Swapping

Replace a task's logic with enhanced debugging:

```graphql
mutation {
  swapTask(
    taskId: "user.create"
    runCode: """
    async function run(input, deps) {
      // Add comprehensive logging
      if (deps.emitLog) {
        await deps.emitLog({
          timestamp: new Date(),
          level: "info",
          message: "DEBUG: Creating user started",
          data: { input }
        });
      }

      // Enhanced validation
      if (!input.email || !input.email.includes('@')) {
        throw new Error('Invalid email address');
      }

      // Original logic with debugging
      const result = {
        id: crypto.randomUUID(),
        email: input.email,
        createdAt: new Date().toISOString(),
        debugInfo: {
          swappedAt: Date.now(),
          inputValidated: true
        }
      };

      if (deps.emitLog) {
        await deps.emitLog({
          timestamp: new Date(),
          level: "info",
          message: "DEBUG: User created successfully",
          data: { result }
        });
      }

      return result;
    }
    """
  ) {
    success
    error
  }
}
```

#### TypeScript Support

The system supports full TypeScript syntax:

```graphql
mutation {
  swapTask(
    taskId: "data.processor"
    runCode: """
    async function run(input: { items: string[] }, deps: any): Promise<{ processed: number }> {
      const items: string[] = input.items || [];
      let processed: number = 0;

      for (const item of items) {
        if (typeof item === 'string' && item.length > 0) {
          processed++;
        }
      }

      return { processed };
    }
    """
  ) {
    success
    error
  }
}
```

#### Arrow Functions and Function Bodies

Multiple code formats are supported:

```graphql
# Arrow function
mutation {
  swapTask(
    taskId: "simple.task"
    runCode: "() => ({ message: 'Hello from arrow function!' })"
  ) {
    success
  }
}

# Function body only
mutation {
  swapTask(
    taskId: "another.task"
    runCode: """
    const result = { timestamp: Date.now() };
    return result;
    """
  ) {
    success
  }
}
```

### Live Telemetry Integration

Swapped functions can emit logs that are captured by the live telemetry system:

```graphql
# After swapping with debug logging, query the logs
query RecentDebugLogs {
  live {
    logs(last: 50, filter: { messageIncludes: "DEBUG" }) {
      timestampMs
      level
      message
      data
      correlationId
    }
  }
}
```

### Safety and Best Practices

#### Type Safety

- No `as any` usage throughout the implementation
- Full TypeScript type checking and compilation
- Comprehensive error validation and reporting

#### Security Considerations

- Code is executed via `eval()` in the Node.js context
- Intended for development/debugging environments only
- Swapped functions have access to the same context as original functions

#### Code-execution gate

Every server-side operation that runs code or writes source files shares one gate. It is open only when the server starts with `RUNNER_DEV_EVAL=1`, or with `NODE_ENV` set to exactly `development` or `test`. An unset `NODE_ENV`, `production`, `staging` or any other value keeps it closed. Plain `node dist/main.js` and `tsx watch` (including a scaffolded project's `npm run dev`) do not set `NODE_ENV`, so start them with `RUNNER_DEV_EVAL=1` or `NODE_ENV=development` when you want these features.

- Gated: `eval`, `shell`, `shellComplete` (returns no options), `swapTask`, `invokeTask`/`invokeEvent` with `evalInput: true`, and `editFile`. Writing a source file counts as code execution because a watcher (`tsx watch`, nodemon) reloads and runs it.
- When closed, they return `success: false` with `<Feature> is disabled in this environment. Set RUNNER_DEV_EVAL=1 or NODE_ENV=development on the server to enable it.`
- Still allowed: every query, `invokeTask`/`invokeEvent` with plain JSON input, `unswapTask` and `unswapAllTasks`.
- `query { codeExecutionEnabled }` reports the gate (`shellEnabled` is the same value). The docs UI uses it: with the gate closed, the source viewer stays read-only and says how to enable editing, and the shell shows the same hint.
- `shell` and `eval` runs are bounded by `RUNNER_DEV_SHELL_TIMEOUT_MS` (default `30000`, a whole number from 1 to 2147483647; invalid values fail the run before any code executes). A timed-out run returns `<Shell|Eval> execution timed out after N ms. The code may still be running …`: JavaScript cannot cancel it, and a synchronous infinite loop blocks the server. For `shell`, the budget also covers initializing a lazy `resourceId`; an init that does not finish in time returns `Resource '<id>' did not finish initializing. Shell execution timed out after N ms. …`. Results over 256 KB (262144 characters) are cut and end with `… [truncated N chars]`.
- The gate controls what the server may do, not who can reach it. Keep the default loopback bind unless you need network access; when the server listens on a non-loopback address with the gate open, it logs a startup warning (see [Network and code-execution defaults](#network-and-code-execution-defaults)).

#### Best Practices

- Use descriptive debug messages in swapped functions
- Leverage the logging system for telemetry capture
- Test swapped functions thoroughly before deployment
- Always restore original functions after debugging

#### Error Recovery

- Failed swaps don't affect the original function
- State tracking prevents inconsistencies
- Easy rollback with `unswapAllTasks` mutation

### AI Assistant Integration

This system is specifically designed for AI debugging workflows:

1. **AI analyzes application behavior** via introspection and live telemetry
2. **AI identifies issues** in specific tasks or functions
3. **AI generates enhanced debug code** with additional logging and validation
4. **AI swaps the function remotely** via GraphQL mutations
5. **AI monitors enhanced telemetry** to understand the issue
6. **AI restores original function** once debugging is complete

### Remote Task Execution

The system provides `invokeTask` functionality for remotely executing tasks with JSON input/output serialization, perfect for AI-driven debugging and testing.

#### Basic Task Invocation

```graphql
mutation {
  invokeTask(taskId: "user.create") {
    success
    error
    taskId
    result
    executionTimeMs
    invocationId
  }
}
```

#### Task Invocation with Input

```graphql
mutation {
  invokeTask(
    taskId: "user.create"
    inputJson: "{\"email\": \"test@example.com\", \"name\": \"John Doe\"}"
  ) {
    success
    result
    executionTimeMs
  }
}
```

#### JavaScript Input Evaluation

For advanced debugging scenarios, use `evalInput: true` to evaluate JavaScript expressions instead of parsing JSON. This runs code on the server, so it needs the [code-execution gate](#code-execution-gate) open; plain JSON input works either way:

```graphql
mutation {
  invokeTask(
    taskId: "data.processor"
    inputJson: """
    {
      timestamp: new Date("2023-01-01"),
      data: [1, 2, 3].map(x => x * 2),
      config: {
        retries: Math.max(3, process.env.NODE_ENV === 'prod' ? 5 : 1),
        timeout: 30 * 1000
      },
      processData: (items) => items.filter(x => x > 0)
    }
    """
    evalInput: true
  ) {
    success
    result
    executionTimeMs
  }
}
```

#### Pure Mode (Bypass Middleware)

Pure mode executes tasks with computed dependencies directly from the store, bypassing the middleware pipeline and authentication systems for clean testing:

```graphql
mutation {
  invokeTask(
    taskId: "user.create"
    inputJson: "{\"email\": \"test@example.com\"}"
    pure: true
  ) {
    success
    result
    executionTimeMs
  }
}
```

#### AI Debugging Workflow

1. **Swap task with enhanced debugging**:

```graphql
mutation {
  swapTask(
    taskId: "user.create"
    runCode: """
    async function run(input, deps) {
      console.log('Input received:', input);
      const result = { id: Math.random(), ...input };
      console.log('Result generated:', result);
      return result;
    }
    """
  ) {
    success
  }
}
```

2. **Invoke task to test behavior**:

```graphql
mutation {
  invokeTask(
    taskId: "user.create"
    inputJson: """
    {
      email: "debug@test.com",
      createdAt: new Date(),
      metadata: {
        source: "ai-debug",
        sessionId: crypto.randomUUID(),
        testData: [1, 2, 3].map(x => x * 10)
      }
    }
    """
    pure: true
    # Activation of eval() for smarter inputs.
    evalInput: true
  ) {
    success
    result
    executionTimeMs
  }
}
```

3. **Monitor live telemetry for debug output**:

```graphql
query {
  live {
    logs(last: 10) {
      level
      message
      data
      timestampMs
    }
  }
}
```

#### JSON Serialization

The system automatically handles complex JavaScript types:

- **Primitives**: strings, numbers, booleans preserved exactly
- **Objects/Arrays**: Deep serialization with proper structure
- **Functions**: Converted to `[Function: name]` strings
- **Undefined**: Converted to `[undefined]` strings
- **Dates**: Serialized as ISO strings
- **Circular References**: Safely handled to prevent errors

#### Input Processing Modes

**JSON Mode (default)**: `evalInput: false`

- Input is parsed as JSON using `JSON.parse()`
- Safe for structured data
- Limited to JSON-compatible types

**JavaScript Evaluation Mode**: `evalInput: true`

- Input is evaluated as JavaScript using `eval()`
- Supports complex expressions, function calls, Date objects, calculations
- Full access to JavaScript runtime and built-in objects
- Perfect for AI-driven testing with dynamic inputs
- Refused with `success: false` while the [code-execution gate](#code-execution-gate) is closed

### Arbitrary Code Evaluation

For advanced debugging, the system provides an `eval` mutation to execute arbitrary JavaScript/TypeScript code on the server.

**Security Warning**: This feature is powerful and executes code with the same privileges as the application. It is intended for development environments only and sits behind the [code-execution gate](#code-execution-gate): it runs only with `RUNNER_DEV_EVAL=1` or `NODE_ENV=development`/`test`, and is disabled when `NODE_ENV` is unset. Runs share the shell's timeout (`RUNNER_DEV_SHELL_TIMEOUT_MS`) and 256 KB result cap.

#### `eval` Mutation

**Execute arbitrary code:**

```graphql
mutation EvalCode($code: String!) {
  eval(code: $code) {
    success
    error
    result # JSON string
    executionTimeMs
  }
}
```

- `code`: The JavaScript/TypeScript code to execute. Pass the full signature, `async function run(deps) { ... }`; `deps` holds `store`, `introspector`, `globals`, `taskRunner` and `eventManager`.

**Example:**

```graphql
mutation {
  eval(code: "return { a: 1, b: process.version }") {
    success
    result
  }
}
```

### Runtime Shell

The `shell` mutation runs a JavaScript/TypeScript snippet against the live runtime, like a REPL. Bare expressions auto-return (`r`, `await runtime.runTask("...")`); multi-statement snippets use `return`. `console` output is captured and returned in `logs`.

- `code`: the snippet to execute.
- `resourceId` (optional): binds `r` to that resource's initialized value (exact or suffix match); without it, `r` is `null`. Under `run(app, { lazy: true })` a resource that is not initialized yet is initialized first, and that init counts toward the run's timeout.
- `runtime`: the live runtime (`runTask`, `emitEvent`, `getResourceValue`, `getResourceConfig`, `getHealth`, …).

Like `eval`, the shell sits behind the [code-execution gate](#code-execution-gate) (`RUNNER_DEV_EVAL=1` or `NODE_ENV=development`/`test`) and shares its timeout and result cap. `query { shellEnabled }` (the same value as `codeExecutionEnabled`) tells a client whether it can run here.

Captured `console` output is bounded too: at most 200 lines or 20000 characters per run. A line longer than the remaining budget is cut with the same `… [truncated N chars]` marker, and a single `log limit reached` line marks where further output was dropped. `console.dir`, `table`, `trace`, `assert` and `count` are captured (formatted like Node's own console); `time*` and `group*` output is not captured.

```graphql
mutation {
  shell(code: "r", resourceId: "app.db") {
    success
    result
    logs
    executionTimeMs
  }
}
```

In the UI, every resource card and resources overview row has a `Shell` action, and the sidebar footer (or ``Ctrl+` ``) opens a global runtime shell — also available from the `⌘K` command palette. The editor completes scope members as you type (`r`, `runtime`, `store`, …) via the side-effect-free `shellComplete` query, with `Enter` to run, `Shift+Enter` for a new line, and `Tab` to accept a suggestion.

### Use Cases

- **Live Debugging**: Add logging to specific functions without restarts (on a production box only with an explicit `RUNNER_DEV_EVAL=1` opt-in)
- **A/B Testing**: Compare different function implementations live
- **Performance Monitoring**: Inject performance measurements
- **Error Investigation**: Add error handling and detailed logging
- **Feature Development**: Test new logic before permanent implementation
- **AI-Driven Debugging**: Enable AI assistants to debug applications autonomously

### Architecture

The hot-swapping system is organized into five high-level capabilities:

- **Execution Control**: swaps task `run` implementations at runtime and supports rollback.
- **Validation Pipeline**: parses and compiles submitted code before activation.
- **API Surface**: exposes swap and restore operations through GraphQL mutations.
- **Observability**: integrates with live telemetry so swapped behavior can be inspected immediately.
- **Safety Controls**: isolates failures to the attempted swap and preserves previous task behavior when validation fails.

The implementation remains fully type-safe and is covered by both unit and GraphQL integration tests.

---

## System Architecture

### Overview

Runner-Dev is built as a modular system of resources that integrate with the @bluelibs/runner framework to provide comprehensive development tools. The architecture follows a resource-based composition pattern where each component is a self-contained resource that can be registered and configured independently.

### Core Components

```mermaid
graph TB
    subgraph "Core Framework (@bluelibs/runner)"
        App[Application Root]
        Resource[Resources]
        Task[Tasks]
        Event[Events]
        Middleware[Middleware]
        Hook[Hooks]
        Tag[Tags]
    end

    subgraph "DevTools Layer (@bluelibs/runner-dev)"
        Dev[dev Resource]
        Introspector[Introspector]
        Live[Live Telemetry]
        Swap[Swap Manager]
        GraphQL[GraphQL Server]
        MCP[MCP Server]
    end

    subgraph "Interfaces"
        UI[React UI]
        CLI[CLI Tools]
        AI[AI Assistants]
    end

    App --> Dev
    Dev --> Introspector
    Dev --> Live
    Dev --> Swap
    Dev --> GraphQL
    GraphQL --> MCP

    Introspector --> Resource
    Introspector --> Task
    Introspector --> Event
    Introspector --> Middleware
    Introspector --> Hook
    Introspector --> Tag

    GraphQL --> UI
    GraphQL --> CLI
    MCP --> AI
```

### Component Responsibilities (High-Level)

| Layer                       | Responsibility                                                                   |
| --------------------------- | -------------------------------------------------------------------------------- |
| **Composition Layer**       | Registers and wires DevTools capabilities into the Runner application lifecycle. |
| **Introspection Layer**     | Builds a runtime model of tasks, resources, events, middleware, hooks, and tags. |
| **Observability Layer**     | Captures logs, emissions, errors, runs, and health metrics for analysis.         |
| **Execution Control Layer** | Supports remote task invocation and controlled hot-swapping workflows.           |
| **Access Layer**            | Exposes a GraphQL API and transports for UI, CLI, and MCP clients.               |

### Data Flow

```mermaid
sequenceDiagram
    participant App as Runner App
    participant Dev as dev Resource
    participant Intro as Introspector
    participant GQL as GraphQL Server
    participant UI as React UI

    App->>Dev: register dev.with({port: 1337})
    Dev->>Intro: walk application graph
    Intro-->>Dev: serialized topology
    Dev->>GQL: start server on port 1337

    UI->>GQL: query { tasks { id dependsOn } }
    GQL-->>UI: introspected data

    UI->>GQL: mutation invokeTask(...)
    GQL->>App: execute task
    App-->>GQL: result
    GQL-->>UI: response
```

### Key Architectural Patterns

1. **Resource-Based Composition**: Everything in Runner is a resource that can be registered and composed. The dev tools themselves are resources.

2. **Introspection System**: The Introspector walks the application graph at runtime, extracting metadata about:

   - Tasks (dependencies, emissions, interceptors)
   - Resources (isolation rules, subtree governance, cooldown hooks)
   - Events (listeners, transactional/parallel modes, lanes)
   - Middleware (auto-apply scopes, tags)
   - Tags (cross-cutting concerns with handlers)

3. **Live Telemetry**: In-memory store for recent activity with SSE streaming via `/live/stream`

4. **Hot-Swapping**: Modify task implementations without restart via `swapTask` mutation

5. **GraphQL API**: Full schema at `src/schema/` with queries for architecture and mutations for invocation/swapping

6. **MCP Integration**: AI assistants can connect via Model Context Protocol to introspect and interact with running apps

### Entry Points

- **Main export**: `src/index.ts` - exports `dev` resource and types
- **CLI entry**: `src/cli.ts` - command-line interface
- **MCP entry**: `src/mcp.ts` - Model Context Protocol server
- **UI entry**: `src/ui/index.html` - React documentation UI
