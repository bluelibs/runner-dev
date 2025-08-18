import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { getIntrospectionQuery } from "graphql";
import { callGraphQL } from "./mcp/http";
import { fetchSchemaSDL } from "./mcp/schema";
import { registerProjectOverview } from "./mcp/projectOverview";
import { registerGraphQLQuery } from "./mcp/tools/graphql.query";
import { registerGraphQLMutation } from "./mcp/tools/graphql.mutation";
import { registerGraphQLIntrospect } from "./mcp/tools/graphql.introspect";
import { registerGraphQLSchemaSDL } from "./mcp/tools/graphql.schemaSdl";
import { registerGraphQLPing } from "./mcp/tools/graphql.ping";
import { registerHelpRead } from "./mcp/tools/help.read";
import { registerHelpRunner } from "./mcp/tools/help.runner";
import { registerHelpRunnerDev } from "./mcp/tools/help.runnerDev";

// Create an MCP server
const server = new McpServer({
  name: "runner_dev",
  version: "1.0.0",
});

// Register tools
registerGraphQLQuery(server);

registerHelpRead(server);

registerHelpRunner(server);

registerHelpRunnerDev(server);

registerGraphQLMutation(server);

registerGraphQLIntrospect(server);

registerGraphQLSchemaSDL(server);

registerGraphQLPing(server);

// High-level project overview for AIs in Markdown format (moved to mcp/projectOverview)
registerProjectOverview(server);

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
