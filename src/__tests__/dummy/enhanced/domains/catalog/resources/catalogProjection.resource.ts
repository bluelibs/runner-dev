import { r } from "@bluelibs/runner";

export const catalogProjectionResource = r
  .resource("catalog-projection")
  .meta({
    title: "Catalog Projection",
    description:
      "Read model placeholder for projection updates.\n\n- Tracks the last projected supplier id\n- Gives event-driven catalog updates a resource target",
  })
  .init(async () => ({
    lastProjectedSupplierId: null as string | null,
  }))
  .build();
