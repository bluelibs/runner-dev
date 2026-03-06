import { RegisterableItems, r } from "@bluelibs/runner";
import {
  CatalogSearchInputSchema,
  CatalogSearchResultSchema,
  FeaturedInspectorResultSchema,
  FeaturedTagConfigSchema,
} from "./schemas";

export const featuredTag = r
  .tag("app-examples-tags-featured")
  .for(["tasks", "resources"])
  .configSchema(FeaturedTagConfigSchema)
  .meta({
    title: "Featured Example Tag",
    description:
      "Used by the lean play demo to showcase tagged elements and tag handlers.",
  })
  .build();

export const publicCatalogResource = r
  .resource("app-examples-isolation-resources-public-catalog")
  .meta({
    title: "Public Catalog Resource",
    description:
      "Public resource matched by the isolation wildcard exports rule.",
  })
  .tags([featuredTag.with({ source: "catalog" })])
  .init(async () => ({
    items: ["starter-kit", "pro-kit"],
  }))
  .build();

export const privateCacheResource = r
  .resource("app-examples-isolation-resources-private-cache")
  .meta({
    title: "Private Cache Resource",
    description:
      "Private resource matched by the isolation wildcard deny rule for UI exploration.",
  })
  .init(async () => ({
    entries: new Map<string, unknown>(),
  }))
  .build();

export const catalogSearchTask = r
  .task("app-examples-tags-tasks-catalogSearch")
  .meta({
    title: "Catalog Search Task",
    description: "Tagged task exposed through the isolation boundary exports.",
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
  .task("app-examples-tags-tasks-featuredInspector")
  .meta({
    title: "Featured Tag Inspector",
    description:
      "Tag handler task that depends on the featured tag and summarizes tagged carriers.",
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
  .resource("app-examples-isolation-resources-boundary")
  .meta({
    title: "Isolation Boundary Resource",
    description:
      "Boundary using wildcard exports/deny rules for ResourceCard wildcard inspection.",
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
