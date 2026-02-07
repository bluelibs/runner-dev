#!/usr/bin/env node
import {
  execRemote,
  parseVariablesOption,
  formatOutput,
  applyNamespaceFilter,
} from "./shared";
import { graphqlQueryCliTask } from "../resources/graphql.query.cli.task";
import { createGraphqlCliHarnessFromEntry } from "./harness";

function printHelp(): void {
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
  --pretty                Shorthand for --format pretty
  --raw                   Output full GraphQL response (with errors)
  --namespace <str>       Convenience filter for idIncludes
  --entry-file <path>     TS entry file exporting default or named app
  --export <name>         Named export to use (default export preferred)

 Modes & selection:
  - If --entry-file is provided, dry-run mode is used (no server). A TS runtime (tsx or ts-node) must be available.
  - Otherwise, a remote endpoint is used via --endpoint or ENDPOINT/GRAPHQL_ENDPOINT.
  - Do not combine --entry-file and --endpoint (mutually exclusive).
  - If neither is provided, the command errors.
`);
}

export async function main(argv: string[]): Promise<void> {
  const args = argv.slice(3); // node dist/cli.js query ...
  if (args.length === 0 || ["-h", "--help", "help"].includes(args[0])) {
    printHelp();
    return;
  }

  // Support two styles:
  // 1) positional query followed by flags: `query '<gql>' --variables ...`
  // 2) flags-only first (e.g. --entry-file) where no positional query is provided
  let query = args[0] ?? "";
  let startIndex = 1;
  const flagsFirst = Boolean(args[0] && args[0].startsWith("--"));
  if (flagsFirst) {
    query = "";
    startIndex = 0;
  }

  const opts = new Map<string, string | boolean>();
  const leftover: string[] = [];
  for (let i = startIndex; i < args.length; i++) {
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
    } else {
      // Track leftover positional tokens that appear when flags are first
      leftover.push(a);
    }
  }

  if (flagsFirst && leftover.length > 0) {
    // Provide a clear error: positional query must be first
    throw new Error(
      "Positional GraphQL query must be the first argument (index 0).\n" +
        "When using flags before the query, do not pass a positional query after flags.\n" +
        "Examples:\n  runner-dev query 'query { tasks { id } }' --entry-file ./src/main.ts\n  runner-dev query --entry-file ./src/main.ts --export app (dry-run without positional query)"
    );
  }

  const endpoint = (opts.get("endpoint") as string) || undefined;
  const headersJson = (opts.get("headers") as string) || undefined;
  const entryFile = (opts.get("entry-file") as string) || undefined;
  const exportName = (opts.get("export") as string) || undefined;
  const variables = parseVariablesOption(
    opts.get("variables") as string | undefined
  );
  const operationName = (opts.get("operation") as string) || undefined;
  // Support --pretty alias for convenience
  const prettyAlias = opts.has("pretty") ? "pretty" : undefined;
  const format = (prettyAlias ||
    (opts.get("format") as string) ||
    "data") as any;
  const raw = Boolean(opts.get("raw"));
  const namespace = (opts.get("namespace") as string) || undefined;

  if (namespace && query) {
    query = applyNamespaceFilter(query, namespace);
  }

  try {
    // Mutual exclusivity: --entry-file and --endpoint cannot be combined
    if (entryFile && endpoint) {
      throw new Error(
        "Invalid options: --entry-file and --endpoint are mutually exclusive.\n" +
          "Use either a local entry (--entry-file) for dry-run or a remote endpoint (--endpoint), not both."
      );
    }

    // Prefer dry-run entry-file mode when provided
    if (entryFile) {
      const harness = await createGraphqlCliHarnessFromEntry(
        entryFile,
        exportName
      );
      try {
        const res = await harness.runTask(graphqlQueryCliTask.id, {
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
          console.error(JSON.stringify(envelope.errors, null, 2));
          process.exitCode = 1;
          return;
        }

        console.log(formatOutput(envelope, { format, raw }));
      } finally {
        try {
          await harness.dispose();
        } catch {
          /* intentionally empty */
        }
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
      console.error(JSON.stringify(result.errors, null, 2));
      process.exitCode = 1;
      return;
    }

    console.log(formatOutput(result, { format, raw }));
  } catch (e) {
    console.error((e as Error).message);
    process.exitCode = 1;
    return;
  }
}

if (require.main === module) {
  main(process.argv).catch((error: unknown) => {
    console.error((error as Error)?.message || String(error));
    process.exitCode = 1;
  });
}
