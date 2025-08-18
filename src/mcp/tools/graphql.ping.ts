import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { callGraphQL } from "../http";
import { assertEndpoint } from "../env";

export function registerGraphQLPing(server: McpServer) {
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
}
