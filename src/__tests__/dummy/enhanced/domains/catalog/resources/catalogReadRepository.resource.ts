import { r } from "@bluelibs/runner";
import { RepositoryConfigSchema } from "../../../schemas";
import { mikroOrmResource } from "../../platform/resources/mikroOrm.resource";

export const catalogReadRepositoryResource = r
  .resource("catalog-read-repository")
  .configSchema(RepositoryConfigSchema)
  .meta({
    title: "Catalog Read Repository",
    description:
      "Repository-style resource for catalog listings and search reads.\n\n- Depends on MikroORM\n- Makes persistence ownership visible in topology",
  })
  .dependencies({ mikroOrmResource })
  .init(async (config) => ({
    entityName: config.entityName,
    findByQuery: async (query: string) =>
      query.trim().length === 0 ? ["starter-kit", "pro-kit"] : ["starter-kit"],
  }))
  .build();
