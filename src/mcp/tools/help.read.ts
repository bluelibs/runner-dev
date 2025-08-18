import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  buildTOC,
  extractSectionsByHeadings,
  readDocContent,
  readPackageDoc,
} from "../help";

export function registerHelpRead(server: McpServer) {
  server.registerTool(
    "help_read",
    {
      title: "Help Documentation",
      description:
        "Read documentation: 'runner-dev' (this app's docs), 'runner' (framework docs), or custom package docs. Supports filtering by heading and TOC generation.",
      inputSchema: {
        doc: z.enum(["runner-dev", "runner"]).optional(),
        packageName: z.string().optional(),
        packageDocPath: z.string().optional(),
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
        const pkg = await readPackageDoc("@bluelibs/runner", "README.md");
        content = pkg.content;
        filePath = pkg.filePath;
      } else {
        const readmeRes = await readDocContent("readme");
        const aiRes = await readDocContent("ai");

        const sections: string[] = [];
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
}
