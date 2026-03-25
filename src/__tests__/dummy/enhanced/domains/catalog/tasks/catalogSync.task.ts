import { tags, r } from "@bluelibs/runner/node";
import {
  RpcCatalogSyncInputSchema,
  RpcCatalogSyncResultSchema,
} from "../../../schemas";
import { rpcLaneCatalogUpdatedEvent } from "../events/catalogUpdated.event";

const rpcLaneTag = (laneId: string) =>
  tags.rpcLane.with({ lane: { id: laneId } });

export const rpcLaneCatalogSyncTask = r
  .task("catalog-sync")
  .meta({
    title: "Catalog Supplier Sync",
    description:
      "Pulls supplier changes and emits the catalog-updated event.\n\n- Acts like an operational sync task\n- Provides the main producer for the lane flow",
  })
  .tags([rpcLaneTag("rpc-catalog-sync")])
  .dependencies({
    emitCatalogUpdated: rpcLaneCatalogUpdatedEvent,
  })
  .inputSchema(RpcCatalogSyncInputSchema)
  .resultSchema(RpcCatalogSyncResultSchema)
  .run(async (input, { emitCatalogUpdated }) => {
    await emitCatalogUpdated({
      supplierId: input.supplierId,
      changedSkus: input.changedSkus,
      source: "catalog-sync" as const,
      updatedAt: new Date(),
    });

    return {
      supplierId: input.supplierId,
      syncedCount: input.changedSkus.length,
      emittedEvent: rpcLaneCatalogUpdatedEvent.id,
    };
  })
  .build();
