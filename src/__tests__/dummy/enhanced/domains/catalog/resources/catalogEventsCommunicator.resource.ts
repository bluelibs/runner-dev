import { r } from "@bluelibs/runner";

export const catalogEventsCommunicatorResource = r
  .resource("catalog-events-communicator")
  .meta({
    title: "Catalog Event Communicator",
    description:
      "Represents the transport binding used by catalog event fan-out.\n\n- Adds a concrete owner for lane docs\n- Intentionally side-effect free",
  })
  .init(async () => ({
    task: async (_taskId: string, _input?: unknown) => null,
    event: async (_eventId: string, _data?: unknown) => undefined,
  }))
  .build();
