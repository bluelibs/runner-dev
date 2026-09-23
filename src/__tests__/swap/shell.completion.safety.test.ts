import { completeShellScope } from "../../resources/swap.tools";

/** A Proxy that records every trap fired against it. */
function createTrappedProxy<T extends object>(target: T) {
  const firedTraps: string[] = [];
  const record =
    (trap: string) =>
    (...args: unknown[]): never => {
      firedTraps.push(trap);
      throw new Error(`trap ${trap} fired with ${args.length} args`);
    };
  const proxy = new Proxy(target, {
    get: record("get"),
    has: record("has"),
    ownKeys: record("ownKeys"),
    getOwnPropertyDescriptor: record("getOwnPropertyDescriptor"),
    getPrototypeOf: record("getPrototypeOf"),
  });
  return { proxy, firedTraps };
}

describe("completeShellScope safety", () => {
  test("lists nothing for a Proxy value without firing traps", () => {
    const { proxy, firedTraps } = createTrappedProxy({ secret: 1 });
    const options = completeShellScope(
      { r: proxy },
      { objectPath: ["r"], prefix: "", from: 0 }
    );
    expect(options).toEqual([]);
    expect(firedTraps).toEqual([]);
  });

  test("does not traverse through a Proxy", () => {
    const { proxy, firedTraps } = createTrappedProxy({ nested: { deep: 1 } });
    const options = completeShellScope(
      { r: proxy },
      { objectPath: ["r", "nested"], prefix: "", from: 0 }
    );
    expect(options).toEqual([]);
    expect(firedTraps).toEqual([]);
  });

  test("still lists a Proxy by name at its parent level", () => {
    const { proxy, firedTraps } = createTrappedProxy({});
    const options = completeShellScope(
      { client: proxy },
      { objectPath: [], prefix: "cl", from: 0 }
    );
    expect(options).toEqual([
      { label: "client", type: "variable", detail: "object" },
    ]);
    expect(firedTraps).toEqual([]);
  });

  test("stops the prototype walk at a Proxy prototype", () => {
    const { proxy, firedTraps } = createTrappedProxy({ inherited: 1 });
    const child: Record<string, unknown> = Object.create(proxy);
    child.own = 1;
    const options = completeShellScope(
      { child },
      { objectPath: ["child"], prefix: "", from: 0 }
    );
    expect(options.map((option) => option.label)).toEqual(["own"]);
    expect(firedTraps).toEqual([]);
  });

  test("does not resolve path segments through a Proxy prototype", () => {
    const { proxy, firedTraps } = createTrappedProxy({ inherited: { x: 1 } });
    const child: Record<string, unknown> = Object.create(proxy);
    const options = completeShellScope(
      { child },
      { objectPath: ["child", "inherited"], prefix: "", from: 0 }
    );
    expect(options).toEqual([]);
    expect(firedTraps).toEqual([]);
  });

  test("lists prototype getters as leaves without invoking them", () => {
    let getterCalls = 0;
    class Service {
      get status(): string {
        getterCalls += 1;
        return "up";
      }
      restart() {
        return "restarted";
      }
    }
    const scope = { svc: new Service() };

    const options = completeShellScope(scope, {
      objectPath: ["svc"],
      prefix: "",
      from: 0,
    });
    expect(options).toEqual([
      { label: "restart", type: "method", detail: "function" },
      { label: "status", type: "property" },
    ]);

    // A getter is a leaf: descending would require invoking it.
    expect(
      completeShellScope(scope, {
        objectPath: ["svc", "status"],
        prefix: "",
        from: 0,
      })
    ).toEqual([]);
    expect(getterCalls).toBe(0);
  });
});
