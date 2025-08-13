import { toVariables } from "../../mcp/http";
import {
  isRecord,
  isScalar,
  getFirstScalarPreview,
  valuePreview,
  formatGraphQLResultAsMarkdown,
} from "../../mcp/format";
import { parseHeadersFromEnv, assertEndpoint } from "../../mcp/env";
import {
  readDocContent,
  buildTOC,
  extractSectionByHeading,
  readPackageDoc,
} from "../../mcp/help";

describe("MCP tools (env/http/format/help)", () => {
  const ORIGINAL_ENV = { ...process.env };

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    jest.resetModules();
  });

  describe("env", () => {
    it("parseHeadersFromEnv: returns {} when HEADERS missing or invalid", () => {
      delete process.env.HEADERS;
      expect(parseHeadersFromEnv()).toEqual({});

      process.env.HEADERS = "not-json";
      expect(parseHeadersFromEnv()).toEqual({});
    });

    it("parseHeadersFromEnv: parses JSON and stringifies non-strings", () => {
      process.env.HEADERS = JSON.stringify({
        Authorization: "Bearer x",
        obj: { a: 1 },
      });
      expect(parseHeadersFromEnv()).toEqual({
        Authorization: "Bearer x",
        obj: JSON.stringify({ a: 1 }),
      });
    });

    it("assertEndpoint: throws when ENDPOINT missing", () => {
      delete process.env.ENDPOINT;
      delete process.env.GRAPHQL_ENDPOINT;
      expect(() => assertEndpoint()).toThrow(
        /ENDPOINT env variable is required/
      );
    });

    it("assertEndpoint: returns ENDPOINT when set", () => {
      process.env.ENDPOINT = "http://localhost:1337/graphql";
      expect(assertEndpoint()).toBe("http://localhost:1337/graphql");
    });
  });

  describe("http.toVariables", () => {
    it("returns undefined for nullish", () => {
      expect(toVariables(undefined as any)).toBeUndefined();
      expect(toVariables(null as any)).toBeUndefined();
    });
    it("passes through objects", () => {
      const obj = { a: 1 };
      expect(toVariables(obj as any)).toBe(obj);
    });
    it("parses JSON strings", () => {
      const out = toVariables('{"a":1,"b":"x"}' as any);
      expect(out).toEqual({ a: 1, b: "x" });
    });
    it("throws on invalid JSON strings", () => {
      expect(() => toVariables("{" as any)).toThrow(
        /Failed to parse variables JSON/
      );
    });
  });

  describe("format utils", () => {
    it("isRecord and isScalar basics", () => {
      expect(isRecord({})).toBe(true);
      expect(isRecord(null)).toBe(false);
      expect(isScalar("x")).toBe(true);
      expect(isScalar({})).toBe(false);
    });

    it("getFirstScalarPreview and valuePreview", () => {
      expect(getFirstScalarPreview({ id: 1, name: "n" })).toBe("id=1");
      expect(valuePreview([1, 2])).toBe("Array(2)");
      expect(valuePreview({ a: 1 })).toBe("Object");
    });

    it("formatGraphQLResultAsMarkdown summary", () => {
      const res = formatGraphQLResultAsMarkdown({
        data: { item: { id: "1" } },
      });
      expect(res).toContain("## Data Summary");
      expect(res).toContain("- item: Object");
    });
  });

  describe("help docs", () => {
    it("readDocContent(readme) returns content", async () => {
      const { content, filePath } = await readDocContent("readme");
      expect(filePath).toMatch(/README\.md$/);
      expect(typeof content).toBe("string");
      expect(content.length).toBeGreaterThan(0);
    });

    it("buildTOC and extractSectionByHeading work", async () => {
      const { content } = await readDocContent("readme");
      const toc = buildTOC(content);
      expect(Array.isArray(toc)).toBe(true);
      // try common headings
      const section = extractSectionByHeading(
        content,
        "AI Assistant Integration"
      );
      expect(typeof section).toBe("string");
    });

    it("readPackageDoc returns content or empty string gracefully", async () => {
      // use a dependency likely present
      const pkg = await readPackageDoc("graphql");
      expect(typeof pkg.content).toBe("string");
    });
  });
});
