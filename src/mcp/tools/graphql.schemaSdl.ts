import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { fetchSchemaSDL } from "../schema";

export function registerGraphQLSchemaSDL(server: McpServer) {
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
}
