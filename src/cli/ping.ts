#!/usr/bin/env node
import { execRemote } from "./shared";

function printHelp(): void {
  // eslint-disable-next-line no-console
  console.log(`
runner-dev ping

Usage:
  runner-dev ping [--endpoint <url>] [--headers '<json>']
`);
}

export async function main(argv: string[]): Promise<void> {
  const args = argv.slice(3);
  if (args.length && ["-h", "--help", "help"].includes(args[0])) {
    printHelp();
    return;
  }
  const opts = new Map<string, string | boolean>();
  for (let i = 0; i < args.length; i++) {
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

  try {
    const result = await execRemote({
      endpoint,
      headersJson,
      query: "query { __typename }",
    });
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify(
        {
          ok: true,
          endpoint:
            endpoint ?? process.env.ENDPOINT ?? process.env.GRAPHQL_ENDPOINT,
          result,
        },
        null,
        2
      )
    );
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(
      JSON.stringify({ ok: false, error: (e as Error).message }, null, 2)
    );
    // eslint-disable-next-line no-process-exit
    process.exit(1);
  }
}

if (require.main === module) {
  void main(process.argv);
}
