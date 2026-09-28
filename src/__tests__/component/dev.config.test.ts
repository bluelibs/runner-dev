import { dev } from "../../resources/dev.resource";

describe("dev resource config", () => {
  test.each([2.5, 0, -3])(
    "rejects maxEntries=%p with a clear message",
    (maxEntries) => {
      expect(() => dev.with({ maxEntries })).toThrow(
        "maxEntries must be a positive integer"
      );
    }
  );

  test("accepts a positive integer maxEntries", () => {
    expect(() => dev.with({ maxEntries: 500 })).not.toThrow();
  });
});
