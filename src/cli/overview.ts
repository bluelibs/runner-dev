#!/usr/bin/env node
import "source-map-support/register";
import {
  execRemote,
  resolveEndpoint,
  resolveHeaders,
  applyNamespaceFilter,
} from "./shared";

function printHelp(): void {
  // eslint-disable-next-line no-console
  console.log(`
runner-dev overview

Usage:
  runner-dev overview [--details 10] [--include-live] [--namespace ns]

Options:
  --endpoint <url>     GraphQL endpoint (or use ENDPOINT/GRAPHQL_ENDPOINT)
  --headers '<json>'   Extra HTTP headers as JSON (or HEADERS env)
  --details <n>        Sample size per section (default 10)
  --include-live       Include live counters (logs/emissions/errors/runs)
  --namespace <str>    Filter nodes by idIncludes (client-side)
`);
}

export async function main(argv: string[]): Promise<void> {
  const args = argv.slice(3);
  if (
    args.length === 0 &&
    process.env.ENDPOINT == null &&
    process.env.GRAPHQL_ENDPOINT == null
  ) {
    // Show help if nothing is set
    printHelp();
    return;
  }
  if (args[0] && ["-h", "--help", "help"].includes(args[0])) {
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
  const details = Number(opts.get("details") ?? 10);
  const includeLive = Boolean(opts.get("include-live"));
  const namespace = (opts.get("namespace") as string) || undefined;

  const query = `query Overview($liveLast: Int) {
  tasks { id meta { title description } filePath inputSchemaReadable }
  hooks { id meta { title description } events filePath inputSchemaReadable }
  resources { id meta { title description } filePath configSchemaReadable }
  middlewares { id meta { title description } filePath configSchemaReadable }
  events { id meta { title description } filePath payloadSchemaReadable emittedBy listenedToBy }
  diagnostics { severity code message nodeId nodeKind }
  live {
    logs(last: $liveLast) { timestampMs level message correlationId }
    emissions(last: $liveLast) { timestampMs eventId emitterId correlationId }
    errors(last: $liveLast) { timestampMs sourceKind message correlationId }
    runs(last: $liveLast) { timestampMs nodeId nodeKind ok correlationId }
  }
}`;

  try {
    const endpointResolved = resolveEndpoint(endpoint);
    const _headers = resolveHeaders(headersJson); // validates
    const out = await execRemote({
      endpoint: endpointResolved,
      headersJson,
      query,
    });
    if (out?.errors?.length) {
      // eslint-disable-next-line no-console
      console.error(JSON.stringify(out.errors, null, 2));
      // eslint-disable-next-line no-process-exit
      process.exit(1);
    }
    const data = out?.data ?? {};

    const tasks = (Array.isArray(data.tasks) ? data.tasks : []).filter(
      (x: any) => !namespace || String(x.id).includes(namespace)
    );
    const hooks = (Array.isArray(data.hooks) ? data.hooks : []).filter(
      (x: any) => !namespace || String(x.id).includes(namespace)
    );
    const resources = (
      Array.isArray(data.resources) ? data.resources : []
    ).filter((x: any) => !namespace || String(x.id).includes(namespace));
    const middlewares = (
      Array.isArray(data.middlewares) ? data.middlewares : []
    ).filter((x: any) => !namespace || String(x.id).includes(namespace));
    const events = (Array.isArray(data.events) ? data.events : []).filter(
      (x: any) => !namespace || String(x.id).includes(namespace)
    );
    const diagnostics = Array.isArray(data.diagnostics) ? data.diagnostics : [];
    const live = data.live ?? {};

    const diagBySeverity: Record<string, number> = {};
    for (const d of diagnostics) {
      const sev = String(d?.severity ?? "UNKNOWN");
      diagBySeverity[sev] = (diagBySeverity[sev] ?? 0) + 1;
    }

    const lines: string[] = [];
    lines.push(`# Runner Dev Project Overview`);
    lines.push("");
    lines.push(`Endpoint: ${endpointResolved}`);
    lines.push("");
    lines.push(`## Topology Summary`);
    lines.push(`- Tasks: ${tasks.length}`);
    lines.push(`- Hooks: ${hooks.length}`);
    lines.push(`- Resources: ${resources.length}`);
    lines.push(`- Middleware: ${middlewares.length}`);
    lines.push(`- Events: ${events.length}`);
    lines.push(`- Diagnostics: ${diagnostics.length}`);
    if (Object.keys(diagBySeverity).length) {
      const sevStr = Object.entries(diagBySeverity)
        .map(([k, v]) => `${k}=${v}`)
        .join(", ");
      lines.push(`  - By severity: ${sevStr}`);
    }
    lines.push("");
    lines.push(`## Sample Nodes (first ${details})`);

    function asString(v: any): string | undefined {
      return typeof v === "string" && v.trim().length ? v : undefined;
    }
    function safeString(v: any): string | undefined {
      if (v == null) return undefined;
      if (typeof v === "string") return v;
      try {
        return JSON.stringify(v);
      } catch {
        return String(v);
      }
    }
    function formatSchemaBlock(
      title: string,
      schemaReadable?: string
    ): string[] {
      if (!schemaReadable || schemaReadable.trim().length === 0) return [];
      const out: string[] = [];
      out.push(`  - ${title}:`);
      out.push("    ```");
      for (const l of schemaReadable.split("\n"))
        out.push(l.length ? `    ${l}` : "    ");
      out.push("    ```");
      return out;
    }
    function formatItem(p: {
      id: string;
      meta?: any;
      filePath?: string;
      schemaReadable?: string;
      schemaLabel?: string;
      extra?: string[];
    }): string {
      const title = asString(p.meta?.title) || p.id;
      const description = asString(p.meta?.description);
      const out: string[] = [];
      out.push(`- ${title} {${p.id}}`);
      if (description) out.push(`  - description: ${description}`);
      if (p.filePath) out.push(`  - file: ${p.filePath}`);
      if (Array.isArray(p.extra) && p.extra.length) out.push(...p.extra);
      if (p.schemaReadable)
        out.push(
          ...formatSchemaBlock(p.schemaLabel || "schema", p.schemaReadable)
        );
      return out.join("\n");
    }

    if (tasks.length) {
      lines.push(`### Tasks`);
      for (const t of tasks.slice(0, details)) {
        lines.push(
          formatItem({
            id: String(t.id),
            meta: t.meta,
            filePath: safeString(t.filePath),
            schemaReadable: asString(t.inputSchemaReadable),
            schemaLabel: "input schema",
          })
        );
      }
      lines.push("");
    }
    if (hooks.length) {
      lines.push(`### Hooks`);
      for (const l of hooks.slice(0, details)) {
        const extra: string[] = [];
        if (l.event) extra.push(`  - event: ${String(l.event)}`);
        lines.push(
          formatItem({
            id: String(l.id),
            meta: l.meta,
            filePath: safeString(l.filePath),
            schemaReadable: asString(l.inputSchemaReadable),
            schemaLabel: "input schema",
            extra,
          })
        );
      }
      lines.push("");
    }
    if (resources.length) {
      lines.push(`### Resources`);
      for (const r of resources.slice(0, details)) {
        lines.push(
          formatItem({
            id: String(r.id),
            meta: r.meta,
            filePath: safeString(r.filePath),
            schemaReadable: asString(r.configSchemaReadable),
            schemaLabel: "config schema",
          })
        );
      }
      lines.push("");
    }
    if (middlewares.length) {
      lines.push(`### Middleware`);
      for (const m of middlewares.slice(0, details)) {
        lines.push(
          formatItem({
            id: String(m.id),
            meta: m.meta,
            filePath: safeString(m.filePath),
            schemaReadable: asString(m.configSchemaReadable),
            schemaLabel: "config schema",
          })
        );
      }
      lines.push("");
    }
    if (events.length) {
      lines.push(`### Events`);
      for (const e of events.slice(0, details)) {
        const emittedBy = Array.isArray(e.emittedBy) ? e.emittedBy.length : 0;
        const listenedToBy = Array.isArray(e.listenedToBy)
          ? e.listenedToBy.length
          : 0;
        const extra = [
          `  - relations: emittedBy=${emittedBy}, listenedToBy=${listenedToBy}`,
        ];
        lines.push(
          formatItem({
            id: String(e.id),
            meta: e.meta,
            filePath: safeString(e.filePath),
            schemaReadable: asString(e.payloadSchemaReadable),
            schemaLabel: "payload schema",
            extra,
          })
        );
      }
      lines.push("");
    }

    if (includeLive) {
      const logs = Array.isArray(live.logs) ? live.logs : [];
      const emissions = Array.isArray(live.emissions) ? live.emissions : [];
      const errors = Array.isArray(live.errors) ? live.errors : [];
      const runs = Array.isArray(live.runs) ? live.runs : [];
      lines.push(`## Live (last 20)`);
      lines.push(`- Logs: ${logs.length}`);
      lines.push(`- Emissions: ${emissions.length}`);
      lines.push(`- Errors: ${errors.length}`);
      lines.push(`- Runs: ${runs.length}`);
      lines.push("");
    }

    // eslint-disable-next-line no-console
    console.log(lines.join("\n"));
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
