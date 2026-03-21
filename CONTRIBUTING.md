# Contributing to @bluelibs/runner-dev

## Local Development Playbook

Quickly boot the dummy server and UI, then exercise the CLI against it.

1. **Start dev play (UI + Server):**

```bash
npm run play
```

This starts:
- UI watcher (`vite build --watch`)
- Dummy GraphQL server with Dev resources on port 31337

2. **Build the CLI and run demo commands:**

In another terminal:

```bash
npm run build
npm run demo:ping
npm run demo:query
npm run demo:overview
```

Alternatively, you can keep a server-only process:

```bash
npm run play:cli
# Then:
npm run demo:query
```

If you want a frozen visual docs export from the enhanced play app instead of a live server:

```bash
npm run play:export
npm run play:export -- ./my-export-dir
```

This writes a static catalog to `./runner-dev-catalog` by default, or to the custom path you pass after `--`.
The exported `index.html` is standalone and can be opened directly.

## Testing

- Unit/integration tests are executed via Jest: `npm test`.
- CLI remote tests spin up the dummy app on ephemeral ports and dispose cleanly.

**Run only the CLI tests:**

```bash
npm test -- cli
```

> **Note**: We prebuild before tests via `pretest` so the CLI binary `dist/cli.js` is available.

## Type-safe GraphQL Resolvers

We generate resolver arg types from the schema using GraphQL Code Generator. Run this after any schema change:

```bash
npm run codegen
```

Generated types are in `src/generated/resolvers-types.ts` and used in schema resolvers (for example `LiveLogsArgs`, `QueryEventArgs`).
