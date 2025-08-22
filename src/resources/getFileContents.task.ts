import { task } from "@bluelibs/runner";
import { httpTag } from "./http.tag";
import fs from "node:fs/promises";
import { resolvePathInput } from "../utils/path";

export const getFileContents = task({
  id: "runner-dev.tasks.getFileContents",
  meta: {
    title: "Get File Contents",
    description: "Returns file contents by absolute path with optional range.",
    tags: [httpTag.with({ method: "GET", path: "/api/file" })],
  },
  inputSchema: undefined,
  async run(input: { path?: string; startLine?: number; endLine?: number }) {
    const filePathInput = typeof input?.path === "string" ? input.path : "";
    const filePath = resolvePathInput(filePathInput) || filePathInput;
    if (!filePath) {
      return { ok: false, error: "Missing path" } as const;
    }
    try {
      const text = await fs.readFile(filePath, "utf8");
      const hasStart = typeof input?.startLine === "number";
      const hasEnd = typeof input?.endLine === "number";
      if (!hasStart && !hasEnd) {
        return { ok: true, content: text } as const;
      }
      const lines = text.split(/\r?\n/);
      const total = lines.length;
      const start = Math.max(1, Math.min(input.startLine ?? 1, total));
      const end = Math.max(1, Math.min(input.endLine ?? total, total));
      const sliced = start > end ? "" : lines.slice(start - 1, end).join("\n");
      return { ok: true, content: sliced } as const;
    } catch (e: any) {
      return { ok: false, error: e?.message ?? "Cannot read file" } as const;
    }
  },
});
