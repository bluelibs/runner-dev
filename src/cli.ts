#!/usr/bin/env -S node --enable-source-maps
import { c, alignRows, divider, indentLines } from "./cli/format";
import version from "./version";
import { writeSync } from "node:fs";

// Allow running the CLI directly via ts-node without a JS build.
// Detect TS runtime by the current filename extension.
const isTsRuntime =
  typeof __filename === "string" && __filename.endsWith(".ts");

async function loadModule(basePath: string): Promise<any> {
  if (isTsRuntime) {
    // In ts-node runtime, .ts requires should already be hooked. Try CJS require first.
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require(`${basePath}.ts`);
    } catch {
      // Fall back to dynamic import if available in the environment
      return await import(`${basePath}.ts`);
    }
  }
  // Built JS path: prefer sync require to avoid early process exit
  // when stdout/stderr are piped and the entrypoint is fire-and-forget.
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require(`${basePath}.js`);
  } catch {
    return await import(`${basePath}.js`);
  }
}

const subcommand = process.argv[2];

async function run(): Promise<void> {
  // Global version flags
  if (["-v", "--version", "version"].includes(subcommand || "")) {
    writeSync(1, `${version}\n`);
    return;
  }

  if (!subcommand || ["help", "-h", "--help"].includes(subcommand)) {
    const title = c.title("runner-dev CLI");
    const usage = alignRows(
      [
        [c.cmd("runner-dev mcp"), "Start the MCP GraphQL server over stdio"],
        [
          c.cmd("runner-dev query"),
          "Run a GraphQL query (endpoint or dry-run entry)",
        ],
        [
          c.cmd("runner-dev new"),
          "Scaffold project or artifacts: project | resource | task | event | hook | tag | task-middleware | resource-middleware",
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
        `${c.gray("# Or run in dry‑run mode with a TS entry (no server)")}`,
        `${c.cmd(
          "runner-dev query"
        )} 'query { tasks { id } }' --entry-file ./src/main.ts`,
        `${c.gray("# Print SDL")}`,
        `${c.cmd(
          "runner-dev schema sdl"
        )} --endpoint http://localhost:1337/graphql`,
        `${c.gray("# Scaffold a project (default)")}`,
        `${c.cmd("runner-dev new my-app")} ${c.gray(
          "# same as 'new project my-app'"
        )}`,
        `${c.gray("# Scaffold artifacts in an existing repo")}`,
        `${c.cmd(
          "runner-dev new resource user-service --ns app --dir src --export"
        )}`,
        `${c.cmd(
          "runner-dev new task create-user --ns app.users --dir src --export"
        )}`,
        `${c.cmd(
          "runner-dev new event user-registered --ns app.users --dir src --export"
        )}`,
        `${c.cmd(
          "runner-dev new hook send-welcome --ns app.users --dir src --export"
        )}`,
        `${c.cmd("runner-dev new tag http --ns app.web --dir src --export")}`,
        `${c.cmd(
          "runner-dev new task-middleware auth --ns app --dir src --export"
        )}`,
        `${c.cmd(
          "runner-dev new resource-middleware soft-delete --ns app --dir src --export"
        )}`,
      ].join("\n"),
      2
    );

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
    await loadModule("./mcp");
    return;
  }

  if (subcommand === "query") {
    const mod = await loadModule("./cli/query");
    await mod.main(process.argv);
    return;
  }

  if (subcommand === "new") {
    const mod = await loadModule("./cli/init");
    await mod.main(process.argv);
    return;
  }

  if (subcommand === "overview") {
    const mod = await loadModule("./cli/overview");
    await mod.main(process.argv);
    return;
  }

  if (subcommand === "schema") {
    const mod = await loadModule("./cli/schema");
    await mod.main(process.argv);
    return;
  }

  if (subcommand === "ping") {
    const mod = await loadModule("./cli/ping");
    await mod.main(process.argv);
    return;
  }

  console.error(`Unknown command: ${subcommand}`);
  process.exitCode = 1;
}

run().catch((error: unknown) => {
  console.error((error as Error)?.message || String(error));
  process.exitCode = 1;
});
