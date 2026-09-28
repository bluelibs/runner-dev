import { mapStoreResourceToResourceModel } from "../../resources/models/initializeFromStore.utils";

// Only the Store members the resource mapper reads; the owner lookup finds
// no parent, so middleware provenance stays local.
function fakeStore(overrides: Record<string, unknown> = {}) {
  return {
    mode: "dev",
    getOwnerResourceId: () => undefined,
    resources: new Map(),
    ...overrides,
  } as any;
}

function fakeResource(overrides: Record<string, unknown> = {}) {
  return {
    id: "test-mapper-resource",
    register: [],
    overrides: [],
    middleware: [],
    ...overrides,
  } as any;
}

describe("mapStoreResourceToResourceModel", () => {
  test("passes the store mode to register/overrides fns", () => {
    const seen: unknown[] = [];
    const resource = fakeResource({
      register: (_config: unknown, mode: unknown) => {
        seen.push(mode);
        return [];
      },
      overrides: (_config: unknown, mode: unknown) => {
        seen.push(mode);
        return [];
      },
    });

    mapStoreResourceToResourceModel(
      resource,
      undefined,
      fakeStore({ mode: "prod", getMiddlewareManager: () => ({}) })
    );

    expect(seen).toEqual(["prod", "prod"]);
  });

  test("falls back to dev mode without a store", () => {
    let seen: unknown;
    const resource = fakeResource({
      register: (_config: unknown, mode: unknown) => {
        seen = mode;
        return [];
      },
    });

    const mapped = mapStoreResourceToResourceModel(resource);

    expect(seen).toBe("dev");
    expect(mapped.registers).toEqual([]);
  });

  test("degrades to empty lists when register/overrides fns throw", () => {
    const resource = fakeResource({
      register: () => {
        throw new Error("mode-sensitive boom");
      },
      overrides: () => {
        throw new Error("mode-sensitive boom");
      },
    });

    const mapped = mapStoreResourceToResourceModel(resource);

    expect(mapped.registers).toEqual([]);
    expect(mapped.overrides).toEqual([]);
  });

  test("degrades to empty lists when register fns return non-arrays", () => {
    const resource = fakeResource({
      register: () => ({ id: "not-a-list" }),
      overrides: () => "nope",
    });

    const mapped = mapStoreResourceToResourceModel(resource);

    expect(mapped.registers).toEqual([]);
    expect(mapped.overrides).toEqual([]);
  });

  test("resolves the effective resource middleware stack via the store", () => {
    const resource = fakeResource({
      middleware: [{ id: "mw-local" }],
    });

    const mapped = mapStoreResourceToResourceModel(
      resource,
      undefined,
      fakeStore({
        getMiddlewareManager: () => ({
          middlewareResolver: {
            getApplicableResourceMiddlewares: () => [
              { id: "mw-everywhere" },
              { id: "mw-local", config: { retries: 1 } },
            ],
          },
        }),
      })
    );

    expect(mapped.middleware).toEqual(["mw-everywhere", "mw-local"]);
    expect(mapped.middlewareDetailed).toEqual([
      {
        id: "mw-everywhere",
        config: null,
        origin: "local",
        subtreeOwnerId: null,
      },
      {
        id: "mw-local",
        config: '{"retries":1}',
        origin: "local",
        subtreeOwnerId: null,
      },
    ]);
  });

  test("falls back to local resource middleware when resolution fails", () => {
    const resource = fakeResource({
      middleware: [{ id: "mw-local" }],
    });

    const throwing = mapStoreResourceToResourceModel(
      resource,
      undefined,
      fakeStore({
        getMiddlewareManager: () => ({
          middlewareResolver: {
            getApplicableResourceMiddlewares: () => {
              throw new Error("subtree conflict");
            },
          },
        }),
      })
    );
    expect(throwing.middleware).toEqual(["mw-local"]);

    const missingFn = mapStoreResourceToResourceModel(
      resource,
      undefined,
      fakeStore({ getMiddlewareManager: () => ({ middlewareResolver: {} }) })
    );
    expect(missingFn.middleware).toEqual(["mw-local"]);

    const nonObjectResolver = mapStoreResourceToResourceModel(
      resource,
      undefined,
      fakeStore({ getMiddlewareManager: () => ({ middlewareResolver: 42 }) })
    );
    expect(nonObjectResolver.middleware).toEqual(["mw-local"]);

    const missingManager = mapStoreResourceToResourceModel(
      resource,
      undefined,
      fakeStore()
    );
    expect(missingManager.middleware).toEqual(["mw-local"]);

    const nonArray = mapStoreResourceToResourceModel(
      resource,
      undefined,
      fakeStore({
        getMiddlewareManager: () => ({
          middlewareResolver: {
            getApplicableResourceMiddlewares: () => ({ oops: true }),
          },
        }),
      })
    );
    expect(nonArray.middleware).toEqual(["mw-local"]);
  });

  test("drops register/overrides entries without an id", () => {
    const resource = fakeResource({
      register: () => [null, "bare-string", { id: "ok-task" }, { noId: true }],
      overrides: () => [{ id: "ok-override" }, undefined],
    });

    const mapped = mapStoreResourceToResourceModel(resource);

    expect(mapped.registers).toEqual(["ok-task"]);
    expect(mapped.overrides).toEqual(["ok-override"]);
  });

  // Runner rejects these shapes at run(), so they only reach the mapper via
  // hand-built definitions; the static form must degrade like the fn form.
  test("drops static register/overrides entries without an id", () => {
    const resource = fakeResource({
      register: [
        null,
        "bare-string",
        { id: "ok-task" },
        { noId: true },
        { id: 7 },
      ],
      overrides: [{}, null, undefined, { id: "ok-override" }],
    });

    const mapped = mapStoreResourceToResourceModel(resource);

    expect(mapped.registers).toEqual(["ok-task"]);
    expect(mapped.overrides).toEqual(["ok-override"]);
  });

  test("reads missing register/overrides declarations as empty", () => {
    const mapped = mapStoreResourceToResourceModel(
      fakeResource({ register: undefined, overrides: undefined })
    );

    expect(mapped.registers).toEqual([]);
    expect(mapped.overrides).toEqual([]);
  });
});
