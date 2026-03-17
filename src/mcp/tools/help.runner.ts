import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  buildTOC,
  extractSectionsByHeadings,
  readFirstAvailablePackageDoc,
} from "../help";

const RUNNER_FRAMEWORK_DOC_PATHS = [
  ".agents/skills/runner/references/COMPACT_GUIDE.md",
  "readmes/COMPACT_GUIDE.md",
  "AI.md",
  "README.md",
];

export function registerHelpRunner(server: McpServer) {
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
      const pkg = await readFirstAvailablePackageDoc(
        "@bluelibs/runner",
        RUNNER_FRAMEWORK_DOC_PATHS
      );
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
}
