# Runner-Dev Compact Guide

Runner-Dev is the developer-facing toolkit for inspecting, querying, and debugging Runner apps through a docs UI, GraphQL endpoint, MCP server, live telemetry, and controlled hot-swapping. Use it when the task is about what a Runner app looks like at runtime, what the docs/AI layer sees, or how runner-dev exposes that information.

## Use This When

- The task touches `/docs/data`, docs UI, chat context, or agent-facing documentation.
- You need GraphQL or MCP access to runtime topology, telemetry, schema, or diagnostics.
- You are debugging telemetry, live events, durable metadata, hook targets, or lane surfaces.
- You are changing runner-dev CLI, MCP tools, docs payload shaping, or introspection behavior.

## Fastest Path To Success

1. Decide whether the target app is already running.
2. If it is running, prefer MCP or GraphQL before reading lots of source.
3. If it is package work, locate the subsystem first:
   - docs payloads and docs UI
   - introspector/store serialization
   - MCP/help tools
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
      port: 1337,
      maxEntries: 1000,
    }),
  ])
  .build();
```

Expected endpoints after the app starts:

- UI: `http://localhost:1337`
- GraphQL: `http://localhost:1337/graphql`
- Live stream: `http://localhost:1337/live/stream`
- Docs payload: `http://localhost:1337/docs/data`

## MCP Quickstart

Use MCP when the app is already running and exposing the Dev GraphQL endpoint.

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
```

First checks, in order:

1. `graphql.ping`
2. `project.overview`
3. `graphql.query`

Shell equivalents:

```bash
ENDPOINT=http://localhost:1337/graphql npx @bluelibs/runner-dev ping
ENDPOINT=http://localhost:1337/graphql npx @bluelibs/runner-dev overview --details 5
ENDPOINT=http://localhost:1337/graphql npx @bluelibs/runner-dev query 'query { tasks { id } resources { id } }' --format pretty
```

Notes:

- Keep `ALLOW_MUTATIONS=false` unless you intentionally need write access.
- Set `HEADERS` if the GraphQL endpoint requires auth.
- If `graphql.ping` fails, check that the app is running, the port is correct, and `HEADERS` is valid JSON.

## First Things To Inspect

If the app is running:

- Start from `/docs/data` when the question is about what the docs UI or AI sees.
- Use `project.overview` for a fast topology summary.
- Use GraphQL for focused reads, not giant dumps.
- Use live telemetry only with narrow limits such as `last: 10`.

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
      level
      message
      correlationId
    }
    errors(last: 10) {
      sourceKind
      message
      correlationId
    }
  }
}
```

## High-Value Source Files

When working inside `@bluelibs/runner-dev`, start here:

- `src/resources/routeHandlers/getDocsData.ts` for docs payloads and bundled context
- `src/resources/models/Introspector.ts` and related store initialization for topology
- `src/mcp/tools/*` for MCP help/query behavior
- `src/resources/live.resource.ts` and telemetry resources for live data
- `src/ui/src/components/Documentation/*` for docs/chat UI behavior
- `src/resources/swap.resource.ts` and `src/resources/swap.tools.ts` for hot-swapping surfaces

## Core Surfaces

- Docs UI: the browser surface for architecture, live data, and AI assistance
- `/docs/data`: the JSON payload feeding docs UI and in-app AI context
- GraphQL: the main runtime introspection surface
- MCP: the fastest AI-native access path when the app is already running
- Live telemetry: logs, emissions, errors, runs, and correlation-driven inspection
- Swap tooling: controlled runtime task replacement and restoration

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
- Use `pure: true` when validating swapped task behavior safely.
- Avoid huge live queries, broad schema dumps, or mutation access unless the task truly needs them.

## Go Deeper

- Read `README.md` for installation, CLI, and broader examples.
- Read the Runner skill for framework-level architecture and contracts.
- Read source near the touched surface before broadening to unrelated subsystems.
