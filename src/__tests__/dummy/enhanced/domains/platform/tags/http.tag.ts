import { r } from "@bluelibs/runner";
import { HttpTagConfigSchema } from "../../../schemas";

export const httpTag = r
  .tag("http")
  .for(["tasks", "resources"])
  .configSchema(HttpTagConfigSchema)
  .meta({
    title: "HTTP Surface",
    description:
      "Marks resources and tasks that participate in the simulated HTTP layer.\n\n- Captures route metadata for docs\n- Makes entrypoints easy to spot in topology",
  })
  .build();
