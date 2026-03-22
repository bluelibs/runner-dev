import { tags, r } from "@bluelibs/runner/node";
import {
  RpcPricingPreviewInputSchema,
  RpcPricingPreviewResultSchema,
} from "../../../schemas";

const rpcLaneTag = (laneId: string) =>
  tags.rpcLane.with({ lane: { id: laneId } });

export const rpcLanePricingPreviewTask = r
  .task("pricing-preview")
  .meta({
    title: "Pricing Preview",
    description:
      "Calculates a simple pricing preview through the RPC lane surface.\n\n- Models a remote pricing service call\n- Keeps the lane task easy to understand in docs",
  })
  .tags([rpcLaneTag("rpc-pricing-preview")])
  .inputSchema(RpcPricingPreviewInputSchema)
  .resultSchema(RpcPricingPreviewResultSchema)
  .run(async (input) => ({
    sku: input.sku,
    adjustedPrice: Number((input.basePrice * 1.03).toFixed(2)),
    source: "rpc-lane-task" as const,
  }))
  .build();
