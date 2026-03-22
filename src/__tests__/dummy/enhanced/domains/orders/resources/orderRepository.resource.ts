import { r } from "@bluelibs/runner";
import { RepositoryConfigSchema } from "../../../schemas";
import { mikroOrmResource } from "../../platform/resources/mikroOrm.resource";

export const orderRepositoryResource = r
  .resource("order-repository")
  .configSchema(RepositoryConfigSchema)
  .meta({
    title: "Order Repository",
    description:
      "Repository-style resource for order review and approval records.\n\n- Depends on MikroORM\n- Gives the durable workflow a persistence owner",
  })
  .dependencies({ mikroOrmResource })
  .init(async (config) => ({
    entityName: config.entityName,
    loadById: async (orderId: string) => ({
      orderId,
      status: "pending-review" as const,
    }),
  }))
  .build();
