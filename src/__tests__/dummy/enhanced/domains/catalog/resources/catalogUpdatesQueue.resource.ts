import { r } from "@bluelibs/runner";
import type { IEventLaneQueue } from "@bluelibs/runner/node";

export const catalogUpdatesQueueResource = r
  .resource("catalog-updates-queue")
  .meta({
    title: "Catalog Updates Queue",
    description:
      "Models the queue used by the read-model projection lane.\n\n- In-memory and deterministic\n- Makes event-lane ownership visible in topology",
  })
  .init(
    async (): Promise<IEventLaneQueue> => ({
      enqueue: async () => "message-1",
      consume: async () => undefined,
      ack: async () => undefined,
      nack: async () => undefined,
    })
  )
  .build();
