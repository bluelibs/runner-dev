import {
  isRecord,
  isScalar,
  getFirstScalarPreview,
  valuePreview,
  formatGraphQLResultAsMarkdown,
} from "../../mcp/format";

describe("Format Utilities", () => {
  describe("isRecord", () => {
    it("should return true for plain objects", () => {
      expect(isRecord({})).toBe(true);
      expect(isRecord({ key: "value" })).toBe(true);
    });

    it("should return false for non-objects", () => {
      expect(isRecord(null)).toBe(false);
      expect(isRecord(undefined)).toBe(false);
      expect(isRecord("string")).toBe(false);
      expect(isRecord(123)).toBe(false);
      expect(isRecord(true)).toBe(false);
      expect(isRecord([])).toBe(false);
    });
  });

  describe("isScalar", () => {
    it("should return true for scalar values", () => {
      expect(isScalar("string")).toBe(true);
      expect(isScalar(123)).toBe(true);
      expect(isScalar(true)).toBe(true);
      expect(isScalar(false)).toBe(true);
      expect(isScalar(null)).toBe(true);
      expect(isScalar(undefined)).toBe(true);
    });

    it("should return false for non-scalar values", () => {
      expect(isScalar({})).toBe(false);
      expect(isScalar([])).toBe(false);
      expect(isScalar(() => {})).toBe(false);
    });
  });

  describe("getFirstScalarPreview", () => {
    it("should prioritize preferred keys", () => {
      const obj = {
        name: "test",
        id: "123",
        other: "value",
      };
      expect(getFirstScalarPreview(obj)).toBe("id=123");
    });

    it("should fall back to any scalar if no preferred keys found", () => {
      const obj = {
        custom: "value",
        other: 42,
      };
      const result = getFirstScalarPreview(obj);
      expect(["custom=value", "other=42"]).toContain(result);
    });

    it("should return undefined if no scalars found", () => {
      const obj = {
        nested: { key: "value" },
        array: [1, 2, 3],
      };
      expect(getFirstScalarPreview(obj)).toBeUndefined();
    });

    it("should handle preferred keys in order", () => {
      const obj = {
        title: "My Title",
        id: "123",
        name: "My Name",
      };
      expect(getFirstScalarPreview(obj)).toBe("id=123");
    });
  });

  describe("valuePreview", () => {
    it("should handle scalars", () => {
      expect(valuePreview("test")).toBe("test");
      expect(valuePreview(123)).toBe("123");
      expect(valuePreview(true)).toBe("true");
      expect(valuePreview(null)).toBe("null");
    });

    it("should handle arrays", () => {
      expect(valuePreview([1, 2, 3])).toBe("Array(3)");
      expect(valuePreview([])).toBe("Array(0)");
    });

    it("should handle objects", () => {
      expect(valuePreview({})).toBe("Object");
      expect(valuePreview({ key: "value" })).toBe("Object");
    });

    it("should handle other types", () => {
      expect(valuePreview(() => {})).toBe("function");
      expect(valuePreview(Symbol("test"))).toBe("symbol");
    });
  });

  describe("formatGraphQLResultAsMarkdown", () => {
    describe("basic functionality", () => {
      it("should format empty result", () => {
        const result = formatGraphQLResultAsMarkdown({});
        expect(result).toContain("# GraphQL Result");
        expect(result).toContain("_No data returned._");
      });

      it("should use custom title", () => {
        const result = formatGraphQLResultAsMarkdown(
          {},
          { title: "Custom Title" }
        );
        expect(result).toContain("# Custom Title");
      });

      it("should format simple data", () => {
        const data = {
          data: {
            user: { id: "123", name: "John" },
            count: 42,
          },
        };
        const result = formatGraphQLResultAsMarkdown(data);
        expect(result).toContain("## Data Summary");
        expect(result).toContain("- user: Object");
        expect(result).toContain("- id: 123");
        expect(result).toContain("- name: John");
        expect(result).toContain("- count: 42");
      });
    });

    describe("error handling", () => {
      it("should format GraphQL errors with message only", () => {
        const result = formatGraphQLResultAsMarkdown({
          errors: [{ message: "Field not found" }],
          data: null,
        });
        expect(result).toContain("## Errors");
        expect(result).toContain("- Field not found");
      });

      it("should format GraphQL errors with path and location", () => {
        const result = formatGraphQLResultAsMarkdown({
          errors: [
            {
              message: "Cannot query field",
              path: ["user", "invalidField"],
              locations: [{ line: 5, column: 10 }],
            },
          ],
          data: null,
        });
        expect(result).toContain("## Errors");
        expect(result).toContain(
          "- Cannot query field (at path: user.invalidField) (line 5, column 10)"
        );
      });

      it("should handle multiple errors with maxItems limit", () => {
        const errors = Array.from({ length: 15 }, (_, i) => ({
          message: `Error ${i + 1}`,
        }));
        const result = formatGraphQLResultAsMarkdown(
          { errors, data: null },
          { maxItems: 5 }
        );
        expect(result).toContain("## Errors");
        expect(result).toContain("- Error 1");
        expect(result).toContain("- Error 5");
        expect(result).toContain("- ... and 10 more errors");
        expect(result).not.toContain("- Error 6");
      });

      it("should handle non-GraphQL error objects", () => {
        const result = formatGraphQLResultAsMarkdown({
          errors: [{ code: 500 }, "string error", null],
          data: null,
        });
        expect(result).toContain("## Errors");
        expect(result).toContain("- Object");
        expect(result).toContain("- string error");
        expect(result).toContain("- null");
      });
    });

    describe("array handling", () => {
      it("should format arrays with nested objects", () => {
        const data = {
          data: {
            users: [
              { id: "1", name: "John", profile: { age: 30 } },
              { id: "2", name: "Jane", profile: { age: 25 } },
            ],
          },
        };
        const result = formatGraphQLResultAsMarkdown(data);
        expect(result).toContain("- users: 2 items");
        expect(result).toContain("[0]:");
        expect(result).toContain("    - id: 1");
        expect(result).toContain("    - name: John");
        expect(result).toContain("    - profile: Object");
        expect(result).toContain("      - age: 30");
        expect(result).toContain("[1]:");
        expect(result).toContain("    - id: 2");
      });

      it("should respect maxItems for arrays", () => {
        const data = {
          data: {
            items: Array.from({ length: 10 }, (_, i) => ({
              id: i,
              name: `Item ${i}`,
            })),
          },
        };
        const result = formatGraphQLResultAsMarkdown(data, { maxItems: 3 });
        expect(result).toContain("- items: 10 items");
        expect(result).toContain("[0]:");
        expect(result).toContain("[1]:");
        expect(result).toContain("[2]:");
        expect(result).toContain("... and 7 more items");
        expect(result).not.toContain("[3]:");
      });

      it("should handle arrays with scalar values", () => {
        const data = {
          data: {
            tags: ["typescript", "graphql", "testing"],
            numbers: [1, 2, 3],
          },
        };
        const result = formatGraphQLResultAsMarkdown(data);
        expect(result).toContain("- tags: 3 items");
        expect(result).toContain("  [0]: typescript");
        expect(result).toContain("  [1]: graphql");
        expect(result).toContain("  [2]: testing");
        expect(result).toContain("- numbers: 3 items");
        expect(result).toContain("  [0]: 1");
      });
    });

    describe("depth control", () => {
      it("should respect maxDepth setting", () => {
        const data = {
          data: {
            user: {
              profile: {
                settings: {
                  preferences: {
                    theme: "dark",
                  },
                },
              },
            },
          },
        };

        const shallowResult = formatGraphQLResultAsMarkdown(data, {
          maxDepth: 2,
        });
        expect(shallowResult).toContain("- user: Object");
        expect(shallowResult).toContain("  - profile: Object");
        expect(shallowResult).toContain("    {...}");
        expect(shallowResult).not.toContain("preferences");

        const deepResult = formatGraphQLResultAsMarkdown(data, { maxDepth: 5 });
        expect(deepResult).toContain("- user: Object");
        expect(deepResult).toContain("  - profile: Object");
        expect(deepResult).toContain("    - settings: Object");
        expect(deepResult).toContain("      - preferences: Object");
        expect(deepResult).toContain("        - theme: dark");
      });

      it("should handle depth limit with arrays", () => {
        const data = {
          data: {
            users: [
              {
                profile: {
                  nested: {
                    deep: "value",
                  },
                },
              },
            ],
          },
        };
        const result = formatGraphQLResultAsMarkdown(data, { maxDepth: 2 });
        expect(result).toContain("- users: 1 item");
        expect(result).toContain("  [0]:");
        expect(result).toContain("    - profile: Object");
        expect(result).toContain("      {...}");
        expect(result).not.toContain("deep: value");
      });
    });

    describe("extensions support", () => {
      it("should format GraphQL extensions", () => {
        const result = formatGraphQLResultAsMarkdown({
          data: { user: { id: "123" } },
          extensions: {
            tracing: { duration: 150 },
            complexity: { score: 5 },
          },
        });
        expect(result).toContain("## Extensions");
        expect(result).toContain("- tracing: Object");
        expect(result).toContain("  - duration: 150");
        expect(result).toContain("- complexity: Object");
        expect(result).toContain("  - score: 5");
      });

      it("should not show extensions section when empty", () => {
        const result = formatGraphQLResultAsMarkdown({
          data: { user: { id: "123" } },
          extensions: {},
        });
        expect(result).not.toContain("## Extensions");
      });
    });

    describe("story style", () => {
      it("should format in story style", () => {
        const data = {
          data: {
            user: { id: "123", name: "John" },
            posts: [{ title: "Post 1" }, { title: "Post 2" }],
          },
        };
        const result = formatGraphQLResultAsMarkdown(data, { style: "story" });
        expect(result).toContain(
          "I queried the server and received the following top-level fields:"
        );
        expect(result).toContain("user (object), posts (2 items).");
      });

      it("should include error count in story", () => {
        const result = formatGraphQLResultAsMarkdown(
          {
            data: { user: { id: "123" } },
            errors: [{ message: "Warning" }, { message: "Another warning" }],
          },
          { style: "story" }
        );
        expect(result).toContain("There were 2 errors included above.");
      });

      it("should handle singular vs plural in story", () => {
        const singleResult = formatGraphQLResultAsMarkdown(
          {
            data: { user: { id: "123" } },
            errors: [{ message: "Single error" }],
          },
          { style: "story" }
        );
        expect(singleResult).toContain("There were 1 error included above.");

        const multiResult = formatGraphQLResultAsMarkdown(
          {
            data: { users: [{ id: "1" }] },
          },
          { style: "story" }
        );
        expect(multiResult).toContain("users (1 item)");
      });
    });

    describe("edge cases", () => {
      it("should handle null and undefined values", () => {
        const result = formatGraphQLResultAsMarkdown({
          data: {
            nullValue: null,
            undefinedValue: undefined,
            emptyString: "",
          },
        });
        expect(result).toContain("- nullValue: null");
        expect(result).toContain("- undefinedValue: undefined");
        expect(result).toContain("- emptyString: ");
      });

      it("should handle empty arrays and objects", () => {
        const result = formatGraphQLResultAsMarkdown({
          data: {
            emptyArray: [],
            emptyObject: {},
          },
        });
        expect(result).toContain("- emptyArray: 0 items");
        expect(result).toContain("- emptyObject: Object");
      });

      it("should handle malformed input gracefully", () => {
        const result = formatGraphQLResultAsMarkdown(null);
        expect(result).toContain("# GraphQL Result");
        expect(result).toContain("_No data returned._");
      });

      it("should handle non-object data field", () => {
        const result = formatGraphQLResultAsMarkdown({
          data: "not an object",
        });
        expect(result).toContain("_No data returned._");
      });
    });
  });

  test("formatFilePath preserves sanitize prefixes and truncates tail", () => {
    const {
      formatFilePath,
    } = require("../../ui/src/components/Documentation/utils/formatting");

    expect(formatFilePath(null)).toBe("Unknown location");
    expect(formatFilePath("workspace:src/index.ts")).toBe(
      "workspace:src/index.ts"
    );
    expect(formatFilePath("workspace:src/a/b/c/d/e.ts")).toBe(
      "workspace:/.../c/d/e.ts"
    );
    expect(formatFilePath("node_modules:@scope/pkg/dist/index.js")).toBe(
      "node_modules:@scope/pkg/dist/index.js"
    );
    expect(formatFilePath("node_modules:@scope/pkg/a/b/c/d.js")).toBe(
      "node_modules:/.../b/c/d.js"
    );
    // Non-prefixed fallback
    expect(formatFilePath("/Users/me/project/src/a/b/c.ts")).toBe(
      ".../a/b/c.ts"
    );
  });
});
