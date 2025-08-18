import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { callGraphQL, toVariables } from "../http";
import { formatGraphQLResultAsMarkdown } from "../format";

export function registerGraphQLQuery(server: McpServer) {
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
}
