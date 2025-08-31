#!/usr/bin/env node
import "source-map-support/register";
import { c, alignRows, divider, indentLines } from "./cli/format";

const subcommand = process.argv[2];

async function run(): Promise<void> {
  if (!subcommand || ["help", "-h", "--help"].includes(subcommand)) {
    const title = c.title("runner-dev CLI");
    const usage = alignRows(
      [
        [c.cmd("runner-dev mcp"), "Start the MCP GraphQL server over stdio"],
        [c.cmd("runner-dev query"), "Run a GraphQL query against an endpoint"],
        [
          c.cmd("runner-dev new"),
          "Scaffold a new Runner TypeScript project (or populate existing directory)",
        ],
        [c.cmd("runner-dev overview"), "Print Markdown project overview"],
        [c.cmd("runner-dev schema"), "Print SDL or introspection JSON"],
        [c.cmd("runner-dev ping"), "Ping GraphQL endpoint"],
      ],
      { gap: 3, indent: 2 }
    );

    const headersExample = 'HEADERS=\'{"Authorization":"Bearer ..."}\'';
    const env = alignRows(
      [
        [c.bold("ENDPOINT / GRAPHQL_ENDPOINT"), "GraphQL endpoint URL"],
        [c.bold("ALLOW_MUTATIONS=true"), "Enable mutations tool"],
        [c.bold(headersExample), "Extra headers JSON"],
      ],
      { gap: 3, indent: 2 }
    );

    const examples = indentLines(
      [
        `${c.gray("# Start MCP over stdio against an endpoint")}`,
        `ENDPOINT=http://localhost:2000/graphql ${c.cmd("runner-dev mcp")}`,
        `${c.gray("# Add headers and enable mutations")}`,
        `ALLOW_MUTATIONS=true HEADERS='{"Authorization":"Bearer token"}' ${c.cmd(
          "runner-dev mcp"
        )}`,
        `${c.gray("# Query your GraphQL endpoint")}`,
        `ENDPOINT=http://localhost:1337/graphql ${c.cmd(
          "runner-dev query"
        )} 'query { tasks { id } }' --format pretty`,
        `${c.gray("# Print SDL")}`,
        `${c.cmd(
          "runner-dev schema sdl"
        )} --endpoint http://localhost:1337/graphql`,
      ].join("\n"),
      2
    );

    // eslint-disable-next-line no-console
    console.log(
      [
        "",
        title,
        divider(),
        c.bold("Usage"),
        usage,
        "",
        c.bold("Environment"),
        env,
        "",
        c.bold("Examples"),
        examples,
        "",
      ].join("\n")
    );
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
