import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ALLOW_MUTATIONS } from "../env";
import { callGraphQL, toVariables } from "../http";
import { formatGraphQLResultAsMarkdown } from "../format";

export function registerGraphQLMutation(server: McpServer) {
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
}
