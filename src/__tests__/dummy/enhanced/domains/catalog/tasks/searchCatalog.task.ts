import { r } from "@bluelibs/runner";
import {
  CatalogSearchInputSchema,
  CatalogSearchResultSchema,
} from "../../../schemas";
import { supportRequestContextMiddleware } from "../../platform/middleware/httpRequestContext.taskMiddleware";
import { httpTag } from "../../platform/tags/http.tag";
import { catalogReadRepositoryResource } from "../resources/catalogReadRepository.resource";
import { featuredTag } from "../tags/featured.tag";

export const catalogSearchTask = r
  .task("catalog-search")
  .meta({
    title: "Search Catalog",
    description:
      "HTTP-facing search handler for the catalog read path.\n\n- Validates request-shaped input\n- Uses repository and request middleware like a real endpoint",
  })
  .tags([
    featuredTag.with({ source: "search" }),
    httpTag.with({
      method: "GET",
      path: "/catalog/search",
      visibility: "public",
    }),
  ])
  .middleware([supportRequestContextMiddleware])
  .dependencies({ catalogReadRepositoryResource })
  .inputSchema(CatalogSearchInputSchema)
  .resultSchema(CatalogSearchResultSchema)
  .run(async (input, { catalogReadRepositoryResource }) => {
    const query = (input.query ?? "").trim();
    const results = await catalogReadRepositoryResource.findByQuery(query);

    return {
      query,
      total: results.length,
      source: "catalog-http-handler" as const,
    };
  })
  .build();
