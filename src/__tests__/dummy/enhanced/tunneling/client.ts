import { r, run, globals, ITask } from "@bluelibs/runner";

// ====================
// TUNNEL CLIENT CONFIGURATION
// ====================

export const tunnelClient = r
  .resource("app.tunnel.client")
  .tags([globals.tags.tunnel])
  .dependencies({ clientFactory: globals.resources.httpClientFactory })
  .init(async (_config, { clientFactory }) => ({
    mode: "client" as const,
    transport: "http" as const,
    tasks: (task: ITask<any, any, any>) => task.id.startsWith("remote.tasks."),
    client: clientFactory({
      baseUrl:
        process.env.REMOTE_RUNNER_URL ||
        "http://localhost:7070/__remote-runner",
    }),
  }))
  .build();

// Simple demo tasks that use tunneling
export const enhancedRegisterUserTask = r
  .task("app.tasks.enhancedRegisterUser")
  .dependencies({ tunnelClient })
  .run(async (_input: unknown, { tunnelClient }) => {
    const tunnel = tunnelClient.client;
    await tunnel.task("remote.tasks.fraudDetection", {});
    return { userId: `user_${Date.now()}` };
  })
  .build();

export const enhancedProductSyncTask = r
  .task("app.tasks.enhancedProductSync")
  .dependencies({ tunnelClient })
  .run(async (_input: unknown, { tunnelClient }) => {
    const tunnel = tunnelClient.client;
    await tunnel.task("remote.tasks.fetchExternalInventory", {});
    return { syncedProducts: 1, totalAvailable: 100 };
  })
  .build();

export const enhancedProcessOrderTask = r
  .task("app.tasks.enhancedProcessOrder")
  .run(async (input: { orderId: string }) => ({
    orderId: input.orderId,
    paymentStatus: "approved",
  }))
  .build();

export const generateBusinessReportTask = r
  .task("app.tasks.generateBusinessReport")
  .dependencies({ tunnelClient })
  .run(async (_input: unknown, { tunnelClient }) => {
    const tunnel = tunnelClient.client;
    await tunnel.task("remote.tasks.generateReport", {});
    return { reportId: `report_${Date.now()}`, downloadUrl: "#" };
  })
  .build();

// Client application
export const tunnelClientApp = r
  .resource("app.tunnelClient")
  .register([
    tunnelClient,
    enhancedRegisterUserTask,
    enhancedProductSyncTask,
    enhancedProcessOrderTask,
    generateBusinessReportTask,
  ])
  .init(async () => {
    console.log("🔗 Tunnel Client Application initialized");
    return {};
  })
  .build();

export async function startTunnelClient() {
  const runtime = await run(tunnelClientApp, { debug: "verbose" });

  process.on("SIGINT", async () => {
    await runtime.dispose();
    process.exit(0);
  });

  return runtime;
}

if (require.main === module) {
  startTunnelClient().catch(console.error);
}
