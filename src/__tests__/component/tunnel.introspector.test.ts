import {
  resource,
  task,
  event,
  run,
  globals,
  type TunnelRunner,
} from "@bluelibs/runner";
import { Introspector } from "../../resources/models/Introspector";
import { initializeFromStore } from "../../resources/models/initializeFromStore";

describe("Tunnel Introspection", () => {
  // Create mock tasks and events that will be tunneled
  const remoteTask = task({
    id: "test.tasks.remote",
    run: async () => "remote result",
  });

  const exposedTask = task({
    id: "test.tasks.exposed",
    run: async () => "exposed result",
  });

  const remoteEvent = event({
    id: "test.events.remote",
  });

  // Create a mock tunnel client resource with run() and emit() functions
  const tunnelClient = resource({
    id: "test.tunnel.client",
    tags: [globals.tags.tunnel],
    init: async (): Promise<TunnelRunner> => ({
      mode: "client",
      transport: "http",
      tasks: ["test.tasks.remote"],
      events: ["test.events.remote"],
      eventDeliveryMode: "mirror",

      run: async (_task, _input) => {
        throw new Error("Mock tunnel - not actually connected");
      },

      emit: async (_event) => {
        // No-op mock
      },
    }),
  });

  // Create a mock tunnel server resource (no run() needed for server mode)
  const tunnelServer = resource({
    id: "test.tunnel.server",
    tags: [globals.tags.tunnel],
    init: async (): Promise<TunnelRunner> => ({
      mode: "server",
      transport: "http",
      tasks: ["test.tasks.exposed"],
      events: [],
    }),
  });

  test("getTunnelResources returns resources with tunnelInfo", async () => {
    const app = resource({
      id: "test.app.tunnel.1",
      register: [
        remoteTask,
        exposedTask,
        remoteEvent,
        tunnelClient,
        tunnelServer,
      ],
    });

    // Run the app without the introspector resource
    // Then create a fresh introspector after runtime completes
    const runtime = await run(app, { debug: {} });

    // Create a fresh introspector AFTER all resources are initialized
    const introspector = new Introspector({ store: runtime.store });
    initializeFromStore(introspector, runtime.store);
    introspector.populateTunnelInfo();

    const tunnelResources = introspector.getTunnelResources();
    const tunnelResourceIds = tunnelResources.map((r) => r.id);

    expect(tunnelResourceIds).toContain("test.tunnel.client");
    expect(tunnelResourceIds).toContain("test.tunnel.server");

    const clientResource = tunnelResources.find(
      (r) => r.id === "test.tunnel.client"
    );
    expect(clientResource?.tunnelInfo).toBeDefined();
    expect(clientResource?.tunnelInfo?.mode).toBe("client");
    expect(clientResource?.tunnelInfo?.transport).toBe("http");
    expect(clientResource?.tunnelInfo?.tasks).toContain("test.tasks.remote");
    expect(clientResource?.tunnelInfo?.events).toContain("test.events.remote");
    expect(clientResource?.tunnelInfo?.eventDeliveryMode).toBe("mirror");

    const serverResource = tunnelResources.find(
      (r) => r.id === "test.tunnel.server"
    );
    expect(serverResource?.tunnelInfo).toBeDefined();
    expect(serverResource?.tunnelInfo?.mode).toBe("server");
    expect(serverResource?.tunnelInfo?.tasks).toContain("test.tasks.exposed");

    await runtime.dispose();
  });

  test("getTunneledTasks returns tasks tunneled by a specific resource", async () => {
    const app = resource({
      id: "test.app.tunnel.2",
      register: [
        remoteTask,
        exposedTask,
        remoteEvent,
        tunnelClient,
        tunnelServer,
      ],
    });

    const runtime = await run(app, { debug: {} });

    const introspector = new Introspector({ store: runtime.store });
    initializeFromStore(introspector, runtime.store);
    introspector.populateTunnelInfo();

    const tunneledTasks = introspector.getTunneledTasks("test.tunnel.client");
    const tunneledTaskIds = tunneledTasks.map((t) => t.id);

    expect(tunneledTaskIds).toContain("test.tasks.remote");

    await runtime.dispose();
  });

  test("getTunnelForTask finds the tunnel resource for a tunneled task", async () => {
    const app = resource({
      id: "test.app.tunnel.3",
      register: [
        remoteTask,
        exposedTask,
        remoteEvent,
        tunnelClient,
        tunnelServer,
      ],
    });

    const runtime = await run(app, { debug: {} });

    const introspector = new Introspector({ store: runtime.store });
    initializeFromStore(introspector, runtime.store);
    introspector.populateTunnelInfo();

    const tunnel = introspector.getTunnelForTask("test.tasks.remote");
    expect(tunnel).toBeDefined();
    expect(tunnel?.id).toBe("test.tunnel.client");

    const nonExistent = introspector.getTunnelForTask("nonexistent.task");
    expect(nonExistent).toBeNull();

    await runtime.dispose();
  });
});
