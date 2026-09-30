import { dev } from "../../resources/dev.resource";
import type { LivePersistence } from "../../resources/live/persistence";
import { sqlitePersistenceResource } from "../../resources/live/sqlitePersistence.resource";
import { r, run } from "@bluelibs/runner";
import { live } from "../../resources/live.resource";

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

  test("forwards configured and bare provider resources to the registered live service", async () => {
    const bare = r
      .resource("config-test-provider")
      .init(
        async (): Promise<LivePersistence> => ({
          load: () => ({ entries: [], lastSequence: 0 }),
          append: () => {},
        })
      )
      .build();
    for (const provider of [
      bare,
      sqlitePersistenceResource.with({ file: ":memory:" }),
    ]) {
      const configured = dev.with({ persistence: provider });
      expect(configured.config.persistence).toBe(provider);
      const root = r
        .resource("dev-config-provider-app")
        .register([configured])
        .build();
      const runtime = await run(root, { dryRun: true, shutdownHooks: false });
      try {
        expect(runtime.getResourceConfig(live).persistence).toBe(provider);
      } finally {
        await runtime.dispose();
      }
    }
  });
});
