import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  buildClientSchema,
  getIntrospectionQuery,
  IntrospectionQuery,
  printSchema,
} from "graphql";
import { ENDPOINT, ALLOW_MUTATIONS, assertEndpoint } from "./mcp/env";
import { callGraphQL, toVariables } from "./mcp/http";
import { formatGraphQLResultAsMarkdown } from "./mcp/format";
import { fetchSchemaSDL } from "./mcp/schema";
import {
  buildTOC,
  extractSectionByHeading,
  extractSectionsByHeadings,
  readDocContent,
  readPackageDoc,
} from "./mcp/help";

// Create an MCP server
const server = new McpServer({
  name: "runner_dev",
  version: "1.0.0",
});

// GraphQL Query tool (read-only)
server.registerTool(
  "graphql_query",
  {
    title: "GraphQL Query",
    description: "Execute a GraphQL query against the configured ENDPOINT",
    inputSchema: {
      query: z.string(),
      variables: z.union([z.string(), z.record(z.unknown())]).optional(),
      operationName: z.string().optional(),
      format: z.enum(["json", "markdown"]).optional(),
      markdownStyle: z.enum(["summary", "story"]).optional(),
      maxItems: z.number().int().min(1).max(100).optional(),
      title: z.string().optional(),
    },
  },
  async ({
    query,
    variables,
    operationName,
    format,
    markdownStyle,
    maxItems,
    title,
  }) => {
    if (/\bmutation\b/i.test(query)) {
      throw new Error("Use graphql.mutation tool for mutations");
    }
    const result = await callGraphQL({
      query,
      variables: toVariables(variables),
      operationName,
    });
    if (format === "markdown") {
      const md = formatGraphQLResultAsMarkdown(result, {
        style: markdownStyle === "story" ? "story" : "summary",
        maxItems: typeof maxItems === "number" ? maxItems : 10,
        title: title || "GraphQL Query Result",
      });
      return { content: [{ type: "text", text: md }] };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

// Help: expose README.md and AI.md, and external package README (eg @bluelibs/runner)
server.registerTool(
  "help_read",
  {
    title: "Help Documentation",
    description:
      "Read documentation: 'runner-dev' (this app's docs), 'runner' (framework docs), or custom package docs. Supports filtering by heading and TOC generation.",
    inputSchema: {
      // Predefined docs or custom package
      doc: z.enum(["runner-dev", "runner"]).optional(),
      packageName: z.string().optional(),
      packageDocPath: z.string().optional(),
      // formatting helpers
      headingIncludes: z.union([z.string(), z.array(z.string())]).optional(),
      toc: z.boolean().optional(),
    },
  },
  async ({ doc, packageName, packageDocPath, headingIncludes, toc }) => {
    let content = "";
    let filePath = "";

    if (packageName) {
      const pkg = await readPackageDoc(
        packageName,
        packageDocPath || "README.md"
      );
      content = pkg.content;
      filePath = pkg.filePath;
    } else if (doc === "runner") {
      // Read @bluelibs/runner framework documentation
      const pkg = await readPackageDoc("@bluelibs/runner", "README.md");
      content = pkg.content;
      filePath = pkg.filePath;
    } else {
      // Default to runner-dev docs (local README.md and AI.md combined)
      const readmeRes = await readDocContent("readme");
      const aiRes = await readDocContent("ai");

      const sections = [];
      if (readmeRes.content) {
        sections.push(`# Runner-Dev Application\n\n${readmeRes.content}`);
      }
      if (aiRes.content) {
        sections.push(`# AI Assistant Guide\n\n${aiRes.content}`);
      }

      content = sections.join("\n\n---\n\n");
      filePath = `${readmeRes.filePath} + ${aiRes.filePath}`;
    }

    if (!content) {
      return {
        content: [
          { type: "text", text: `Document not found or empty: ${filePath}` },
        ],
      };
    }

    if (toc) {
      const lines = [`# Table of Contents`, "", ...buildTOC(content)];
      return { content: [{ type: "text", text: lines.join("\n") }] };
    }

    if (headingIncludes) {
      const headingQueries = Array.isArray(headingIncludes)
        ? headingIncludes
        : [headingIncludes];

      // Filter out empty strings
      const validQueries = headingQueries.filter(
        (q) => typeof q === "string" && q.trim().length > 0
      );

      if (validQueries.length > 0) {
        const section = extractSectionsByHeadings(content, validQueries);
        return { content: [{ type: "text", text: section || "" }] };
      }
    }

    return { content: [{ type: "text", text: content }] };
  }
);

// Quick access tools for the two main documentation types
server.registerTool(
  "help_runner",
  {
    title: "Runner Framework Documentation",
    description:
      "Read the official @bluelibs/runner framework documentation. Use 'toc: true' for table of contents or 'headingIncludes' to filter sections.",
    inputSchema: {
      headingIncludes: z.union([z.string(), z.array(z.string())]).optional(),
      toc: z.boolean().optional(),
    },
  },
  async ({ headingIncludes, toc }) => {
    const pkg = await readPackageDoc("@bluelibs/runner", "AI.md");
    let content = pkg.content;

    if (!content) {
      return {
        content: [
          {
            type: "text",
            text: `Runner framework documentation not found: ${pkg.filePath}`,
          },
        ],
      };
    }

    if (toc) {
      const lines = [
        `# Runner Framework - Table of Contents`,
        "",
        ...buildTOC(content),
      ];
      return { content: [{ type: "text", text: lines.join("\n") }] };
    }

    if (headingIncludes) {
      const headingQueries = Array.isArray(headingIncludes)
        ? headingIncludes
        : [headingIncludes];

      // Filter out empty strings
      const validQueries = headingQueries.filter(
        (q) => typeof q === "string" && q.trim().length > 0
      );

      if (validQueries.length > 0) {
        const section = extractSectionsByHeadings(content, validQueries);
        content = section || content;
      }
    }

    return {
      content: [
        {
          type: "text",
          text: `# Runner Framework Documentation\n\n${content}`,
        },
      ],
    };
  }
);

server.registerTool(
  "help_runner_dev",
  {
    title: "Runner-Dev Application Guide",
    description:
      "Read Runner-Dev application documentation including GraphQL API guide, MCP tools, and AI assistant instructions.",
    inputSchema: {
      headingIncludes: z.union([z.string(), z.array(z.string())]).optional(),
      toc: z.boolean().optional(),
    },
  },
  async ({ headingIncludes, toc }) => {
    const readmeRes = await readDocContent("readme");
    const aiRes = await readDocContent("ai");

    const sections = [];
    if (readmeRes.content) {
      sections.push(`# Runner-Dev Application\n\n${readmeRes.content}`);
    }
    if (aiRes.content) {
      sections.push(`# AI Assistant Guide\n\n${aiRes.content}`);
    }

    const content = sections.join("\n\n---\n\n");

    if (!content) {
      return {
        content: [
          {
            type: "text",
            text: "Runner-Dev documentation not found. Please ensure README.md and AI.md exist.",
          },
        ],
      };
    }

    if (toc) {
      const lines = [
        `# Runner-Dev Documentation - Table of Contents`,
        "",
        ...buildTOC(content),
      ];
      return { content: [{ type: "text", text: lines.join("\n") }] };
    }

    if (headingIncludes) {
      const headingQueries = Array.isArray(headingIncludes)
        ? headingIncludes
        : [headingIncludes];

      // Filter out empty strings
      const validQueries = headingQueries.filter(
        (q) => typeof q === "string" && q.trim().length > 0
      );

      if (validQueries.length > 0) {
        const section = extractSectionsByHeadings(content, validQueries);
        return { content: [{ type: "text", text: section || content }] };
      }
    }

    return { content: [{ type: "text", text: content }] };
  }
);

// GraphQL Mutation tool (guarded by ALLOW_MUTATIONS)
server.registerTool(
  "graphql_mutation",
  {
    title: "GraphQL Mutation",
    description:
      "Execute a GraphQL mutation against the configured ENDPOINT. Requires ALLOW_MUTATIONS=true",
    inputSchema: {
      mutation: z.string(),
      variables: z.union([z.string(), z.record(z.unknown())]).optional(),
      operationName: z.string().optional(),
      format: z.enum(["json", "markdown"]).optional(),
      markdownStyle: z.enum(["summary", "story"]).optional(),
      maxItems: z.number().int().min(1).max(100).optional(),
      title: z.string().optional(),
    },
  },
  async ({
    mutation,
    variables,
    operationName,
    format,
    markdownStyle,
    maxItems,
    title,
  }) => {
    if (!ALLOW_MUTATIONS) {
      throw new Error(
        "Mutations are disabled. Set ALLOW_MUTATIONS=true to enable."
      );
    }
    const result = await callGraphQL({
      query: mutation,
      variables: toVariables(variables),
      operationName,
    });
    if (format === "markdown") {
      const md = formatGraphQLResultAsMarkdown(result, {
        style: markdownStyle === "story" ? "story" : "summary",
        maxItems: typeof maxItems === "number" ? maxItems : 10,
        title: title || "GraphQL Mutation Result",
      });
      return { content: [{ type: "text", text: md }] };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

// Introspection tool
server.registerTool(
  "graphql_introspect",
  {
    title: "GraphQL Introspection",
    description: "Fetch GraphQL schema via standard introspection query",
    inputSchema: {},
  },
  async () => {
    const introspectionQuery = getIntrospectionQuery();
    const result = await callGraphQL({ query: introspectionQuery });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

// Schema (SDL) tool - compact, human-readable
server.registerTool(
  "graphql_schema_sdl",
  {
    title: "GraphQL Schema (SDL)",
    description:
      "Return the GraphQL schema as SDL string (compact, fewer tokens than JSON introspection)",
    inputSchema: {},
  },
  async () => {
    const sdl = await fetchSchemaSDL();
    return { content: [{ type: "text", text: sdl }] };
  }
);

// Ping tool to check connectivity
server.registerTool(
  "graphql_ping",
  {
    title: "GraphQL Ping",
    description: "Verify the GraphQL endpoint is reachable",
    inputSchema: {},
  },
  async () => {
    const result = await callGraphQL({ query: "query { __typename }" });
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            { ok: true, result, endpoint: assertEndpoint() },
            null,
            2
          ),
        },
      ],
    };
  }
);

// High-level project overview for AIs in Markdown format
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
  tasks { id meta { title description } filePath }
  listeners { id meta { title description } event }
  resources { id meta { title description } filePath }
  middlewares { id meta { title description } }
  events { id meta { title description } emittedBy listenedToBy }
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
    const middlewares = Array.isArray(data.middlewares) ? data.middlewares : [];
    const events = Array.isArray(data.events) ? data.events : [];
    const diagnostics = Array.isArray(data.diagnostics) ? data.diagnostics : [];
    const live = data.live ?? {};

    const diagBySeverity: Record<string, number> = {};
    for (const d of diagnostics) {
      const sev = String(d?.severity ?? "UNKNOWN");
      diagBySeverity[sev] = (diagBySeverity[sev] ?? 0) + 1;
    }

    const formatList = (
      arr: { id: string; filePath?: string }[],
      limit: number
    ) => {
      return arr
        .slice(0, limit)
        .map((x) => `- ${x.id}${x.filePath ? ` (${x.filePath})` : ""}`)
        .join("\n");
    };

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
      lines.push(
        `  - By severity: ${Object.entries(diagBySeverity)
          .map(([k, v]) => `${k}=${v}`)
          .join(", ")}`
      );
    }
    lines.push("");
    lines.push(`## Sample Nodes (first ${sampleSize})`);
    if (tasks.length) {
      lines.push(`### Tasks`);
      lines.push(formatList(tasks, sampleSize));
      lines.push("");
    }
    if (listeners.length) {
      lines.push(`### Listeners`);
      lines.push(
        listeners
          .slice(0, sampleSize)
          .map((x: any) => `- ${x.id} (event: ${x.event})`)
          .join("\n")
      );
      lines.push("");
    }
    if (resources.length) {
      lines.push(`### Resources`);
      lines.push(formatList(resources, sampleSize));
      lines.push("");
    }
    if (middlewares.length) {
      lines.push(`### Middleware`);
      lines.push(
        middlewares
          .slice(0, sampleSize)
          .map((x: any) => `- ${x.id}`)
          .join("\n")
      );
      lines.push("");
    }
    if (events.length) {
      lines.push(`### Events`);
      lines.push(
        events
          .slice(0, sampleSize)
          .map((x: any) => `- ${x.id}`)
          .join("\n")
      );
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

// Expose the schema as an MCP resource
server.registerResource(
  "graphql_schema",
  new ResourceTemplate("graphql://schema", { list: undefined }),
  {
    title: "GraphQL Schema (Introspection)",
    description: "Introspection result of the configured GraphQL endpoint",
  },
  async (uri) => {
    const introspectionQuery = getIntrospectionQuery();
    const result = await callGraphQL({ query: introspectionQuery });
    return {
      contents: [
        {
          uri: uri.href,
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }
);

// Expose the SDL schema as an MCP resource
server.registerResource(
  "graphql_schema_sdl",
  new ResourceTemplate("graphql://schema.sdl", { list: undefined }),
  {
    title: "GraphQL Schema (SDL)",
    description: "SDL string representation of the configured GraphQL endpoint",
  },
  async (uri) => {
    const sdl = await fetchSchemaSDL();
    return {
      contents: [
        {
          uri: uri.href,
          text: sdl,
        },
      ],
    };
  }
);

// Start receiving messages on stdin and sending messages on stdout
const transport = new StdioServerTransport();
server.connect(transport);
