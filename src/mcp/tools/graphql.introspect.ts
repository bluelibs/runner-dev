import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getIntrospectionQuery } from "graphql";
import { callGraphQL } from "../http";

export function registerGraphQLIntrospect(server: McpServer) {
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
}
