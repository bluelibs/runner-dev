import { tags, r } from "@bluelibs/runner/node";
import { LaneCatalogUpdatedPayloadSchema } from "../../../schemas";

const rpcLaneTag = (laneId: string) =>
  tags.rpcLane.with({ lane: { id: laneId } });

export const rpcLaneCatalogUpdatedEvent = r
  .event("catalog-updated")
  .meta({
    title: "Catalog Updated",
    description:
      "Signals that supplier catalog data changed.\n\n- Routed through the RPC lane graph\n- Emitted after the sync task completes",
  })
  .tags([rpcLaneTag("rpc-catalog-updates")])
  .payloadSchema(LaneCatalogUpdatedPayloadSchema)
  .build();
