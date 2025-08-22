#!/usr/bin/env node
import "source-map-support/register";
import { fetchIntrospectionJson } from "./shared";
import { fetchSchemaSDL } from "../mcp/schema";

function printHelp(): void {
  // eslint-disable-next-line no-console
  console.log(`
runner-dev schema

Usage:
  runner-dev schema sdl [--endpoint <url>] [--headers '<json>']
  runner-dev schema json [--endpoint <url>] [--headers '<json>']
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

  const endpoint = (opts.get("endpoint") as string) || undefined;
  const headersJson = (opts.get("headers") as string) || undefined;

  try {
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
    // eslint-disable-next-line no-process-exit
    process.exit(1);
  }
}

if (require.main === module) {
  void main(process.argv);
}
