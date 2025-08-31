#!/usr/bin/env node
import "source-map-support/register";
import {
  execRemote,
  parseVariablesOption,
  formatOutput,
  applyNamespaceFilter,
} from "./shared";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { run } from "@bluelibs/runner";
import { graphqlCli } from "../resources/graphql.cli.resource";

function printHelp(): void {
  // eslint-disable-next-line no-console
  console.log(`
runner-dev query

Usage:
  runner-dev query '<graphql>' [--variables '{"id":"..."}'] [--operation Name]

Options:
  --endpoint <url>        GraphQL endpoint (or use ENDPOINT/GRAPHQL_ENDPOINT)
  --headers '<json>'      Extra HTTP headers as JSON (or HEADERS env)
  --variables '<json>'    Variables JSON
  --operation <name>      Operation name if multiple
  --format <fmt>          data|json|pretty (default: data)
  --raw                   Output full GraphQL response (with errors)
  --namespace <str>       Convenience filter for idIncludes
  --entry-file <path>     TS entry file exporting default or named app
  --export <name>         Named export to use (default export preferred)
`);
}

export async function main(argv: string[]): Promise<void> {
  const args = argv.slice(3); // node dist/cli.js query ...
  if (args.length === 0 || ["-h", "--help", "help"].includes(args[0])) {
    printHelp();
    return;
  }

  let query = args[0];
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

  const endpoint = (opts.get("endpoint") as string) || undefined;
  const headersJson = (opts.get("headers") as string) || undefined;
  const entryFile = (opts.get("entry-file") as string) || undefined;
  const exportName = (opts.get("export") as string) || undefined;
  const variables = parseVariablesOption(
    opts.get("variables") as string | undefined
  );
  const operationName = (opts.get("operation") as string) || undefined;
  const format = ((opts.get("format") as string) || "data") as any;
  const raw = Boolean(opts.get("raw"));
  const namespace = (opts.get("namespace") as string) || undefined;

  if (namespace) {
    query = applyNamespaceFilter(query, namespace);
  }

  try {
    // Prefer dry-run entry-file mode when provided
    if (entryFile) {
      // Auto-load TypeScript; require ts-node/register/transpile-only
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        require("ts-node/register/transpile-only");
      } catch (e) {
        throw new Error(
          `TypeScript loader not available. Please install ts-node. Original error: ${
            (e as Error).message
          }`
        );
      }

      const abs = path.isAbsolute(entryFile)
        ? entryFile
        : path.resolve(process.cwd(), entryFile);
      const mod = await import(pathToFileURL(abs).href);
      const entry =
        (exportName ? mod?.[exportName] : mod?.default) ?? mod?.app ?? null;
      if (!entry) {
        throw new Error(
          `Entry not found. Provide a default export or use --export <name>.`
        );
      }

      // First pass: dry-run to get the Store
      const dry = await run(entry, { dryRun: true });
      const customStore = dry.store;
      if (!customStore) {
        throw new Error("Dry-run did not return a store.");
      }

      // Second pass: run the GraphQL harness with the custom store
      const harness = await run(graphqlCli.with({ customStore }));
      try {
        const res = await harness.runTask("runner-dev.tasks.graphqlQueryCli", {
          query,
          variables,
          operationName,
        });
        const envelope = {
          data: res?.ok ? res?.data ?? null : null,
          errors: res?.ok
            ? undefined
            : Array.isArray(res?.errors)
            ? res?.errors?.map((m: any) => ({ message: String(m) }))
            : undefined,
        };

        if (!raw && envelope?.errors?.length) {
          // eslint-disable-next-line no-console
          console.error(JSON.stringify(envelope.errors, null, 2));
          // eslint-disable-next-line no-process-exit
          process.exit(1);
        }
        // eslint-disable-next-line no-console
        console.log(formatOutput(envelope, { format, raw }));
      } finally {
        try {
          await harness.dispose();
        } catch {}
      }
      return;
    }

    // Fallback to remote endpoint execution
    const result = await execRemote({
      endpoint,
      headersJson,
      query,
      variables,
      operationName,
    });
    if (!raw && result?.errors?.length) {
      // eslint-disable-next-line no-console
      console.error(JSON.stringify(result.errors, null, 2));
      // eslint-disable-next-line no-process-exit
      process.exit(1);
    }
    // eslint-disable-next-line no-console
    console.log(formatOutput(result, { format, raw }));
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error((e as Error).message);
    // eslint-disable-next-line no-process-exit
    process.exit(1);
  }
}

if (require.main === module) {
  void main(process.argv);
}
