import { r } from "@bluelibs/runner";
import { eventLaneCatalogProjectionUpdatedEvent } from "../events/catalogProjectionUpdated.event";
import { rpcLaneCatalogUpdatedEvent } from "../events/catalogUpdated.event";
import { catalogProjectionResource } from "../resources/catalogProjection.resource";

export const catalogProjectionHook = r
  .hook("catalog-projection-sync")
  .meta({
    title: "Catalog Projection Sync",
    description:
      "Projects supplier updates into the public catalog read model.\n\n- Listens to catalog sync events\n- Emits a follow-up projection event for lane topology",
  })
  .on(rpcLaneCatalogUpdatedEvent)
  .dependencies({
    catalogProjectionResource,
    emitProjectionUpdated: eventLaneCatalogProjectionUpdatedEvent,
  })
  .run(async (input, { catalogProjectionResource, emitProjectionUpdated }) => {
    catalogProjectionResource.lastProjectedSupplierId = input.data.supplierId;

    await emitProjectionUpdated({
      supplierId: input.data.supplierId,
      projectedAt: new Date(),
    });
  })
  .build();
