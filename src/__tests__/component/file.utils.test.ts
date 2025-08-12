import { promises as fs } from "fs";
import { readFile } from "../../graphql/utils";
import * as path from "path";

describe("readFile utility", () => {
  const tmpDir = path.join(__dirname, "tmp-files");
  const tmpFile = path.join(tmpDir, "sample.txt");

  const contentLines = ["line1", "line2", "line3", "line4", "line5"];

  beforeAll(async () => {
    await fs.mkdir(tmpDir, { recursive: true });
    await fs.writeFile(tmpFile, contentLines.join("\n"), "utf8");
  });

  afterAll(async () => {
    // best-effort cleanup; ignore errors in CI
    try {
      await fs.unlink(tmpFile);
      await fs.rmdir(tmpDir);
    } catch {}
  });

  test("returns full file when no options provided", async () => {
    const result = await readFile(tmpFile);
    expect(result).toBe(contentLines.join("\n"));
  });

  test("slices within range using 1-based inclusive bounds", async () => {
    const result = await readFile(tmpFile, { startLine: 2, endLine: 4 });
    expect(result).toBe(["line2", "line3", "line4"].join("\n"));
  });

  test("clamps start and end to valid bounds", async () => {
    const result = await readFile(tmpFile, { startLine: 0, endLine: 999 });
    expect(result).toBe(contentLines.join("\n"));
  });

  test("returns empty string when start > end after clamping", async () => {
    const result = await readFile(tmpFile, { startLine: 5, endLine: 2 });
    expect(result).toBe("");
  });

  test("returns null when file cannot be read", async () => {
    const missing = path.join(tmpDir, "does-not-exist.txt");
    const result = await readFile(missing);
    expect(result).toBeNull();
  });
});
