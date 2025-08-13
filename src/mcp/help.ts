import { promises as fs } from "fs";
import * as path from "path";
import { sanitizePath } from "../utils/path";

export type HelpDoc = "readme" | "ai";

export async function readDocContent(doc: HelpDoc): Promise<{
  doc: HelpDoc;
  filePath: string;
  content: string;
}> {
  const root = process.cwd();
  const fileName = doc === "readme" ? "README.md" : "AI.md";
  const filePath = path.join(root, fileName);
  const content = await fs.readFile(filePath, "utf8").catch(() => "");
  return { doc, filePath: sanitizePath(filePath) ?? filePath, content };
}

export async function readPackageDoc(
  packageName: string,
  docPath = "README.md"
): Promise<{ packageName: string; filePath: string; content: string }> {
  const root = process.cwd();
  const filePath = path.join(root, "node_modules", packageName, docPath);
  const content = await fs.readFile(filePath, "utf8").catch(() => "");
  return { packageName, filePath: sanitizePath(filePath) ?? filePath, content };
}

export function extractSectionByHeading(
  markdown: string,
  headingQuery: string
): string {
  if (!markdown || !headingQuery) return "";
  const lines = markdown.split(/\r?\n/);
  const normalizedQuery = headingQuery.trim().toLowerCase();
  let startIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^#{1,6}\s+/.test(line)) {
      const title = line
        .replace(/^#{1,6}\s+/, "")
        .trim()
        .toLowerCase();
      if (title.includes(normalizedQuery)) {
        startIndex = i;
        break;
      }
    }
  }
  if (startIndex === -1) return "";
  let endIndex = lines.length;
  const startLevel = lines[startIndex].match(/^#+/)?.[0].length ?? 1;
  for (let j = startIndex + 1; j < lines.length; j++) {
    const l = lines[j];
    const m = l.match(/^#{1,6}\s+/);
    if (m && m[0].trim().length <= startLevel) {
      endIndex = j;
      break;
    }
  }
  return lines.slice(startIndex, endIndex).join("\n");
}

/**
 * Extract multiple sections by heading queries (supports array of headings).
 * @param markdown - The markdown content to search
 * @param headingQueries - Array of heading queries to search for
 * @returns Combined sections with separators
 */
export function extractSectionsByHeadings(
  markdown: string,
  headingQueries: string[]
): string {
  if (!markdown || !headingQueries || headingQueries.length === 0) return "";

  const sections: string[] = [];
  const foundHeadings: string[] = [];

  for (const query of headingQueries) {
    const section = extractSectionByHeading(markdown, query);
    if (section) {
      sections.push(section);
      foundHeadings.push(query);
    }
  }

  if (sections.length === 0) {
    return `No sections found matching: ${headingQueries.join(", ")}`;
  }

  const header =
    foundHeadings.length === headingQueries.length
      ? `Found all ${sections.length} requested sections:`
      : `Found ${sections.length} of ${headingQueries.length} requested sections:`;

  return (
    `${header} ${foundHeadings.join(", ")}\n\n` + sections.join("\n\n---\n\n")
  );
}

export function buildTOC(markdown: string): string[] {
  if (!markdown) return [];
  const lines = markdown.split(/\r?\n/);
  const toc: string[] = [];
  for (const line of lines) {
    const m = line.match(/^(#{1,6})\s+(.*)$/);
    if (m) {
      const level = m[1].length;
      const title = m[2].trim();
      toc.push(`${"  ".repeat(level - 1)}- ${title}`);
    }
  }
  return toc;
}
