import { promises as fs } from "fs";

export interface ReadFileOptions {
  startLine?: number | null;
  endLine?: number | null;
}

/**
 * Reads a file from disk as UTF-8. When startLine and/or endLine are provided,
 * returns only the inclusive slice of lines using 1-based line numbers.
 * - Out-of-range values are clamped within [1, totalLines].
 * - If startLine > endLine after clamping, returns an empty string.
 * - Returns null if the file cannot be read.
 */
export async function readFile(
  filePath: string,
  options?: ReadFileOptions
): Promise<string | null> {
  try {
    const contents = await fs.readFile(filePath, "utf8");

    const hasStart =
      typeof options?.startLine === "number" && options.startLine != null;
    const hasEnd =
      typeof options?.endLine === "number" && options.endLine != null;

    if (!hasStart && !hasEnd) {
      return contents;
    }

    const lines = contents.split(/\r?\n/);
    const totalLines = lines.length;

    const rawStart = (options?.startLine ?? 1) as number;
    const rawEnd = (options?.endLine ?? totalLines) as number;

    const start = Math.max(1, Math.min(rawStart, totalLines));
    const end = Math.max(1, Math.min(rawEnd, totalLines));

    if (start > end) {
      return "";
    }

    return lines.slice(start - 1, end).join("\n");
  } catch {
    return null;
  }
}
