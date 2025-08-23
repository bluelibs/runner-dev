#!/usr/bin/env node
import "source-map-support/register";
import {
  execRemote,
  parseVariablesOption,
  formatOutput,
  applyNamespaceFilter,
} from "./shared";

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
