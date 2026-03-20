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
  readPackageDoc,
  readFirstAvailablePackageDoc,
  RUNNER_FRAMEWORK_COMPACT_DOC_PATHS,
  RUNNER_FRAMEWORK_COMPLETE_DOC_PATHS,
} from "../../docs/packageDocs";

describe("MCP tools (env/http/format/docs)", () => {
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

  describe("package docs", () => {
    it("readPackageDoc returns content or empty string gracefully", async () => {
      const pkg = await readPackageDoc(
        "@bluelibs/runner",
        RUNNER_FRAMEWORK_COMPACT_DOC_PATHS[0]
      );
      expect(pkg.content.length).toBeGreaterThan(0);
    });

    it("runner docs prefer compact and full guides from readmes", async () => {
      expect(RUNNER_FRAMEWORK_COMPACT_DOC_PATHS[0]).toBe(
        "readmes/COMPACT_GUIDE.md"
      );
      expect(RUNNER_FRAMEWORK_COMPLETE_DOC_PATHS[0]).toBe(
        "readmes/FULL_GUIDE.md"
      );

      const compact = await readFirstAvailablePackageDoc("@bluelibs/runner", [
        "readmes/DOES_NOT_EXIST.md",
        ...RUNNER_FRAMEWORK_COMPACT_DOC_PATHS,
      ]);
      const complete = await readFirstAvailablePackageDoc("@bluelibs/runner", [
        "readmes/DOES_NOT_EXIST.md",
        ...RUNNER_FRAMEWORK_COMPLETE_DOC_PATHS,
      ]);

      expect(compact.filePath).toMatch(
        /(?:readmes|references\/readmes)\/COMPACT_GUIDE\.md$/
      );
      expect(compact.content.length).toBeGreaterThan(0);
      expect(complete.filePath).toMatch(
        /(?:readmes|references\/readmes)\/FULL_GUIDE\.md$/
      );
      expect(complete.content.length).toBeGreaterThan(0);
    });

    it("fails fast when none of the requested package docs exist", async () => {
      await expect(
        readFirstAvailablePackageDoc("@bluelibs/runner", [
          "readmes/DOES_NOT_EXIST.md",
        ])
      ).rejects.toThrow(
        "Required package docs for @bluelibs/runner were not found"
      );
    });
  });
});
