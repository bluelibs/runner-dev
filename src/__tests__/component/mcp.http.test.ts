import { toVariables } from "../../mcp/http";

describe("mcp/http", () => {
  describe("toVariables", () => {
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
});
