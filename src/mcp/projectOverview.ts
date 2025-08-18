import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ENDPOINT } from "./env";
import { callGraphQL } from "./http";

type Maybe<T> = T | null | undefined;

function safeString(value: Maybe<unknown>): string | undefined {
  if (value == null) return undefined;
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function asString(value: Maybe<unknown>): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value
    : undefined;
}

function formatSchemaBlock(title: string, schemaReadable?: string): string[] {
  if (!schemaReadable || schemaReadable.trim().length === 0) return [];
  const lines: string[] = [];
  lines.push(`  - ${title}:`);
  lines.push("    ```");
  lines.push(
    ...schemaReadable.split("\n").map((l) => (l.length ? `    ${l}` : "    "))
  );
  lines.push("    ```");
  return lines;
}

function formatItem(params: {
  id: string;
  meta?: { title?: string | null; description?: string | null } | null;
  filePath?: string | null;
  schemaReadable?: string | null;
  schemaLabel?: string; // e.g., "input schema", "config schema", "payload schema"
  extra?: string[]; // additional bullet lines already indented with two spaces
}): string {
  const { id, meta, filePath, schemaReadable, schemaLabel, extra } = params;
  const title = asString(meta?.title) || id;
  const description = asString(meta?.description);

  const out: string[] = [];
  out.push(`- ${title} {${id}}`);
  if (description) out.push(`  - description: ${description}`);
  if (filePath) out.push(`  - file: ${filePath}`);
  if (Array.isArray(extra) && extra.length) out.push(...extra);
  if (schemaReadable) {
    out.push(
      ...formatSchemaBlock(schemaLabel || "schema", schemaReadable || undefined)
    );
  }
  return out.join("\n");
}

export function registerProjectOverview(server: McpServer) {
  server.registerTool(
    "project_overview",
    {
      title: "Project Overview (Markdown)",
      description:
        "Builds a dynamic Markdown overview by querying the GraphQL endpoint for tasks, resources, events, middleware, diagnostics and recent live telemetry.",
      inputSchema: {
        details: z.number().int().min(1).max(100).optional(),
        includeLive: z.boolean().optional(),
        last: z.number().int().min(1).max(200).optional(),
      },
    },
    async ({ details, includeLive, last }) => {
      const endpoint = ENDPOINT ?? "<set ENDPOINT>";
      const sampleSize = typeof details === "number" ? details : 10;
      const liveLast = typeof last === "number" ? last : 20;

      const query = `query Overview($liveLast: Int) {
  tasks { id meta { title description } filePath inputSchemaReadable }
  listeners { id meta { title description } event filePath inputSchemaReadable }
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

      const result = (await callGraphQL({
        query,
        variables: { liveLast },
      })) as any;

      const data = result?.data ?? {};
      const tasks = Array.isArray(data.tasks) ? data.tasks : [];
      const listeners = Array.isArray(data.listeners) ? data.listeners : [];
      const resources = Array.isArray(data.resources) ? data.resources : [];
      const middlewares = Array.isArray(data.middlewares)
        ? data.middlewares
        : [];
      const events = Array.isArray(data.events) ? data.events : [];
      const diagnostics = Array.isArray(data.diagnostics)
        ? data.diagnostics
        : [];
      const live = data.live ?? {};

      const diagBySeverity: Record<string, number> = {};
      for (const d of diagnostics) {
        const sev = String(d?.severity ?? "UNKNOWN");
        diagBySeverity[sev] = (diagBySeverity[sev] ?? 0) + 1;
      }

      const lines: string[] = [];
      lines.push(`# Runner Dev Project Overview`);
      lines.push("");
      lines.push(`Endpoint: ${endpoint}`);
      lines.push("");
      lines.push(`## Topology Summary`);
      lines.push(`- Tasks: ${tasks.length}`);
      lines.push(`- Listeners: ${listeners.length}`);
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
      lines.push(`## Sample Nodes (first ${sampleSize})`);

      if (tasks.length) {
        lines.push(`### Tasks`);
        for (const t of tasks.slice(0, sampleSize)) {
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

      if (listeners.length) {
        lines.push(`### Listeners`);
        for (const l of listeners.slice(0, sampleSize)) {
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
        for (const r of resources.slice(0, sampleSize)) {
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
        for (const m of middlewares.slice(0, sampleSize)) {
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
        for (const e of events.slice(0, sampleSize)) {
          const extra: string[] = [];
          const emittedBy = Array.isArray(e.emittedBy) ? e.emittedBy.length : 0;
          const listenedToBy = Array.isArray(e.listenedToBy)
            ? e.listenedToBy.length
            : 0;
          extra.push(
            `  - relations: emittedBy=${emittedBy}, listenedToBy=${listenedToBy}`
          );
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
        lines.push(`## Live (last ${liveLast})`);
        lines.push(`- Logs: ${logs.length}`);
        lines.push(`- Emissions: ${emissions.length}`);
        lines.push(`- Errors: ${errors.length}`);
        lines.push(`- Runs: ${runs.length}`);
        lines.push("");
      }

      return { content: [{ type: "text", text: lines.join("\n") }] };
    }
  );
}
