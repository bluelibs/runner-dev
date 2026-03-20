import {
  getSchemaArrayEnumOptions,
  getSchemaFieldHint,
  getSchemaStringInputType,
  parseCommaSeparatedArrayValue,
} from "./schemaForm";

describe("schemaForm helpers", () => {
  test("returns format-aware string input types", () => {
    expect(getSchemaStringInputType({ format: "email" })).toBe("email");
    expect(getSchemaStringInputType({ format: "uri" })).toBe("url");
    expect(getSchemaStringInputType({ format: "date-time" })).toBe("text");
  });

  test("parses numeric and boolean arrays into friendly typed values", () => {
    expect(
      parseCommaSeparatedArrayValue("1, 2, 3", { type: "integer" })
    ).toEqual([1, 2, 3]);
    expect(
      parseCommaSeparatedArrayValue("true, false, yes, no", {
        type: "boolean",
      })
    ).toEqual([true, false, true, false]);
  });

  test("keeps invalid typed array tokens readable instead of discarding them", () => {
    expect(
      parseCommaSeparatedArrayValue("1, nope, 3", { type: "number" })
    ).toEqual([1, "nope", 3]);
  });

  test("builds helpful fallback hints for generated fields", () => {
    expect(
      getSchemaFieldHint({
        type: "array",
        items: { type: "integer" },
      })
    ).toBe("Comma-separated integer values.");
    expect(
      getSchemaFieldHint({
        type: "string",
        format: "date-time",
      })
    ).toBe("Use an ISO date-time value.");
  });

  test("detects enum-backed string arrays for multi-select rendering", () => {
    expect(
      getSchemaArrayEnumOptions({
        type: "array",
        items: {
          enum: ["draft", "published", 1, null],
        },
      })
    ).toEqual(["draft", "published"]);

    expect(
      getSchemaArrayEnumOptions({
        type: "array",
        items: {
          type: "string",
        },
      })
    ).toBeUndefined();
  });
});
