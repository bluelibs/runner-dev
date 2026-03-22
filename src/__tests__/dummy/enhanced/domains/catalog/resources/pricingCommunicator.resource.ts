import { r } from "@bluelibs/runner";

export const pricingCommunicatorResource = r
  .resource("pricing-communicator")
  .meta({
    title: "Pricing Communicator",
    description:
      "Represents the transport binding for pricing RPC traffic.\n\n- No real network transport\n- Exists to make the lane topology feel like a production deployment",
  })
  .init(async () => ({
    task: async (_taskId: string, _input?: unknown) => null,
    event: async (_eventId: string, _data?: unknown) => undefined,
  }))
  .build();
