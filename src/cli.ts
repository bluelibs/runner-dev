#!/usr/bin/env node
import "source-map-support/register";

const subcommand = process.argv[2];

async function run(): Promise<void> {
  if (!subcommand || ["help", "-h", "--help"].includes(subcommand)) {
    // eslint-disable-next-line no-console
    console.log(`
runner-dev CLI

Usage:
  runner-dev mcp        Start the MCP GraphQL server over stdio
  runner-dev query      Run a GraphQL query against an endpoint
  runner-dev new        Scaffold a new Runner TypeScript project (or populate existing directory)
  runner-dev overview   Print Markdown project overview
  runner-dev schema     Print SDL or introspection JSON
  runner-dev ping       Ping GraphQL endpoint

Environment:
  ENDPOINT or GRAPHQL_ENDPOINT   GraphQL endpoint URL
  ALLOW_MUTATIONS=true           Enable mutations tool
  HEADERS='{"Authorization":"Bearer ..."}'  Extra headers JSON

Examples:
  ENDPOINT=http://localhost:2000/graphql runner-dev mcp
  ALLOW_MUTATIONS=true HEADERS='{"Authorization":"Bearer token"}' runner-dev mcp
  ENDPOINT=http://localhost:1337/graphql runner-dev query 'query { tasks { id } }'
  runner-dev schema sdl --endpoint http://localhost:1337/graphql
`);
    return;
  }

  if (subcommand === "mcp") {
    await import("./mcp.js");
    return;
  }

  if (subcommand === "query") {
    const mod = await import("./cli/query.js");
    await mod.main(process.argv);
    return;
  }

  if (subcommand === "new") {
    const mod = await import("./cli/init.js");
    await mod.main(process.argv);
    return;
  }

  if (subcommand === "overview") {
    const mod = await import("./cli/overview.js");
    await mod.main(process.argv);
    return;
  }

  if (subcommand === "schema") {
    const mod = await import("./cli/schema.js");
    await mod.main(process.argv);
    return;
  }

  if (subcommand === "ping") {
    const mod = await import("./cli/ping.js");
    await mod.main(process.argv);
    return;
  }

  // eslint-disable-next-line no-console
  console.error(`Unknown command: ${subcommand}`);
  process.exit(1);
}

void run();
