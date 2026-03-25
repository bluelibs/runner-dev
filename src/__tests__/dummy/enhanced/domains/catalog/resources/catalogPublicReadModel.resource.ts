import { r } from "@bluelibs/runner";
import { featuredTag } from "../tags/featured.tag";
import { httpTag } from "../../platform/tags/http.tag";

export const publicCatalogResource = r
  .resource("public-catalog")
  .meta({
    title: "Catalog Public Read Model",
    description:
      "Represents the public catalog view served by the HTTP layer.\n\n- Exposed through the isolation boundary\n- Gives search and docs a realistic read-model resource",
  })
  .tags([
    featuredTag.with({ source: "catalog" }),
    httpTag.with({
      method: "GET",
      path: "/catalog/search",
      visibility: "public",
    }),
  ])
  .init(async () => ({
    items: ["starter-kit", "pro-kit"],
  }))
  .build();
