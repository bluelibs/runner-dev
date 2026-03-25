import { r } from "@bluelibs/runner";

export const catalogSyncCommunicatorResource = r
  .resource("catalog-sync-communicator")
  .meta({
    title: "Catalog Sync Communicator",
    description:
      "Represents the transport binding used for supplier sync RPC calls.\n\n- Returns inert values only\n- Gives the sync lane a believable concrete owner",
  })
  .init(async () => ({
    task: async (_taskId: string, _input?: unknown) => null,
    event: async (_eventId: string, _data?: unknown) => undefined,
  }))
  .build();
