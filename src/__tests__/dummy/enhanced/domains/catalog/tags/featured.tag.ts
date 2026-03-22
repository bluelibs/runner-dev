import { r } from "@bluelibs/runner";
import { FeaturedTagConfigSchema } from "../../../schemas";

export const featuredTag = r
  .tag("featured")
  .for(["tasks", "resources"])
  .configSchema(FeaturedTagConfigSchema)
  .meta({
    title: "Featured Surface",
    description:
      "Highlights the small set of catalog nodes that act as the primary demo surface.\n\n- Powers tag-based docs views\n- Keeps the public path through the app easy to follow",
  })
  .build();
