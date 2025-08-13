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

Environment:
  ENDPOINT or GRAPHQL_ENDPOINT   GraphQL endpoint URL
  ALLOW_MUTATIONS=true           Enable mutations tool
  HEADERS='{"Authorization":"Bearer ..."}'  Extra headers JSON

Examples:
  ENDPOINT=http://localhost:2000/graphql runner-dev mcp
  ALLOW_MUTATIONS=true HEADERS='{"Authorization":"Bearer token"}' runner-dev mcp
`);
    return;
  }

  if (subcommand === "mcp") {
    await import("./mcp.js");
    return;
  }

  // eslint-disable-next-line no-console
  console.error(`Unknown command: ${subcommand}`);
  process.exit(1);
}

void run();
