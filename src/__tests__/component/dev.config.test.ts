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

describe("dev resource allowedHosts", () => {
  test.each(["http://devbox.lan", "devbox.lan:1337", "", "dev box"])(
    "rejects allowedHosts entry %p with a clear message",
    (entry) => {
      expect(() => dev.with({ allowedHosts: [entry] })).toThrow(
        "allowedHosts entries are hostnames without scheme or port"
      );
    }
  );

  test("accepts plain hostnames", () => {
    expect(() =>
      dev.with({ allowedHosts: ["devbox.lan", "app"] })
    ).not.toThrow();
  });
});
