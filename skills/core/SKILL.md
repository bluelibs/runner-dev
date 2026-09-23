---
name: Runner DevTools Usage
description: Use when working on @bluelibs/runner-dev itself, especially for docs UI behavior, introspection resources, GraphQL tooling, MCP helpers, telemetry surfaces, and agent-facing documentation. Start here when the task needs runner-dev-specific context instead of the general Runner framework skill.
---

# Runner Dev

Start with `./references/readmes/COMPACT_GUIDE.md`.
It is the canonical compact runner-dev guide and should stay aligned with the current toolkit behavior.

Use `./references/README.md` when the task needs installation, CLI, or broader user-facing usage details.
Use `./references/readmes/API_REFERENCE.md` when the task needs the current GraphQL surface used by docs or MCP flows.

Reference layout:

- `./references/README.md` mirrors the repo root `README.md` (a symlink in the repository)
- `./references/readmes/` mirrors the repo `readmes/` directory, including `COMPACT_GUIDE.md` and `API_REFERENCE.md` (a symlink in the repository, copied in when the package is packed)
- When editing in the repository, change the originals and keep the links; `README.md`, this file, `./references/README.md` and `./references/readmes/COMPACT_GUIDE.md` are one documentation unit and change together

Use this skill when the task involves:

- docs UI behavior, `/docs/data`, in-app documentation delivery, or the topology graph / blast-radius / mindmap views
- the runtime shell (REPL), the `⌘K` command palette, keyboard shortcuts, or the docs tables (search-first filters, sorting, detail pager)
- MCP helpers (`graphql_query`, `graphql_mutation`, `graphql_introspect`, `graphql_schema_sdl`, `graphql_ping`, `project_overview`), GraphQL tooling, introspection resources, or chat context wiring
- live telemetry (including `sequence`/`afterSequence` cursors and SSE streaming), hot-swapping, CLI surfaces, or other runner-dev tooling
- security defaults: the code-execution gate (`RUNNER_DEV_EVAL=1` or `NODE_ENV=development`/`test`), the loopback bind, the Host header check on every bind (`allowedHosts` for extra DNS names), and the `host` option for deliberate network exposure
- agent-facing documentation that must stay aligned with `readmes/COMPACT_GUIDE.md` and `README.md`
- GraphQL schema and MCP contract work grounded in `./references/readmes/API_REFERENCE.md`

Reach for the general Runner skill when the problem is about framework design rather than runner-dev's tooling surface.

## Scaffold dependency checks

New projects target Runner 6.6 and Vitest 4.1.11+ and require Node.js 22.12+ or 24+ (runner-dev itself needs Node.js 22+). Their `npm run dev` (`tsx watch`) does not set `NODE_ENV`, so the docs UI shell, file editing, `swapTask` and `eval` stay off there until the app is started with `RUNNER_DEV_EVAL=1` or `NODE_ENV=development`. Run `npm run audit` in generated projects to check production and development dependencies. Before a release, run `npm run build`, `npm run audit`, and `npm run audit:scaffold`; the latter verifies a fresh project against the packed local release, including its build and tests. The repository audit covers backend dependencies and frontend tooling. Do not suppress audit findings or use `--omit=dev` for this check. `npm run check:runtime-deps` (run by CI after the build and by `npm pack` after a clean build) fails when `dist` requires a package that is not a dependency or peer, or when loading the package entry pulls in an optional peer such as `typescript`.

Runner 6.6 durable apps must register `resources.durable` (also exported as `durableSupportResource`) from `@bluelibs/runner/node` alongside the durable runtime; the workflow tag alone does not register the required runtime tags, events, and lifecycle hook.
