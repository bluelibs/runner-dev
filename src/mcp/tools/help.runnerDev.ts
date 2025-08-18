import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { buildTOC, extractSectionsByHeadings, readDocContent } from "../help";

export function registerHelpRunnerDev(server: McpServer) {
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

      const sections: string[] = [];
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
}
