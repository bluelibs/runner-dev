import { r } from "@bluelibs/runner";
import { LaneCatalogProjectionUpdatedPayloadSchema } from "../../../schemas";

export const eventLaneCatalogProjectionUpdatedEvent = r
  .event("catalog-projection-updated")
  .meta({
    title: "Catalog Projection Updated",
    description:
      "Signals that the catalog read model caught up with a supplier update.\n\n- Consumed through the event-lane example\n- Gives hooks and lanes a believable projection story",
  })
  .payloadSchema(LaneCatalogProjectionUpdatedPayloadSchema)
  .build();
