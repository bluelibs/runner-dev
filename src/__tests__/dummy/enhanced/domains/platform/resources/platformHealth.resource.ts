import { r } from "@bluelibs/runner";
import { databaseResource } from "./database.resource";
import { httpServerResource } from "./httpServer.resource";
import { mikroOrmResource } from "./mikroOrm.resource";

export const platformHealthResource = r
  .resource("platform-health")
  .meta({
    title: "Platform Health",
    description:
      "Aggregates the main platform infrastructure into one operational node.\n\n- Depends on server, database, and ORM\n- Provides a believable health/ops surface in docs",
  })
  .dependencies({
    httpServerResource,
    databaseResource,
    mikroOrmResource,
  })
  .init(async () => ({
    checks: ["http-server", "database", "mikro-orm"],
  }))
  .build();
