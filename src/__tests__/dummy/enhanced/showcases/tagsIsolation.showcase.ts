import { RegisterableItems, r } from "@bluelibs/runner";
import {
  CatalogSearchInputSchema,
  CatalogSearchResultSchema,
  FeaturedInspectorResultSchema,
  FeaturedTagConfigSchema,
} from "./schemas";

export const featuredTag = r
  .tag("featured")
  .for(["tasks", "resources"])
  .configSchema(FeaturedTagConfigSchema)
  .meta({
    title: "Featured Tag",
    description:
      "Marks the small set of featured catalog elements.\n\n- Powers tag-based docs views\n- Gives topology a simple tagging story",
  })
  .build();

export const publicCatalogResource = r
  .resource("public-catalog")
  .meta({
    title: "Public Catalog",
    description:
      "Catalog data exposed through the isolation boundary.\n\n- Exported from the subtree\n- Small public-facing resource",
  })
  .tags([featuredTag.with({ source: "catalog" })])
  .init(async () => ({
    items: ["starter-kit", "pro-kit"],
  }))
  .build();

export const privateCacheResource = r
  .resource("private-cache")
  .meta({
    title: "Private Cache",
    description:
      "Internal cache kept behind the isolation boundary.\n\n- Denied from exports\n- Useful for subtree visibility checks",
  })
  .init(async () => ({
    entries: new Map<string, unknown>(),
  }))
  .build();

export const catalogSearchTask = r
  .task("catalog-search")
  .meta({
    title: "Catalog Search",
    description:
      "Search task exposed by the catalog boundary.\n\n- Tagged as featured\n- Exported together with the public catalog resource",
  })
  .tags([featuredTag.with({ source: "search" })])
  .inputSchema(CatalogSearchInputSchema)
  .resultSchema(CatalogSearchResultSchema)
  .run(async (input) => {
    const query = (input.query ?? "").trim();
    return {
      query,
      total: query.length === 0 ? 2 : 1,
    };
  })
  .build();

export const featuredInspectorTask = r
  .task("featured-inspector")
  .meta({
    title: "Featured Inspector",
    description:
      "Reads the featured tag and lists its carriers.\n\n- Minimal tag handler example\n- Helps blast radius show tag dependencies",
  })
  .dependencies({ featuredTag })
  .resultSchema(FeaturedInspectorResultSchema)
  .run(async (_input, { featuredTag }) => ({
    taggedTaskIds: featuredTag.tasks.map((entry) => entry.definition.id),
    taggedResourceIds: featuredTag.resources.map(
      (entry) => entry.definition.id
    ),
  }))
  .build();

export const isolationBoundaryResource = r
  .resource("isolation-boundary")
  .meta({
    title: "Catalog Boundary",
    description:
      "Owns the catalog subtree and controls what gets exported.\n\n- Exports public catalog pieces\n- Denies the private cache",
  })
  .register([publicCatalogResource, privateCacheResource, catalogSearchTask])
  .isolate({
    exports: [publicCatalogResource, catalogSearchTask],
    deny: [privateCacheResource],
  })
  .build();

export const tagsIsolationShowcaseRegistrations: RegisterableItems[] = [
  featuredTag,
  isolationBoundaryResource,
  featuredInspectorTask,
];
