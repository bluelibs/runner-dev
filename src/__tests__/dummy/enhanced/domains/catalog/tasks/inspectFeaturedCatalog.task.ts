import { r } from "@bluelibs/runner";
import { FeaturedInspectorResultSchema } from "../../../schemas";
import { featuredTag } from "../tags/featured.tag";

export const featuredInspectorTask = r
  .task("featured-inspector")
  .meta({
    title: "Inspect Featured Catalog Surface",
    description:
      "Reads the featured tag and lists the main catalog carriers.\n\n- Helps docs explain the important path through the app\n- Keeps tag handler relationships visible",
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
