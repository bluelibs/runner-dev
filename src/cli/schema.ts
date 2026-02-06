#!/usr/bin/env node
import { fetchIntrospectionJson } from "./shared";
import { fetchSchemaSDL } from "../mcp/schema";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { run } from "@bluelibs/runner";
import { graphqlCli } from "../resources/graphql.cli.resource";
import { getIntrospectionQuery, buildClientSchema, printSchema } from "graphql";
import { graphqlQueryCliTask } from "../resources/graphql.query.cli.task";
import { createGraphqlCliHarnessFromEntry } from "./harness";

function printHelp(): void {
  // eslint-disable-next-line no-console
  console.log(`
runner-dev schema

Usage:
  runner-dev schema sdl [--endpoint <url>] [--headers '<json>']
  runner-dev schema json [--endpoint <url>] [--headers '<json>']
  runner-dev schema sdl --entry-file <path> [--export <name>]
  runner-dev schema json --entry-file <path> [--export <name>]
`);
}

export async function main(argv: string[]): Promise<void> {
  const args = argv.slice(3);
  if (args.length === 0 || ["-h", "--help", "help"].includes(args[0])) {
    printHelp();
    return;
  }
  const sub = args[0];

  const opts = new Map<string, string | boolean>();
  for (let i = 1; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = args[i + 1];
      if (!next || next.startsWith("--")) {
        opts.set(key, true);
      } else {
        opts.set(key, next);
        i++;
      }
    }
  }

  const entryFile = (opts.get("entry-file") as string) || undefined;
  const exportName = (opts.get("export") as string) || undefined;

  const endpoint = (opts.get("endpoint") as string) || undefined;
  const headersJson = (opts.get("headers") as string) || undefined;

  try {
    // Mutual exclusivity: --entry-file and --endpoint cannot be combined
    if (entryFile && endpoint) {
      throw new Error(
        "Invalid options: --entry-file and --endpoint are mutually exclusive.\n" +
          "Use either a local entry (--entry-file) for dry-run or a remote endpoint (--endpoint), not both."
      );
    }

    // Support entry-file dry-run mode for schema as well
    if (entryFile) {
      const harness = await createGraphqlCliHarnessFromEntry(
        entryFile,
        exportName
      );
      try {
        if (sub === "sdl") {
          const intros = await harness.runTask(graphqlQueryCliTask.id, {
            query: getIntrospectionQuery(),
          });
          if (!intros?.ok || !intros?.data) {
            throw new Error(
              `Introspection failed: ${JSON.stringify(intros ?? {})}`
            );
          }
          const schema = buildClientSchema(intros.data as any);
          // eslint-disable-next-line no-console
          console.log(printSchema(schema));
          return;
        }
        if (sub === "json") {
          const intros = await harness.runTask(graphqlQueryCliTask.id, {
            query: getIntrospectionQuery(),
          });
          // eslint-disable-next-line no-console
          console.log(JSON.stringify(intros, null, 2));
          return;
        }
      } finally {
        try {
          await harness.dispose();
        } catch {}
      }
    }

    if (sub === "sdl") {
      if (endpoint) process.env.ENDPOINT = endpoint;
      if (headersJson) process.env.HEADERS = headersJson;
      const sdl = await fetchSchemaSDL();
      // eslint-disable-next-line no-console
      console.log(sdl);
      return;
    }
    if (sub === "json") {
      const json = await fetchIntrospectionJson(endpoint, headersJson);
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(json, null, 2));
      return;
    }
    printHelp();
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error((e as Error).message);
    process.exitCode = 1;
    return;
  }
}

if (require.main === module) {
  main(process.argv).catch((error: unknown) => {
    // eslint-disable-next-line no-console
    console.error((error as Error)?.message || String(error));
    process.exitCode = 1;
  });
}
