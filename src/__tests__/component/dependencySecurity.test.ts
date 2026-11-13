import { createRequire } from "node:module";
import { z } from "zod";

const loadPackage = createRequire(__filename);
const loadFromJest = createRequire(loadPackage.resolve("jest-config"));
const merge = loadFromJest("deepmerge");
const { mergeConfig } = loadPackage("jest-config");

test("TypeDoc can traverse matching directories with its partial-match API", () => {
  const loadFromTypeDoc = createRequire(loadPackage.resolve("typedoc"));
  const { Minimatch } = loadFromTypeDoc("minimatch");
  const matcher = new Minimatch("src/{durable,resources}/**/*.ts");
  const matchesDirectory = (directory: string) =>
    matcher.set.some((row: unknown) =>
      matcher.matchOne(directory.split("/"), row, true)
    );

  expect(matchesDirectory("src/durable")).toBe(true);
  expect(matchesDirectory("src/resources/models")).toBe(true);
  expect(matchesDirectory("src/ui")).toBe(false);
  expect(matcher.match("src/durable/router.ts")).toBe(true);
  expect(matcher.match("src/durable/router.js")).toBe(false);
});

describe("Jest configuration merging", () => {
  test.each(["target", "source", "null-prototype target"])(
    "does not poison returned prototypes through %s",
    (variant) => {
      const payload: object = JSON.parse(
        '{"__proto__":{"injected":true},"safe":{"enabled":true}}'
      );
      const target =
        variant === "target"
          ? payload
          : variant === "null-prototype target"
          ? Object.create(null)
          : {};
      const source = variant === "target" ? {} : payload;
      for (const result of [
        merge(target, source),
        mergeConfig(target, source),
      ]) {
        expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
        expect(result.injected).toBeUndefined();
        expect(Object.hasOwn(result, "__proto__")).toBe(false);
        expect(result.safe).toEqual({ enabled: true });
      }
    }
  );

  test("preserves nested defaults, array concatenation and overrides", () => {
    const defaults = {
      globals: { feature: { enabled: true, retries: 1 }, labels: ["default"] },
    };
    const overrides = {
      globals: { feature: { retries: 2 }, labels: ["project"] },
    };
    const expected = {
      globals: {
        feature: { enabled: true, retries: 2 },
        labels: ["default", "project"],
      },
    };
    expect(mergeConfig(defaults, overrides)).toEqual(expected);
    expect(merge(defaults, overrides)).toEqual(expected);
    expect(defaults.globals.labels).toEqual(["default"]);
  });
});

describe("Zod collection limits", () => {
  test.each(["array", "map", "set"] as const)(
    "rejects oversized %s inputs before validating every element",
    (kind) => {
      const validateElement = jest.fn(() => true);
      const element = z.string().refine(validateElement);
      const values = Array.from({ length: 1000 }, (_, i) => String(i));
      const schema =
        kind === "array"
          ? z.array(element).max(2)
          : kind === "map"
          ? z.map(z.string(), element).max(2)
          : z.set(element).max(2);
      const input =
        kind === "array"
          ? values
          : kind === "map"
          ? new Map(values.map((value) => [value, value]))
          : new Set(values);

      const result = schema.safeParse(input);
      expect(result.success).toBe(false);
      if (result.success) throw new Error("Oversized collection was accepted");
      expect(result.error.issues).toHaveLength(1);
      expect(result.error.issues[0].code).toBe("too_big");
      expect(validateElement).not.toHaveBeenCalled();

      const valid =
        kind === "array"
          ? ["ok"]
          : kind === "map"
          ? new Map([["key", "ok"]])
          : new Set(["ok"]);
      expect(schema.safeParse(valid).success).toBe(true);
      expect(validateElement).toHaveBeenCalledTimes(1);
    }
  );
});
