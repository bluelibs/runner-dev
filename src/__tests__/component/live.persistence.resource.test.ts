import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { r, run } from "@bluelibs/runner";
import { resources, dev, type LivePersistence } from "../../index";
import { persistenceSourceSchema } from "../../resources/live/persistenceProvider";

function store(): LivePersistence {
  return {
    load: () => ({ entries: [], lastSequence: 0 }),
    append: () => {},
  };
}

const quietRuntime = {
  shutdownHooks: false,
  logs: { printThreshold: null },
} as const;

describe("persistence provider resources", () => {
  test("auto-registers a configured provider and its dependencies, and disposes the provider before its dependencies", async () => {
    const order: string[] = [];
    const database = r
      .resource("persistence-db")
      .init(async () => {
        order.push("database.init");
        return { connected: true };
      })
      .dispose(async () => {
        order.push("database.dispose");
      })
      .build();
    const provider = r
      .resource<{ prefix: string }>("telemetry-provider")
      .register([database])
      .dependencies({ database })
      .init(async (config, { database }): Promise<LivePersistence> => {
        expect(database.connected).toBe(true);
        expect(config.prefix).toBe("my-app");
        order.push("provider.init");
        return {
          ...store(),
          load: ({ maxEntries }) => {
            expect(maxEntries).toBe(7);
            order.push("store.load");
            return { entries: [], lastSequence: 0 };
          },
        };
      })
      .dispose(async () => {
        order.push("provider.dispose");
      })
      .isolate({ exports: "none" })
      .build();
    const configured = provider.with({ prefix: "my-app" });
    expect(dev.with({ persistence: configured }).config.persistence).toBe(
      configured
    );
    const root = r
      .resource("resource-persistence-app")
      .register([
        resources.live.with({ persistence: configured, maxEntries: 7 }),
      ])
      .build();
    const runtime = await run(root, quietRuntime);
    try {
      expect(runtime.getResourceConfig(provider)).toEqual({ prefix: "my-app" });
      expect(runtime.getResourceValue(provider).load).toBeInstanceOf(Function);
      const live = runtime.getResourceValue(resources.live);
      live.recordRun("provider-test", "TASK", 1, true);
      expect(live.getRuns()[0].nodeId).toBe("provider-test");
      expect(order).toEqual(["database.init", "provider.init", "store.load"]);
    } finally {
      await runtime.dispose();
    }
    expect(order).toEqual([
      "database.init",
      "provider.init",
      "store.load",
      "provider.dispose",
      "database.dispose",
    ]);
  });

  test("resolves a bare provider resource through Runner overrides", async () => {
    const originalLoad = jest.fn(() => store().load({ maxEntries: 10_000 }));
    const replacementLoad = jest.fn(() => store().load({ maxEntries: 10_000 }));
    const provider = r
      .resource("overridable-persistence")
      .init(
        async (): Promise<LivePersistence> => ({
          ...store(),
          load: originalLoad,
        })
      )
      .build();
    const override = r.override(
      provider,
      async (): Promise<LivePersistence> => ({
        ...store(),
        load: replacementLoad,
      })
    );
    const root = r
      .resource("override-persistence-app")
      .register([resources.live.with({ persistence: provider })])
      .overrides([override])
      .build();
    const runtime = await run(root, quietRuntime);
    try {
      expect(originalLoad).not.toHaveBeenCalled();
      expect(replacementLoad).toHaveBeenCalledWith({ maxEntries: 10_000 });
    } finally {
      await runtime.dispose();
    }
  });

  test("restores capped history from the built-in SQLite resource across runtimes", async () => {
    const directory = mkdtempSync(
      join(tmpdir(), "runner-dev-resource-sqlite-")
    );
    try {
      const configured = resources.sqlitePersistence.with({
        file: join(directory, "telemetry.sqlite"),
      });
      const root = r
        .resource("sqlite-resource-app")
        .register([
          resources.live.with({ persistence: configured, maxEntries: 2 }),
        ])
        .build();
      const first = await run(root, quietRuntime);
      try {
        const live = first.getResourceValue(resources.live);
        for (let index = 0; index < 4; index++)
          live.recordRun(`persisted-${index}`, "TASK", 1, true);
        live.recordError("unknown-error", "INTERNAL", undefined);
      } finally {
        await first.dispose();
      }
      const second = await run(root, quietRuntime);
      try {
        expect(
          second
            .getResourceValue(resources.live)
            .getRuns()
            .map((entry) => entry.nodeId)
        ).toEqual(["persisted-2", "persisted-3"]);
        expect(
          second.getResourceValue(resources.live).getErrors()[0].message
        ).toBe("undefined");
      } finally {
        await second.dispose();
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test("fails startup for a resource whose override returns an invalid adapter", async () => {
    const provider = r
      .resource("invalid-provider")
      .init(async (): Promise<LivePersistence> => store())
      .build();
    // An untyped override can bypass the compile-time provider contract.
    // @ts-expect-error Deliberately simulate an invalid JavaScript override.
    const override = r.override(provider, async () => undefined);
    const root = r
      .resource("invalid-provider-app")
      .register([resources.live.with({ persistence: provider })])
      .overrides([override])
      .build();
    await expect(run(root, quietRuntime)).rejects.toThrow(
      "must return a store"
    );
  });

  test("rejects a provider missing append() at startup and cleans up through Runner", async () => {
    const dispose = jest.fn();
    const invalid = persistenceSourceSchema.parse(
      r
        .resource("partial-store")
        .init(async () => ({ load: () => ({ entries: [], lastSequence: 0 }) }))
        .dispose(dispose)
        .build()
    );
    const root = r
      .resource("partial-store-app")
      .register([resources.live.with({ persistence: invalid })])
      .build();
    await expect(run(root, quietRuntime)).rejects.toThrow(
      "must return a store"
    );
    expect(dispose).toHaveBeenCalledTimes(1);
  });

  test("rejects async JavaScript writes without publishing their uncommitted entry", async () => {
    const invalid = persistenceSourceSchema.parse(
      r
        .resource("async-store")
        .init(async () => ({
          ...store(),
          append: (record: { kind: string }) =>
            record.kind === "run"
              ? Promise.reject(new Error("late write failure"))
              : undefined,
        }))
        .build()
    );
    const root = r
      .resource("async-write-app")
      .register([resources.live.with({ persistence: invalid })])
      .build();
    const runtime = await run(root, quietRuntime);
    try {
      const live = runtime.getResourceValue(resources.live);
      const listener = jest.fn();
      live.onRecord(listener);
      expect(() => live.recordRun("uncommitted", "TASK", 1, true)).toThrow(
        "commit synchronously"
      );
      expect(live.getRuns()).toEqual([]);
      expect(listener).not.toHaveBeenCalled();
      await Promise.resolve();
    } finally {
      await runtime.dispose();
    }
  });
});
