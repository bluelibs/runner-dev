# Contributing to @bluelibs/runner-dev

## Local Development Playbook

Quickly boot the dummy server and UI, then exercise the CLI against it.

1. **Start dev play (UI + Server):**

```bash
npm run play
```

This starts:
- UI watcher (`vite build --watch`)
- Dummy GraphQL server with Dev resources on port 31337 (docs UI at `http://localhost:31337/docs`)

The play server does not set `NODE_ENV`, so the code-execution gate is closed: the shell, file editing, `swapTask`, `eval` and `evalInput` answer with "disabled in this environment". To try them locally, start it with the gate open:

```bash
RUNNER_DEV_EVAL=1 npm run play
```

Requires Node.js 22+ (see `engines` in `package.json`).

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

If you want a frozen visual docs export from the reference commerce app instead of a live server:

```bash
npm run play:export
npm run play:export -- ./my-export-dir
```

This writes a static catalog to `./runner-dev-catalog` by default, or to the custom path you pass after `--`.
The exported `index.html` is standalone and can be opened directly.

## Testing

- Unit/integration tests are executed via Jest: `npm test`. Jest sets `NODE_ENV=test` when it is unset, so the code-execution gate is open in tests unless a test changes the environment.
- Jest has two projects: `node` for `*.test.ts` and `jsdom` for every `src/ui/**/*.test.tsx` (plus the chat tests). `src/__tests__/jest.projects.test.ts` fails when a test file is matched by no project or by both.
- CLI remote tests spin up the dummy app on ephemeral ports and dispose cleanly.
- `npm run qa` runs lint (with fixes), typecheck, build, the test suite and typedoc.

**Run only the CLI tests:**

```bash
npm test -- cli
```

> **Note**: The CLI tests run the built binary `dist/cli.js`, so run `npm run build` first. `npm run qa` and `npm run test:ci` build before testing; plain `npm test` does not.

## Continuous Integration

CI (`.github/workflows/ci.yml`) runs on Node 22 and 24: lint, typecheck, then `npm run test:ci` (build, then Jest with `--coverage`), then `npm run check:runtime-deps`. On the Node 22 leg it also runs `npm run audit` and `npm run audit:scaffold`. The TypeDoc site deploys to GitHub Pages in a separate job, only on pushes to `main` after the tests pass.

- Coverage thresholds in `config/jest/jest.config.js` are a ratchet toward 100%, not 100% today: statements 57, branches 44, functions 54, lines 58. Raise them as coverage improves; never lower them or exclude source files to make a run pass. Test files are excluded from `collectCoverageFrom` because Jest never instruments them.
- `npm run check:runtime-deps` scans `dist` (except `dist/ui`) and fails when it requires a package that is not a dependency, a peer or a documented optional module, or when loading the package entry pulls in an optional peer such as `typescript`. `prepack` runs `npm run clean` and a fresh build before it, so stale files in `dist` cannot be packed.

## Type-safe GraphQL Resolvers

We generate resolver arg types from the schema using GraphQL Code Generator. Run this after any schema change:

```bash
npm run codegen
```

Generated types are in `src/generated/resolvers-types.ts` and used in schema resolvers (for example `LiveLogsArgs`, `QueryEventArgs`).
