import { r } from "@bluelibs/runner";
import { catalogSearchTask } from "../tasks/searchCatalog.task";
import { privateCacheResource } from "./catalogPrivateCache.resource";
import { publicCatalogResource } from "./catalogPublicReadModel.resource";

export const isolationBoundaryResource = r
  .resource("isolation-boundary")
  .meta({
    title: "Catalog HTTP Boundary",
    description:
      "Owns the public catalog subtree and decides what crosses into the HTTP surface.\n\n- Exports the public read model and handler\n- Keeps internal cache entries private",
  })
  .register([publicCatalogResource, privateCacheResource, catalogSearchTask])
  .isolate({
    exports: [publicCatalogResource, catalogSearchTask],
    deny: [privateCacheResource],
  })
  .build();
